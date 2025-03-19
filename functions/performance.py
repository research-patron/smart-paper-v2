# ~/Desktop/smart-paper-v2/functions/performance.py
import time
import datetime
from google.cloud import firestore
import logging
import os
import uuid
from error_handling import log_error, log_info

# 環境変数から設定を取得
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")

# Firestoreクライアント初期化 (グローバル変数)
_db = None

# 現在の処理情報を一時保存するディクショナリ（paper_idをキーとして使用）
_processing_data = {}

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

def get_current_week_range():
    """
    現在の週の範囲を計算してフォーマットする
    例: 2025_3_18_to_3_24 (火曜日から次の月曜日までの期間)
    """
    now = datetime.datetime.now()
    # 今日の曜日を取得（0は月曜、6は日曜）
    weekday = now.weekday()
    
    # 週の最初の日を計算（月曜日）- 今日が月曜なら今日、それ以外は前週の月曜
    days_to_monday = weekday
    monday = now - datetime.timedelta(days=days_to_monday)
    
    # 週の最後の日を計算（次の日曜日）
    days_to_sunday = 6 - weekday
    sunday = now + datetime.timedelta(days=days_to_sunday)
    
    # フォーマット: YYYY_MM_DD_to_MM_DD
    return f"{monday.year}_{monday.month}_{monday.day}_to_{sunday.month}_{sunday.day}"

def start_processing_session(paper_id, function_name, details=None):
    """
    処理セッションを開始し、開始時間とセッションIDを記録する
    
    Args:
        paper_id: 論文ID（または一意の処理ID）
        function_name: メイン関数名
        details: 処理の詳細情報（オプション）
    
    Returns:
        session_id: 処理セッションID
    """
    if paper_id not in _processing_data:
        _processing_data[paper_id] = {}
    
    # 新しいセッションIDを生成
    session_id = str(uuid.uuid4())
    
    # セッション情報を記録
    _processing_data[paper_id][session_id] = {
        "paper_id": paper_id,
        "function_name": function_name,
        "start_time": time.time(),
        "steps": [],
        "details": details or {}
    }
    
    return session_id

def add_processing_step(paper_id, session_id, step_name, details=None, processing_time_ms=None):
    """
    処理ステップを追加する
    
    Args:
        paper_id: 論文ID
        session_id: 処理セッションID
        step_name: ステップ名
        details: ステップの詳細情報（オプション）
        processing_time_ms: 処理時間（ミリ秒）。指定しない場合はステップの実行時間は記録されない
    """
    # セッションが存在しない場合、回復措置としてセッションを作成
    if paper_id not in _processing_data:
        _processing_data[paper_id] = {}
    
    if session_id not in _processing_data.get(paper_id, {}):
        # セッションが見つからない場合は警告を出し、新しいセッションを作成
        log_info("Performance", f"Session not found, creating new session for paper_id: {paper_id}, session_id: {session_id}")
        _processing_data[paper_id][session_id] = {
            "paper_id": paper_id,
            "function_name": f"recovery_for_{step_name}",
            "start_time": time.time(),
            "steps": [],
            "details": {"recovery": True, "original_step": step_name}
        }
    
    # ステップ情報を記録
    step_info = {
        "step_name": step_name,
        "timestamp": datetime.datetime.now(),
    }
    
    # 詳細情報があれば追加
    if details:
        step_info["details"] = details
    
    # 処理時間があれば追加
    if processing_time_ms is not None:
        step_info["processing_time_ms"] = processing_time_ms
    
    # ステップを追加
    _processing_data[paper_id][session_id]["steps"].append(step_info)

def end_processing_session(paper_id, session_id, success=True, error=None):
    """
    処理セッションを終了し、処理時間をFirestoreに記録する
    
    Args:
        paper_id: 論文ID
        session_id: 処理セッションID
        success: 処理が成功したかどうか
        error: エラー情報（失敗した場合）
    
    Returns:
        処理時間（ミリ秒）
    """
    # セッションが存在しない場合、回復措置としてエラーだけ記録
    if paper_id not in _processing_data or session_id not in _processing_data.get(paper_id, {}):
        log_info("Performance", f"Session not found for ending, creating recovery record for paper_id: {paper_id}, session_id: {session_id}")
        
        # 回復用のセッションを作成
        start_processing_session(paper_id, "recovery_session", {"recovery": True})
        
        # セッションがなくても処理を継続できるよう0を返す
        return 0
    
    # セッション情報を取得
    session_data = _processing_data[paper_id][session_id]
    
    # 終了時間を記録
    end_time = time.time()
    session_data["end_time"] = end_time
    
    # 処理時間を計算（ミリ秒）
    processing_time_ms = (end_time - session_data["start_time"]) * 1000
    session_data["processing_time_ms"] = processing_time_ms
    
    # 処理結果を記録
    session_data["success"] = success
    if error:
        session_data["error"] = error
    
    try:
        # 現在の週の範囲を取得
        week_range = get_current_week_range()
        
        # Firestoreに処理時間を記録
        db = get_db()
        
        # 週範囲ドキュメントへの参照を取得
        week_doc_ref = db.collection("process_time").document(week_range)
        
        # ドキュメントが存在するか確認し、なければ作成
        week_doc = week_doc_ref.get()
        if not week_doc.exists:
            week_doc_ref.set({
                "start_date": datetime.datetime.now(),
                "week_range": week_range,
                "total_processes": 0,
                "created_at": datetime.datetime.now()
            })
        
        # 処理カウンターをインクリメント
        week_doc_ref.update({
            "total_processes": firestore.Increment(1),
            "updated_at": datetime.datetime.now()
        })
        
        # 処理データをサブコレクションに保存
        process_data = {
            "paper_id": paper_id,
            "function_name": session_data["function_name"],
            "start_time": datetime.datetime.fromtimestamp(session_data["start_time"]),
            "end_time": datetime.datetime.fromtimestamp(session_data["end_time"]),
            "processing_time_ms": processing_time_ms,
            "steps": session_data["steps"],
            "success": success,
            "timestamp": datetime.datetime.now(),
        }
        
        # 詳細情報を追加
        if "details" in session_data and session_data["details"]:
            for key, value in session_data["details"].items():
                if value is not None:
                    process_data[key] = value
        
        # エラー情報を追加
        if error:
            process_data["error"] = error
        
        # データをFirestoreに保存
        week_doc_ref.collection("processes").document(session_id).set(process_data)
        
        # セッションデータをクリーンアップ
        del _processing_data[paper_id][session_id]
        if not _processing_data[paper_id]:  # 論文に関するセッションがすべて終了したら
            del _processing_data[paper_id]
        
        log_info("Performance", f"Logged processing time: {session_data['function_name']}, {processing_time_ms:.2f}ms, session_id: {session_id}")
        
        return processing_time_ms
        
    except Exception as e:
        log_error("PerformanceError", f"Error logging processing time: {str(e)}")
        return processing_time_ms

def start_timer(function_name, paper_id=None, details=None):
    """
    タイマーを開始し、セッションIDを返す
    
    Args:
        function_name: 関数名
        paper_id: 論文ID（オプション）
        details: 詳細情報（オプション）
    
    Returns:
        (session_id, paper_id): セッションIDと論文IDのタプル
    """
    # paper_idが指定されていない場合は一時的なIDを生成
    if not paper_id:
        paper_id = f"temp_{uuid.uuid4()}"
    
    # セッションを開始
    session_id = start_processing_session(paper_id, function_name, details)
    
    return (session_id, paper_id)

def add_step(session_id, paper_id, step_name, details=None, processing_time_ms=None):
    """
    処理ステップを追加する便利な関数
    
    Args:
        session_id: セッションID
        paper_id: 論文ID
        step_name: ステップ名
        details: ステップの詳細情報（オプション）
        processing_time_ms: 処理時間（ミリ秒）
    """
    add_processing_step(paper_id, session_id, step_name, details, processing_time_ms)

def stop_timer(session_id, paper_id, success=True, error=None):
    """
    タイマーを停止し、処理時間を記録する
    
    Args:
        session_id: セッションID
        paper_id: 論文ID
        success: 処理が成功したかどうか
        error: エラー情報（失敗した場合）
    
    Returns:
        処理時間（ミリ秒）
    """
    return end_processing_session(paper_id, session_id, success, error)