import json
import re
import os
from typing import Dict, Optional, Any, List
from vertex import (
    initialize_vertex_ai,
    get_model,
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


def process_content(pdf_gs_path: str, operation: str, chapter_info: dict = None, metadata: dict = None) -> dict:
    """
    PDFファイルを直接処理して翻訳・要約・メタデータ抽出を行う
    
    metadata引数が提供された場合、その章構成情報を使用して翻訳を行います。

    Args:
        pdf_gs_path: PDFファイルのパス (gs://から始まる)
        operation: 処理内容 ('translate', 'summarize', 'extract_metadata_and_chapters')
        chapter_info: 章情報（章番号、開始ページ、終了ページ）。translate, summarize の場合に必要。

    Returns:
        dict: 処理結果（JSON形式）
    """
    try:
        # Vertex AIの初期化
        initialize_vertex_ai()
        
        # モデルを取得
        model = get_model()
        
        # 処理内容に応じてプロンプトを選択
        if operation == "translate":
            if not chapter_info:
                raise ValidationError("Chapter info is required for translation operation")
                
            prompt_template = load_prompt(TRANSLATION_PROMPT_FILE)
            
            # 章構成の文字列を作成
            if metadata and "chapters" in metadata:
                chapters_str = json.dumps([{
                    "chapter_number": ch["chapter_number"],
                    "title": ch["title"]
                } for ch in sorted(metadata["chapters"], key=lambda x: x["chapter_number"])], 
                ensure_ascii=False, indent=2)
            else:
                chapters_str = "単一章の翻訳"

            # テンプレートの置換
            prompt = prompt_template.replace("{{chapter_structure}}", chapters_str)
            prompt = prompt.replace("{{current_chapter}}", str(chapter_info["chapter_number"]))
            prompt = prompt.replace("{{current_title}}", chapter_info["title"])
            prompt = prompt.replace("{{start_page}}", str(chapter_info["start_page"]))
            prompt = prompt.replace("{{end_page}}", str(chapter_info["end_page"]))
            
        elif operation == "summarize":
            if not chapter_info:
                raise ValidationError("Chapter info is required for summarize operation")
                
            prompt = load_prompt(SUMMARY_PROMPT_FILE)
            # プロンプトに章情報を追加
            prompt += f"\n\nChapter Number: {chapter_info['chapter_number']}"
            prompt += f"\nStart Page: {chapter_info['start_page']}"
            prompt += f"\nEnd Page: {chapter_info['end_page']}"
            prompt += f"\nChapter Title: {chapter_info['title']}"
            
        elif operation == "extract_metadata_and_chapters":
            prompt = load_prompt(METADATA_AND_CHAPTER_PROMPT_FILE)
            
        else:
            raise ValidationError(f"Invalid operation: {operation}")

        # PDFの処理と結果の生成
        log_info("ProcessPDF", f"Processing PDF content for operation: {operation}")
        response_text = process_pdf_content(model, pdf_gs_path, prompt)
        
        # レスポンスをJSON形式として処理
        result = process_json_response(response_text, operation)
            
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
                    
        log_info("ProcessPDF", f"Successfully processed {operation}")
        return result
                
    except Exception as e:
        log_error("ProcessPDFError", f"Failed to process PDF: {operation}", 
                 {"error": str(e), "file_path": pdf_gs_path, "operation": operation})
        raise

async def process_chapter(pdf_gs_path: str, chapter_info: dict, paper_id: str, chapter_structure: str):
    """
    指定された章の翻訳および要約を順次処理する

    Args:
        pdf_gs_path: PDFファイルのパス
        chapter_info: 章情報
        paper_id: 論文ID
        chapter_structure: 論文全体の章構成（JSON文字列）

    Returns:
        dict: 処理結果
    """
    try:
        # 翻訳プロンプトの準備
        prompt_template = load_prompt(TRANSLATION_PROMPT_FILE)
        # テンプレートの置換
        prompt = prompt_template.replace("{{chapter_structure}}", chapter_structure)
        prompt = prompt.replace("{{current_chapter}}", str(chapter_info['chapter_number']))
        prompt = prompt.replace("{{current_title}}", chapter_info['title'])
        prompt = prompt.replace("{{start_page}}", str(chapter_info['start_page']))
        prompt = prompt.replace("{{end_page}}", str(chapter_info['end_page']))

        # 翻訳処理
        log_info("ProcessChapter", f"Starting translation for chapter {chapter_info['chapter_number']}",
                {"paper_id": paper_id})
        translate_result = process_content(pdf_gs_path, "translate", chapter_info)

        if not translate_result:
            return {
                "success": False,
                "chapter_number": chapter_info["chapter_number"],
                "error": "翻訳結果が取得できませんでした"
            }

        # Firestore (translated_chapters サブコレクション) に結果を保存
        from google.cloud import firestore
        db = firestore.Client()
        doc_ref = db.collection("papers").document(paper_id)
        
        # この章がすでに存在するか確認
        chapter_query = doc_ref.collection("translated_chapters").where("chapter_number", "==", chapter_info['chapter_number'])
        chapter_docs = chapter_query.get()
        
        # 翻訳データに章情報を追加
        translated_data = {
            **translate_result,
            "chapter_number": chapter_info["chapter_number"],
            "title": chapter_info["title"],
            "start_page": chapter_info["start_page"],
            "end_page": chapter_info["end_page"]
        }
        
        if len(chapter_docs) > 0:
            # 既存の章を更新
            chapter_doc = chapter_docs[0]
            chapter_doc.reference.update(translated_data)
        else:
            # 新しい章を追加
            doc_ref.collection("translated_chapters").add(translated_data)

        log_info("ProcessChapter", f"Translation completed for chapter {chapter_info['chapter_number']}",
                {"paper_id": paper_id})

        # 要約処理
        log_info("ProcessChapter", f"Starting summary for chapter {chapter_info['chapter_number']}",
                {"paper_id": paper_id})
        summary_result = process_content(pdf_gs_path, "summarize", chapter_info)

        if not summary_result:
            return {
                "success": False,
                "chapter_number": chapter_info["chapter_number"],
                "error": "要約結果が取得できませんでした"
            }

        # Firestoreに結果を保存（章番号付きでフォーマット）
        current_summary = doc_ref.get().to_dict().get("summary", "")
        updated_summary = current_summary
        if current_summary:
            updated_summary += "\n\n"
        updated_summary += f"**Chapter {chapter_info['chapter_number']}:**\n{summary_result['summary']}"
        doc_ref.update({"summary": updated_summary})

        log_info("ProcessChapter", f"Summary completed for chapter {chapter_info['chapter_number']}",
                {"paper_id": paper_id})

        return {
            "success": True,
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

async def process_all_chapters(chapters: list, paper_id: str, pdf_gs_path: str):
    """
    すべての章を順番に処理する

    Args:
        chapters: 章情報のリスト
        paper_id: 論文ID
        pdf_gs_path: PDFのパス
    """
    from google.cloud import firestore
    from google.cloud import storage
    import datetime
    import json
    
    db = firestore.Client()
    storage_client = storage.Client()
    BUCKET_NAME = os.environ.get("BUCKET_NAME", f"{os.environ.get('GOOGLE_CLOUD_PROJECT')}.appspot.com")
    
    try:
        doc_ref = db.collection("papers").document(paper_id)

        # ステータスを処理中に更新
        doc_ref.update({
            "status": "processing",
            "progress": 0
        })

        # 章番号でソートして処理
        sorted_chapters = sorted(chapters, key=lambda x: x["chapter_number"])
        total_chapters = len(sorted_chapters)
        
        # 章構成のJSON文字列を作成
        chapter_structure = json.dumps([{
            "chapter_number": ch["chapter_number"],
            "title": ch["title"]
        } for ch in sorted_chapters], ensure_ascii=False, indent=2)

        results = []
        for i, chapter in enumerate(sorted_chapters, 1):
            log_info("ProcessAllChapters", 
                    f"Processing chapter {i}/{total_chapters}: Chapter {chapter['chapter_number']}",
                    {"paper_id": paper_id})

            # 翻訳を実行
            result = await process_chapter(
                pdf_gs_path=pdf_gs_path,
                chapter=chapter,
                paper_id=paper_id,
                chapter_structure=chapter_structure
            )

            # エラーチェック
            if not result["success"]:
                log_error("ProcessChapterError", 
                         f"Error processing chapter {chapter['chapter_number']}",
                         {"paper_id": paper_id, "error": result["error"]})
                doc_ref.update({
                    "status": "error",
                    "error_message": f"Chapter {chapter['chapter_number']}の処理中にエラーが発生しました: {result['error']}"
                })
                return

            results.append(result)
            
            # 進捗を更新
            progress = int((i / total_chapters) * 100)
            doc_ref.update({"progress": progress})

        # 全ての章の翻訳結果を結合
        all_translated_text = ""
        
        # 章番号順にソート
        chapter_docs = sorted(
            doc_ref.collection("translated_chapters").get(),
            key=lambda x: x.to_dict().get("chapter_number", 0)
        )
        
        for chapter_doc in chapter_docs:
            chapter_data = chapter_doc.to_dict()
            translated_text = chapter_data.get('translated_text', '')
            if translated_text:
                if all_translated_text:
                    all_translated_text += "\n\n"
                # 章番号とタイトルを追加
                chapter_title = chapter_data.get('title', f"Chapter {chapter_data.get('chapter_number', '?')}")
                all_translated_text += f"<h2>Chapter {chapter_data.get('chapter_number', '?')}: {chapter_title}</h2>\n\n"
                all_translated_text += translated_text

        # エラーチェック
        if not all_translated_text:
            log_warning("ProcessAllChapters", "No translated text was generated", {"paper_id": paper_id})
            all_translated_text = "<p>翻訳の生成に失敗しました。しばらくしてから再度お試しください。</p>"

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
                "completed_at": datetime.datetime.now(),
                "progress": 100
            })

            log_info("ProcessAllChapters", f"Large translated text saved to Cloud Storage",
                    {"paper_id": paper_id, "path": translated_text_path})
        else:
            # Firestoreに保存
            doc_ref.update({
                "translated_text_path": None,
                "translated_text": all_translated_text,
                "status": "completed",
                "completed_at": datetime.datetime.now(),
                "progress": 100
            })

            log_info("ProcessAllChapters", f"Translated text saved to Firestore", {"paper_id": paper_id})

        # 関連論文の追加（ダミーデータ）
        related_papers = [
            {"title": "Related Paper 1", "doi": "10.1234/abcd1234"},
            {"title": "Related Paper 2", "doi": "10.5678/efgh5678"},
            {"title": "Related Paper 3", "doi": "10.9101/ijkl9101"}
        ]

        doc_ref.update({"related_papers": related_papers})
        log_info("ProcessAllChapters", f"Added related papers recommendations", {"paper_id": paper_id})

        return results
    except Exception as e:
        log_error("ProcessAllChaptersError", "Failed to process all chapters",
                 {"paper_id": paper_id, "error": str(e)})

        # エラー状態に更新
        doc_ref.update({
            "status": "error",
            "error_message": str(e)
        })
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
        
        return process_content(process_with_cache.pdf_gs_path, operation, chapter_info)
    except Exception as e:
        log_error("ProcessPDFError", f"Failed to process with cache: {operation}", 
                 {"error": str(e), "cache_id": cache_id, "operation": operation})
        raise

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
