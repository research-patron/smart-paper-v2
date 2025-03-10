import functions_framework
from flask import Flask, jsonify, Request
from google.cloud import firestore
from google.cloud import storage
from google.cloud import tasks_v2
from google.cloud import secretmanager
from google.protobuf import timestamp_pb2
from google.oauth2 import service_account
import datetime
import json
import os
import logging

# 自作モジュールのインポート
from process_pdf import (
    create_cached_content,
    process_with_cache,
    cleanup_cache
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

# ロギング設定
logging.basicConfig(level=logging.INFO)

# プロジェクトID
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = os.environ.get("FUNCTION_REGION", "us-central1")
QUEUE = os.environ.get("TASK_QUEUE", "translate-pdf-queue")
CLOUD_FUNCTIONS_URL = os.environ.get("FUNCTIONS_URL", f"https://{LOCATION}-{PROJECT_ID}.cloudfunctions.net")
BUCKET_NAME = os.environ.get("BUCKET_NAME", f"{PROJECT_ID}.firebasestorage.app")

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
    tasks_client = tasks_v2.CloudTasksClient(credentials=credentials) if credentials else tasks_v2.CloudTasksClient()
except Exception as e:
    log_error("ClientInitError", f"Failed to initialize clients: {str(e)}")
    # フォールバック
    db = firestore.Client()
    storage_client = storage.Client()
    tasks_client = tasks_v2.CloudTasksClient()

def create_task(payload: dict, task_name: str = None, delay_seconds: int = 0) -> str:
    """Cloud Tasks キューにタスクを追加する

    Args:
        payload: タスクのペイロード
        task_name: タスク名（ユニークである必要がある）
        delay_seconds: タスクの実行を遅延させる秒数

    Returns:
        str: タスク名
    """
    parent = tasks_client.queue_path(PROJECT_ID, LOCATION, QUEUE)

    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": f"{CLOUD_FUNCTIONS_URL}/process_pdf_task",  # Cloud Functions (Python) の URL
            "oidc_token": {
                "service_account_email": os.environ.get("CLOUD_FUNCTIONS_SA", f"{PROJECT_ID}@appspot.gserviceaccount.com"),
            },
            "headers": {
                "Content-Type": "application/json",
            },
            "body": json.dumps(payload).encode(),
        },
        "dispatch_deadline": {"seconds": 9 * 60}  # タイムアウト時間を設定（9分）
    }

    if task_name:
        task["name"] = f"{parent}/tasks/{task_name}"

    if delay_seconds > 0:
        # タスクの実行を遅延させる時間を設定
        execution_time = datetime.datetime.utcnow() + datetime.timedelta(seconds=delay_seconds)
        timestamp = timestamp_pb2.Timestamp()
        timestamp.FromDatetime(execution_time)
        task["schedule_time"] = timestamp

    try:
        response = tasks_client.create_task(parent=parent, task=task)
        log_info("CloudTasks", f"Created task: {response.name}", {"task_name": task_name})
        return response.name
    except Exception as e:
        log_error("CloudTasksError", "Failed to create task", {"error": str(e), "task_name": task_name})
        raise

def handle_api_error(error: APIError):
    """APIエラーをHTTPレスポンスに変換"""
    return jsonify(error.to_dict()), error.status_code

@functions_framework.http
def process_pdf(request: Request):
    """
    PDFアップロードを受け付け、Cloud Storageへの保存、メタデータ抽出、Cloud Tasksへのタスク追加を行う
    """
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

        # 1. リクエストのバリデーション
        if not request.method == "POST":
            raise ValidationError("Method not allowed")

        if not request.files or "file" not in request.files:
            raise ValidationError("No file uploaded")

        pdf_file = request.files["file"]
        if not pdf_file.filename.lower().endswith(".pdf"):
            raise ValidationError("Invalid file type. Only PDF files are allowed.")

        content_length = request.content_length or 0
        if content_length > 20 * 1024 * 1024:  # 20MB limit
            raise ValidationError("File too large. Maximum size is 20MB.")

        # 2. Firebase AuthenticationのIDトークン検証
        user_id = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]  # 'Bearer 'の後の部分を取得
                try:
                    # Firebase Admin SDKを使用してIDトークンを検証
                    # ここでは簡略化のため実装を省略
                    # 本来はFirebase Admin SDKのauth.verify_id_token()を使用
                    user_id = "test_user_id"  # 実際の実装ではトークンから取得したユーザーID
                except Exception as e:
                    log_error("AuthError", "Invalid ID token", {"error": str(e)})
                    raise AuthenticationError("Invalid ID token")

        # 3. Cloud StorageにPDFを保存
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S-%f")
        file_name = f"{timestamp}_{pdf_file.filename}"
        blob = storage_client.bucket(BUCKET_NAME).blob(f"papers/{file_name}")
        blob.upload_from_file(pdf_file, content_type="application/pdf")
        pdf_gs_path = f"gs://{BUCKET_NAME}/papers/{file_name}"

        log_info("Storage", f"Uploaded PDF to {pdf_gs_path}")

        # 4. Firestoreにドキュメントを作成 (初期ステータス: pending)
        doc_ref = db.collection("papers").document()
        doc_ref.set({
            "user_id": user_id,
            "file_path": pdf_gs_path,
            "cache_id": None,  # 後で更新
            "status": "pending",
            "uploaded_at": datetime.datetime.now(),
            "completed_at": None,
            "metadata": None,
            "chapters": None,
            "summary": "",
            "translated_text": None,
            "translated_text_path": None,
            "related_papers": None
        })
        paper_id = doc_ref.id

        log_info("Firestore", f"Created paper document with ID: {paper_id}")

        # 5. メタデータ抽出タスクをCloud Tasksに追加
        cache_id = f"{file_name}_{timestamp}"
        payload = {
            "pdf_gs_path": pdf_gs_path,
            "cache_id": cache_id,
            "paper_id": paper_id,
            "operation": "extract_metadata",
        }
        create_task(payload, task_name=f"extract_metadata_{paper_id}")

        # 6. クライアントにレスポンスを返す (FirestoreドキュメントID)
        return jsonify({"paper_id": paper_id}), 200, headers

    except APIError as e:
        log_error("APIError", e.message, {"details": e.details})
        return handle_api_error(e)
    except Exception as e:
        log_error("UnhandledError", "An internal server error occurred", {"error": str(e)})
        return jsonify({"error": "An internal server error occurred."}), 500, headers

@functions_framework.http
def process_pdf_task(request: Request):
    """
    Cloud Tasksからトリガーされ、実際のPDF処理（翻訳、要約、メタデータ抽出、章構成抽出）を行う
    """
    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            raise ValidationError("No JSON payload received")
            
        pdf_gs_path = request_json.get("pdf_gs_path")
        cache_id = request_json.get("cache_id")
        paper_id = request_json.get("paper_id")
        operation = request_json.get("operation")
        
        if not all([pdf_gs_path, cache_id, paper_id, operation]):
            raise ValidationError("Required fields missing from payload")

        log_info("ProcessPDFTask", f"Starting {operation} task", {
            "paper_id": paper_id, 
            "operation": operation
        })

        # メタデータ抽出タスク
        if operation == "extract_metadata":
            # 初回のみコンテキストキャッシュを作成
            file_name = pdf_gs_path.split("/")[-1].split(".")[0]
            cached_content_name = create_cached_content(pdf_gs_path, file_name)

            log_info("VertexAI", f"Created context cache: {cached_content_name}")

            # メタデータと章構成を抽出
            result = process_with_cache(cache_id, "extract_metadata_and_chapters")

            # Firestoreに結果を保存
            doc_ref = db.collection("papers").document(paper_id)
            doc_ref.update({
                "cache_id": cache_id,
                "metadata": result.get("metadata", {}),
                "chapters": result.get("chapters", []),
                "status": "metadata_extracted",
            })

            log_info("ProcessPDFTask", f"Metadata extraction completed", {"paper_id": paper_id})

            # 各章の翻訳タスクをCloud Tasksに追加
            for chapter in result.get("chapters", []):
                payload = {
                    "pdf_gs_path": pdf_gs_path,
                    "cache_id": cache_id,
                    "paper_id": paper_id,
                    "operation": "translate",
                    "chapter_info": chapter,  # 章情報をペイロードに追加
                }
                task_name = f"translate_chapter_{paper_id}_{chapter['chapter_number']}"
                create_task(payload, task_name=task_name)

            # 関連論文推薦タスクをCloud Tasksに追加
            payload = {
                "pdf_gs_path": pdf_gs_path,
                "cache_id": cache_id,
                "paper_id": paper_id,
                "operation": "recommend_related_papers",
            }
            create_task(payload, task_name=f"recommend_{paper_id}")

        # 各章の翻訳タスク
        elif operation == "translate":
            chapter_info = request_json.get("chapter_info")
            if not chapter_info:
                raise ValidationError("Chapter info missing for translate task")
            
            # 翻訳処理
            translate_result = process_with_cache(cache_id, "translate", chapter_info)

            # Firestore (translated_chapters サブコレクション) に結果を保存
            doc_ref = db.collection("papers").document(paper_id)
            doc_ref.collection("translated_chapters").add(translate_result)

            log_info("ProcessPDFTask", f"Translation completed for chapter {chapter_info['chapter_number']}", 
                     {"paper_id": paper_id})

            # 要約タスクをCloud Tasksに追加
            payload = {
                "pdf_gs_path": pdf_gs_path,
                "cache_id": cache_id,
                "paper_id": paper_id,
                "operation": "summarize",
                "chapter_info": chapter_info,
            }
            task_name = f"summarize_chapter_{paper_id}_{chapter_info['chapter_number']}"
            create_task(payload, task_name=task_name)

        # 各章の要約タスク
        elif operation == "summarize":
            chapter_info = request_json.get("chapter_info")
            if not chapter_info:
                raise ValidationError("Chapter info missing for summarize task")
            
            # 要約処理
            summary_result = process_with_cache(cache_id, "summarize", chapter_info)

            # Firestoreに結果を保存
            doc_ref = db.collection("papers").document(paper_id)
            # 各章の要約を結合して、論文全体の要約とする
            current_summary = doc_ref.get().to_dict().get("summary", "")
            updated_summary = f"{current_summary}\n\n**Chapter {chapter_info['chapter_number']}:**\n{summary_result['summary']}"
            doc_ref.update({"summary": updated_summary})

            log_info("ProcessPDFTask", f"Summary completed for chapter {chapter_info['chapter_number']}", 
                     {"paper_id": paper_id})

            # 全ての章の翻訳・要約が完了したか確認
            # (Cloud Tasksの仕様上、順序は保証されないため、translated_chaptersの数とchaptersの数を比較)
            translated_chapters_count = len(list(doc_ref.collection("translated_chapters").get()))
            chapters = doc_ref.get().to_dict().get("chapters", [])
            chapters_count = len(chapters)
            
            if translated_chapters_count == chapters_count:
                log_info("ProcessPDFTask", f"All chapters translated and summarized", {"paper_id": paper_id})
                
                # 論文全体の翻訳結果を結合
                all_translated_text = ""
                for chapter_doc in sorted(doc_ref.collection("translated_chapters").get(), 
                                         key=lambda x: x.to_dict().get("chapter_number", 0)):
                    chapter_data = chapter_doc.to_dict()
                    all_translated_text += f"\n\n{chapter_data.get('translated_text', '')}"

                # 文字数に応じて保存先を決定
                if len(all_translated_text) > 800000:
                    # Cloud Storageに保存
                    timestamp = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S-%f")
                    file_name = f"translated_text_{timestamp}_{paper_id}.txt"
                    blob = storage_client.bucket(BUCKET_NAME).blob(f"papers/{file_name}")
                    blob.upload_from_string(all_translated_text, content_type="text/plain")
                    translated_text_path = f"gs://{BUCKET_NAME}/papers/{file_name}"
                    
                    doc_ref.update({
                        "translated_text_path": translated_text_path, 
                        "translated_text": None,
                        "status": "completed",
                        "completed_at": datetime.datetime.now()
                    })
                    
                    log_info("ProcessPDFTask", f"Large translated text saved to Cloud Storage", 
                            {"paper_id": paper_id, "path": translated_text_path})
                else:
                    # Firestoreに保存
                    doc_ref.update({
                        "translated_text_path": None, 
                        "translated_text": all_translated_text,
                        "status": "completed",
                        "completed_at": datetime.datetime.now()
                    })
                    
                    log_info("ProcessPDFTask", f"Translated text saved to Firestore", {"paper_id": paper_id})

        # 関連論文推薦タスク
        elif operation == "recommend_related_papers":
            # 仮のダミーデータを使用 (本来は関連論文APIなどを使用)
            related_papers = [
                {"title": "Related Paper 1", "doi": "10.1234/abcd1234"},
                {"title": "Related Paper 2", "doi": "10.5678/efgh5678"},
                {"title": "Related Paper 3", "doi": "10.9101/ijkl9101"},
            ]
            
            doc_ref = db.collection("papers").document(paper_id)
            doc_ref.update({"related_papers": related_papers})
            
            log_info("ProcessPDFTask", f"Added related papers recommendations", {"paper_id": paper_id})
            
            # 全ての処理が完了していることを確認
            paper_data = doc_ref.get().to_dict()
            
            if paper_data.get("status") == "completed":
                # コンテキストキャッシュの削除 (全ての処理が完了した後)
                cleanup_cache(cache_id)
                log_info("ProcessPDFTask", f"Cleaned up context cache", {"paper_id": paper_id, "cache_id": cache_id})

        return jsonify({"message": f"{operation} task completed"}), 200

    except APIError as e:
        log_error("APIError", e.message, {"details": e.details})
        
        # Firestoreのステータスを 'error' に更新
        if "paper_id" in request_json:
            try:
                db.collection("papers").document(paper_id).update({"status": "error"})
            except Exception as db_error:
                log_error("FirestoreError", "Failed to update Firestore status", {"error": str(db_error)})
                
        return handle_api_error(e)
        
    except Exception as e:
        log_error("UnhandledError", "An internal server error occurred", {"error": str(e)})
        
        # Firestoreのステータスを 'error' に更新
        if request_json and "paper_id" in request_json:
            try:
                db.collection("papers").document(request_json["paper_id"]).update({"status": "error"})
            except Exception as db_error:
                log_error("FirestoreError", "Failed to update Firestore status", {"error": str(db_error)})
                
        return jsonify({"error": "An internal server error occurred."}), 500

@functions_framework.http
def get_signed_url(request: Request):
    """
    Cloud StorageのファイルへのURLを取得する（メモリ使用量を最適化）
    """
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
        
        # リクエスト検証（軽量化）
        request_json = request.get_json(silent=True)
        if not request_json or "filePath" not in request_json:
            print("Invalid request: Missing filePath")
            return jsonify({"error": "File path is required"}), 400, headers
            
        file_path = request_json.get("filePath")
        
        # ファイルパスのパース（簡素化）
        if file_path.startswith("gs://"):
            file_path = file_path[5:]  # "gs://" を削除
            
        try:
            bucket_name, object_name = file_path.split("/", 1)
        except ValueError:
            print(f"Invalid file path format: {file_path}")
            return jsonify({"error": "Invalid file path format"}), 400, headers
        
        # 署名付きURLの生成（軽量化）
        try:
            # 一時的なクライアントを作成して直接操作（グローバル変数を使用しない）
            storage_client_local = storage.Client()
            bucket = storage_client_local.bucket(bucket_name)
            blob = bucket.blob(object_name)
            
            url = blob.generate_signed_url(
                version="v4",
                expiration=datetime.timedelta(minutes=5),
                method="GET"
            )
            
            # 最小限のログ記録
            print(f"Generated signed URL for {file_path}")
            
            return jsonify({"url": url}), 200, headers
            
        except Exception as e:
            print(f"Error generating signed URL: {str(e)}")
            return jsonify({"error": "Failed to generate signed URL"}), 500, headers
            
    except Exception as e:
        print(f"Unexpected error in get_signed_url: {str(e)}")
        return jsonify({"error": "An internal server error occurred"}), 500, headers