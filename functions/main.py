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

# 自作モジュールのインポート
from process_pdf import process_content, process_all_chapters
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
BUCKET_NAME = os.environ.get("BUCKET_NAME", f"{PROJECT_ID}.appspot.com")

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

@functions_framework.http
def process_pdf(request: Request):
    """
    PDFアップロードを受け付け、Cloud Storageへの保存、メタデータ抽出、直列処理を行う
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

        # リクエストのバリデーション
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

        # Firebase AuthenticationのIDトークン検証
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

        # Cloud StorageにPDFを保存
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S-%f")
        file_name = f"{timestamp}_{pdf_file.filename}"
        blob = storage_client.bucket(BUCKET_NAME).blob(f"papers/{file_name}")
        blob.upload_from_file(pdf_file, content_type="application/pdf")
        pdf_gs_path = f"gs://{BUCKET_NAME}/papers/{file_name}"

        log_info("Storage", f"Uploaded PDF to {pdf_gs_path}")

        # Firestoreにドキュメントを作成
        doc_ref = db.collection("papers").document()
        doc_ref.set({
            "user_id": user_id,
            "file_path": pdf_gs_path,
            "status": "pending",
            "uploaded_at": datetime.datetime.now(),
            "completed_at": None,
            "metadata": None,
            "chapters": None,
            "summary": "",
            "translated_text": None,
            "translated_text_path": None,
            "related_papers": None,
            "progress": 0
        })
        paper_id = doc_ref.id

        log_info("Firestore", f"Created paper document with ID: {paper_id}")

        # バックグラウンド処理を起動
        try:
            log_info("ProcessPDF", f"Starting background processing for paper {paper_id}")
            doc_ref.update({
                "processing_started": True,
                "status": "pending"
            })
        except Exception as e:
            log_error("BackgroundProcessingError", "Failed to start background processing", {"error": str(e)})

        return jsonify({"paper_id": paper_id}), 200, headers

    except APIError as e:
        log_error("APIError", e.message, {"details": e.details})
        return handle_api_error(e)
    except Exception as e:
        log_error("UnhandledError", "An internal server error occurred", {"error": str(e)})
        return jsonify({"error": "An internal server error occurred."}), 500, headers

@functions_framework.http
def process_pdf_background(request: Request):
    """
    PDF処理を同期的に実行する
    """
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

    paper_id = None
    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            raise ValidationError("No JSON payload received")

        paper_id = request_json.get("paper_id")
        if not paper_id:
            raise ValidationError("Paper ID is required")

        # 論文ドキュメントを取得
        doc_ref = db.collection("papers").document(paper_id)
        paper_data = doc_ref.get().to_dict()

        if not paper_data:
            raise NotFoundError(f"Paper with ID {paper_id} not found")

        pdf_gs_path = paper_data.get("file_path")
        if not pdf_gs_path:
            raise ValidationError("PDF file path is missing")

        # 既に処理が完了している場合はスキップ
        if paper_data.get("status") == "completed":
            return jsonify({"message": "Paper already processed", "paper_id": paper_id}), 200, headers

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
            
            result = process_content(pdf_gs_path, "extract_metadata_and_chapters")

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

        # すべての章を順番に処理
        chapters = result.get("chapters", [])
        if not chapters:
            log_warning("ProcessPDFBackground", f"No chapters found", {"paper_id": paper_id})
            doc_ref.update({
                "status": "completed",
                "completed_at": datetime.datetime.now(),
                "progress": 100,
                "summary": "この論文には章が見つかりませんでした。",
                "translated_text": "<p>この論文には処理可能な章が見つかりませんでした。別の論文を試してください。</p>"
            })
            return jsonify({"message": "Processing completed (no chapters found)"}), 200, headers

        # 章を順番に処理（同期処理）
        chapter_results = process_all_chapters(chapters, paper_id, pdf_gs_path)

        log_info("ProcessPDFBackground", f"All chapters processed successfully",
                {"paper_id": paper_id, "chapters_count": len(chapters)})

        return jsonify({
            "message": "Processing completed",
            "paper_id": paper_id,
            "chapters_processed": len(chapter_results) if chapter_results else 0
        }), 200, headers

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
        return jsonify({"error": "An internal server error occurred"}), 500, headers

@functions_framework.http
def get_signed_url(request: Request):
    """
    Cloud StorageのファイルへのURLを取得する
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

        # リクエスト検証
        request_json = request.get_json(silent=True)
        if not request_json or "filePath" not in request_json:
            return jsonify({"error": "File path is required"}), 400, headers

        file_path = request_json["filePath"]

        # gs://バケット名/オブジェクト名 からバケット名とオブジェクト名を抽出
        if not file_path.startswith("gs://"):
            return jsonify({"error": "Invalid file path format. Must start with gs://"}), 400, headers

        parts = file_path[5:].split("/", 1)  # "gs://" を削除して最初の "/" で分割
        if len(parts) != 2:
            return jsonify({"error": "Invalid file path format"}), 400, headers

        bucket_name = parts[0]
        object_name = parts[1]

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
            return jsonify({"error": "Failed to initialize storage client"}), 500, headers

        # 署名付きURLの生成
        blob = bucket.blob(object_name)

        # 詳細なログ記録
        log_info("GetSignedURL", f"Generating signed URL", {
            "bucket": bucket_name,
            "object": object_name,
            "file_path": file_path
        })

        try:
            url = blob.generate_signed_url(
                version="v4",
                expiration=datetime.timedelta(minutes=15),
                method="GET"
            )
            log_info("GetSignedURL", "Successfully generated signed URL")
        except Exception as e:
            log_error("GetSignedURLError", f"Failed to generate signed URL: {str(e)}")
            return jsonify({"error": "Failed to generate signed URL"}), 500, headers

        log_info("GetSignedURL", f"Generated signed URL successfully")
        return jsonify({"url": url}), 200, headers

    except Exception as e:
        log_error("GetSignedURLError", "Failed to generate signed URL", {"error": str(e)})
        return jsonify({"error": "Failed to generate signed URL", "details": str(e)}), 500, headers