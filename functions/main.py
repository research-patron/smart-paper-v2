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
        if content_length > 10 * 1024 * 1024:  # 10MB limit
            raise ValidationError("File too large. Maximum size is 10MB.")
            
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
    PDF処理を同期的に実行する
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
            # メタデータと章構成を抽出
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
                    metadata_time_sec * 1000)  # このAPIはまだミリ秒を受け取る

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

        # すべての章を順番に処理
        chapters = result.get("chapters", [])
        if not chapters:
            log_warning("ProcessPDFBackground", f"No chapters found", {"paper_id": paper_id})
            
            # 章がない場合は完了とする
            doc_ref.update({
                "status": "completed",
                "completed_at": datetime.datetime.now(),
                "progress": 100,
                "summary": "この論文には章が見つかりませんでした。",
                "translated_text": "<p>この論文には処理可能な章が見つかりませんでした。別の論文を試してください。</p>"
            })
            
            add_step(session_id, paper_id, "no_chapters_found")
            response = jsonify({"message": "Processing completed (no chapters found)"}), 200, headers
            # 処理時間の記録
            stop_timer(session_id, paper_id, True)
            return response

        # 章を順番に処理（同期処理）
        chapters_start = time.time()
        chapter_results = process_all_chapters(chapters, paper_id, pdf_gs_path, session_id)  # セッションIDを渡す
        chapters_time_sec = time.time() - chapters_start
        
        add_step(session_id, paper_id, "all_chapters_processed", 
                {"chapters_count": len(chapters), 
                 "processed_count": len(chapter_results) if chapter_results else 0}, 
                chapters_time_sec * 1000)  # このAPIはまだミリ秒を受け取る

        log_info("ProcessPDFBackground", f"All chapters processed successfully",
                {"paper_id": paper_id, "chapters_count": len(chapters)})

        response = jsonify({
            "message": "Processing completed",
            "paper_id": paper_id,
            "chapters_processed": len(chapter_results) if chapter_results else 0
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

        # 認証を必須に変更 - 認証なしでは処理を続行しない
        user_id = require_authentication(request)
        log_info("Auth", f"Signed URL requested by authenticated user: {user_id}")
        add_step(session_id, temp_paper_id, "auth_complete", {"user_id": user_id})

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

# Stripe関数のリダイレクト - 変更なし

# 管理者機能関数のリダイレクト
@functions_framework.http
def share_paper_with_admin_router(request: Request):
    """
    share_paper_with_admin関数へのルーターとして機能
    """
    from admin_functions import share_paper_with_admin
    return share_paper_with_admin(request)