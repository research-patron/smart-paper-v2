"""
Cloud Tasks キュー操作モジュール
PDF処理タスクを非同期に実行するためのヘルパー関数群
"""
import json
import os
import datetime
from google.cloud import tasks_v2
from google.protobuf import timestamp_pb2
from error_handling import log_error, log_info

# 環境変数から設定を取得
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = os.environ.get("TASKS_LOCATION", "us-central1")
QUEUE_NAME = os.environ.get("TASKS_QUEUE_NAME", "translate-pdf-queue")
CLOUD_FUNCTIONS_SA = os.environ.get("CLOUD_FUNCTIONS_SA", f"{PROJECT_ID}@appspot.gserviceaccount.com")

# Cloud FunctionsのベースURL
CLOUD_FUNCTIONS_URL = f"https://{LOCATION}-{PROJECT_ID}.cloudfunctions.net"

# タスクライアントの初期化
tasks_client = None

def initialize_tasks_client():
    """Cloud Tasks クライアントを初期化する"""
    global tasks_client
    if tasks_client is None:
        try:
            tasks_client = tasks_v2.CloudTasksClient()
            log_info("CloudTasks", "Cloud Tasks client initialized successfully")
        except Exception as e:
            log_error("CloudTasksError", "Failed to initialize Cloud Tasks client", {"error": str(e)})
            raise

def create_task(
    function_name: str, 
    payload: dict, 
    task_name: str = None, 
    delay_seconds: int = 0,
    retry_config: dict = None
) -> str:
    """Cloud Tasks キューにタスクを追加する

    Args:
        function_name: 呼び出すCloud Functions関数名
        payload: タスクのペイロード
        task_name: タスク名（ユニークである必要がある）
        delay_seconds: タスクの実行を遅延させる秒数
        retry_config: リトライ設定（省略時はデフォルト設定）

    Returns:
        str: タスク名
    """
    initialize_tasks_client()
    
    # キューパスの作成
    parent = tasks_client.queue_path(PROJECT_ID, LOCATION, QUEUE_NAME)
    
    # 関数URLの作成
    url = f"{CLOUD_FUNCTIONS_URL}/{function_name}"
    
    # タスクの設定
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": url,
            "oidc_token": {
                "service_account_email": CLOUD_FUNCTIONS_SA,
            },
            "headers": {
                "Content-Type": "application/json",
            },
            "body": json.dumps(payload).encode(),
        },
        # タイムアウト時間を9分に設定（Cloud Functionsの最大タイムアウトに合わせる）
        "dispatch_deadline": {"seconds": 9 * 60}
    }
    
    # タスク名の指定（ユニークであること）
    if task_name:
        task["name"] = f"{parent}/tasks/{task_name}"
    
    # 実行遅延の設定
    if delay_seconds > 0:
        execution_time = datetime.datetime.utcnow() + datetime.timedelta(seconds=delay_seconds)
        timestamp = timestamp_pb2.Timestamp()
        timestamp.FromDatetime(execution_time)
        task["schedule_time"] = timestamp
    
    # リトライ設定
    if retry_config:
        task["retry_config"] = retry_config
    
    # 429エラー（リソース枯渇）に対するリトライ設定を調整
    if not retry_config:
        # デフォルトのリトライ設定: 429エラーに対して最大5回、初期遅延10秒、最大遅延5分
        task["retry_config"] = {
            "max_attempts": 5,
            "max_retry_duration": {"seconds": 30 * 60},  # 最大30分
            "min_backoff": {"seconds": 10},
            "max_backoff": {"seconds": 300},  # 5分
            "max_doublings": 5,  # 指数バックオフの最大倍率
        }
    
    try:
        # タスクの作成
        response = tasks_client.create_task(parent=parent, task=task)
        task_id = response.name.split('/')[-1]
        log_info("CloudTasks", f"Task created: {task_id}", {"function": function_name})
        return task_id
    except Exception as e:
        log_error("CloudTasksError", f"Failed to create task for {function_name}", {"error": str(e)})
        raise

def create_extract_metadata_task(paper_id: str, pdf_gs_path: str) -> str:
    """メタデータ抽出タスクを作成する

    Args:
        paper_id: 論文ID
        pdf_gs_path: PDFファイルのパス

    Returns:
        str: タスクID
    """
    payload = {
        "paper_id": paper_id,
        "pdf_gs_path": pdf_gs_path,
        "operation": "extract_metadata"
    }
    
    task_name = f"extract_metadata_{paper_id}"
    return create_task("extract_metadata", payload, task_name)

def create_translate_chapter_task(
    paper_id: str, 
    pdf_gs_path: str, 
    chapter_info: dict,
    delay_seconds: int = 0
) -> str:
    """章翻訳タスクを作成する

    Args:
        paper_id: 論文ID
        pdf_gs_path: PDFファイルのパス
        chapter_info: 章情報（章番号、タイトル、開始ページ、終了ページ）
        delay_seconds: 実行遅延（秒）

    Returns:
        str: タスクID
    """
    payload = {
        "paper_id": paper_id,
        "pdf_gs_path": pdf_gs_path,
        "operation": "translate",
        "chapter_info": chapter_info
    }
    
    # 章番号を含むユニークなタスク名
    task_name = f"translate_chapter_{paper_id}_{chapter_info['chapter_number']}"
    
    # 429エラーに対する特別なリトライ設定
    retry_config = {
        "max_attempts": 3,  # 最大3回
        "max_retry_duration": {"seconds": 3600},  # 最大1時間
        "min_backoff": {"seconds": 30},  # 初期遅延30秒
        "max_backoff": {"seconds": 600},  # 最大遅延10分
        "max_doublings": 3,  # 指数バックオフの最大倍率
    }
    
    return create_task("translate_chapter", payload, task_name, delay_seconds, retry_config)

def create_summarize_chapter_task(
    paper_id: str, 
    pdf_gs_path: str, 
    chapter_info: dict,
    delay_seconds: int = 0
) -> str:
    """章要約タスクを作成する

    Args:
        paper_id: 論文ID
        pdf_gs_path: PDFファイルのパス
        chapter_info: 章情報（章番号、タイトル、開始ページ、終了ページ）
        delay_seconds: 実行遅延（秒）

    Returns:
        str: タスクID
    """
    payload = {
        "paper_id": paper_id,
        "pdf_gs_path": pdf_gs_path,
        "operation": "summarize",
        "chapter_info": chapter_info
    }
    
    # 章番号を含むユニークなタスク名
    task_name = f"summarize_chapter_{paper_id}_{chapter_info['chapter_number']}"
    
    # 429エラーに対する特別なリトライ設定
    retry_config = {
        "max_attempts": 2,  # 最大2回
        "max_retry_duration": {"seconds": 1800},  # 最大30分
        "min_backoff": {"seconds": 60},  # 初期遅延1分
        "max_backoff": {"seconds": 300},  # 最大遅延5分
        "max_doublings": 2,  # 指数バックオフの最大倍率
    }
    
    return create_task("summarize_chapter", payload, task_name, delay_seconds, retry_config)

def create_finalize_task(paper_id: str, delay_seconds: int = 0) -> str:
    """論文処理完了タスクを作成する（翻訳結果の結合、ステータス更新など）

    Args:
        paper_id: 論文ID
        delay_seconds: 実行遅延（秒）

    Returns:
        str: タスクID
    """
    payload = {
        "paper_id": paper_id,
        "operation": "finalize"
    }
    
    task_name = f"finalize_{paper_id}"
    return create_task("finalize_processing", payload, task_name, delay_seconds)