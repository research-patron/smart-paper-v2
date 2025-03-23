import json
import re
import os
import time
import random
from typing import Dict, Optional, Any, List
from performance import (
    start_timer, 
    stop_timer, 
    add_step, 
    save_translated_text, 
    save_summary_text,
    save_metadata_text,
    add_chapter_translation
)
from vertex import (
    initialize_vertex_ai,
    get_model,
    start_chat_session,
    process_with_chat,
    end_chat_session,
    process_pdf_content,
    process_json_response
)
from error_handling import (
    log_error,
    log_info,
    log_warning,
    VertexAIError,
    ValidationError
)

# 使用するプロンプトファイルのパス
TRANSLATION_PROMPT_FILE = ""
SUMMARY_PROMPT_FILE = "./prompts/summary_prompt_v1.json"
METADATA_AND_CHAPTER_PROMPT_FILE = ""

# デフォルトのプロンプト (プロンプトファイルが読み込めない場合に使用)
DEFAULT_TRANSLATION_PROMPT = """
あなたは学術論文の翻訳者です。与えられた英語または他の言語の論文を日本語に翻訳してください。
翻訳は学術的に正確であるべきですが、読みやすさも考慮してください。
専門用語は適切な日本語訳または原語のままにしてください。
数式、図表の参照、引用は原文のまま残してください。

以下の情報を使用して、指定された章（チャプター）だけを翻訳してください：
Chapter Number: {chapter_number}
Start Page: {start_page}
End Page: {end_page}
Chapter Title: {chapter_title}

PDF内の指定されたページ範囲から、その章だけを翻訳してください。以前の翻訳結果には言及せずに、
新しく翻訳を行ってください。

重要な指示：
1. 章の見出しは必ず「数字. タイトル」の形式にしてください。例えば「Chapter 3: Results and Discussion」は「3. 結果と考察」としてください。
2. サブ見出しも同様に「3.1. 実験結果」のような形式にしてください。
3. 翻訳したテキストは<p>タグで段落を区切ってください。
4. 見出しは<h2>、<h3>などの適切なタグを使用してください。

出力形式：
```json
{
  "translated_text": "翻訳されたテキスト（HTMLマークアップ形式）"
}
```
"""

DEFAULT_SUMMARY_PROMPT = """
あなたは学術論文を要約する専門家です。
PDFの内容全体を考慮した上で、論文全体の要約を生成してください。
要約は日本語で作成し、論文の重要なポイント、方法論、結果、結論を含めてください。
章ごとに分けずに、一つのまとまった要約として作成してください。

出力形式：
```json
{
  "summary": "論文全体の要約（500〜800字程度）"
}
```
"""

DEFAULT_METADATA_PROMPT = """
あなたは学術論文のメタデータと章構成を抽出するAIアシスタントです。
与えられた論文から、以下の情報を抽出してJSON形式で出力してください:

**メタデータ:**
* title (タイトル): 論文のタイトル
* authors (著者): 著者のリスト
    * name (氏名): 著者の氏名
    * affiliation (所属): 著者の所属機関 (可能な場合)
* year (出版年): 論文の出版年
* journal (ジャーナル名): 論文が掲載されたジャーナル名
* doi (DOI): 論文の DOI
* keywords (キーワード): 論文のキーワード (複数)
* abstract (要約): 論文の要約

**章構成:**
* chapters (章): 章のリスト
    * chapter_number (章番号): アラビア数字で表記 (例: 1, 2, 3)。章番号がない場合は、論文の先頭からの通し番号を付与してください。
    * title (章タイトル): 章のタイトル。タイトルがない場合は、「(章番号) の内容」と記述してください。
    * start_page (開始ページ): 章の開始ページ番号。
    * end_page (終了ページ): 章の終了ページ番号。

出力形式:
```json
{
 "metadata": {
  "title": "",
  "authors": [
   {
    "name": "",
    "affiliation": ""
   }
  ],
  "year": 0,
  "journal": "",
  "doi": "",
  "keywords": [],
  "abstract": ""
 },
 "chapters": [
  {
   "chapter_number": 0,
   "title": "",
   "start_page": 0,
   "end_page": 0
  }
 ]
}
```
"""

def load_prompt(filename: str) -> str:
    """
    JSONファイルからプロンプトを読み込む

    Args:
        filename: プロンプトファイル名 (例: "translation_prompt.json")

    Returns:
        str: プロンプト文字列
    """
    try:
        with open(filename, "r", encoding="utf-8") as f:
            prompt = json.loads(f.read())
        return prompt["prompt"]  # プロンプトはJSONの "prompt" キーに格納
    except Exception as e:
        log_error("PromptLoadError", f"Failed to load prompt: {filename}", {"error": str(e)})
        # デフォルトのプロンプトを返す
        if "translation" in filename:
            return DEFAULT_TRANSLATION_PROMPT
        elif "summary" in filename:
            return DEFAULT_SUMMARY_PROMPT
        elif "metadata" in filename:
            return DEFAULT_METADATA_PROMPT
        else:
            raise ValueError(f"Unknown prompt type: {filename}")

# エクスポネンシャルバックオフ付きリトライ関数
def retry_with_backoff(func, max_retries=0, base_delay=1.0, max_delay=60.0):
    """
    指数関数的バックオフ付きのリトライを行う関数

    Args:
        func: リトライする関数
        max_retries: 最大リトライ回数
        base_delay: 初期待機時間（秒）
        max_delay: 最大待機時間（秒）

    Returns:
        関数の実行結果
    """
    retries = 0
    while True:
        try:
            return func()
        except Exception as e:
            if retries >= max_retries:
                log_error("RetryError", f"Maximum retries reached", {"retries": retries, "error": str(e)})
                raise
            
            delay = min(base_delay * (2 ** retries) + random.uniform(0, 1), max_delay)
            log_warning("RetryWarning", f"Retry attempt {retries + 1}/{max_retries} after {delay:.2f}s delay",
                      {"error": str(e)})
            time.sleep(delay)
            retries += 1

def process_all_chapters(chapters: list, paper_id: str, pdf_gs_path: str, parent_session_id=None) -> list:
    """
    すべての章を順番に処理する（同期処理版）
    
    Args:
        chapters: 章情報のリスト
        paper_id: 論文ID
        pdf_gs_path: PDFのパス
        parent_session_id: 親処理のセッションID（オプション）
        
    Returns:
        list: 各章の処理結果リスト
    """
    # 処理時間測定開始 - paper_idを必ず渡す
    session_id, _ = start_timer("process_all_chapters", paper_id, {"chapters_count": len(chapters)})
    
    from google.cloud import firestore
    from google.cloud import storage
    import datetime
    
    db = firestore.Client()
    storage_client = storage.Client()
    BUCKET_NAME = os.environ.get("BUCKET_NAME", f"{os.environ.get('GOOGLE_CLOUD_PROJECT')}.appspot.com")
    
    try:
        doc_ref = db.collection("papers").document(paper_id)

        # ステータスを処理中に更新
        doc_ref.update({
            "status": "processing",
            "progress": 5
        })
        
        add_step(session_id, paper_id, "processing_started")

        # チャットセッションを初期化
        start_chat_session(paper_id, pdf_gs_path)
        log_info("ProcessAllChapters", f"Initialized chat session for paper", {"paper_id": paper_id})
        add_step(session_id, paper_id, "chat_session_initialized")

        # 各章を順番に処理
        results = []
        # 章番号でソートして処理
        sorted_chapters = sorted(chapters, key=lambda x: x["chapter_number"])
        total_chapters = len(sorted_chapters)
        
        # 全章の翻訳テキストを結合するための変数
        all_translated_text = ""
        
        # 1. 翻訳フェーズ - 各章を順番に翻訳
        for i, chapter in enumerate(sorted_chapters, 1):
            try:
                log_info("ProcessAllChapters", f"Processing chapter {i}/{total_chapters}: Chapter {chapter['chapter_number']}",
                         {"paper_id": paper_id})
                
                # 翻訳前に少し待機（レート制限対策）
                time.sleep(2.0 + random.uniform(0.5, 1.5))
                
                # 章処理の開始時間を記録
                chapter_start = time.time()
                
                # 翻訳処理 - paper_idを確実に渡す
                translate_result = process_content(pdf_gs_path, paper_id, "translate", chapter)

                # 章処理の時間を記録
                chapter_time_ms = (time.time() - chapter_start) * 1000
                chapter_time_sec = chapter_time_ms / 1000.0

                # 結果を確認して構造化
                if "chapter" in translate_result and "translated_text" in translate_result:
                    # 新しい構造の結果をサブチャプターも含めて処理
                    chapter_title = translate_result["chapter"]
                    translated_text = translate_result["translated_text"]
                    
                    # サブチャプターがあれば構造化されたHTMLを生成
                    html_content = translated_text
                    
                    if "sub_chapters" in translate_result and translate_result["sub_chapters"]:
                        for sub_chapter in translate_result["sub_chapters"]:
                            if isinstance(sub_chapter, dict) and "title" in sub_chapter and "content" in sub_chapter:
                                html_content += f"\n\n<h3>{sub_chapter['title']}</h3>\n\n"
                                html_content += sub_chapter["content"]
                    
                    # 最終的な翻訳テキストを設定
                    final_result = {
                        "chapter_number": chapter["chapter_number"],
                        "title": chapter_title,
                        "translated_text": html_content,
                        "start_page": chapter["start_page"],
                        "end_page": chapter["end_page"]
                    }
                else:
                    # 旧形式の場合は変換（後方互換性）
                    final_result = translate_result
                    # 必要なフィールドを追加
                    if "chapter_number" not in final_result:
                        final_result["chapter_number"] = chapter["chapter_number"]
                    if "title" not in final_result:
                        final_result["title"] = chapter.get("title", f"Chapter {chapter['chapter_number']}")
                    if "start_page" not in final_result:
                        final_result["start_page"] = chapter["start_page"]
                    if "end_page" not in final_result:
                        final_result["end_page"] = chapter["end_page"]

                # 全体の翻訳テキストに追加
                chapter_translated_text = final_result.get("translated_text", "")
                if chapter_translated_text:
                    if all_translated_text:
                        all_translated_text += "\n\n"
                    
                    # 章番号とタイトルを追加
                    chapter_number = final_result.get("chapter_number", "?")
                    chapter_title = final_result.get("title", "")
                    
                    # タイトルが「数字. タイトル」の形式かチェック
                    title_pattern = rf"^{chapter_number}\.\s+.*"
                    if not re.match(title_pattern, chapter_title):
                        chapter_title = f"{chapter_number}. {chapter_title}"
                    
                    all_translated_text += f"<h2>{chapter_title}</h2>\n\n"
                    all_translated_text += chapter_translated_text

                # FirestoreのサブコレクションにTranslation結果を保存
                chapter_ref = doc_ref.collection("translated_chapters").document(f"chapter_{chapter['chapter_number']}")
                chapter_ref.set(final_result)
                
                # 章データを追加 - 修正: paper_idを確実に渡す
                add_chapter_translation(
                    session_id, 
                    paper_id, 
                    final_result["chapter_number"], 
                    final_result["title"], 
                    final_result["translated_text"], 
                    chapter_time_sec
                )
                
                # パフォーマンス計測モジュールに翻訳テキストを保存 - ここでは個別章のテキストだけを保存
                # save_translated_text(session_id, chapter_translated_text)
                
                add_step(session_id, paper_id, f"chapter_{chapter['chapter_number']}_translated", 
                        {"chapter_number": chapter["chapter_number"],
                         "start_page": chapter["start_page"], 
                         "end_page": chapter["end_page"]}, 
                        chapter_time_ms)
                
                log_info("ProcessAllChapters", f"Translation completed for chapter {chapter['chapter_number']}",
                         {"paper_id": paper_id})
                
                # 進捗を更新 (翻訳フェーズで5%から75%まで)
                progress = 5 + int((i / total_chapters) * 70)
                doc_ref.update({"progress": progress})
                
                results.append({
                    "chapter_number": chapter["chapter_number"],
                    "translated": True
                })
                
                # 各章の処理後に待機（重要: レート制限対策）
                time.sleep(3.0 + random.uniform(1.0, 2.0))
                
            except Exception as chapter_error:
                log_error("ProcessChapterError", f"Error processing chapter {chapter['chapter_number']}",
                         {"paper_id": paper_id, "error": str(chapter_error)})
                         
                add_step(session_id, paper_id, f"chapter_{chapter['chapter_number']}_error", 
                        {"chapter_number": chapter["chapter_number"],
                         "error": str(chapter_error)})
                
                # エラーが発生しても続行
                results.append({
                    "chapter_number": chapter["chapter_number"],
                    "translated": False,
                    "error": str(chapter_error)
                })
                
                # エラー後は少し長めに待機
                time.sleep(5.0 + random.uniform(1.0, 3.0))

        # 翻訳テキスト全体をパフォーマンス計測モジュールに保存
        save_translated_text(session_id, all_translated_text)

        # 2. 要約フェーズ - 論文全体の要約を一回だけ生成
        try:
            log_info("ProcessAllChapters", f"Generating summary for the entire paper", {"paper_id": paper_id})
            
            # 進捗を更新
            doc_ref.update({"progress": 75})
            
            # 要約前に少し待機（レート制限対策）
            time.sleep(3.0 + random.uniform(1.0, 2.0))
            
            # 要約処理の開始時間を記録
            summary_start = time.time()
            
            # 要約処理 (章情報なしで全体要約) - paper_idを確実に渡す
            summary_result = process_content(pdf_gs_path, paper_id, "summarize")
            
            # 要約処理の時間を記録
            summary_time_ms = (time.time() - summary_start) * 1000
            summary_time_sec = summary_time_ms / 1000.0
            
            add_step(session_id, paper_id, "summary_generated", {}, summary_time_ms)
            
            # 正常なJSONレスポンスがある場合
            if isinstance(summary_result, dict):
                summary_text = summary_result.get('summary', '')
                required_knowledge = summary_result.get('required_knowledge', '')
            else:
                # JSONレスポンスがない場合、結果全体を要約とみなす
                summary_text = str(summary_result)
                required_knowledge = ''

            # パフォーマンス計測モジュールに要約テキストを保存
            save_summary_text(session_id, summary_text)

            # Firestoreに結果を保存
            doc_ref.update({
                "summary": summary_text,
                "required_knowledge": required_knowledge,  # 新しいフィールドを追加
                "progress": 80
            })
            
            log_info("ProcessAllChapters", f"Summary completed for the entire paper", {"paper_id": paper_id})
            
        except Exception as summary_error:
            log_error("ProcessSummaryError", f"Error generating paper summary",
                    {"paper_id": paper_id, "error": str(summary_error)})
                    
            add_step(session_id, paper_id, "summary_error", {"error": str(summary_error)})
                    
            doc_ref.update({
                "summary": "要約の生成中にエラーが発生しました。",
                "required_knowledge": ""  # エラー時も空の値を設定
            })

        # 進捗を更新
        doc_ref.update({"progress": 85})
        add_step(session_id, paper_id, "chapters_combining_started", {"chapters_count": len(results)})
        
        # エラーチェック
        if not all_translated_text:
            log_warning("ProcessAllChapters", "No translated text was generated", {"paper_id": paper_id})
            
            add_step(session_id, paper_id, "no_translated_text_error")
            all_translated_text = "<p>翻訳の生成に失敗しました。しばらくしてから再度お試しください。</p>"

        # 文字数に応じて保存先を決定
        text_length = len(all_translated_text)
        add_step(session_id, paper_id, "text_combined", {"translated_text_length": text_length})
        
        if text_length > 800000:
            # Cloud Storageに保存
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S-%f")
            file_name = f"translated_text_{timestamp}_{paper_id}.txt"
            blob = storage_client.bucket(BUCKET_NAME).blob(f"papers/{file_name}")
            
            storage_start = time.time()
            blob.upload_from_string(all_translated_text, content_type="text/plain")
            storage_time_ms = (time.time() - storage_start) * 1000
            storage_time_sec = storage_time_ms / 1000.0
            
            translated_text_path = f"gs://{BUCKET_NAME}/papers/{file_name}"
            add_step(session_id, paper_id, "text_saved_to_storage", 
                    {"translated_text_path": translated_text_path},
                    storage_time_ms)

            doc_ref.update({
                "translated_text_path": translated_text_path,
                "translated_text": None,
                "status": "completed",
                "completed_at": datetime.datetime.now(),
                "progress": 100
            })

            log_info("ProcessAllChapters", f"Large translated text saved to Cloud Storage",
                    {"paper_id": paper_id, "path": translated_text_path})
        else:
            # Firestoreに保存
            firestore_start = time.time()
            doc_ref.update({
                "translated_text_path": None,
                "translated_text": all_translated_text,
                "status": "completed",
                "completed_at": datetime.datetime.now(),
                "progress": 100
            })
            firestore_time_ms = (time.time() - firestore_start) * 1000
            firestore_time_sec = firestore_time_ms / 1000.0
            
            add_step(session_id, paper_id, "text_saved_to_firestore", {}, firestore_time_ms)

            log_info("ProcessAllChapters", f"Translated text saved to Firestore", {"paper_id": paper_id})

        # チャットセッションを終了して解放
        end_chat_session(paper_id)
        log_info("ProcessAllChapters", f"Ended chat session for paper", {"paper_id": paper_id})
        add_step(session_id, paper_id, "chat_session_ended")

        # 処理時間の記録
        stop_timer(session_id, paper_id, True)
        
        # 親セッションにステップを追加（存在する場合）
        if parent_session_id:
            add_step(parent_session_id, paper_id, "all_chapters_completed", 
                    {"chapters_count": total_chapters, 
                     "translated_text_length": text_length,
                     "success": True})
        
        return results
        
    except Exception as e:
        log_error("ProcessAllChaptersError", "Failed to process all chapters",
                 {"paper_id": paper_id, "error": str(e)})

        # エラー状態に更新
        doc_ref.update({
            "status": "error",
            "error_message": str(e)
        })
        
        add_step(session_id, paper_id, "processing_failed", {"error": str(e)})
        
        # 処理時間の記録（エラー発生時）
        stop_timer(session_id, paper_id, False, str(e))
        
        # 親セッションにステップを追加（存在する場合）
        if parent_session_id:
            add_step(parent_session_id, paper_id, "all_chapters_failed", 
                    {"error": str(e)})
        
        # エラー時もチャットセッションを解放
        try:
            end_chat_session(paper_id)
        except:
            pass
            
        raise

def process_with_cache(cache_id: str, operation: str, chapter_info: dict = None) -> dict:
    """
    互換性のために残す関数（非推奨）
    新しい process_content 関数を呼び出すだけ
    """
    # TODO: この関数は将来的に削除予定
    try:
        # Cloud Storageのパスを取得（本来はキャッシュIDから取得していたが、今は直接渡す必要がある）
        if not hasattr(process_with_cache, 'pdf_gs_path'):
            raise ValueError("PDF path not set. This function is deprecated.")
        
        if not hasattr(process_with_cache, 'paper_id'):
            raise ValueError("Paper ID not set. This function is deprecated.")
            
        return process_content(process_with_cache.pdf_gs_path, process_with_cache.paper_id, operation, chapter_info)
    except Exception as e:
        log_error("ProcessPDFError", f"Failed to process with cache: {operation}", 
                 {"error": str(e), "cache_id": cache_id, "operation": operation})
        raise

def process_content(pdf_gs_path: str, paper_id: str, operation: str, chapter_info: dict = None) -> dict:
    """
    PDFファイルを直接処理して翻訳・要約・メタデータ抽出を行う

    Args:
        pdf_gs_path: PDFファイルのパス (gs://から始まる)
        paper_id: 論文のID
        operation: 処理内容 ('translate', 'summarize', 'extract_metadata_and_chapters')
        chapter_info: 章情報（章番号、開始ページ、終了ページ）。translate の場合に必要。

    Returns:
        dict: 処理結果（JSON形式）
    """
    # paper_idが確実に渡されるようにチェック
    if not paper_id:
        log_warning("ProcessContent", "No paper_id provided to process_content")
        paper_id = "unknown_paper_id"
        
    # 処理時間測定開始 - 関数名を明示的に指定
    processing_details = {"operation": operation}
    if chapter_info:
        processing_details["chapter_number"] = chapter_info.get("chapter_number")
    
    session_id, _ = start_timer(f"process_content_{operation}", paper_id, processing_details)
    
    try:
        # Vertex AIの初期化
        initialize_vertex_ai()
        
        # チャットセッションを開始または取得
        start_chat_session(paper_id, pdf_gs_path)
        add_step(session_id, paper_id, "chat_session_started")
        
        # 処理内容に応じてプロンプトを選択
        if operation == "translate":
            if not chapter_info:
                raise ValidationError("Chapter info is required for translation operation")
                
            # 翻訳プロンプトのテンプレートを読み込む
            if not TRANSLATION_PROMPT_FILE or TRANSLATION_PROMPT_FILE == "":
                prompt_template = DEFAULT_TRANSLATION_PROMPT
                add_step(session_id, paper_id, "using_default_translation_prompt")
            else:
                prompt_template = load_prompt(TRANSLATION_PROMPT_FILE)
            
            # 安全なフォーマット処理 - 文字列置換によるフォーマット
            # format()メソッドではなく手動で置換する
            prompt = prompt_template.replace("{chapter_number}", str(chapter_info['chapter_number']))
            prompt = prompt.replace("{start_page}", str(chapter_info['start_page']))
            prompt = prompt.replace("{end_page}", str(chapter_info['end_page']))
            prompt = prompt.replace("{chapter_title}", str(chapter_info.get('title', 'Untitled')))
            
            add_step(session_id, paper_id, "translation_prompt_prepared", 
                {"chapter_number": chapter_info['chapter_number']})
            
        elif operation == "summarize":
            # 論文全体の要約のためのプロンプト
            if not SUMMARY_PROMPT_FILE or SUMMARY_PROMPT_FILE == "":
                prompt = DEFAULT_SUMMARY_PROMPT
                add_step(session_id, paper_id, "using_default_summary_prompt")
            else:
                prompt = load_prompt(SUMMARY_PROMPT_FILE)
            add_step(session_id, paper_id, "summary_prompt_prepared")
            
        elif operation == "extract_metadata_and_chapters":
            if not METADATA_AND_CHAPTER_PROMPT_FILE or METADATA_AND_CHAPTER_PROMPT_FILE == "":
                prompt = DEFAULT_METADATA_PROMPT
                add_step(session_id, paper_id, "using_default_metadata_prompt")
            else:
                prompt = load_prompt(METADATA_AND_CHAPTER_PROMPT_FILE)
            add_step(session_id, paper_id, "metadata_prompt_prepared")
            
        else:
            raise ValidationError(f"Invalid operation: {operation}")

        # チャットセッションを使用してプロンプトを処理
        # リソースエラー対策のためリトライ機能を追加
        log_info("ProcessPDF", f"Processing with chat session for operation: {operation}, paper_id: {paper_id}")
        add_step(session_id, paper_id, "process_started")
        
        # リトライ処理でAPIを呼び出す
        def api_call():
            # リソースエラー対策のためのスリープ (ランダム要素を含める)
            time.sleep(1.0 + random.uniform(0.1, 0.5))
            return process_with_chat(paper_id, prompt)
        
        # APIコール開始時間を記録
        api_start = time.time()
        
        # リトライを無効化し、直接API呼び出しを実行
        response_text = api_call()
        
        # API呼び出しの時間を記録
        api_time_ms = (time.time() - api_start) * 1000
        add_step(session_id, paper_id, "api_call_completed", {}, api_time_ms)
        
        # JSONレスポンスの処理
        try:
            # 改善されたJSONパース処理
            # モデルが返すさまざまな形式に対応
            result = extract_json_from_response(response_text, operation)
            add_step(session_id, paper_id, "response_parsed")
            
            # 翻訳結果のHTMLをサニタイズ
            if operation == "translate" and "translated_text" in result:
                result["translated_text"] = sanitize_html(result.get("translated_text", ""))
                
                # 章情報を結果に追加
                result["chapter_number"] = chapter_info["chapter_number"]
                result["title"] = chapter_info.get("title", "")
                result["start_page"] = chapter_info["start_page"]
                result["end_page"] = chapter_info["end_page"]
                
                # 個別章の翻訳テキストはここでは保存しない
                # パフォーマンス計測モジュールに翻訳テキストを保存
                # save_translated_text(session_id, result["translated_text"])
                
                add_step(session_id, paper_id, "html_sanitized")
            
            # 要約結果の処理
            elif operation == "summarize" and "summary" in result:
                # 要約テキストをパフォーマンス計測モジュールに保存
                save_summary_text(session_id, result["summary"])
                
            # メタデータ抽出の処理
            elif operation == "extract_metadata_and_chapters":
                # メタデータテキストを保存
                save_metadata_text(session_id, json.dumps(result, indent=2))
                
            log_info("ProcessPDF", f"Successfully processed {operation}")
            
            # 処理時間の記録
            stop_timer(session_id, paper_id, True)
            
            return result
            
        except json.JSONDecodeError as e:
            # JSONでない場合のフォールバック処理
            log_warning("JSONDecodeError", "Invalid JSON response from Vertex AI. Trying fallback processing.", 
                       {"response_text": response_text[:1000] + "..." if len(response_text) > 1000 else response_text})
            
            add_step(session_id, paper_id, "json_parsing_failed", {"error": str(e)})
            
            if operation == "translate":
                sanitized_text = sanitize_html(response_text)
                result = {
                    "translated_text": sanitized_text,
                    "chapter_number": chapter_info["chapter_number"],
                    "title": chapter_info.get("title", ""),
                    "start_page": chapter_info["start_page"],
                    "end_page": chapter_info["end_page"]
                }
                
                # 個別章の翻訳テキストはここでは保存しない
                # 翻訳テキストをパフォーマンス計測モジュールに保存
                # save_translated_text(session_id, sanitized_text)
                
                add_step(session_id, paper_id, "used_fallback_translation")
                
                # 処理時間の記録（エラーだがリカバリー成功）
                stop_timer(session_id, paper_id, True)
                return result
                
            elif operation == "summarize":
                result = {"summary": response_text}
                
                # 要約テキストをパフォーマンス計測モジュールに保存
                save_summary_text(session_id, response_text)
                
                add_step(session_id, paper_id, "used_fallback_summary")
                
                # 処理時間の記録（エラーだがリカバリー成功）
                stop_timer(session_id, paper_id, True)
                return result
                
            elif operation == "extract_metadata_and_chapters":
                # メタデータテキストを保存
                save_metadata_text(session_id, response_text)
                
                # 処理時間の記録（エラーだがリカバリー成功）
                stop_timer(session_id, paper_id, True)
                
                # それでも失敗する場合は例外を発生させる
                log_error("JSONDecodeError", "Failed to parse response as JSON for metadata extraction", 
                         {"response_text": response_text[:1000] + "..." if len(response_text) > 1000 else response_text})
                
                raise VertexAIError("Failed to parse Vertex AI response as JSON for metadata extraction")
                
            else:
                # それでも失敗する場合は例外を発生させる
                log_error("JSONDecodeError", "Failed to parse response as JSON and no fallback available", 
                         {"response_text": response_text[:1000] + "..." if len(response_text) > 1000 else response_text})
                
                # 処理時間の記録（失敗）
                stop_timer(session_id, paper_id, False, "Failed to parse response as JSON")
                raise VertexAIError("Failed to parse Vertex AI response as JSON")
                
    except Exception as e:
        # 処理時間の記録（エラー発生時）
        stop_timer(session_id, paper_id, False, str(e))
        
        log_error("ProcessPDFError", f"Failed to process PDF: {operation}", 
                 {"error": str(e), "file_path": pdf_gs_path, "operation": operation})
        raise

def extract_json_from_response(response_text: str, operation: str) -> dict:
    """
    さまざまな形式のレスポンスからJSONを抽出する強化された関数
    
    Args:
        response_text: モデルからのレスポンステキスト
        operation: 処理タイプ ('translate', 'summarize', 'extract_metadata_and_chapters')
        
    Returns:
        dict: パースされたJSON
    """
    # 前処理: 余分な空白、改行を削除
    cleaned_text = response_text.strip()
    
    # マークダウンのコードブロックを削除
    cleaned_text = re.sub(r'^```(?:json)?\s*', '', cleaned_text)
    cleaned_text = re.sub(r'\s*```$', '', cleaned_text)
    
    # 1. 完全なJSONオブジェクトを探す - 最も厳格なチェック
    # 一般的なJSONパターン: '{...}'
    try:
        # JSON部分を正規表現で抽出
        json_pattern = re.compile(r'(\{.*\})', re.DOTALL)
        match = json_pattern.search(cleaned_text)
        if match:
            potential_json = match.group(1)
            return json.loads(potential_json)
    except json.JSONDecodeError:
        pass
    
    # 2. 特殊ケース: "1. 導入 json { "translated_text": " のようなパターン
    json_snippet_pattern = re.compile(r'.*?(?:json)?\s*(\{\s*"[^"]+"\s*:)', re.DOTALL)
    match = json_snippet_pattern.search(cleaned_text)
    if match:
        # JSONの開始部分を見つけた場合、そこから完全なJSONを抽出する試み
        start_index = match.start(1)
        text_from_start = cleaned_text[start_index:]
        
        # JSONオブジェクトを完成させる
        try:
            # まず波括弧のバランスを確認
            open_count = 0
            close_count = 0
            in_string = False
            escape_next = False
            end_index = -1
            
            for i, char in enumerate(text_from_start):
                if escape_next:
                    escape_next = False
                    continue
                
                if char == '\\':
                    escape_next = True
                elif char == '"' and not escape_next:
                    in_string = not in_string
                elif not in_string:
                    if char == '{':
                        open_count += 1
                    elif char == '}':
                        close_count += 1
                        if open_count == close_count:
                            end_index = i + 1
                            break
            
            if end_index > 0:
                json_str = text_from_start[:end_index]
                try:
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    # JSONの修復を試みる
                    json_str = json_str.replace('\n', '\\n')
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError:
                        pass
        except Exception:
            pass
    
    # 3. translated_text だけを抽出する特殊処理
    if operation == "translate":
        # 正規表現を使って章見出しと本文を識別
        chapter_pattern = re.compile(r'(?:<h2>)?\s*(\d+\.\s+[^<\n]+)(?:</h2>)?', re.MULTILINE)
        chapter_match = chapter_pattern.search(cleaned_text)
        
        if chapter_match:
            chapter_title = chapter_match.group(1).strip()
            # 章タイトルを整形
            if not chapter_title.startswith('<h2>'):
                chapter_title = f"<h2>{chapter_title}</h2>"
            
            # 本文を抽出
            body_text = cleaned_text.replace(chapter_match.group(0), '', 1).strip()
            
            # 参考文献セクションを確認
            references_pattern = re.compile(r'(?:<h[1-6]>)?(?:\d+\.\s*)?(?:references|bibliography|参考文献)(?:</h[1-6]>)?.*?$', re.DOTALL | re.IGNORECASE)
            references_match = references_pattern.search(body_text)
            
            if references_match:
                # 参考文献部分を削除して専用フォーマットに置き換え
                body_text = body_text[:references_match.start()].strip() + '\n\n<h2>参考文献</h2>\n<p>（参考文献リストは省略）</p>'
            
            # 本文が<p>タグで囲まれていなければ囲む
            if not re.search(r'<p>', body_text):
                paragraphs = re.split(r'\n\s*\n', body_text)
                body_text = '\n\n'.join([f"<p>{p.strip()}</p>" if not p.strip().startswith('<') else p.strip() for p in paragraphs if p.strip()])
            
            # 結合して返す
            full_text = f"{chapter_title}\n\n{body_text}"
            return {"translated_text": full_text}
    
    # 4. 翻訳処理の特殊フォールバック
    if operation == "translate":
        # 参考文献セクションを確認して除去
        references_pattern = re.compile(r'(?:<h[1-6]>)?(?:\d+\.\s*)?(?:references|bibliography|参考文献)(?:</h[1-6]>)?.*?$', re.DOTALL | re.IGNORECASE)
        references_match = references_pattern.search(cleaned_text)
        
        if references_match:
            # 参考文献部分を削除して専用フォーマットに置き換え
            cleaned_text = cleaned_text[:references_match.start()].strip() + '\n\n<h2>参考文献</h2>\n<p>（参考文献リストは省略）</p>'
        
        # 章見出しを適切なHTMLタグで囲む
        chapter_pattern = re.compile(r'^(\d+\.\s+[^\n]+)$', re.MULTILINE)
        cleaned_text = chapter_pattern.sub(r'<h2>\1</h2>', cleaned_text)
        
        # サブ章見出しを適切なHTMLタグで囲む
        subchapter_pattern = re.compile(r'^(\d+\.\d+\.\s+[^\n]+)$', re.MULTILINE)
        cleaned_text = subchapter_pattern.sub(r'<h3>\1</h3>', cleaned_text)
        
        # <img>タグを処理
        img_pattern = re.compile(r'<img[^>]+>')
        cleaned_text = img_pattern.sub(r'（図表）', cleaned_text)
        
        # 段落を<p>タグで囲む（すでにHTMLタグがある場合を除く）
        if not re.search(r'<p>', cleaned_text):
            paragraphs = re.split(r'\n\s*\n', cleaned_text)
            processed_paragraphs = []
            
            for p in paragraphs:
                p = p.strip()
                if not p:
                    continue
                # すでにHTMLタグで始まる場合はそのまま
                if p.startswith('<h') or p.startswith('<p') or p.startswith('<ul') or p.startswith('<ol'):
                    processed_paragraphs.append(p)
                else:
                    processed_paragraphs.append(f"<p>{p}</p>")
            
            cleaned_text = '\n\n'.join(processed_paragraphs)
        
        return {"translated_text": cleaned_text}
    
    # 5. 要約処理の特殊フォールバック
    elif operation == "summarize":
        return {"summary": cleaned_text}
    
    # 6. メタデータ抽出の場合は最も厳格
    elif operation == "extract_metadata_and_chapters":
        # JSON形式を完全に修復する試み
        try:
            # メタデータの基本構造を作成
            metadata = {
                "metadata": {
                    "title": "",
                    "authors": [],
                    "year": 0,
                    "journal": "",
                    "doi": "",
                    "keywords": [],
                    "abstract": ""
                },
                "chapters": []
            }
            
            # タイトルを抽出
            title_pattern = re.compile(r'"title"\s*:\s*"([^"]+)"')
            title_match = title_pattern.search(cleaned_text)
            if title_match:
                metadata["metadata"]["title"] = title_match.group(1).strip()
            
            # 著者を抽出
            authors_pattern = re.compile(r'"authors"\s*:\s*\[(.*?)\]', re.DOTALL)
            authors_match = authors_pattern.search(cleaned_text)
            if authors_match:
                authors_text = authors_match.group(1)
                # 個々の著者情報を抽出
                author_items = re.findall(r'{(.*?)}', authors_text, re.DOTALL)
                for author_item in author_items:
                    author = {}
                    
                    # 著者名
                    name_match = re.search(r'"name"\s*:\s*"([^"]+)"', author_item)
                    if name_match:
                        author["name"] = name_match.group(1).strip()
                    
                    # 所属
                    affiliation_match = re.search(r'"affiliation"\s*:\s*"([^"]+)"', author_item)
                    if affiliation_match:
                        author["affiliation"] = affiliation_match.group(1).strip()
                    
                    if author:
                        metadata["metadata"]["authors"].append(author)
            
            # 年を抽出
            year_pattern = re.compile(r'"year"\s*:\s*(\d+)')
            year_match = year_pattern.search(cleaned_text)
            if year_match:
                metadata["metadata"]["year"] = int(year_match.group(1))
            
            # ジャーナルを抽出
            journal_pattern = re.compile(r'"journal"\s*:\s*"([^"]+)"')
            journal_match = journal_pattern.search(cleaned_text)
            if journal_match:
                metadata["metadata"]["journal"] = journal_match.group(1).strip()
            
            # DOIを抽出
            doi_pattern = re.compile(r'"doi"\s*:\s*"([^"]+)"')
            doi_match = doi_pattern.search(cleaned_text)
            if doi_match:
                metadata["metadata"]["doi"] = doi_match.group(1).strip()
            
            # キーワードを抽出
            keywords_pattern = re.compile(r'"keywords"\s*:\s*\[(.*?)\]', re.DOTALL)
            keywords_match = keywords_pattern.search(cleaned_text)
            if keywords_match:
                keywords_text = keywords_match.group(1)
                # キーワードを抽出（カンマで区切られた文字列リスト）
                keyword_items = re.findall(r'"([^"]+)"', keywords_text)
                metadata["metadata"]["keywords"] = [keyword.strip() for keyword in keyword_items]
            
            # アブストラクトを抽出
            abstract_pattern = re.compile(r'"abstract"\s*:\s*"(.*?)"', re.DOTALL)
            abstract_match = abstract_pattern.search(cleaned_text)
            if abstract_match:
                metadata["metadata"]["abstract"] = abstract_match.group(1).strip()
            
            # 章構造を抽出
            chapters_pattern = re.compile(r'"chapters"\s*:\s*\[(.*?)\]', re.DOTALL)
            chapters_match = chapters_pattern.search(cleaned_text)
            if chapters_match:
                chapters_text = chapters_match.group(1)
                # 個々の章情報を抽出
                chapter_items = re.findall(r'{(.*?)}', chapters_text, re.DOTALL)
                for chapter_item in chapter_items:
                    chapter = {}
                    
                    # 章番号
                    number_match = re.search(r'"chapter_number"\s*:\s*(\d+)', chapter_item)
                    if number_match:
                        chapter["chapter_number"] = int(number_match.group(1))
                    
                    # タイトル
                    title_match = re.search(r'"title"\s*:\s*"([^"]+)"', chapter_item)
                    if title_match:
                        chapter["title"] = title_match.group(1)
                    
                    # ページ情報
                    start_page_match = re.search(r'"start_page"\s*:\s*(\d+)', chapter_item)
                    if start_page_match:
                        chapter["start_page"] = int(start_page_match.group(1))
                    
                    end_page_match = re.search(r'"end_page"\s*:\s*(\d+)', chapter_item)
                    if end_page_match:
                        chapter["end_page"] = int(end_page_match.group(1))
                    
                    if chapter:
                        metadata["chapters"].append(chapter)
            
            return metadata
        except Exception as e:
            log_error("JSONExtraction", f"Failed to extract metadata: {str(e)}", 
                      {"text_sample": cleaned_text[:500] + "..." if len(cleaned_text) > 500 else cleaned_text})
            raise json.JSONDecodeError(f"Could not extract valid JSON for metadata", cleaned_text, 0)
    
    # 7. どのケースにも当てはまらない場合、最終手段としてテキスト全体を適切なキーの値として返す
    log_warning("JSONExtraction", f"Fallback case: returning raw text for operation {operation}", 
               {"text_sample": cleaned_text[:100] + "..." if len(cleaned_text) > 100 else cleaned_text})
    
    if operation == "translate":
        return {"translated_text": cleaned_text}
    elif operation == "summarize":
        return {"summary": cleaned_text}
    else:
        raise json.JSONDecodeError(f"Could not extract valid JSON for operation: {operation}", cleaned_text, 0)

def sanitize_html(html_text: str) -> str:
    """
    HTMLをサニタイズし、章構造を整える改良版関数
    
    Args:
        html_text: サニタイズするHTML文字列
        
    Returns:
        str: サニタイズされたHTML
    """
    if not html_text:
        return ""
    
    # JSON形式の文字列が含まれているか確認し、含まれている場合は抽出
    json_pattern = re.compile(r'^\s*\{\s*"(?:translated_text|summary)"\s*:\s*"(.+)"\s*\}\s*$', re.DOTALL)
    json_match = json_pattern.search(html_text)
    if json_match:
        # JSON形式の文字列から内容を抽出
        html_text = json_match.group(1)
        # エスケープされたクォートとバックスラッシュを戻す
        html_text = html_text.replace('\\"', '"').replace('\\\\', '\\')
        # エスケープされた改行を実際の改行に変換
        html_text = html_text.replace('\\n', '\n')
    
    # 参考文献セクションの処理
    references_pattern = re.compile(r'<h\d>\s*(?:\d+\.\s*)?(?:references|bibliography|参考文献)(?:リスト)?</h\d>.*?$', re.DOTALL | re.IGNORECASE)
    if re.search(references_pattern, html_text):
        html_text = re.sub(references_pattern, '<h2>参考文献</h2><p>（参考文献リストは省略）</p>', html_text)
    
    # 参考文献リストパターン (例: [1], [2] など)
    references_list_pattern = re.compile(r'(?:\[\d+\][^\[]{2,})+$', re.MULTILINE)
    if re.search(references_list_pattern, html_text):
        html_text = re.sub(references_list_pattern, '', html_text)
    
    # <img>タグの処理（画像を適切な表記に置換）
    img_pattern = re.compile(r'<img[^>]+>')
    html_text = img_pattern.sub('（図表）', html_text)
    
    # 章見出しの形式を修正
    # 「Chapter X: Title」の形式を「X. タイトル」に変換
    html_text = re.sub(r'<h(\d)>\s*Chapter\s+(\d+)(?::|\.)\s*(.*?)\s*</h\1>', r'<h\1>\2. \3</h\1>', html_text, flags=re.IGNORECASE)
    
    # 「Section X.Y: Title」の形式を「X.Y. タイトル」に変換
    html_text = re.sub(r'<h(\d)>\s*Section\s+(\d+\.\d+)(?::|\.)\s*(.*?)\s*</h\1>', r'<h\1>\2. \3</h\1>', html_text, flags=re.IGNORECASE)
    
    # 1. Introduction のような形式を <h2>1. Introduction</h2> に変換
    # ただし、既にHTMLタグがある場合は変換しない
    chapter_pattern = re.compile(r'^(\d+\.\s+[^\n<]+)$', re.MULTILINE)
    html_text = chapter_pattern.sub(r'<h2>\1</h2>', html_text)
    
    # 1.1. Method のような形式を <h3>1.1. Method</h3> に変換
    subchapter_pattern = re.compile(r'^(\d+\.\d+\.\s+[^\n<]+)$', re.MULTILINE)
    html_text = subchapter_pattern.sub(r'<h3>\1</h3>', html_text)
    
    # 見出しの重複を削除（同じ番号の見出しが連続する場合）
    html_text = re.sub(
        r'(<h(\d)>\s*(\d+(?:\.\d+)?)[\.:]?\s*[^<]+</h\2>)\s*<h\2>\s*\3[\.:]?\s*([^<]+)</h\2>',
        r'\1',
        html_text,
        flags=re.IGNORECASE
    )
    
    # 段落の処理: 見出しタグでも段落タグでもない文字列を段落タグで囲む
    if not re.search(r'<p>', html_text):
        # テキストを見出しタグで分割
        parts = re.split(r'(<h\d>.*?</h\d>)', html_text)
        processed_parts = []
        
        for part in parts:
            # 見出しタグはそのまま保持
            if re.match(r'<h\d>.*?</h\d>', part):
                processed_parts.append(part)
            elif part.strip():
                # 非見出し部分を段落に分割
                paragraphs = re.split(r'\n\s*\n', part)
                for p in paragraphs:
                    if p.strip():
                        processed_parts.append(f"<p>{p.strip()}</p>")
        
        html_text = '\n\n'.join(processed_parts)
    
    # スクリプトタグ、iframe、style、linkタグなどの危険なタグを削除
    html_text = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', html_text, flags=re.IGNORECASE)
    html_text = re.sub(r'<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>', '', html_text, flags=re.IGNORECASE)
    html_text = re.sub(r'<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>', '', html_text, flags=re.IGNORECASE)
    html_text = re.sub(r'<link\b[^<]*(?:(?!>)(.|\n))*>', '', html_text, flags=re.IGNORECASE)
    
    # オンイベント属性（onClick, onLoadなど）を削除
    html_text = re.sub(r'\bon\w+\s*=\s*"[^"]*"', '', html_text, flags=re.IGNORECASE)
    
    # 許可するタグのリスト
    allowed_tags = [
        'p', 'br', 'b', 'i', 'u', 'strong', 'em', 
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'sup', 'sub', 'span'
    ]
    
    # 許可されないタグを削除
    found_tags = set(re.findall(r'</?(\w+)[^>]*>', html_text))
    for tag in found_tags:
        if tag.lower() not in allowed_tags:
            html_text = re.sub(r'<{0}[^>]*>'.format(tag), '', html_text, flags=re.IGNORECASE)
            html_text = re.sub(r'</{0}[^>]*>'.format(tag), '', html_text, flags=re.IGNORECASE)
    
    # 連続する改行を整理
    html_text = re.sub(r'\n{3,}', '\n\n', html_text)
    
    return html_text