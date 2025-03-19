# ~/Desktop/smart-paper-v2/functions/performance.py
import time
import datetime
from google.cloud import firestore
import logging
import os
import uuid
from error_handling import log_error, log_info, log_warning

# 環境変数から設定を取得
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")

# Firestoreクライアント初期化 (グローバル変数)
_db = None

# 操作タイプの定義
OPERATION_TRANSLATE = "translate"
OPERATION_SUMMARY = "summary"
OPERATION_METADATA = "metadata"
OPERATION_UNKNOWN = "unknown"

# 現在の処理情報を一時保存するディクショナリ（paper_idをキーとして使用）
_processing_data = {}

# 章ごとのデータを保存するディクショナリ - キー: paper_id
_chapter_data = {}

# 翻訳・要約テキストを保存するディクショナリ
_translated_texts = {}  # キー: paper_id
_summary_texts = {}     # キー: paper_id
_metadata_texts = {}    # キー: paper_id

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

def determine_operation_type(function_name):
    """
    関数名から操作タイプを判断する
    
    Args:
        function_name: 関数名
        
    Returns:
        操作タイプ (translate, summary, metadata, unknown)
    """
    function_name_lower = function_name.lower()
    
    if "translate" in function_name_lower:
        return OPERATION_TRANSLATE
    elif "summary" in function_name_lower or "summarize" in function_name_lower:
        return OPERATION_SUMMARY
    elif "metadata" in function_name_lower or "extract" in function_name_lower:
        return OPERATION_METADATA
    else:
        return OPERATION_UNKNOWN

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
    if not paper_id:
        paper_id = "unknown_paper_id"
        log_warning("Performance", "No paper_id provided to start_processing_session")
    
    if paper_id not in _processing_data:
        _processing_data[paper_id] = {}
    
    # 新しいセッションIDを生成
    session_id = str(uuid.uuid4())
    
    # 操作タイプを判断
    operation_type = determine_operation_type(function_name)
    
    # セッション情報を記録
    _processing_data[paper_id][session_id] = {
        "paper_id": paper_id,
        "function_name": function_name,
        "operation_type": operation_type,
        "start_time": time.time(),
        "steps": [],
        "details": details or {}
    }
    
    # 章データ初期化（翻訳操作の場合）
    if operation_type == OPERATION_TRANSLATE and paper_id not in _chapter_data:
        _chapter_data[paper_id] = []
    
    # paper_id ごとのテキストデータを初期化
    if operation_type == OPERATION_TRANSLATE and paper_id not in _translated_texts:
        _translated_texts[paper_id] = ""
    elif operation_type == OPERATION_SUMMARY and paper_id not in _summary_texts:
        _summary_texts[paper_id] = ""
    elif operation_type == OPERATION_METADATA and paper_id not in _metadata_texts:
        _metadata_texts[paper_id] = ""
    
    return session_id

def add_processing_step(paper_id, session_id, step_name, details=None, processing_time_sec=None):
    """
    処理ステップを追加する
    
    Args:
        paper_id: 論文ID
        session_id: 処理セッションID
        step_name: ステップ名
        details: ステップの詳細情報（オプション）
        processing_time_sec: 処理時間（秒）。旧APIとの互換性のため、ミリ秒で渡された場合は秒に変換
    """
    # temp_ で始まる一時IDを修正
    if paper_id and paper_id.startswith("temp_"):
        # セッションデータから実際のpaper_idを探す
        for actual_id, sessions in _processing_data.items():
            if actual_id != paper_id and session_id in sessions:
                paper_id = actual_id
                log_info("Performance", f"Replaced temp paper_id with actual paper_id: {paper_id}")
                break
    
    # セッションが存在しない場合、回復措置としてセッションを作成
    if paper_id not in _processing_data:
        _processing_data[paper_id] = {}
    
    if session_id not in _processing_data.get(paper_id, {}):
        # セッションが見つからない場合は警告を出し、新しいセッションを作成
        log_info("Performance", f"Session not found, creating new session for paper_id: {paper_id}, session_id: {session_id}")
        _processing_data[paper_id][session_id] = {
            "paper_id": paper_id,
            "function_name": f"recovery_for_{step_name}",
            "operation_type": OPERATION_UNKNOWN,
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
    
    # 処理時間を秒単位で追加
    if processing_time_sec is not None:
        # 非常に大きい値の場合はミリ秒として解釈して変換（下位互換性のため）
        if processing_time_sec > 1000:  # 1000秒以上は通常ありえないので、おそらくミリ秒
            processing_time_sec = processing_time_sec / 1000.0
            log_warning("Performance", f"Detected millisecond value in processing_time_sec, converting to seconds: {processing_time_sec}")
        
        step_info["processing_time_sec"] = processing_time_sec
    
    # ステップを追加
    _processing_data[paper_id][session_id]["steps"].append(step_info)

def add_chapter_data(paper_id, chapter_number, title, translated_text, processing_time_sec=None):
    """
    章ごとの翻訳データを追加する
    
    Args:
        paper_id: 論文ID
        chapter_number: 章番号
        title: 章タイトル
        translated_text: 翻訳テキスト
        processing_time_sec: 処理時間（秒）
    """
    if paper_id not in _chapter_data:
        _chapter_data[paper_id] = []
    
    # 章データを追加
    _chapter_data[paper_id].append({
        "chapter_number": chapter_number,
        "title": title,
        "translated_text": translated_text,
        "processing_time_sec": processing_time_sec,
        "timestamp": datetime.datetime.now()
    })
    
    # 翻訳テキストを追記 (全体のテキストとしても保存)
    if paper_id not in _translated_texts:
        _translated_texts[paper_id] = ""
    
    # 章見出しと翻訳テキストを連結
    chapter_text = f"\n\n<h2>{chapter_number}. {title}</h2>\n\n{translated_text}"
    _translated_texts[paper_id] += chapter_text

def save_translated_text(session_id, translated_text):
    """
    翻訳テキストを保存する便利な関数
    
    Args:
        session_id: セッションID
        translated_text: 翻訳テキスト
    """
    if not translated_text:
        return
        
    # セッションからpaper_idを取得
    paper_id = None
    for pid, sessions in _processing_data.items():
        if session_id in sessions:
            paper_id = pid
            break
    
    if not paper_id:
        log_warning("Performance", f"No paper_id found for session_id: {session_id} when saving translated text")
        return
    
    # テキストを保存
    _translated_texts[paper_id] = translated_text

def save_summary_text(session_id, summary_text):
    """
    要約テキストを保存する便利な関数
    
    Args:
        session_id: セッションID
        summary_text: 要約テキスト
    """
    if not summary_text:
        return
        
    # セッションからpaper_idを取得
    paper_id = None
    for pid, sessions in _processing_data.items():
        if session_id in sessions:
            paper_id = pid
            break
    
    if not paper_id:
        log_warning("Performance", f"No paper_id found for session_id: {session_id} when saving summary text")
        return
    
    # テキストを保存
    _summary_texts[paper_id] = summary_text

def end_processing_session(paper_id, session_id, success=True, error=None):
    """
    処理セッションを終了し、処理時間をFirestoreに記録する
    
    Args:
        paper_id: 論文ID
        session_id: 処理セッションID
        success: 処理が成功したかどうか
        error: エラー情報（失敗した場合）
    
    Returns:
        処理時間（秒）
    """
    # temp_ で始まる一時IDを修正
    if paper_id and paper_id.startswith("temp_"):
        # セッションデータから実際のpaper_idを探す
        for actual_id, sessions in _processing_data.items():
            if actual_id != paper_id and session_id in sessions:
                # 実際のIDが見つかった場合、データを移行
                paper_id = actual_id
                log_info("Performance", f"Replaced temp paper_id with actual paper_id: {paper_id}")
                break
    
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
    
    # 処理時間を計算
    processing_time_sec = (end_time - session_data["start_time"])
    session_data["processing_time_sec"] = processing_time_sec
    
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
        
        # 操作タイプに基づいてデータ保存
        operation_type = session_data.get("operation_type", OPERATION_UNKNOWN)
        
        # 基本的な処理データを準備
        process_data = {
            "paper_id": paper_id,
            "function_name": session_data["function_name"],
            "start_time": datetime.datetime.fromtimestamp(session_data["start_time"]),
            "end_time": datetime.datetime.fromtimestamp(session_data["end_time"]),
            "processing_time_sec": processing_time_sec,
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
        
        # オペレーションタイプ別のデータを保存
        if operation_type in [OPERATION_TRANSLATE, OPERATION_SUMMARY, OPERATION_METADATA]:
            # 参照に必要なドキュメントパス
            process_ref = week_doc_ref.collection("processes").document(paper_id)
            operation_coll = process_ref.collection(operation_type)
            
            # オペレーションタイプ別のデータを追加
            if operation_type == OPERATION_TRANSLATE:
                # メインデータドキュメント
                data_doc_ref = operation_coll.document("data")
                
                # 翻訳テキストを追加
                translated_text = _translated_texts.get(paper_id, "")
                if translated_text:
                    # テキストが長すぎる場合は切り詰める（Firestoreのドキュメントサイズ制限を考慮）
                    if len(translated_text) > 100000:  # 約10万文字でトリミング
                        process_data["translated_text"] = translated_text[:100000] + "... (続き)"
                        process_data["text_truncated"] = True
                    else:
                        process_data["translated_text"] = translated_text
                
                # 章データを取得
                chapter_data = _chapter_data.get(paper_id, [])
                
                if chapter_data:
                    # 章番号で昇順ソート
                    sorted_chapters = sorted(chapter_data, key=lambda x: x["chapter_number"])
                    
                    # 1. すべての章のサマリーを作成 (メインのデータドキュメントに保存)
                    chapters_summary = []
                    for chapter in sorted_chapters:
                        chapters_summary.append({
                            "chapter_number": chapter["chapter_number"],
                            "title": chapter["title"],
                            "processing_time_sec": chapter.get("processing_time_sec", 0)
                        })
                    
                    process_data["chapters_summary"] = chapters_summary
                    
                    # 2. 各章の詳細データを別々のドキュメントに保存 (サブドキュメント)
                    for chapter in sorted_chapters:
                        chapter_num = chapter["chapter_number"]
                        # 章番号をゼロパディングして常に2桁に (例: 1 → 01, 10 → 10)
                        # これにより章が昇順でソートされる
                        chapter_doc_id = f"chapter_{chapter_num:02d}"
                        
                        chapter_doc_ref = operation_coll.document(chapter_doc_id)
                        chapter_doc_ref.set({
                            "chapter_number": chapter_num,
                            "title": chapter["title"],
                            "translated_text": chapter["translated_text"],
                            "processing_time_sec": chapter.get("processing_time_sec", 0),
                            "timestamp": chapter.get("timestamp", datetime.datetime.now())
                        })
                
                # メインデータドキュメントに処理概要を保存
                data_doc_ref.set(process_data, merge=True)
            
            elif operation_type == OPERATION_SUMMARY:
                # 要約テキストを追加
                summary_text = _summary_texts.get(paper_id, "")
                if summary_text:
                    process_data["summary_text"] = summary_text
                
                # データを保存/更新
                data_doc_ref = operation_coll.document("data")
                data_doc_ref.set(process_data, merge=True)
            
            elif operation_type == OPERATION_METADATA:
                # メタデータテキストを追加
                metadata_text = _metadata_texts.get(paper_id, "")
                if metadata_text:
                    process_data["metadata_text"] = metadata_text
                
                # データを保存/更新
                data_doc_ref = operation_coll.document("data")
                data_doc_ref.set(process_data, merge=True)
        
        else:
            # 未知の操作タイプは「other」カテゴリに保存
            other_doc_ref = week_doc_ref.collection("processes").document(paper_id).collection("other").document(session_id)
            other_doc_ref.set(process_data)
        
        # クリーンアップ
        # セッションデータを削除
        del _processing_data[paper_id][session_id]
        if not _processing_data[paper_id]:
            del _processing_data[paper_id]
        
        # 処理が成功した場合、キャッシュデータをクリーンアップ
        if success:
            if paper_id in _translated_texts and operation_type == OPERATION_TRANSLATE:
                del _translated_texts[paper_id]
            if paper_id in _summary_texts and operation_type == OPERATION_SUMMARY:
                del _summary_texts[paper_id]
            if paper_id in _metadata_texts and operation_type == OPERATION_METADATA:
                del _metadata_texts[paper_id]
            if paper_id in _chapter_data and operation_type == OPERATION_TRANSLATE:
                del _chapter_data[paper_id]
        
        log_info("Performance", f"Logged processing time: {session_data['function_name']}, {processing_time_sec:.2f}s, paper_id: {paper_id}, operation: {operation_type}")
        
        return processing_time_sec
        
    except Exception as e:
        log_error("PerformanceError", f"Error logging processing time: {str(e)}")
        return processing_time_sec

# 以下は外部から呼び出される関数

def start_timer(function_name, paper_id=None, details=None):
    """
    タイマーを開始し、セッションIDを返す
    
    Args:
        function_name: 関数名
        paper_id: 論文ID（必須）
        details: 詳細情報（オプション）
    
    Returns:
        (session_id, paper_id): セッションIDと論文IDのタプル
    """
    # paper_idがない場合は警告を表示して仮のIDを生成
    if not paper_id:
        # 一時IDは使用せず、ユーザー向けの警告を表示
        paper_id = "unknown_paper_id"
        log_warning("Performance", "No paper_id provided to start_timer")
    
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
        processing_time_ms: 処理時間（ミリ秒）- 下位互換性のために維持
    """
    # ミリ秒から秒への変換（下位互換性のために）
    processing_time_sec = None
    if processing_time_ms is not None:
        processing_time_sec = processing_time_ms / 1000.0
    
    add_processing_step(paper_id, session_id, step_name, details, processing_time_sec)

def stop_timer(session_id, paper_id, success=True, error=None):
    """
    タイマーを停止し、処理時間を記録する
    
    Args:
        session_id: セッションID
        paper_id: 論文ID
        success: 処理が成功したかどうか
        error: エラー情報（失敗した場合）
    
    Returns:
        処理時間（秒）
    """
    return end_processing_session(paper_id, session_id, success, error)

# 章データを追加するためのヘルパー関数
def add_chapter_translation(session_id, paper_id, chapter_number, title, translated_text, processing_time_sec=None):
    """
    章ごとの翻訳データを追加する便利な関数
    
    Args:
        session_id: セッションID
        paper_id: 論文ID
        chapter_number: 章番号
        title: 章タイトル
        translated_text: 翻訳テキスト
        processing_time_sec: 処理時間（秒）
    """
    # temp_ で始まる一時IDを修正
    if paper_id and paper_id.startswith("temp_"):
        # セッションデータから実際のpaper_idを探す
        for actual_id, sessions in _processing_data.items():
            if actual_id != paper_id and session_id in sessions:
                paper_id = actual_id
                log_info("Performance", f"Replaced temp paper_id with actual paper_id in add_chapter_translation: {paper_id}")
                break
    
    # セッションデータが存在するか確認
    if paper_id not in _processing_data or not any(session_id in sessions for sessions in _processing_data.values()):
        log_warning("Performance", f"No valid session found for session_id: {session_id}, paper_id: {paper_id}")
        return
    
    add_chapter_data(paper_id, chapter_number, title, translated_text, processing_time_sec)

# 下位互換性のための関数
def save_metadata_text(session_id, metadata_text):
    """
    メタデータテキストを保存する便利な関数
    
    Args:
        session_id: セッションID
        metadata_text: メタデータテキスト
    """
    if not metadata_text:
        return
        
    # セッションからpaper_idを取得
    paper_id = None
    for pid, sessions in _processing_data.items():
        if session_id in sessions:
            paper_id = pid
            break
    
    if not paper_id:
        log_warning("Performance", f"No paper_id found for session_id: {session_id} when saving metadata text")
        return
    
    # テキストを保存
    _metadata_texts[paper_id] = metadata_text