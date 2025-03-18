# ~/Desktop/smart-paper-v2/functions/performance.py
import time
import datetime
from google.cloud import firestore
import logging
import os
from error_handling import log_error, log_info

# 環境変数から設定を取得
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")

# Firestoreクライアント初期化 (グローバル変数)
_db = None

def get_db():
    """Firestoreクライアントを取得または初期化する"""
    global _db
    if _db is None:
        try:
            _db = firestore.Client()
        except Exception as e:
            log_error("FirestoreError", f"Failed to initialize Firestore client: {str(e)}")
            raise
    return _db

def log_processing_time(function_name: str, processing_time_ms: float, details: dict = None):
    """
    関数の処理時間をFirestoreに記録する

    Args:
        function_name: 関数名
        processing_time_ms: 処理時間 (ミリ秒)
        details: 追加詳細情報 (オプション)
    """
    try:
        # Firestoreクライアント取得
        db = get_db()
        
        # 現在の週を特定 (ISO形式: YYYY-WW)
        current_date = datetime.datetime.now()
        year = current_date.isocalendar()[0]
        week = current_date.isocalendar()[1]
        week_id = f"{year}-{week:02d}"
        
        # データを準備
        perf_data = {
            "function_name": function_name,
            "processing_time_ms": processing_time_ms,
            "timestamp": current_date,
            "week_id": week_id
        }
        
        # 追加の詳細情報があれば追加
        if details:
            for key, value in details.items():
                if value is not None:
                    perf_data[key] = value
        
        # Firestoreに保存
        # コレクション: process_time
        # ドキュメント: 自動生成ID
        db.collection("process_time").add(perf_data)
        
        log_info("Performance", f"Logged processing time: {function_name}, {processing_time_ms:.2f}ms, week: {week_id}")
        
    except Exception as e:
        log_error("PerformanceError", f"Error logging processing time: {str(e)}")

def start_timer():
    """タイマーを開始し、開始時間を返す"""
    return time.time()

def stop_timer(start_time, function_name, details=None):
    """
    タイマーを停止し、処理時間を記録する
    
    Args:
        start_time: 開始時間 (time.time()の結果)
        function_name: 関数名
        details: 追加詳細情報 (オプション)
    """
    end_time = time.time()
    processing_time_ms = (end_time - start_time) * 1000
    log_processing_time(function_name, processing_time_ms, details)
    return processing_time_ms