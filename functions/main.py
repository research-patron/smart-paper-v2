import functions_framework
from flask import Flask, jsonify, Request
from google.cloud import firestore
from google.cloud import storage
from google.cloud import secretmanager
from google.oauth2 import service_account
import datetime
import json
import os
import logging
import time
import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from dateutil.relativedelta import relativedelta

# 自作モジュールのインポート
from process_pdf import (
    process_all_chapters,
    process_content,
    extract_json_from_response
)
from error_handling import (
    log_error,
    log_info,
    log_warning,
    APIError,
    ValidationError,
    AuthenticationError,
    NotFoundError
)
from performance import (
    start_timer, 
    stop_timer, 
    add_step, 
    save_translated_text, 
    save_summary_text
)

# StripeのCloud Functionsをインポート
from stripe_functions import (
    create_stripe_checkout,
    cancel_stripe_subscription,
    update_payment_method,
    stripe_webhook
)

# 管理者向け機能をインポート
from admin_functions import (
    share_paper_with_admin
)

# ロギング設定
logging.basicConfig(level=logging.INFO)

# プロジェクトID
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = os.environ.get("FUNCTION_REGION", "us-central1")
BUCKET_NAME = os.environ.get("BUCKET_NAME", f"{PROJECT_ID}.appspot.com")

# Firebase Admin SDK初期化
try:
    # Firebase Admin SDKの初期化（既に初期化されていたら例外をキャッチ）
    try:
        firebase_app = firebase_admin.initialize_app()
        log_info("Firebase", "Firebase Admin SDK initialized successfully")
    except ValueError:
        # 既に初期化されている場合
        log_info("Firebase", "Firebase Admin SDK already initialized")
        firebase_app = firebase_admin.get_app()
except Exception as e:
    log_error("FirebaseError", f"Failed to initialize Firebase Admin SDK: {str(e)}")
    raise

# Secret Managerからサービスアカウント認証情報を取得
def get_credentials(secret_name="firebase-credentials"):
    try:
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{PROJECT_ID}/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        credentials_json = response.payload.data.decode("UTF-8")

        # JSON形式の認証情報を辞書に変換
        credentials_info = json.loads(credentials_json)

        # サービスアカウント認証情報を作成
        credentials = service_account.Credentials.from_service_account_info(credentials_info)
        return credentials
    except Exception as e:
        log_error("CredentialsError", f"Failed to get credentials from Secret Manager: {str(e)} (secret: {secret_name})")
        # エラー時はデフォルトの認証情報を返す（開発環境のフォールバック）
        return None

# 認証情報を使用してクライアントを初期化
try:
    credentials = get_credentials()
    db = firestore.Client(credentials=credentials) if credentials else firestore.Client()
    storage_client = storage.Client(credentials=credentials) if credentials else storage.Client()
except Exception as e:
    log_error("ClientInitError", f"Failed to initialize clients: {str(e)}")
    # フォールバック
    db = firestore.Client()
    storage_client = storage.Client()

def handle_api_error(error: APIError):
    """APIエラーをHTTPレスポンスに変換"""
    return jsonify(error.to_dict()), error.status_code

# Firebaseの認証トークンを検証し、ユーザーIDを取得する関数
def verify_firebase_token(request: Request):
    """
    リクエストヘッダーからFirebase認証トークンを取得・検証し、ユーザーIDを返す
    
    Args:
        request: Flaskのリクエストオブジェクト
    
    Returns:
        str: 検証されたユーザーID、または認証情報がない場合はNone
    """
    user_id = None
    
    try:
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]  # 'Bearer 'の後の部分を取得
                try:
                    # Firebase Admin SDKを使用してIDトークンを検証
                    decoded_token = firebase_auth.verify_id_token(token)
                    user_id = decoded_token['uid']
                    log_info("Auth", f"Successfully verified user token: {user_id}")
                except Exception as e:
                    log_error("AuthError", "Invalid ID token", {"error": str(e)})
                    raise AuthenticationError("Invalid ID token")
    except AuthenticationError:
        raise
    except Exception as e:
        log_error("AuthError", "Error verifying token", {"error": str(e)})
    
    return user_id

# 認証が必要なメソッドを強制する関数を追加
def require_authentication(request: Request):
    """
    リクエストから認証情報を取得し、未認証の場合は例外をスロー
    
    Args:
        request: Flaskのリクエストオブジェクト
        
    Returns:
        str: 認証済みユーザーID
        
    Raises:
        AuthenticationError: 認証情報がない、または無効な場合
    """
    user_id = verify_firebase_token(request)
    
    if not user_id:
        log_error("AuthError", "Authentication required", {"path": request.path})
        raise AuthenticationError("このAPIを使用するには認証が必要です")
        
    return user_id

# 翻訳数制限のチェックと更新を行う関数
def check_and_update_translation_limit(user_id: str, check_only: bool = False):
    """
    ユーザーの翻訳数制限をチェックし、必要に応じて更新する
    
    Args:
        user_id: ユーザーID
        check_only: True の場合はチェックのみを行い、カウントの更新は行わない
        
    Returns:
        bool: 翻訳が許可される場合は True、それ以外は False
        
    Raises:
        ValidationError: 翻訳数制限に達している場合
    """
    user_ref = db.collection("users").document(user_id)
    user_doc = user_ref.get()
    user_data = user_doc.to_dict()
    
    if not user_data:
        log_warning("TranslationLimit", f"User data not found for user: {user_id}")
        # ユーザーデータがない場合は制限なしとする
        return True
    
    # 現在の日時
    now = datetime.datetime.now()
    
    # 翻訳期間のチェック
    translation_period_start = user_data.get("translation_period_start")
    translation_period_end = user_data.get("translation_period_end")
    
    # 期間が設定されていないか、期間が終了している場合は新しい期間を設定
    if not translation_period_start or not translation_period_end or translation_period_end.replace(tzinfo=None) < now:
        # 新しい期間を設定 (1ヶ月間)
        new_period_start = now
        new_period_end = now + relativedelta(months=1)  # 1ヶ月後
        
        if not check_only:
            # Firestoreを更新
            user_ref.update({
                "translation_period_start": new_period_start,
                "translation_period_end": new_period_end,
                "translation_count": 0  # カウントをリセット
            })
            log_info("TranslationLimit", f"Reset translation period for user: {user_id}")
        
        # 期間をリセットしたので、翻訳を許可
        return True
    
    # 無料会員の場合のみ翻訳数をチェック
    if user_data.get("subscription_status") != "paid":
        translation_count = user_data.get("translation_count", 0)
        
        # 月3件の上限に達している場合はエラー
        if translation_count >= 3:
            log_warning("TranslationLimit", f"User {user_id} has reached the translation limit (3/month)")
            raise ValidationError("月間翻訳数の上限（3件）に達しました。プレミアムプランにアップグレードすると無制限に翻訳できます。")
    
    # カウントの更新が必要な場合（プレミアムユーザーを含むすべてのユーザー）
    if not check_only:
        # トランザクションを使用して確実に更新
        transaction = db.transaction()
        
        @firestore.transactional
        def update_in_transaction(transaction, user_ref):
            # 最新のデータを取得
            user_snapshot = user_ref.get(transaction=transaction)
            user_data = user_snapshot.to_dict()
            
            # 最新の翻訳数
            current_count = user_data.get("translation_count", 0)
            
            # カウントを更新（プレミアムユーザーを含む全ユーザー）
            transaction.update(user_ref, {
                "translation_count": current_count + 1,
                "updated_at": datetime.datetime.now()
            })
            
            log_info("TranslationLimit", f"Updated translation count for user {user_id}: {current_count + 1}")
            return True
        
        # トランザクションで更新を実行
        update_in_transaction(transaction, user_ref)
    
    return True

@functions_framework.http
def process_pdf(request: Request):
    """
    PDFアップロードを受け付け、Cloud Storageへの保存、メタデータ抽出、直列処理を行う
    """
    # 処理時間測定開始
    session_id, temp_paper_id = start_timer("process_pdf")
    paper_id = None
    user_id = None
    
    try:
        # CORSヘッダーの設定
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)

        headers = {
            'Access-Control-Allow-Origin': '*'
        }

        # リクエストのバリデーション
        if not request.method == "POST":
            raise ValidationError("Method not allowed")

        if not request.files or "file" not in request.files:
            raise ValidationError("No file uploaded")
            
        add_step(session_id, temp_paper_id, "validation_complete", {"method": request.method})

        pdf_file = request.files["file"]
        if not pdf_file.filename.lower().endswith(".pdf"):
            raise ValidationError("Invalid file type. Only PDF files are allowed.")

        content_length = request.content_length or 0
        if content_length > 20 * 1024 * 1024:  # 20MB limit
            raise ValidationError("File too large. Maximum size is 20MB.")
            
        add_step(session_id, temp_paper_id, "file_validation_complete", {"file_size": content_length, "filename": pdf_file.filename})

        # 認証を必須に変更 - 認証なしでは処理を続行しない
        user_id = require_authentication(request)
        add_step(session_id, temp_paper_id, "auth_complete", {"user_id": user_id})

        # 翻訳数制限のチェック（更新はまだしない - check_only=True）
        check_and_update_translation_limit(user_id, check_only=True)
        add_step(session_id, temp_paper_id, "translation_limit_check_complete", {"user_id": user_id})

        # Cloud StorageにPDFを保存
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S-%f")
        file_name = f"{timestamp}_{pdf_file.filename}"
        blob = storage_client.bucket(BUCKET_NAME).blob(f"papers/{file_name}")
        
        upload_start = time.time()
        blob.upload_from_file(pdf_file, content_type="application/pdf")
        upload_time_sec = time.time() - upload_start
        
        pdf_gs_path = f"gs://{BUCKET_NAME}/papers/{file_name}"
        add_step(session_id, temp_paper_id, "storage_upload_complete", 
                {"pdf_gs_path": pdf_gs_path}, 
                upload_time_sec * 1000)  # このAPIはまだミリ秒を受け取る

        log_info("Storage", f"Uploaded PDF to {pdf_gs_path}")

        # Firestoreにドキュメントを作成
        doc_ref = db.collection("papers").document()
        doc_ref.set({
            "user_id": user_id,  # 認証されたユーザーIDを保存
            "file_path": pdf_gs_path,
            "status": "pending",
            "uploaded_at": datetime.datetime.now(),
            "completed_at": None,
            "metadata": None,
            "chapters": None,
            "summary": "",
            "translated_text": None,
            "translated_text_path": None,
            "progress": 0
        })
        paper_id = doc_ref.id
        
        # 一時IDではなく実際のpaper_idに関連付け
        add_step(session_id, paper_id, "firestore_document_created", {"paper_id": paper_id})

        log_info("Firestore", f"Created paper document with ID: {paper_id}")

        # 翻訳数制限カウントを更新（check_only=False）
        # カウント更新に成功した場合のみ処理を続行する
        check_and_update_translation_limit(user_id, check_only=False)
        add_step(session_id, paper_id, "translation_limit_updated", {"user_id": user_id})

        # バックグラウンド処理を起動
        try:
            log_info("ProcessPDF", f"Starting background processing for paper {paper_id}")
            doc_ref.update({
                "processing_started": True,
                "status": "pending"
            })
            add_step(session_id, paper_id, "background_processing_started")
        except Exception as e:
            log_error("BackgroundProcessingError", "Failed to start background processing", {"error": str(e)})
            add_step(session_id, paper_id, "background_processing_failed", {"error": str(e)})

        response = jsonify({"paper_id": paper_id}), 200, headers
        
        # 処理時間の記録
        stop_timer(session_id, paper_id)
        
        return response

    except APIError as e:
        log_error("APIError", e.message, {"details": e.details})
        # 処理時間の記録（エラー発生時）
        target_paper_id = paper_id if paper_id else temp_paper_id
        stop_timer(session_id, target_paper_id, False, f"{e.__class__.__name__}: {e.message}")
        return handle_api_error(e)
    except Exception as e:
        log_error("UnhandledError", "An internal server error occurred", {"error": str(e)})
        # 処理時間の記録（エラー発生時）
        target_paper_id = paper_id if paper_id else temp_paper_id
        stop_timer(session_id, target_paper_id, False, f"UnhandledException: {str(e)}")
        return jsonify({"error": "An internal server error occurred."}), 500, headers

@functions_framework.http
def process_pdf_background(request: Request):
    """
    PDF処理を非同期的に実行する（メタデータ抽出のみ同期処理、翻訳と要約はCloud Tasksで非同期処理）
    """
    # 処理時間測定開始
    session_id, temp_paper_id = start_timer("process_pdf_background")
    paper_id = None
    
    try:
        # CORSヘッダーの設定
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)

        headers = {'Access-Control-Allow-Origin': '*'}

        request_json = request.get_json(silent=True)
        if not request_json:
            raise ValidationError("No JSON payload received")

        paper_id = request_json.get("paper_id")
        if not paper_id:
            raise ValidationError("Paper ID is required")
            
        add_step(session_id, paper_id, "request_validation_complete", {"paper_id": paper_id})

        # 認証を必須に変更 - 認証なしでは処理を続行しない
        user_id = require_authentication(request)
        log_info("Auth", f"Background process initiated by authenticated user: {user_id}")
        add_step(session_id, paper_id, "auth_complete", {"user_id": user_id})

        # 論文ドキュメントを取得
        doc_ref = db.collection("papers").document(paper_id)
        paper_data = doc_ref.get().to_dict()

        if not paper_data:
            raise NotFoundError(f"Paper with ID {paper_id} not found")
            
        # 権限チェック：paper.user_id とリクエストユーザーIDが一致することを確認
        paper_owner_id = paper_data.get("user_id")
        if paper_owner_id != user_id:
            log_error("AuthError", "User is not authorized to access this paper", 
                     {"user_id": user_id, "paper_id": paper_id, "paper_owner_id": paper_owner_id})
            raise AuthenticationError("この論文へのアクセス権限がありません")

        pdf_gs_path = paper_data.get("file_path")
        if not pdf_gs_path:
            raise ValidationError("PDF file path is missing")
            
        add_step(session_id, paper_id, "paper_data_retrieved", {"pdf_gs_path": pdf_gs_path})

        # 既に処理が完了している場合はスキップ
        if paper_data.get("status") == "completed":
            add_step(session_id, paper_id, "paper_already_completed")
            response = jsonify({"message": "Paper already processed", "paper_id": paper_id}), 200, headers
            # 処理時間の記録
            stop_timer(session_id, paper_id, True)
            return response

        # 現在の状態を確認
        current_status = paper_data.get("status", "pending")
        
        # メタデータ抽出済みならスキップする
        if current_status == "pending" or not paper_data.get("metadata"):
            # メタデータと章構成を抽出（この部分は同期処理で行う）
            log_info("ProcessPDFBackground", f"Extracting metadata and chapters", {"paper_id": paper_id})
            
            # 処理中ステータスに更新
            doc_ref.update({
                "status": "metadata_extracted",
                "progress": 10
            })
            
            metadata_start = time.time()
            result = process_content(pdf_gs_path, paper_id, "extract_metadata_and_chapters")
            metadata_time_sec = time.time() - metadata_start
            
            add_step(session_id, paper_id, "metadata_extraction_complete", 
                    {"chapters_count": len(result.get("chapters", []))}, 
                    metadata_time_sec * 1000)

            # Firestoreに結果を保存
            doc_ref.update({
                "metadata": result.get("metadata", {}),
                "chapters": result.get("chapters", []),
                "status": "metadata_extracted",
                "progress": 20
            })

            log_info("ProcessPDFBackground", f"Metadata extraction completed", {"paper_id": paper_id})
        else:
            # メタデータが既に抽出済み
            result = {
                "chapters": paper_data.get("chapters", [])
            }
            add_step(session_id, paper_id, "metadata_already_extracted", 
                    {"chapters_count": len(result.get("chapters", []))})

        # すべての章のリストを取得
        chapters = result.get("chapters", [])
        if not chapters:
            log_warning("ProcessPDFBackground", f"No chapters found", {"paper_id": paper_id})
            
            # 章がない場合は完了とするか、要約のみ実行する
            doc_ref.update({
                "status": "processing",
                "progress": 50
            })
            
            add_step(session_id, paper_id, "no_chapters_found_starting_summary")
            
            # 要約のみのタスクを作成
            from cloud_tasks import create_paper_summary_task
            create_paper_summary_task(paper_id)
            
            response = jsonify({
                "message": "No chapters found, summary task scheduled",
                "paper_id": paper_id
            }), 200, headers
            
            # 処理時間の記録
            stop_timer(session_id, paper_id, True)
            return response

        # --- 非同期処理のための変更開始 ---
        
        # 各章の翻訳タスクをCloud Tasksに登録
        task_ids = []
        from cloud_tasks import create_paper_translation_task
        
        for chapter in chapters:
            task_id = create_paper_translation_task(paper_id, chapter)
            task_ids.append(task_id)
            
            # タスク作成間隔を空ける（レート制限対策）
            time.sleep(0.2)
        
        add_step(session_id, paper_id, "translation_tasks_created", 
                {"tasks_count": len(task_ids)})
        
        # 処理完了チェックタスクを登録（最初のチェックは30秒後）
        from cloud_tasks import create_completion_check_task
        completion_task_id = create_completion_check_task(paper_id, 30)
        
        add_step(session_id, paper_id, "completion_check_task_created", 
                {"task_id": completion_task_id})
        
        log_info("ProcessPDFBackground", f"All tasks created successfully",
                {"paper_id": paper_id, "chapters_count": len(chapters)})

        response = jsonify({
            "message": "Processing tasks scheduled",
            "paper_id": paper_id,
            "chapters_count": len(chapters),
            "translation_tasks": len(task_ids),
            "completion_check_task": completion_task_id
        }), 200, headers
        
        # 処理時間の記録
        stop_timer(session_id, paper_id, True)
        
        return response

    except APIError as e:
        log_error("APIError", e.message, {"details": e.details})
        if paper_id:
            try:
                db.collection("papers").document(paper_id).update({
                    "status": "error",
                    "error_message": e.message,
                    "progress": 0  # エラー時は進捗を0に戻す
                })
            except Exception as db_error:
                log_error("FirestoreError", "Failed to update Firestore status", {"error": str(db_error)})
        
        # 処理時間の記録（エラー発生時）
        target_paper_id = paper_id if paper_id else temp_paper_id
        stop_timer(session_id, target_paper_id, False, f"{e.__class__.__name__}: {e.message}")
        
        return jsonify(e.to_dict()), e.status_code, headers

    except Exception as e:
        log_error("UnhandledError", "An internal server error occurred", {"error": str(e)})
        if paper_id:
            try:
                db.collection("papers").document(paper_id).update({
                    "status": "error",
                    "error_message": str(e),
                    "progress": 0  # エラー時は進捗を0に戻す
                })
            except Exception as db_error:
                log_error("FirestoreError", "Failed to update Firestore status", {"error": str(db_error)})
        
        # 処理時間の記録（エラー発生時）
        target_paper_id = paper_id if paper_id else temp_paper_id
        stop_timer(session_id, target_paper_id, False, f"UnhandledException: {str(e)}")
        
        return jsonify({"error": "An internal server error occurred"}), 500, headers

@functions_framework.http
def get_signed_url(request: Request):
    """
    Cloud StorageのファイルへのURLを取得する
    公開論文の場合は認証なしでもアクセス可能
    """
    # 処理時間測定開始
    session_id, temp_paper_id = start_timer("get_signed_url")
    file_path = None
    
    try:
        # CORSヘッダーの設定
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)

        headers = {'Access-Control-Allow-Origin': '*'}

        # リクエスト検証
        request_json = request.get_json(silent=True)
        if not request_json or "filePath" not in request_json:
            error_response = jsonify({"error": "File path is required"}), 400, headers
            # 処理時間の記録（バリデーションエラー）
            stop_timer(session_id, temp_paper_id, False, "Validation error: File path is required")
            return error_response

        file_path = request_json["filePath"]

        # gs://バケット名/オブジェクト名 からバケット名とオブジェクト名を抽出
        if not file_path.startswith("gs://"):
            error_response = jsonify({"error": "Invalid file path format. Must start with gs://"}), 400, headers
            # 処理時間の記録（バリデーションエラー）
            stop_timer(session_id, temp_paper_id, False, "Validation error: Invalid file path format")
            return error_response

        parts = file_path[5:].split("/", 1)  # "gs://" を削除して最初の "/" で分割
        if len(parts) != 2:
            error_response = jsonify({"error": "Invalid file path format"}), 400, headers
            # 処理時間の記録（バリデーションエラー）
            stop_timer(session_id, temp_paper_id, False, "Validation error: Invalid file path format")
            return error_response

        bucket_name = parts[0]
        object_name = parts[1]
        
        # ファイルパスから論文IDを抽出する試み
        paper_id = None
        # リクエストに paper_id が含まれている場合はそれを使用
        if "paper_id" in request_json:
            paper_id = request_json["paper_id"]
        
        # 論文IDが見つからない場合は、ファイルパスから推測
        # papers/以下のファイルパスからpaper_idを推測
        if not paper_id and object_name.startswith("papers/"):
            # Firestoreから該当パスのファイルを持つ論文を検索
            try:
                papers_ref = db.collection("papers")
                query = papers_ref.where("file_path", "==", file_path)
                papers = query.stream()
                
                for paper in papers:
                    paper_id = paper.id
                    paper_data = paper.to_dict()
                    # 公開論文かどうかチェック
                    is_public = paper_data.get("public", False)
                    
                    log_info("GetSignedURL", f"Found paper with matching file_path", {
                        "paper_id": paper_id,
                        "is_public": is_public
                    })
                    
                    # 認証チェック
                    user_id = verify_firebase_token(request)  # 認証情報がなければNoneを返す
                    
                    # 公開論文または認証されたユーザーの場合は続行
                    if is_public or user_id:
                        log_info("Auth", f"Access granted to {'public paper' if is_public else 'private paper'}", {
                            "paper_id": paper_id,
                            "user_id": user_id,
                            "is_public": is_public
                        })
                        break
                    else:
                        # 非公開論文で未認証の場合
                        error_response = jsonify({"error": "Authentication required for non-public papers"}), 401, headers
                        stop_timer(session_id, temp_paper_id, False, "Authentication error: Authentication required")
                        return error_response
            except Exception as e:
                log_error("GetSignedURLError", f"Error while checking paper access: {str(e)}")
                # エラーが発生しても処理を続行、従来の認証チェックに移る
        
        # 論文のチェックで認証OKにならなかった場合は従来通り認証を要求
        if not paper_id:
            try:
                # 従来の認証チェック
                user_id = verify_firebase_token(request)
                if not user_id:
                    # 未認証の場合はエラー
                    error_response = jsonify({"error": "Authentication required"}), 401, headers
                    stop_timer(session_id, temp_paper_id, False, "Authentication error: Authentication required")
                    return error_response
                
                log_info("Auth", f"Signed URL requested by authenticated user: {user_id}")
                add_step(session_id, temp_paper_id, "auth_complete", {"user_id": user_id})
            except Exception as auth_error:
                log_error("AuthError", f"Authentication failed: {str(auth_error)}")
                error_response = jsonify({"error": "Authentication failed"}), 401, headers
                stop_timer(session_id, temp_paper_id, False, "Authentication error: Authentication failed")
                return error_response

        # 署名付きURL用の認証情報を取得
        try:
            credentials = get_credentials("signed-url-credentials")
            if not credentials:
                raise Exception("Failed to get credentials from Secret Manager")

            # 認証情報を使用して新しいストレージクライアントを作成
            storage_client_signed = storage.Client(credentials=credentials)
            bucket = storage_client_signed.bucket(bucket_name)
        except Exception as e:
            log_error("GetSignedURLError", f"Failed to initialize storage client with credentials: {str(e)}")
            error_response = jsonify({"error": "Failed to initialize storage client"}), 500, headers
            # 処理時間の記録（認証エラー）
            stop_timer(session_id, temp_paper_id, False, "Authentication error: Failed to initialize storage client")
            return error_response

        # 署名付きURLの生成
        blob = bucket.blob(object_name)

        # 詳細なログ記録
        log_info("GetSignedURL", f"Generating signed URL", {
            "bucket": bucket_name,
            "object": object_name,
            "file_path": file_path
        })

        url_gen_start = time.time()
        try:
            url = blob.generate_signed_url(
                version="v4",
                expiration=datetime.timedelta(minutes=15),
                method="GET"
            )
            url_gen_time_sec = time.time() - url_gen_start
            add_step(session_id, temp_paper_id, "signed_url_generated", 
                   {"bucket": bucket_name, "object": object_name}, 
                   url_gen_time_sec * 1000)  # このAPIはまだミリ秒を受け取る
                   
            log_info("GetSignedURL", "Successfully generated signed URL")
        except Exception as e:
            log_error("GetSignedURLError", f"Failed to generate signed URL: {str(e)}")
            error_response = jsonify({"error": "Failed to generate signed URL"}), 500, headers
            # 処理時間の記録（URL生成エラー）
            stop_timer(session_id, temp_paper_id, False, "Error: Failed to generate signed URL")
            return error_response

        log_info("GetSignedURL", f"Generated signed URL successfully")
        
        response = jsonify({"url": url}), 200, headers
        
        # 処理時間の記録
        stop_timer(session_id, temp_paper_id, True)
        
        return response

    except Exception as e:
        log_error("GetSignedURLError", "Failed to generate signed URL", {"error": str(e)})
        
        # 処理時間の記録（エラー発生時）
        stop_timer(session_id, temp_paper_id, False, f"Unhandled error: {str(e)}")
        
        return jsonify({"error": "Failed to generate signed URL", "details": str(e)}), 500, headers

@functions_framework.http
def get_processing_time(request: Request):
    """
    論文IDに基づいて処理時間データを取得する
    """
    try:
        # CORSヘッダーの設定
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)

        headers = {'Access-Control-Allow-Origin': '*'}

        # クエリパラメータまたはJSONからpaper_idを取得
        paper_id = request.args.get('paper_id')
        
        if not paper_id:
            # JSONからも試みる
            request_json = request.get_json(silent=True)
            if request_json:
                paper_id = request_json.get('paper_id')
        
        if not paper_id:
            return jsonify({"error": "paper_id is required"}), 400, headers

        # 認証確認
        user_id = verify_firebase_token(request)
        # 管理者かどうかを確認
        if not user_id:
            return jsonify({"error": "認証が必要です"}), 401, headers

        # 管理者かどうかを確認する処理を追加
        admin_emails = ["smart-paper-v2@student-subscription.com", "s.kosei0626@gmail.com"]
        user_record = firebase_auth.get_user(user_id)
        if user_record.email not in admin_emails:
            return jsonify({"error": "管理者権限が必要です"}), 403, headers

        log_info("GetProcessingTime", f"Fetching processing time for paper: {paper_id}", {"user_id": user_id})

        # performance.pyから週範囲取得用の関数をインポート
        from performance import get_current_week_range
        
        # 最新の週範囲を取得
        week_range = get_current_week_range()
        
        # process_time コレクションから特定の paper_id に関するデータを取得
        process_ref = db.collection("process_time").document(week_range).collection("processes").document(paper_id)
        
        # 翻訳処理データを取得
        translate_ref = process_ref.collection("translate").document("data")
        translate_doc = translate_ref.get()
        translate_data = translate_doc.to_dict() if translate_doc.exists else None
        
        # 要約処理データを取得
        summary_ref = process_ref.collection("summarize").document("data")
        summary_doc = summary_ref.get()
        summary_data = summary_doc.to_dict() if summary_doc.exists else None
        
        # メタデータ処理データを取得
        metadata_ref = process_ref.collection("extract_metadata_and_chapters").document("data")
        metadata_doc = metadata_ref.get()
        metadata_data = metadata_doc.to_dict() if metadata_doc.exists else None
        
        # 章別のデータを取得（翻訳の場合のみ）
        chapters_data = []
        if translate_doc.exists:
            # 修正: すべてのドキュメントを取得後、"data"以外をフィルタリング
            chapters_query = process_ref.collection("translate").stream()
            
            for doc in chapters_query:
                # "data"ドキュメント以外をフィルタリング
                if doc.id != "data":
                    chapter_data = doc.to_dict()
                    if chapter_data and "chapter_number" in chapter_data:
                        chapters_data.append(chapter_data)
        
        # レスポンスデータ構築
        result = {
            "paper_id": paper_id,
            "translation": translate_data,
            "summary": summary_data,
            "metadata": metadata_data,
            "chapters": chapters_data
        }
        
        log_info("GetProcessingTime", f"Successfully fetched processing time for paper: {paper_id}")
        return jsonify(result), 200, headers
        
    except Exception as e:
        log_error("GetProcessingTimeError", f"Failed to get processing time: {str(e)}")
        return jsonify({"error": f"エラーが発生しました: {str(e)}"}), 500, headers

# Stripe関数のリダイレクト - 変更なし

# 管理者機能関数のリダイレクト
@functions_framework.http
def share_paper_with_admin_router(request: Request):
    """
    share_paper_with_admin関数へのルーターとして機能
    """
    from admin_functions import share_paper_with_admin
    return share_paper_with_admin(request)

# 処理時間データ取得用の関数ルーティング
@functions_framework.http
def get_processing_time_router(request: Request):
    """
    get_processing_time関数へのルーターとして機能
    """
    return get_processing_time(request)

@functions_framework.http
def process_chapter_translation(request: Request):
    """
    単一の章を翻訳するタスク処理 (Cloud Tasksから呼び出される)
    サブ章がさらにサブサブ章を持つ場合もスキップするよう拡張
    """
    # 処理時間測定開始
    session_id, temp_paper_id = start_timer("process_chapter_translation")
    paper_id = None
    chapter_number = None
    
    try:
        # CORSヘッダーの設定
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)

        headers = {'Access-Control-Allow-Origin': '*'}

        # リクエストのバリデーション
        request_json = request.get_json(silent=True)
        if not request_json:
            raise ValidationError("No JSON payload received")

        paper_id = request_json.get("paper_id")
        if not paper_id:
            raise ValidationError("Paper ID is required")
        
        chapter_info = request_json.get("chapter_info")
        if not chapter_info:
            raise ValidationError("Chapter info is required")
            
        chapter_number = chapter_info.get("chapter_number")
        if not chapter_number:
            raise ValidationError("Chapter number is required")
            
        add_step(session_id, paper_id, "request_validation_complete", 
                {"paper_id": paper_id, "chapter_number": chapter_number})

        # Firestoreクライアント初期化
        db = firestore.Client()
        
        # 論文ドキュメントを取得
        doc_ref = db.collection("papers").document(paper_id)
        paper_data = doc_ref.get().to_dict()

        if not paper_data:
            raise NotFoundError(f"Paper with ID {paper_id} not found")
            
        # 論文のステータスをチェック
        current_status = paper_data.get("status")
        if current_status not in ["metadata_extracted", "processing"]:
            log_warning("ProcessChapterTranslation", 
                       f"Paper is not in the right state for translation: {current_status}",
                       {"paper_id": paper_id})
            
            # 処理時間の記録（スキップ）
            add_step(session_id, paper_id, "translation_skipped", 
                    {"current_status": current_status})
            stop_timer(session_id, paper_id, True, "Translation skipped due to paper status")
            
            return jsonify({"status": "skipped", "reason": f"Paper status is {current_status}"}), 200, headers
            
        # 論文ファイルパスを取得
        pdf_gs_path = paper_data.get("file_path")
        if not pdf_gs_path:
            raise ValidationError("PDF file path is missing")
            
        add_step(session_id, paper_id, "paper_data_retrieved", 
                {"pdf_gs_path": pdf_gs_path, "chapter_number": chapter_number})

        # すべての章情報を取得してメイン章/サブ章をスキップする必要があるか判断
        chapters = paper_data.get("chapters", [])
        
        # 章番号を部分に分解する関数
        def parse_chapter_number(ch_num):
            # 文字列に変換
            str_number = str(ch_num)
            # ピリオドで分割
            parts = str_number.split('.')
            return parts
        
        # 子章を持つかどうかを判定する関数（任意の階層で適用可能）
        def has_child_chapters(ch_num, ch_list):
            # 章番号を部分に分解
            parts = parse_chapter_number(ch_num)
            
            # 自分の章番号の文字列表現
            self_prefix = str(ch_num)
            
            # 子章かどうかを判定するために、自分よりも1階層深い章を探す
            for ch in ch_list:
                other_number = ch.get("chapter_number")
                if other_number == ch_num:
                    continue  # 自分自身はスキップ
                
                # 他の章の部分を取得
                other_parts = parse_chapter_number(other_number)
                
                # 自分が他の章の親かどうかをチェック:
                # 1. 他の章の階層が自分より1つ深い
                # 2. 他の章のプレフィックスが自分と一致する
                if (len(other_parts) == len(parts) + 1 and 
                    str(other_number).startswith(self_prefix + ".")):
                    return True
            
            return False
        
        # ステータスを処理中に更新 (初めての章処理の場合のみ)
        if current_status == "metadata_extracted":
            doc_ref.update({
                "status": "processing",
                "progress": 20  # メタデータ抽出後、翻訳開始時点での進捗
            })
            add_step(session_id, paper_id, "status_updated_to_processing")
        
        # 日本語タイトルの処理
        chapter_title = chapter_info.get("title", "")
        chapter_title_ja = chapter_info.get("title_ja", "")
        
        # title_jaがない場合は、titleを使用
        if not chapter_title_ja:
            chapter_title_ja = chapter_title
        
        # 章番号がタイトルに含まれていない場合は追加
        if not chapter_title_ja.startswith(f"{chapter_number}"):
            chapter_title_ja = f"{chapter_number}. {chapter_title_ja}"
            
        # 子章があるかチェック（任意の階層で適用）
        if has_child_chapters(chapter_number, chapters):
            log_info("ProcessChapterTranslation", 
                    f"Skipping chapter {chapter_number} as it has child chapters",
                    {"paper_id": paper_id})
            
            # スキップした章としてFirestoreに保存（タイトルのみ保存）
            chapter_ref = doc_ref.collection("translated_chapters").document(f"chapter_{chapter_number}")
            chapter_ref.set({
                "chapter_number": chapter_number,
                "title": chapter_title,
                "title_ja": chapter_title_ja,
                "skipped": True,
                "reason": "has_child_chapters",
                "translated_text": "",  # 翻訳テキストは空
                "completed_at": datetime.datetime.now()
            })
            
            add_step(session_id, paper_id, "chapter_skipped_has_children", 
                    {"chapter_number": chapter_number})
            
            # 進捗を更新
            update_progress(db, doc_ref, chapters)
            
            # 処理時間の記録（スキップ）
            stop_timer(session_id, paper_id, True, "Chapter skipped - has child chapters")
            
            return jsonify({
                "status": "skipped", 
                "reason": "has_child_chapters",
                "chapter_number": chapter_number
            }), 200, headers

        # ここまで来たら、子章を持たない章なので翻訳を実行
        log_info("ProcessChapterTranslation", f"Translating chapter {chapter_number}", {"paper_id": paper_id})
        
        # 処理開始時間を記録
        translate_start = time.time()
        
        # 翻訳処理 - process_content関数を呼び出し
        result = process_content(pdf_gs_path, paper_id, "translate", chapter_info)
        
        # 処理時間を記録
        translate_time_sec = time.time() - translate_start
        
        add_step(session_id, paper_id, f"chapter_{chapter_number}_translated", 
                {"chapter_number": chapter_number,
                 "translate_time_sec": translate_time_sec}, 
                translate_time_sec * 1000)  # ミリ秒単位で記録

        # 結果を正規化
        if "translated_text" not in result:
            raise ValidationError(f"Invalid translation result for chapter {chapter_number}")
            
        # FirestoreのサブコレクションにTranslation結果を保存
        chapter_ref = doc_ref.collection("translated_chapters").document(f"chapter_{chapter_number}")
        chapter_ref.set({
            "chapter_number": chapter_info["chapter_number"],
            "title": chapter_title,
            "title_ja": chapter_title_ja,  # 日本語タイトルを保存
            "start_page": chapter_info.get("start_page", 0),
            "end_page": chapter_info.get("end_page", 0),
            "translated_text": result["translated_text"],
            "completed_at": datetime.datetime.now()
        })
        
        add_step(session_id, paper_id, "chapter_saved_to_firestore")
        
        # 進捗を更新
        update_progress(db, doc_ref, chapters)

        # 翻訳が完了した章の情報を含めたレスポンスを生成
        response = jsonify({
            "status": "success",
            "paper_id": paper_id,
            "chapter_number": chapter_number
        }), 200, headers
        
        # 処理時間の記録
        stop_timer(session_id, paper_id, True)
        
        return response

    except APIError as e:
        log_error("APIError", e.message, {"details": e.details, "paper_id": paper_id, "chapter_number": chapter_number})
        
        # 処理時間の記録（エラー発生時）
        target_paper_id = paper_id if paper_id else temp_paper_id
        stop_timer(session_id, target_paper_id, False, f"{e.__class__.__name__}: {e.message}")
        
        return jsonify(e.to_dict()), e.status_code, headers

    except Exception as e:
        log_error("UnhandledError", "An internal server error occurred", 
                 {"error": str(e), "paper_id": paper_id, "chapter_number": chapter_number})
        
        # エラー状態を更新
        if paper_id:
            try:
                db = firestore.Client()
                db.collection("papers").document(paper_id).update({
                    "error_message": f"Chapter {chapter_number} translation error: {str(e)}",
                })
            except Exception as db_error:
                log_error("FirestoreError", "Failed to update Firestore error status", {"error": str(db_error)})
        
        # 処理時間の記録（エラー発生時）
        target_paper_id = paper_id if paper_id else temp_paper_id
        stop_timer(session_id, target_paper_id, False, f"UnhandledException: {str(e)}")
        
        return jsonify({"error": "An internal server error occurred"}), 500, headers

def update_progress(db, doc_ref, chapters):
    """
    処理の進捗を更新する汎用関数
    
    Args:
        db: Firestoreクライアント
        doc_ref: 論文ドキュメントの参照
        chapters: 章のリスト
    """
    # トランザクションを使って進捗を一貫性を持って更新
    transaction = db.transaction()

    @firestore.transactional
    def update_progress_in_transaction(transaction, doc_ref):
        # 最新の論文データを取得
        paper_snapshot = doc_ref.get(transaction=transaction)
        paper_data = paper_snapshot.to_dict()
        
        # 翻訳済み章の数をカウント
        translated_chapters_query = doc_ref.collection("translated_chapters").stream()
        translated_count = len([doc.id for doc in translated_chapters_query])
        
        # 章の総数
        total_chapters = len(chapters)
        
        if total_chapters == 0:
            # 章がない場合は50%とする
            new_progress = 50
        else:
            # 要約を含む全タスク数を計算（要約は1章分として扱う）
            total_tasks = total_chapters + 1  # +1は要約タスク
            completed_tasks = translated_count  # 要約はまだ完了していない
            
            # 進捗率を計算（0%〜100%）
            new_progress = int((completed_tasks / total_tasks) * 100)
        
        # 最新の進捗率を更新
        transaction.update(doc_ref, {
            "progress": new_progress
        })
        
        log_info("UpdateProgress", 
                f"Updated progress: {new_progress}% ({translated_count}/{total_chapters} chapters + summary)")
        
        return new_progress

    # トランザクションを実行
    return update_progress_in_transaction(transaction, doc_ref)

@functions_framework.http
def process_paper_summary(request: Request):
    """
    論文全体の要約を処理するタスク (Cloud Tasksから呼び出される)
    すべての階層でのスキップした章のタイトル表示に対応
    """
    # 処理時間測定開始
    session_id, temp_paper_id = start_timer("process_paper_summary")
    paper_id = None
    
    try:
        # CORSヘッダーの設定
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)

        headers = {'Access-Control-Allow-Origin': '*'}

        # リクエストのバリデーション
        request_json = request.get_json(silent=True)
        if not request_json:
            raise ValidationError("No JSON payload received")

        paper_id = request_json.get("paper_id")
        if not paper_id:
            raise ValidationError("Paper ID is required")
            
        add_step(session_id, paper_id, "request_validation_complete", {"paper_id": paper_id})

        # Firestoreクライアント初期化
        db = firestore.Client()
        
        # 論文ドキュメントを取得
        doc_ref = db.collection("papers").document(paper_id)
        paper_data = doc_ref.get().to_dict()

        if not paper_data:
            raise NotFoundError(f"Paper with ID {paper_id} not found")
            
        # 論文のステータスをチェック
        current_status = paper_data.get("status")
        if current_status not in ["processing"]:
            log_warning("ProcessPaperSummary", 
                       f"Paper is not in the right state for summary: {current_status}",
                       {"paper_id": paper_id})
            
            # 処理時間の記録（スキップ）
            add_step(session_id, paper_id, "summary_skipped", 
                    {"current_status": current_status})
            stop_timer(session_id, paper_id, True, "Summary skipped due to paper status")
            
            return jsonify({"status": "skipped", "reason": f"Paper status is {current_status}"}), 200, headers
            
        # 論文ファイルパスを取得
        pdf_gs_path = paper_data.get("file_path")
        if not pdf_gs_path:
            raise ValidationError("PDF file path is missing")
            
        add_step(session_id, paper_id, "paper_data_retrieved", {"pdf_gs_path": pdf_gs_path})

        # 章の総数を取得し、新しい進捗計算を適用
        chapters = paper_data.get("chapters", [])
        total_chapters = len(chapters)
        
        # 翻訳された章数を取得
        translated_chapters_query = doc_ref.collection("translated_chapters").stream()
        translated_chapters = len([doc.id for doc in translated_chapters_query])
        
        # 要約を1章分としてカウント
        total_tasks = total_chapters + 1  # +1は要約タスク
        completed_tasks = translated_chapters  # 要約はまだ完了していない
        
        # 進捗率を計算 (要約処理開始時点)
        progress_percentage = int((completed_tasks / total_tasks) * 100)
        
        # 進捗を更新
        doc_ref.update({
            "progress": progress_percentage
        })

        add_step(session_id, paper_id, "progress_updated_for_summary", {"progress": progress_percentage})

        # 要約処理
        log_info("ProcessPaperSummary", f"Generating summary for paper {paper_id}")
        
        # 処理開始時間を記録
        summary_start = time.time()
        
        # 要約処理 - process_content関数を呼び出し
        summary_result = process_content(pdf_gs_path, paper_id, "summarize")
        
        # 処理時間を記録
        summary_time_sec = time.time() - summary_start
        
        add_step(session_id, paper_id, "summary_generated", {}, summary_time_sec * 1000)

        # 結果を正規化
        summary_text = ""
        required_knowledge = ""
        
        if isinstance(summary_result, dict):
            summary_text = summary_result.get('summary', '')
            required_knowledge = summary_result.get('required_knowledge', '')
        else:
            # JSONレスポンスがない場合、結果全体を要約とみなす
            summary_text = str(summary_result)
        
        # パフォーマンス計測モジュールに要約テキストを保存
        save_summary_text(session_id, summary_text)

        # 要約が完了したので、進捗を更新
        completed_tasks = translated_chapters + 1  # +1は要約タスク完了
        progress_percentage = int((completed_tasks / total_tasks) * 100)
        
        # 要約の結果をFirestoreに保存
        doc_ref.update({
            "summary": summary_text,
            "required_knowledge": required_knowledge,
            "progress": progress_percentage  # 要約も含めた進捗
        })
        
        add_step(session_id, paper_id, "summary_saved_to_firestore")

        # 翻訳された章の全テキストを結合
        # スキップされた章はテキストがなくても見出しは表示する
        chapters_query = doc_ref.collection("translated_chapters").stream()
        
        # 章番号でソートするための辞書を作成
        chapter_docs = {}
        for chapter_doc in chapters_query:
            chapter_data = chapter_doc.to_dict()
            chapter_number = chapter_data.get("chapter_number")
            chapter_docs[chapter_number] = chapter_data
        
        # 章番号を正しくソートするための関数
        def sort_chapter_key(chapter_number):
            # 文字列に変換
            chapter_str = str(chapter_number)
            # ピリオドで分割
            parts = chapter_str.split('.')
            # 数値部分をint型に変換してタプルで返す
            return tuple(int(part) if part.isdigit() else part for part in parts)
        
        # 章番号でソート
        sorted_chapter_numbers = sorted(chapter_docs.keys(), key=sort_chapter_key)
        
        # 見出しレベルを決定する関数
        def get_heading_level(chapter_number):
            # 文字列に変換してピリオドで分割
            parts = str(chapter_number).split('.')
            # 階層の深さに基づいて見出しレベルを決定
            # 例: 2 -> h2, 2.1 -> h3, 2.1.1 -> h4
            return min(6, len(parts) + 1)  # h6が最大なので制限
        
        # ソートされた順序で章を処理
        all_translated_text = ""
        for chapter_number in sorted_chapter_numbers:
            chapter_data = chapter_docs[chapter_number]
            chapter_title_ja = chapter_data.get("title_ja", "")  # 日本語タイトルを優先
            if not chapter_title_ja:
                chapter_title_ja = chapter_data.get("title", "")  # 日本語タイトルがなければ英語タイトル
            
            # 見出しレベルを設定（階層の深さに応じて）
            heading_level = get_heading_level(chapter_number)
            
            # 章番号がタイトルに含まれていない場合は追加
            if not str(chapter_title_ja).startswith(f"{chapter_number}"):
                chapter_title_ja = f"{chapter_number}. {chapter_title_ja}"
            
            # 章見出しは常に追加
            if all_translated_text:
                all_translated_text += "\n\n"
            
            all_translated_text += f"<h{heading_level}>{chapter_title_ja}</h{heading_level}>"
            
            # スキップされた章でなければ、翻訳内容も追加
            if not chapter_data.get("skipped", False):
                translated_text = chapter_data.get("translated_text", "")
                if translated_text:
                    all_translated_text += "\n\n" + translated_text
        
        # 文字数に応じて保存先を決定
        text_length = len(all_translated_text)
        add_step(session_id, paper_id, "text_combined", {"translated_text_length": text_length})
        
        storage_client = storage.Client()
        BUCKET_NAME = os.environ.get("BUCKET_NAME", f"{os.environ.get('GOOGLE_CLOUD_PROJECT')}.appspot.com")
        
        if text_length > 800000:
            # Cloud Storageに保存
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S-%f")
            file_name = f"translated_text_{timestamp}_{paper_id}.txt"
            blob = storage_client.bucket(BUCKET_NAME).blob(f"papers/{file_name}")
            
            storage_start = time.time()
            blob.upload_from_string(all_translated_text, content_type="text/plain")
            storage_time_ms = (time.time() - storage_start) * 1000
            
            translated_text_path = f"gs://{BUCKET_NAME}/papers/{file_name}"
            add_step(session_id, paper_id, "text_saved_to_storage", 
                    {"translated_text_path": translated_text_path},
                    storage_time_ms)

            # トランザクションを使って最終更新
            trans_final = db.transaction()
            
            @firestore.transactional
            def update_to_completed(transaction, doc_ref):
                transaction.update(doc_ref, {
                    "translated_text_path": translated_text_path,
                    "translated_text": None,
                    "status": "completed",
                    "completed_at": datetime.datetime.now(),
                    "progress": 100  # 完了時は必ず100%
                })
                return True
            
            # トランザクションを実行
            update_to_completed(trans_final, doc_ref)

            log_info("ProcessPaperSummary", f"Large translated text saved to Cloud Storage",
                    {"paper_id": paper_id, "path": translated_text_path})
        else:
            # Firestoreに直接保存
            firestore_start = time.time()
            
            # トランザクションを使って最終更新
            trans_final = db.transaction()
            
            @firestore.transactional
            def update_to_completed(transaction, doc_ref):
                transaction.update(doc_ref, {
                    "translated_text_path": None,
                    "translated_text": all_translated_text,
                    "status": "completed",
                    "completed_at": datetime.datetime.now(),
                    "progress": 100  # 完了時は必ず100%
                })
                return True
            
            # トランザクションを実行
            update_to_completed(trans_final, doc_ref)
            
            firestore_time_ms = (time.time() - firestore_start) * 1000
            
            add_step(session_id, paper_id, "text_saved_to_firestore", {}, firestore_time_ms)

            log_info("ProcessPaperSummary", f"Translated text saved to Firestore", {"paper_id": paper_id})

        # チャットセッションを終了して解放
        from vertex import end_chat_session
        end_chat_session(paper_id)
        log_info("ProcessPaperSummary", f"Ended chat session for paper", {"paper_id": paper_id})
        add_step(session_id, paper_id, "chat_session_ended")

        # 処理完了した情報を含めたレスポンスを生成
        response = jsonify({
            "status": "success",
            "paper_id": paper_id,
            "progress": 100
        }), 200, headers
        
        # 処理時間の記録
        stop_timer(session_id, paper_id, True)
        
        return response

    except APIError as e:
        log_error("APIError", e.message, {"details": e.details, "paper_id": paper_id})
        
        # 処理時間の記録（エラー発生時）
        target_paper_id = paper_id if paper_id else temp_paper_id
        stop_timer(session_id, target_paper_id, False, f"{e.__class__.__name__}: {e.message}")
        
        return jsonify(e.to_dict()), e.status_code, headers

    except Exception as e:
        log_error("UnhandledError", "An internal server error occurred", 
                 {"error": str(e), "paper_id": paper_id})
        
        # エラー状態を更新
        if paper_id:
            try:
                db = firestore.Client()
                db.collection("papers").document(paper_id).update({
                    "error_message": f"Summary generation error: {str(e)}",
                })
            except Exception as db_error:
                log_error("FirestoreError", "Failed to update Firestore error status", {"error": str(db_error)})
        
        # 処理時間の記録（エラー発生時）
        target_paper_id = paper_id if paper_id else temp_paper_id
        stop_timer(session_id, target_paper_id, False, f"UnhandledException: {str(e)}")
        
        return jsonify({"error": "An internal server error occurred"}), 500, headers
    
@functions_framework.http
def check_paper_completion(request: Request):
    """
    論文処理の完了状態をチェックし、必要に応じて要約処理を開始する
    """
    # 処理時間測定開始
    session_id, temp_paper_id = start_timer("check_paper_completion")
    paper_id = None
    
    try:
        # CORSヘッダーの設定
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)

        headers = {'Access-Control-Allow-Origin': '*'}

        # リクエストのバリデーション
        request_json = request.get_json(silent=True)
        if not request_json:
            raise ValidationError("No JSON payload received")

        paper_id = request_json.get("paper_id")
        if not paper_id:
            raise ValidationError("Paper ID is required")
            
        add_step(session_id, paper_id, "request_validation_complete", {"paper_id": paper_id})

        # Firestoreクライアント初期化
        db = firestore.Client()
        
        # 論文ドキュメントを取得
        doc_ref = db.collection("papers").document(paper_id)
        paper_data = doc_ref.get().to_dict()

        if not paper_data:
            raise NotFoundError(f"Paper with ID {paper_id} not found")
            
        # 論文の現在のステータスを取得
        current_status = paper_data.get("status")
        
        # 既に処理が完了しているか、エラーが発生している場合はスキップ
        if current_status in ["completed", "error"]:
            log_info("CheckPaperCompletion", f"Paper is already in final state: {current_status}", 
                    {"paper_id": paper_id})
            
            add_step(session_id, paper_id, "completion_check_skipped", 
                    {"current_status": current_status})
            
            # 処理時間の記録（スキップ）
            stop_timer(session_id, paper_id, True, "Completion check skipped")
            
            return jsonify({
                "status": "skipped", 
                "reason": f"Paper already in final state: {current_status}"
            }), 200, headers
            
        # 章の翻訳状態をチェック
        chapters = paper_data.get("chapters", [])
        if not chapters:
            log_warning("CheckPaperCompletion", "No chapters found for paper", {"paper_id": paper_id})
            
            add_step(session_id, paper_id, "no_chapters_found")
            
            # 章がない場合は、要約処理を開始するか、エラーに設定する
            if current_status in ["processing", "metadata_extracted"]:
                # 要約タスクを作成
                log_info("CheckPaperCompletion", "Starting summary task for paper with no chapters", 
                        {"paper_id": paper_id})
                
                from cloud_tasks import create_paper_summary_task
                create_paper_summary_task(paper_id)
                
                add_step(session_id, paper_id, "summary_task_created_no_chapters")
            else:
                # 何か問題がある場合はエラーに設定
                doc_ref.update({
                    "status": "error",
                    "error_message": "章構成の抽出に失敗しました。",
                    "progress": 0
                })
                
                add_step(session_id, paper_id, "set_error_no_chapters")
                
            # 処理時間の記録
            stop_timer(session_id, paper_id, True)
            
            return jsonify({
                "status": "processed", 
                "action": "created_summary_task_or_set_error"
            }), 200, headers

        # トランザクションを使って処理状況を確認
        transaction = db.transaction()

        @firestore.transactional
        def check_completion_in_transaction(transaction, doc_ref):
            # 最新の論文データを取得
            paper_snapshot = doc_ref.get(transaction=transaction)
            paper_data = paper_snapshot.to_dict()
            
            # 章の総数
            chapters = paper_data.get("chapters", [])
            total_chapters = len(chapters)
            
            if total_chapters == 0:
                # 章がない場合は直接要約タスクを作成
                return {
                    "all_completed": True,
                    "total_chapters": 0,
                    "translated_count": 0
                }
            
            # 翻訳済み章の取得
            translated_chapters_query = doc_ref.collection("translated_chapters").stream()
            translated_chapters = [doc.id for doc in translated_chapters_query]
            translated_count = len(translated_chapters)
            
            # 要約を含む全タスク数を計算
            total_tasks = total_chapters + 1  # +1は要約タスク
            completed_tasks = translated_count  # 要約はまだ完了していない
            
            # 進捗率を計算（0%〜100%）
            new_progress = int((completed_tasks / total_tasks) * 100)
            
            # 進捗率を更新
            transaction.update(doc_ref, {
                "progress": new_progress
            })
            
            # 全ての章が翻訳済みかどうか
            all_completed = translated_count >= total_chapters
            
            return {
                "all_completed": all_completed,
                "total_chapters": total_chapters,
                "translated_count": translated_count,
                "progress": new_progress
            }

        # トランザクションを実行
        result = check_completion_in_transaction(transaction, doc_ref)

        add_step(session_id, paper_id, "completion_check_transaction", 
                {"translated_count": result["translated_count"], 
                 "total_chapters": result["total_chapters"],
                 "progress": result.get("progress", 0)})

        # 全ての章が翻訳されているかチェック
        if result["all_completed"]:
            # 全て翻訳済みなら要約処理を開始
            log_info("CheckPaperCompletion", "All chapters translated, starting summary task", 
                    {"paper_id": paper_id, "chapters_count": result["total_chapters"]})
            
            # 要約タスクを作成
            from cloud_tasks import create_paper_summary_task
            create_paper_summary_task(paper_id)
            
            add_step(session_id, paper_id, "summary_task_created")
            
            # 処理時間の記録
            stop_timer(session_id, paper_id, True)
            
            return jsonify({
                "status": "processed", 
                "action": "created_summary_task",
                "translated_chapters": result["translated_count"],
                "total_chapters": result["total_chapters"]
            }), 200, headers
        else:
            # まだ翻訳中の章があるので再度チェックタスクを登録（30秒後）
            log_info("CheckPaperCompletion", 
                    f"Not all chapters translated yet ({result['translated_count']}/{result['total_chapters']}), scheduling another check", 
                    {"paper_id": paper_id})
            
            # 完了チェックタスクを30秒後に再度登録
            from cloud_tasks import create_completion_check_task
            create_completion_check_task(paper_id, 30)
            
            add_step(session_id, paper_id, "rescheduled_completion_check", 
                    {"translated_count": result["translated_count"], 
                     "total_chapters": result["total_chapters"]})
            
            # 処理時間の記録
            stop_timer(session_id, paper_id, True)
            
            return jsonify({
                "status": "in_progress", 
                "translated_chapters": result["translated_count"],
                "total_chapters": result["total_chapters"],
                "action": "rescheduled_check"
            }), 200, headers

    except APIError as e:
        log_error("APIError", e.message, {"details": e.details, "paper_id": paper_id})
        
        # 処理時間の記録（エラー発生時）
        target_paper_id = paper_id if paper_id else temp_paper_id
        stop_timer(session_id, target_paper_id, False, f"{e.__class__.__name__}: {e.message}")
        
        return jsonify(e.to_dict()), e.status_code, headers

    except Exception as e:
        log_error("UnhandledError", "An internal server error occurred", 
                 {"error": str(e), "paper_id": paper_id})
        
        # 処理時間の記録（エラー発生時）
        target_paper_id = paper_id if paper_id else temp_paper_id
        stop_timer(session_id, target_paper_id, False, f"UnhandledException: {str(e)}")
        
        return jsonify({"error": "An internal server error occurred"}), 500, headers