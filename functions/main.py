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
except Exception as e:
    log_error("ClientInitError", f"Failed to initialize clients: {str(e)}")
    # フォールバック
    db = firestore.Client()
    storage_client = storage.Client()

def handle_api_error(error: APIError):
    """APIエラーをHTTPレスポンスに変換"""
    return jsonify(error.to_dict()), error.status_code

async def process_chapter(cache_id, chapter_info, paper_id):
    """
    指定された章の翻訳および要約を順次処理する
    
    Args:
        cache_id: コンテキストキャッシュID
        chapter_info: 章情報
        paper_id: 論文ID
    
    Returns:
        dict: 処理結果
    """
    try:
        # 翻訳処理
        log_info("ProcessChapter", f"Starting translation for chapter {chapter_info['chapter_number']}", 
                {"paper_id": paper_id})
        translate_result = process_with_cache(cache_id, "translate", chapter_info)
        
        # Firestore (translated_chapters サブコレクション) に結果を保存
        doc_ref = db.collection("papers").document(paper_id)
        doc_ref.collection("translated_chapters").add(translate_result)
        
        log_info("ProcessChapter", f"Translation completed for chapter {chapter_info['chapter_number']}", 
                {"paper_id": paper_id})
        
        # 要約処理
        log_info("ProcessChapter", f"Starting summary for chapter {chapter_info['chapter_number']}", 
                {"paper_id": paper_id})
        summary_result = process_with_cache(cache_id, "summarize", chapter_info)
        
        # Firestoreに結果を保存
        current_summary = doc_ref.get().to_dict().get("summary", "")
        updated_summary = f"{current_summary}\n\n**Chapter {chapter_info['chapter_number']}:**\n{summary_result['summary']}"
        doc_ref.update({"summary": updated_summary})
        
        log_info("ProcessChapter", f"Summary completed for chapter {chapter_info['chapter_number']}", 
                {"paper_id": paper_id})
        
        return {
            "chapter_number": chapter_info["chapter_number"],
            "translated": True,
            "summarized": True
        }
    except Exception as e:
        log_error("ProcessChapterError", f"Error processing chapter {chapter_info['chapter_number']}", 
                 {"paper_id": paper_id, "error": str(e)})
        return {
            "chapter_number": chapter_info["chapter_number"],
            "translated": False,
            "summarized": False,
            "error": str(e)
        }

async def process_all_chapters(cache_id, chapters, paper_id, pdf_gs_path):
    """
    すべての章を順番に処理する
    
    Args:
        cache_id: コンテキストキャッシュID
        chapters: 章情報のリスト
        paper_id: 論文ID
        pdf_gs_path: PDFのパス
    """
    try:
        doc_ref = db.collection("papers").document(paper_id)
        
        # ステータスを処理中に更新
        doc_ref.update({"status": "processing"})
        
        # 各章を順番に処理
        results = []
        for chapter in sorted(chapters, key=lambda x: x["chapter_number"]):
            result = await process_chapter(cache_id, chapter, paper_id)
            results.append(result)
        
        # 全ての章の翻訳結果を結合
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
            
            log_info("ProcessAllChapters", f"Large translated text saved to Cloud Storage", 
                    {"paper_id": paper_id, "path": translated_text_path})
        else:
            # Firestoreに保存
            doc_ref.update({
                "translated_text_path": None, 
                "translated_text": all_translated_text,
                "status": "completed",
                "completed_at": datetime.datetime.now()
            })
            
            log_info("ProcessAllChapters", f"Translated text saved to Firestore", {"paper_id": paper_id})
        
        # 関連論文の追加（ダミーデータ）
        related_papers = [
            {"title": "Related Paper 1", "doi": "10.1234/abcd1234"},
            {"title": "Related Paper 2", "doi": "10.5678/efgh5678"},
            {"title": "Related Paper 3", "doi": "10.9101/ijkl9101"},
        ]
        
        doc_ref.update({"related_papers": related_papers})
        
        log_info("ProcessAllChapters", f"Added related papers recommendations", {"paper_id": paper_id})
        
        # コンテキストキャッシュの削除
        cleanup_cache(cache_id)
        log_info("ProcessAllChapters", f"Cleaned up context cache", {"paper_id": paper_id, "cache_id": cache_id})
        
        return results
    except Exception as e:
        log_error("ProcessAllChaptersError", "Failed to process all chapters", 
                 {"paper_id": paper_id, "error": str(e)})
        
        # エラー状態に更新
        doc_ref.update({"status": "error"})
        
        raise

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

        # 5. 処理開始
        # バックグラウンド処理を起動（非同期でCloud Functionを呼び出す）
        try:
            # Firebase Admin SDKを使用して独自のバックグラウンド処理トリガーを作成
            log_info("ProcessPDF", f"Starting background processing for paper {paper_id}")
            
            # このリクエストのレスポンスを早く返すため、実際の処理は別途実行
            # 実際のプロダクション環境では、Pub/SubやHTTPトリガーなどでバックグラウンド処理を実装
            
            # 処理開始を示すフラグを設定
            doc_ref.update({"processing_started": True})
        except Exception as e:
            log_error("BackgroundProcessingError", "Failed to start background processing", {"error": str(e)})
            # エラーがあっても進める（フロントエンドでポーリングされる）

        # 6. クライアントにレスポンスを返す (FirestoreドキュメントID)
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
    PDF処理を非同期でバックグラウンドで実行する
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
    
    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            raise ValidationError("No JSON payload received")
            
        paper_id = request_json.get("paper_id")
        
        if not paper_id:
            raise ValidationError("Paper ID is required")

        # 1. 論文ドキュメントを取得
        doc_ref = db.collection("papers").document(paper_id)
        paper_data = doc_ref.get().to_dict()
        
        if not paper_data:
            raise NotFoundError(f"Paper with ID {paper_id} not found")
            
        pdf_gs_path = paper_data.get("file_path")
        
        if not pdf_gs_path:
            raise ValidationError("PDF file path is missing")
            
        # 2. コンテキストキャッシュを作成
        file_name = pdf_gs_path.split("/")[-1].split(".")[0]
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S-%f")
        cache_id = f"{file_name}_{timestamp}"
        
        cached_content_name = create_cached_content(pdf_gs_path, file_name)
        log_info("VertexAI", f"Created context cache: {cached_content_name}")
        
        # 3. コンテキストキャッシュIDを保存
        doc_ref.update({"cache_id": cache_id})
        
        # 4. メタデータと章構成を抽出
        log_info("ProcessPDFBackground", f"Extracting metadata and chapters", {"paper_id": paper_id})
        result = process_with_cache(cache_id, "extract_metadata_and_chapters")
        
        # 5. Firestoreに結果を保存
        doc_ref.update({
            "metadata": result.get("metadata", {}),
            "chapters": result.get("chapters", []),
            "status": "metadata_extracted",
        })
        
        log_info("ProcessPDFBackground", f"Metadata extraction completed", {"paper_id": paper_id})
        
        # 6. すべての章を順番に処理
        chapters = result.get("chapters", [])
        if not chapters:
            log_warning("ProcessPDFBackground", f"No chapters found", {"paper_id": paper_id})
            # 空の場合でもエラーではなく、処理完了として扱う
            doc_ref.update({
                "status": "completed", 
                "completed_at": datetime.datetime.now()
            })
            return jsonify({"message": "Processing completed (no chapters found)"}), 200, headers
            
        # 章を順番に処理
        import asyncio
        chapter_results = asyncio.run(process_all_chapters(cache_id, chapters, paper_id, pdf_gs_path))
        
        log_info("ProcessPDFBackground", f"All chapters processed", 
                {"paper_id": paper_id, "chapters_count": len(chapters)})
        
        return jsonify({
            "message": "Processing completed",
            "paper_id": paper_id,
            "chapters_processed": len(chapter_results)
        }), 200, headers
        
    except APIError as e:
        log_error("APIError", e.message, {"details": e.details})
        
        # Firestoreのステータスを 'error' に更新
        if paper_id:
            try:
                db.collection("papers").document(paper_id).update({"status": "error"})
            except Exception as db_error:
                log_error("FirestoreError", "Failed to update Firestore status", {"error": str(db_error)})
                
        return jsonify(e.to_dict()), e.status_code, headers
        
    except Exception as e:
        log_error("UnhandledError", "An internal server error occurred", {"error": str(e)})
        
        # paper_id変数が定義されていない可能性があるため、ローカル変数で確認
        paper_id_local = request_json.get("paper_id") if request_json else None
        
        # Firestoreのステータスを 'error' に更新
        if paper_id_local:
            try:
                db.collection("papers").document(paper_id_local).update({"status": "error"})
            except Exception as db_error:
                log_error("FirestoreError", "Failed to update Firestore status", {"error": str(db_error)})
                
        return jsonify({"error": "An internal server error occurred"}), 500, headers

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