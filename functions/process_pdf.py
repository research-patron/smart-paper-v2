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
# 新しい共通モジュールからインポート
from json_utils import extract_json_from_response, extract_content_from_json
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
INTEGRATED_PROMPT_FILE = "./prompts/integrated_prompt_v1.json"
# 2段階処理用のプロンプトファイル
METADATA_PROMPT_V2_FILE = "./prompts/metadata_prompt_v2.json"
TRANSLATION_SUMMARY_PROMPT_V2_FILE = "./prompts/translation_summary_prompt_v2.json"

# デフォルトのプロンプト (プロンプトファイルが読み込めない場合に使用)
DEFAULT_TRANSLATION_PROMPT = """
以下の章番号に対応する章を日本語に翻訳してください：
Chapter Number: {chapter_number}
Chapter Title: {chapter_title}

重要な指示：
1. 数式、図表の参照、引用は原文のまま残してください。
2. 「References」のセクションは翻訳せず、単に「（参考文献リストは省略）」と出力してください。
3. 章タイトルは翻訳せず、章番号に対応する内容のみを日本語に翻訳して。

出力形式：
```json
{
  "translated_text": "翻訳されたテキスト"
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
    * chapter_number (章番号): 正確な形式で表記してください。
      - メイン章は "1", "2", "3" など
      - サブ章は "1.1", "1.2", "2.1", "2.2" など
    * title (章タイトル): 章のタイトル。タイトルがない場合は、「(章番号) の内容」と記述してください。
    * title_ja (章タイトル日本語訳): 章タイトルの日本語訳を提供してください。英語タイトルの場合は適切な日本語訳を、日本語タイトルの場合はそのまま記載してください。
    * start_page (開始ページ): 章の開始ページ番号。
    * end_page (終了ページ): 章の終了ページ番号。

重要な指示：
1. メイン章だけでなく、サブ章（例：1.1, 1.2）も必ず抽出してください。
2. 章番号は正確な形式で表記してください。サブ章の場合は親章の番号を含めて「1.1」のように表記します。
3. 結論（Conclusion）より後ろの章は、抽出しないでください（謝辞・参考文献・補遺など）。

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
   "chapter_number": "1",
   "title": "Introduction",
   "title_ja": "はじめに",
   "start_page": 1,
   "end_page": 2
  },
  {
   "chapter_number": "1.1",
   "title": "Background",
   "title_ja": "背景",
   "start_page": 1,
   "end_page": 1
  },
  {
   "chapter_number": "1.2",
   "title": "Related Work",
   "title_ja": "関連研究",
   "start_page": 2,
   "end_page": 2
  }
 ]
}
```
"""

def is_subchapter(chapter_number) -> bool:
    """
    章番号がサブ章かどうかを判定する
    
    Args:
        chapter_number: 章番号（文字列または数値）
        
    Returns:
        bool: サブ章の場合はTrue、主章の場合はFalse
    """
    # 章番号を文字列に変換
    str_number = str(chapter_number)
    
    # 数値部分のみを抽出して判定
    # サブ章パターン (例: "3.1", "3.1.2" など)
    parts = str_number.split('.')
    return len(parts) > 1

def get_main_chapter_number(chapter_number) -> str:
    """
    章番号から主章番号を抽出する
    
    Args:
        chapter_number: 章番号（文字列または数値）
        
    Returns:
        str: 主章番号の文字列表現
    """
    # 章番号を文字列に変換
    str_number = str(chapter_number)
    
    # 最初のピリオドまでを取得
    parts = str_number.split('.')
    return parts[0]

def has_subchapters(chapter_number, chapters: list) -> bool:
    """
    指定された主章番号にサブ章があるかどうかを判定する
    
    Args:
        chapter_number: 主章番号
        chapters: 全章のリスト
        
    Returns:
        bool: サブ章がある場合はTrue、ない場合はFalse
    """
    # 主章の番号を取得 (例: "3")
    main_number = get_main_chapter_number(chapter_number)
    
    # サブ章の有無を確認
    for chapter in chapters:
        other_number = chapter.get("chapter_number")
        # 自分自身は除外
        if other_number == chapter_number:
            continue
            
        # 他の章の主章番号を取得
        other_main = get_main_chapter_number(other_number)
        
        # 主章番号が一致し、かつサブ章である場合
        if other_main == main_number and is_subchapter(other_number):
            return True
    
    return False

def process_two_stage_content(pdf_gs_path: str, paper_id: str, progress_callback=None) -> dict:
    """
    PDFファイルを2段階で処理して、メタデータ抽出後に翻訳・要約を行う
    
    Args:
        pdf_gs_path: PDFファイルのパス (gs://から始まる)
        paper_id: 論文のID
        progress_callback: 進捗更新用のコールバック関数 (オプション)
        
    Returns:
        dict: 処理結果（メタデータ、翻訳テキスト、要約、必要な知識）
    """
    # 処理時間測定開始
    session_id, _ = start_timer("process_two_stage_content", paper_id)
    
    try:
        # Vertex AIの初期化
        initialize_vertex_ai()
        
        # チャットセッションを開始
        start_chat_session(paper_id, pdf_gs_path)
        add_step(session_id, paper_id, "chat_session_started")
        
        # ステージ1: メタデータ抽出
        log_info("TwoStageProcessing", f"Stage 1: Extracting metadata for paper: {paper_id}")
        
        # メタデータ抽出プロンプトを読み込む
        metadata_prompt = load_prompt(METADATA_PROMPT_V2_FILE)
        
        # Gemini APIを呼び出し（メタデータ抽出）
        metadata_response = process_with_chat(paper_id, metadata_prompt, temperature=0.1, operation="metadata_v2")
        
        add_step(session_id, paper_id, "metadata_extraction_complete")
        
        # メタデータの抽出と検証
        metadata_result = extract_json_from_response(metadata_response, "metadata_v2")
        
        if not metadata_result.get("metadata"):
            raise ValidationError("Metadata not found in response")
        if not metadata_result.get("chapters"):
            raise ValidationError("Chapters not found in response")
            
        # 進捗更新（50%）
        if progress_callback:
            progress_callback(50)
            
        add_step(session_id, paper_id, "metadata_validation_complete")
        
        # ステージ2: 翻訳・要約・必要な知識の抽出
        log_info("TwoStageProcessing", f"Stage 2: Translation and summary for paper: {paper_id}")
        
        # 翻訳・要約プロンプトを読み込む
        translation_summary_prompt = load_prompt(TRANSLATION_SUMMARY_PROMPT_V2_FILE)
        
        # Gemini APIを呼び出し（翻訳・要約）
        translation_response = process_with_chat(paper_id, translation_summary_prompt, temperature=0.2, operation="translation_summary_v2")
        
        add_step(session_id, paper_id, "translation_summary_complete")
        
        # 翻訳・要約の抽出と検証
        translation_result = extract_json_from_response(translation_response, "translation_summary_v2")
        
        if not translation_result.get("translated_content"):
            raise ValidationError("Translated content not found in response")
        if not translation_result.get("summary"):
            raise ValidationError("Summary not found in response")
        if not translation_result.get("required_knowledge"):
            raise ValidationError("Required knowledge not found in response")
            
        add_step(session_id, paper_id, "translation_validation_complete")
        
        # 結果を統合
        final_result = {
            "metadata": metadata_result["metadata"],
            "chapters": metadata_result["chapters"],
            "translated_content": translation_result["translated_content"],
            "summary": translation_result["summary"],
            "required_knowledge": translation_result["required_knowledge"]
        }
        
        # パフォーマンス記録に各データを保存
        save_metadata_text(session_id, json.dumps(metadata_result, ensure_ascii=False))
        save_translated_text(session_id, translation_result.get("translated_content", ""))
        save_summary_text(session_id, translation_result.get("summary", ""))
        
        # 処理時間の記録を正常終了
        stop_timer(session_id, paper_id, True)
        
        log_info("TwoStageProcessing", f"Two-stage processing completed for paper: {paper_id}")
        
        return final_result
        
    except Exception as e:
        # エラー発生時の処理時間記録
        stop_timer(session_id, paper_id, False, str(e))
        log_error("TwoStageProcessingError", f"Error in two-stage processing: {str(e)}", 
                 {"paper_id": paper_id, "pdf_path": pdf_gs_path})
        raise
    finally:
        # チャットセッションを終了
        end_chat_session(paper_id)

def process_integrated_content(pdf_gs_path: str, paper_id: str) -> dict:
    """
    PDFファイルを一括処理して、メタデータ抽出、翻訳、要約を行う
    
    Args:
        pdf_gs_path: PDFファイルのパス (gs://から始まる)
        paper_id: 論文のID
        
    Returns:
        dict: 処理結果（メタデータ、翻訳テキスト、要約、必要な知識）
    """
    # 処理時間測定開始
    session_id, _ = start_timer("process_integrated_content", paper_id)
    
    try:
        # Vertex AIの初期化
        initialize_vertex_ai()
        
        # チャットセッションを開始
        start_chat_session(paper_id, pdf_gs_path)
        add_step(session_id, paper_id, "chat_session_started")
        
        # 統合プロンプトを読み込む
        prompt_template = load_prompt(INTEGRATED_PROMPT_FILE)
        
        # プロンプトを使用してAPI呼び出し
        log_info("IntegratedProcessing", f"Starting integrated processing for paper: {paper_id}")
        
        # Gemini APIを呼び出し（temperatureを低く設定）
        response = process_with_chat(paper_id, prompt_template, temperature=0.2, operation="integrated")
        
        add_step(session_id, paper_id, "api_call_complete")
        
        # レスポンスからJSONを抽出
        result = extract_json_from_response(response, "integrated")
        
        # 結果の検証
        if not result.get("metadata"):
            raise ValidationError("Metadata not found in response")
        if not result.get("translated_content"):
            raise ValidationError("Translated content not found in response")
        if not result.get("summary"):
            raise ValidationError("Summary not found in response")
        if not result.get("required_knowledge"):
            raise ValidationError("Required knowledge not found in response")
            
        add_step(session_id, paper_id, "response_validation_complete")
        
        # パフォーマンス記録に各データを保存
        save_metadata_text(session_id, json.dumps(result.get("metadata", {}), ensure_ascii=False))
        save_translated_text(session_id, result.get("translated_content", ""))
        save_summary_text(session_id, result.get("summary", ""))
        
        # 処理時間の記録を正常終了
        stop_timer(session_id, paper_id, True)
        
        log_info("IntegratedProcessing", f"Integrated processing completed for paper: {paper_id}")
        
        return result
        
    except Exception as e:
        # エラー発生時の処理時間記録
        stop_timer(session_id, paper_id, False, str(e))
        log_error("IntegratedProcessingError", f"Error in integrated processing: {str(e)}", 
                 {"paper_id": paper_id, "pdf_path": pdf_gs_path})
        raise
    finally:
        # チャットセッションを終了
        end_chat_session(paper_id)

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

def format_basic_html(text: str) -> str:
    """
    テキストに基本的な段落タグとシンプルなリスト検出処理を適用する
    
    Args:
        text: 整形するテキスト
        
    Returns:
        str: HTML整形されたテキスト
    """
    if not text:
        return ""
    
    # すでにHTMLタグが含まれている場合は処理しない
    if "<p>" in text or "<ol>" in text:
        return text
    
    # 空行で段落を分割
    paragraphs = text.split("\n\n")
    formatted_paragraphs = []
    
    # 連続するリスト項目を検出するための変数
    current_list_items = []
    
    for paragraph in paragraphs:
        if not paragraph.strip():
            continue
            
        # 数字+ピリオドで始まる段落をリスト項目として検出
        # 例: "1. テキスト" や "2. テキスト" など
        import re
        list_match = re.match(r'^\s*(\d+)\.\s+(.*)', paragraph.strip())
        
        if list_match:
            # リスト項目を保存
            item_content = list_match.group(2)
            current_list_items.append(item_content)
        else:
            # 蓄積されたリスト項目があれば処理
            if current_list_items:
                # リスト全体を<ol>タグで囲む
                list_html = "<ol>\n"
                for item in current_list_items:
                    list_html += f"<li>{item}</li>\n"
                list_html += "</ol>"
                formatted_paragraphs.append(list_html)
                current_list_items = []  # リストをクリア
            
            # 通常の段落として処理
            formatted_paragraphs.append(f"<p>{paragraph.strip()}</p>")
    
    # 最後に残ったリスト項目があれば処理
    if current_list_items:
        list_html = "<ol>\n"
        for item in current_list_items:
            list_html += f"<li>{item}</li>\n"
        list_html += "</ol>"
        formatted_paragraphs.append(list_html)
    
    return "\n\n".join(formatted_paragraphs)

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
            time.sleep(0.1 + random.uniform(0.1, 0.5))
            return process_with_chat(paper_id, prompt, operation=operation)  # operation パラメータを追加
        
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
            
            # 翻訳結果の処理 - 基本的なHTML整形を適用
            if operation == "translate" and "translated_text" in result:
                # 段落タグの付与のみを行う
                translated_text = result.get("translated_text", "")
                result["translated_text"] = format_basic_html(translated_text)
                
                # 章情報を結果に追加
                result["chapter_number"] = chapter_info["chapter_number"]
                result["title"] = chapter_info.get("title", "")
                result["start_page"] = chapter_info["start_page"]
                result["end_page"] = chapter_info["end_page"]
                
                add_step(session_id, paper_id, "translation_processed")
            
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
                # 基本的なHTML整形処理を適用
                formatted_text = format_basic_html(response_text, chapter_info)
                
                result = {
                    "translated_text": formatted_text,
                    "chapter_number": chapter_info["chapter_number"],
                    "title": chapter_info.get("title", ""),
                    "start_page": chapter_info["start_page"],
                    "end_page": chapter_info["end_page"]
                }
                
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