import functions_framework
from flask import jsonify, Request
from google.cloud import firestore
from google.cloud import storage
from google.cloud import tasks_v2
from google.protobuf import timestamp_pb2
import datetime
import json
import os

# 他のモジュールから関数をインポート
from process_pdf import (
    create_cached_content,
    process_with_cache,
    cleanup_cache,
    log_error
)

# Firestore, Storageクライアントの初期化
db = firestore.Client()
storage_client = storage.Client()
tasks_client = tasks_v2.CloudTasksClient()

# 環境変数から設定を取得
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = "us-central1"  # Cloud Functions, Cloud Tasksのリージョン
QUEUE = "translate-pdf-queue"  # Cloud Tasksキュー名
CLOUD_FUNCTIONS_URL = f"https://{LOCATION}-{PROJECT_ID}.cloudfunctions.net"
BUCKET_NAME = os.environ.get("BUCKET_NAME", f"{PROJECT_ID}-storage")  # バケット名

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
                "service_account_email": os.environ.get("CLOUD_FUNCTIONS_SA"),  # 環境変数からサービスアカウントを取得
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

    response = tasks_client.create_task(parent=parent, task=task)
    return response.name

@functions_framework.http
def process_pdf(request: Request):
    """
    PDFアップロードを受け付け、Cloud Storageへの保存、メタデータ抽出、Cloud Tasksへのタスク追加を行う
    """
    try:
        # 1. リクエストのバリデーション
        if not request.method == "POST":
            return jsonify({"error": "Method not allowed"}), 405
        if not request.files or "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        pdf_file = request.files["file"]
        if not pdf_file.filename.lower().endswith(".pdf"):
            return jsonify({"error": "Invalid file type"}), 400
        if pdf_file.content_length > 20 * 1024 * 1024:  # 20MB limit
            return jsonify({"error": "File too large"}), 400

        # 2. FirebaseのCloud StorageにPDFを保存
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S-%f")
        file_name = f"{timestamp}_{pdf_file.filename}"
        blob = storage_client.bucket(BUCKET_NAME).blob(f"papers/{file_name}")
        blob.upload_from_file(pdf_file, content_type="application/pdf")
        pdf_gs_path = f"gs://{BUCKET_NAME}/papers/{file_name}"

        # 3. Firestoreにドキュメントを作成 (初期ステータス: pending)
        user_id = request.auth.uid if hasattr(request, 'auth') and request.auth else None
        doc_ref = db.collection("papers").add({
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
        paper_id = doc_ref[1].id

        # 4. メタデータ抽出タスクをCloud Tasksに追加
        cache_id = f"{file_name}_{timestamp}"
        payload = {
            "pdf_gs_path": pdf_gs_path,
            "cache_id": cache_id,
            "paper_id": paper_id,
            "operation": "extract_metadata",
        }
        create_task(payload, task_name=f"extract_metadata_{paper_id}")

        # 5. クライアントにレスポンスを返す (FirestoreドキュメントID)
        return jsonify({"paper_id": paper_id}), 200

    except Exception as e:
        log_error("CloudFunctionsError", "An error occurred in process_pdf", {"error": str(e)})
        return jsonify({"error": "An internal server error occurred."}), 500

@functions_framework.http
def process_pdf_task(request: Request):
    """
    Cloud Tasksからトリガーされ、実際のPDF処理（翻訳、要約、メタデータ抽出、章構成抽出）を行う
    """
    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return jsonify({"error": "No JSON payload received"}), 400
            
        pdf_gs_path = request_json.get("pdf_gs_path")
        cache_id = request_json.get("cache_id")
        paper_id = request_json.get("paper_id")
        operation = request_json.get("operation")
        
        if not all([pdf_gs_path, cache_id, paper_id, operation]):
            return jsonify({"error": "Required fields missing from payload"}), 400

        # メタデータ抽出タスク
        if operation == "extract_metadata":
            # 初回のみコンテキストキャッシュを作成
            file_name = pdf_gs_path.split("/")[-1].split(".")[0]
            cached_content_name = create_cached_content(pdf_gs_path, file_name)

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
                return jsonify({"error": "Chapter info missing for translate task"}), 400
            
            # 翻訳処理
            translate_result = process_with_cache(cache_id, "translate", chapter_info)

            # Firestore (translated_chapters サブコレクション) に結果を保存
            doc_ref = db.collection("papers").document(paper_id)
            doc_ref.collection("translated_chapters").add(translate_result)

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
                return jsonify({"error": "Chapter info missing for summarize task"}), 400
            
            # 要約処理
            summary_result = process_with_cache(cache_id, "summarize", chapter_info)

            # Firestoreに結果を保存
            doc_ref = db.collection("papers").document(paper_id)
            # 各章の要約を結合して、論文全体の要約とする
            current_summary = doc_ref.get().to_dict().get("summary", "")
            updated_summary = f"{current_summary}\n\n**Chapter {chapter_info['chapter_number']}:**\n{summary_result['summary']}"
            doc_ref.update({"summary": updated_summary})

            # 全ての章の翻訳・要約が完了したか確認
            # (Cloud Tasksの仕様上、順序は保証されないため、translated_chaptersの数とchaptersの数を比較)
            translated_chapters_count = len(list(doc_ref.collection("translated_chapters").get()))
            chapters = doc_ref.get().to_dict().get("chapters", [])
            chapters_count = len(chapters)
            
            if translated_chapters_count == chapters_count:
                # 論文全体の翻訳結果を結合
                all_translated_text = ""
                for chapter_doc in doc_ref.collection("translated_chapters").get():
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
                else:
                    # Firestoreに保存
                    doc_ref.update({
                        "translated_text_path": None, 
                        "translated_text": all_translated_text,
                        "status": "completed",
                        "completed_at": datetime.datetime.now()
                    })

                # コンテキストキャッシュの削除 (全ての処理が完了した後)
                cleanup_cache(cache_id)

        # 関連論文推薦タスク
        elif operation == "recommend_related_papers":
            # 仮のダミーデータを使用 (本来は関連論文APIなどを使用)
            related_papers = [
                {"title": "Related Paper 1", "doi": "10.1234/abcd"},
                {"title": "Related Paper 2", "doi": "10.5678/efgh"},
                {"title": "Related Paper 3", "doi": "10.9101/ijkl"},
            ]
            doc_ref = db.collection("papers").document(paper_id)
            doc_ref.update({"related_papers": related_papers})

        return jsonify({"message": f"{operation} task completed"}), 200

    except Exception as e:
        log_error("CloudFunctionsError", "An error occurred in process_pdf_task", {"error": str(e)})
        # Firestoreのステータスを 'error' に更新
        if "paper_id" in request_json:
            try:
                db.collection("papers").document(paper_id).update({"status": "error"})
            except Exception as db_error:
                log_error("FirestoreError", "Failed to update Firestore status", {"error": str(db_error)})
        return jsonify({"error": "An internal server error occurred."}), 500

@functions_framework.http
def get_signed_url(request: Request):
    """
    Cloud StorageのファイルへのURLを取得する
    """
    try:
        request_json = request.get_json(silent=True)
        if not request_json:
            return jsonify({"error": "No JSON payload received"}), 400
            
        file_path = request_json.get("filePath")
        if not file_path:
            return jsonify({"error": "File path is required"}), 400
        
        # gs://バケット名/パス の形式から、バケット名とオブジェクト名を抽出
        if file_path.startswith("gs://"):
            file_path = file_path[5:]  # "gs://" を削除
            
        bucket_name, object_name = file_path.split("/", 1)
        
        # 署名付きURLを生成（有効期限は5分）
        blob = storage_client.bucket(bucket_name).blob(object_name)
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=5),
            method="GET"
        )
        
        return jsonify({"url": url}), 200
        
    except Exception as e:
        log_error("CloudFunctionsError", "An error occurred in get_signed_url", {"error": str(e)})
        return jsonify({"error": "An internal server error occurred."}), 500