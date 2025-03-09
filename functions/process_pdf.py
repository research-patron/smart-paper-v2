import vertexai
import datetime
import json
import re
import sys
import traceback
import logging
from vertexai.generative_models import Part
from vertexai.preview import caching
from vertexai.preview.generative_models import GenerativeModel
from google.api_core import exceptions

# 使用するプロンプトファイルのパス
TRANSLATION_PROMPT_FILE = "./prompts/translation_prompt_v1.json"
SUMMARY_PROMPT_FILE = "./prompts/summary_prompt_v1.json"
METADATA_AND_CHAPTER_PROMPT_FILE = "./prompts/metadata_and_chapter_prompt_v1.json"

# デフォルトのプロンプト (プロンプトファイルが読み込めない場合に使用)
DEFAULT_TRANSLATION_PROMPT = """
あなたは学術論文の翻訳者です。与えられた英語または他の言語の論文を日本語に翻訳してください。
翻訳は学術的に正確であるべきですが、読みやすさも考慮してください。
専門用語は適切な日本語訳または原語のままにしてください。
数式、図表の参照、引用は原文のまま残してください。

以下の情報を使用して、指定された章（チャプター）だけを翻訳してください：

出力形式：
```json
{
  "translated_text": "翻訳されたテキスト（HTMLマークアップ形式）"
}
```
"""

DEFAULT_SUMMARY_PROMPT = """
あなたは学術論文を要約する専門家です。
以下の情報を使用して、指定された章（チャプター）の要約を生成してください。
要約は日本語で作成し、そのセクションの重要なポイント、方法論、結果、結論を含めてください。

出力形式：
```json
{
  "summary": "章の要約（500字程度）"
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

def create_cached_content(pdf_gs_path: str, file_name: str) -> str:
    """
    PDFファイルからコンテキストキャッシュを生成する

    Args:
        pdf_gs_path: FirebaseのCloud Storage上のPDFファイルパス (gs://で始まる)
        file_name: ファイル名

    Returns:
        str: キャッシュID
    """
    try:
        contents = [
            Part.from_uri(
                pdf_gs_path,
                mime_type="application/pdf",
            )
        ]

        # キャッシュIDを生成 (ファイル名 + タイムスタンプ)
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S-%f")
        cache_id = f"{file_name}_{timestamp}"

        cached_content = caching.CachedContent.create(
            model_name="gemini-1.5-flash-002",
            contents=contents,
            ttl=None,  # TTLは設定しない
            display_name=cache_id  # キャッシュ名としてファイル名とタイムスタンプを使用
        )

        return cached_content.name
    except Exception as e:
        log_error("VertexAIError", "Failed to create context cache", {"error": str(e), "file_path": pdf_gs_path})
        raise

def process_with_cache(cache_id: str, operation: str, chapter_info: dict = None) -> dict:
    """
    コンテキストキャッシュを使用して翻訳・要約・メタデータ抽出を行う

    Args:
        cache_id: コンテキストキャッシュID
        operation: 処理内容 ('translate', 'summarize', 'extract_metadata_and_chapters')
        chapter_info: 章情報（章番号、開始ページ、終了ページ）。translate, summarize の場合に必要。

    Returns:
        dict: 処理結果（JSON形式）
    """
    try:
        cached_content = caching.CachedContent(cached_content_name=cache_id)
        model = GenerativeModel.from_cached_content(cached_content=cached_content, model_name="gemini-1.5-flash-002")

        # 処理内容に応じてプロンプトを選択
        if operation == "translate":
            prompt = load_prompt(TRANSLATION_PROMPT_FILE)
            # プロンプトに章情報を追加
            prompt += f"\n\nChapter Number: {chapter_info['chapter_number']}"
            prompt += f"\nStart Page: {chapter_info['start_page']}"
            prompt += f"\nEnd Page: {chapter_info['end_page']}"
            prompt += f"\nChapter Title: {chapter_info['title']}"
        elif operation == "summarize":
            prompt = load_prompt(SUMMARY_PROMPT_FILE)
            # プロンプトに章情報を追加
            prompt += f"\n\nChapter Number: {chapter_info['chapter_number']}"
            prompt += f"\nStart Page: {chapter_info['start_page']}"
            prompt += f"\nEnd Page: {chapter_info['end_page']}"
            prompt += f"\nChapter Title: {chapter_info['title']}"
        elif operation == "extract_metadata_and_chapters":
            prompt = load_prompt(METADATA_AND_CHAPTER_PROMPT_FILE)
        else:
            raise ValueError(f"Invalid operation: {operation}")

        response = generate_content_with_retry(model, prompt)

        try:
            result = json.loads(response.text)
            # 翻訳結果のHTMLをサニタイズ
            if operation == "translate":
                if 'chapters' in result:  # チャプターで分割
                    for chapter in result["chapters"]:
                        chapter["translated_text"] = sanitize_html(chapter["translated_text"])
                else:  # チャプターがない場合
                    result["translated_text"] = sanitize_html(result["translated_text"])
                    # 章情報を追加
                    result["chapter_number"] = chapter_info["chapter_number"]
                    result["title"] = chapter_info["title"]
                    result["start_page"] = chapter_info["start_page"]
                    result["end_page"] = chapter_info["end_page"]
            return result
        except json.JSONDecodeError as e:
            log_error("JSONDecodeError", "Invalid JSON response from Vertex AI", 
                     {"response_text": response.text, "error": str(e)})
            
            # JSONでない場合のフォールバック処理
            if operation == "translate":
                return {
                    "translated_text": sanitize_html(response.text),
                    "chapter_number": chapter_info["chapter_number"],
                    "title": chapter_info["title"],
                    "start_page": chapter_info["start_page"],
                    "end_page": chapter_info["end_page"]
                }
            elif operation == "summarize":
                return {"summary": response.text}
            else:
                # それでも失敗する場合は例外を発生させる
                raise
    except Exception as e:
        log_error("VertexAIError", f"Failed to process with cache: {operation}", {"error": str(e), "cache_id": cache_id})
        raise

def generate_content_with_retry(model, prompt, max_retries=3):
    """
    Vertex AIのGenerative AIモデルを呼び出し、リトライロジックを組み込む

    Args:
        model: 生成モデル
        prompt: プロンプト文字列
        max_retries: 最大リトライ回数

    Returns:
        生成レスポンス
    """
    retries = 0
    last_error = None

    while retries < max_retries:
        try:
            response = model.generate_content(prompt)
            return response
        except exceptions.DeadlineExceeded as e:
            # タイムアウトエラー
            last_error = e
            retries += 1
            log_error("VertexAITimeout", f"Retry {retries}/{max_retries}: API request timed out", {"error": str(e)})
        except exceptions.ServiceUnavailable as e:
            # サービス一時的利用不可
            last_error = e
            retries += 1
            log_error("VertexAIUnavailable", f"Retry {retries}/{max_retries}: Service unavailable", {"error": str(e)})
        except Exception as e:
            # その他のエラー (リトライしない)
            log_error("VertexAIError", "Error generating content", {"error": str(e)})
            raise

    # すべてのリトライが失敗
    log_error("VertexAIMaxRetries", "All retries failed", {"error": str(last_error)})
    raise last_error

def cleanup_cache(cache_id: str):
    """
    コンテキストキャッシュを削除する

    Args:
        cache_id: キャッシュID
    """
    try:
        cached_content = caching.CachedContent(cached_content_name=cache_id)
        cached_content.delete()
    except Exception as e:
        log_error("VertexAIError", "Failed to cleanup cache", {"error": str(e), "cache_id": cache_id})
        # キャッシュ削除の失敗はエラーとして扱わず、ログだけ残す

def sanitize_html(html_text: str) -> str:
    """
    HTMLをサニタイズする（XSS対策など）

    Args:
        html_text: サニタイズするHTML文字列

    Returns:
        str: サニタイズされたHTML
    """
    if not html_text:
        return ""
        
    # 許可するタグのリスト
    allowed_tags = [
        'p', 'br', 'b', 'i', 'u', 'strong', 'em', 
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'sup', 'sub', 'span'
    ]
    
    # 許可する属性のリスト
    allowed_attrs = {
        'span': ['style'],
        'th': ['colspan', 'rowspan'],
        'td': ['colspan', 'rowspan']
    }
    
    # スクリプトタグとイベントハンドラを削除
    html_text = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', html_text, flags=re.IGNORECASE)
    html_text = re.sub(r'\bon\w+\s*=\s*"[^"]*"', '', html_text, flags=re.IGNORECASE)
    
    # iframeタグを削除
    html_text = re.sub(r'<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>', '', html_text, flags=re.IGNORECASE)
    
    # styleタグとlinkタグを削除
    html_text = re.sub(r'<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>', '', html_text, flags=re.IGNORECASE)
    html_text = re.sub(r'<link\b[^<]*(?:(?!>)(.|\n))*>', '', html_text, flags=re.IGNORECASE)
    
    # 許可しないすべてのタグを削除
    for tag in re.findall(r'</?(\w+)[^>]*>', html_text):
        if tag.lower() not in allowed_tags:
            pattern = r'<{0}[^>]*>.*?</{0}>'.format(tag)
            html_text = re.sub(pattern, '', html_text, flags=re.DOTALL | re.IGNORECASE)
            html_text = re.sub(r'<{0}[^>]*>'.format(tag), '', html_text, flags=re.IGNORECASE)
            html_text = re.sub(r'</{0}[^>]*>'.format(tag), '', html_text, flags=re.IGNORECASE)
    
    # 許可しない属性を削除
    for tag in allowed_tags:
        if tag in allowed_attrs:
            for attr in allowed_attrs[tag]:
                continue
        else:
            pattern = r'<{0}\s+[^>]*>'.format(tag)
            for match in re.finditer(pattern, html_text, re.IGNORECASE):
                old_tag = match.group(0)
                new_tag = '<{0}>'.format(tag)
                html_text = html_text.replace(old_tag, new_tag)
    
    return html_text

def log_error(error_type: str, message: str, details: dict = None):
    """
    エラー情報を構造化ログとして標準エラー出力に出力

    Args:
        error_type: エラーの種類
        message: エラーメッセージ
        details: エラーの詳細情報（オプション）
    """
    # Cloud Logging で認識される形式でログを出力
    logging.error(json.dumps({
        "severity": "ERROR",  # Cloud Logging でエラーとして認識される
        "error_type": error_type,
        "message": message,
        "timestamp": datetime.datetime.now().isoformat(),
        "stack_trace": traceback.format_exc(),
        "details": details,
    }))

# プロンプトファイルの読み込み
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
            prompt = json.load(f)
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