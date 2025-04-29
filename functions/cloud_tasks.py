# functions/cloud_tasks.py
from google.cloud import tasks_v2
from google.protobuf import timestamp_pb2
import datetime
import os
import json
import logging
from error_handling import log_error, log_info

# Cloud Tasks関連の設定
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = os.environ.get("FUNCTION_REGION", "us-central1")
QUEUE_NAME = "paper-processing-queue"  # Cloud Tasksのキュー名

def initialize_tasks_client():
    """Cloud Tasksクライアントを初期化"""
    try:
        return tasks_v2.CloudTasksClient()
    except Exception as e:
        log_error("TasksError", f"Failed to initialize Cloud Tasks client: {str(e)}")
        raise

def create_paper_translation_task(paper_id: str, chapter_info: dict):
    """
    章の翻訳処理をCloud Tasksに登録する
    
    Args:
        paper_id: 論文ID
        chapter_info: 章の情報
    
    Returns:
        task_name: 作成されたタスク名
    """
    try:
        client = initialize_tasks_client()
        parent = client.queue_path(PROJECT_ID, LOCATION, QUEUE_NAME)
        
        # タスク実行先の設定（Cloud Functions）
        function_url = f"https://{LOCATION}-{PROJECT_ID}.cloudfunctions.net/process_chapter_translation"
        
        # タスクのペイロード
        payload = {
            "paper_id": paper_id,
            "chapter_info": chapter_info
        }
        
        # リクエストの作成
        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": function_url,
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": json.dumps(payload).encode()
            }
        }
        
        # タスクのスケジューリング
        response = client.create_task(request={"parent": parent, "task": task})
        task_name = response.name
        
        log_info("CloudTasks", f"Created translation task for chapter {chapter_info.get('chapter_number')}", 
                {"paper_id": paper_id, "task_name": task_name})
        
        return task_name
    
    except Exception as e:
        log_error("TasksError", f"Failed to create translation task: {str(e)}", 
                 {"paper_id": paper_id, "chapter_number": chapter_info.get('chapter_number')})
        raise

def create_paper_summary_task(paper_id: str):
    """
    論文要約処理をCloud Tasksに登録する
    
    Args:
        paper_id: 論文ID
    
    Returns:
        task_name: 作成されたタスク名
    """
    try:
        client = initialize_tasks_client()
        parent = client.queue_path(PROJECT_ID, LOCATION, QUEUE_NAME)
        
        # タスク実行先の設定（Cloud Functions）
        function_url = f"https://{LOCATION}-{PROJECT_ID}.cloudfunctions.net/process_paper_summary"
        
        # タスクのペイロード
        payload = {
            "paper_id": paper_id
        }
        
        # リクエストの作成
        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": function_url,
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": json.dumps(payload).encode()
            }
        }
        
        # タスクのスケジューリング
        response = client.create_task(request={"parent": parent, "task": task})
        task_name = response.name
        
        log_info("CloudTasks", f"Created summary task for paper {paper_id}", 
                {"paper_id": paper_id, "task_name": task_name})
        
        return task_name
    
    except Exception as e:
        log_error("TasksError", f"Failed to create summary task: {str(e)}", 
                 {"paper_id": paper_id})
        raise

def create_task_with_delay(task_type: str, paper_id: str, params: dict = None, delay_seconds: int = 0):
    """
    遅延付きでCloud Tasksにタスクを登録する一般化関数
    
    Args:
        task_type: タスクの種類 ('translation', 'summary', 'completion_check')
        paper_id: 論文ID
        params: 追加パラメータ
        delay_seconds: 遅延秒数
        
    Returns:
        task_name: 作成されたタスク名
    """
    try:
        client = initialize_tasks_client()
        parent = client.queue_path(PROJECT_ID, LOCATION, QUEUE_NAME)
        
        # タスク種類に応じたエンドポイント
        endpoints = {
            'translation': 'process_chapter_translation',
            'summary': 'process_paper_summary',
            'completion_check': 'check_paper_completion'
        }
        
        if task_type not in endpoints:
            raise ValueError(f"Unknown task type: {task_type}")
        
        # タスク実行先の設定（Cloud Functions）
        function_url = f"https://{LOCATION}-{PROJECT_ID}.cloudfunctions.net/{endpoints[task_type]}"
        
        # タスクのペイロード
        payload = {
            "paper_id": paper_id
        }
        
        # 追加パラメータがあれば統合
        if params:
            payload.update(params)
        
        # タスクの作成
        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": function_url,
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": json.dumps(payload).encode()
            }
        }
        
        # 遅延指定がある場合
        if delay_seconds > 0:
            # 現在時刻から指定秒数後の時刻を計算
            d = datetime.datetime.utcnow() + datetime.timedelta(seconds=delay_seconds)
            
            # Protobuf形式のタイムスタンプに変換
            timestamp = timestamp_pb2.Timestamp()
            timestamp.FromDatetime(d)
            
            # タスクに実行時刻を設定
            task["schedule_time"] = timestamp
        
        # タスクのスケジューリング
        response = client.create_task(request={"parent": parent, "task": task})
        task_name = response.name
        
        log_info("CloudTasks", f"Created {task_type} task for paper {paper_id} with delay {delay_seconds}s", 
                {"paper_id": paper_id, "task_name": task_name})
        
        return task_name
    
    except Exception as e:
        log_error("TasksError", f"Failed to create {task_type} task: {str(e)}", 
                 {"paper_id": paper_id})
        raise

def create_completion_check_task(paper_id: str, delay_seconds: int = 30):
    """
    論文処理完了チェックタスクを登録する（翻訳・要約が完了しているか確認）
    
    Args:
        paper_id: 論文ID
        delay_seconds: 遅延秒数
    
    Returns:
        task_name: 作成されたタスク名
    """
    return create_task_with_delay('completion_check', paper_id, None, delay_seconds)