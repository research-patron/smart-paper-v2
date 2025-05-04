import json
import re
from error_handling import log_error, log_warning

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
            parsed_json = json.loads(potential_json)
            # 重要な修正: この関数ではJSONとして解析したオブジェクトを返す
            return parsed_json
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
                    return json.loads(json_str)  # 修正: パースしたJSONオブジェクトを返す
                except json.JSONDecodeError:
                    # JSONの修復を試みる
                    json_str = json_str.replace('\n', '\\n')
                    try:
                        return json.loads(json_str)  # 修正: パースしたJSONオブジェクトを返す
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
            return {"translated_text": full_text}  # 修正: 辞書オブジェクトを返す
    
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
        
        return {"translated_text": cleaned_text}  # 修正: 辞書オブジェクトを返す
    
    # 5. 要約処理の特殊フォールバック
    elif operation == "summarize":
        try:
            # JSON文字列のパターンを探す
            summary_json_pattern = re.compile(r'\{\s*"summary"\s*:\s*"(.+?)"\s*,\s*"required_knowledge"\s*:\s*"(.+?)"\s*\}', re.DOTALL)
            json_match = summary_json_pattern.search(cleaned_text)
            
            if json_match:
                # マッチした場合は抽出してJSONオブジェクトを構築
                summary_text = json_match.group(1).replace('\\n', '\n').replace('\\"', '"')
                required_knowledge = json_match.group(2).replace('\\n', '\n').replace('\\"', '"')
                return {
                    "summary": summary_text,
                    "required_knowledge": required_knowledge
                }
            else:
                # マッチしない場合はテキスト全体を要約として扱う
                return {"summary": cleaned_text}
        except Exception:
            # エラー時はテキスト全体を要約として扱う
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
                    
                    # 章番号の抽出 - 文字列または数値の両方に対応
                    chapter_number_pattern = re.compile(r'"chapter_number"\s*:\s*"?([^",]+)"?')
                    number_match = chapter_number_pattern.search(chapter_item)
                    if number_match:
                        chapter["chapter_number"] = number_match.group(1).strip()
                    
                    # タイトル
                    title_match = re.search(r'"title"\s*:\s*"([^"]+)"', chapter_item)
                    if title_match:
                        chapter["title"] = title_match.group(1).strip()
                    
                    # 日本語タイトル (新規追加)
                    title_ja_match = re.search(r'"title_ja"\s*:\s*"([^"]+)"', chapter_item)
                    if title_ja_match:
                        chapter["title_ja"] = title_ja_match.group(1).strip()
                    else:
                        # 日本語タイトルがない場合は英語タイトルを使用
                        if "title" in chapter:
                            # 英語タイトルを日本語名に自動変換
                            title_lower = chapter["title"].lower()
                            if "introduction" in title_lower:
                                chapter["title_ja"] = "はじめに"
                            elif "method" in title_lower:
                                chapter["title_ja"] = "方法"
                            elif "result" in title_lower:
                                chapter["title_ja"] = "結果"
                            elif "discussion" in title_lower:
                                chapter["title_ja"] = "考察"
                            elif "conclusion" in title_lower:
                                chapter["title_ja"] = "結論"
                            elif "abstract" in title_lower:
                                chapter["title_ja"] = "要約"
                            elif "background" in title_lower:
                                chapter["title_ja"] = "背景"
                            elif "reference" in title_lower:
                                chapter["title_ja"] = "参考文献"
                            elif "bibliography" in title_lower:
                                chapter["title_ja"] = "参考文献"
                            else:
                                # 該当なしの場合は元のタイトルを使用
                                chapter["title_ja"] = chapter["title"]
                    
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

def extract_content_from_json(json_obj, operation):
    """
    パース済みJSONから実際の内容を抽出する
    
    Args:
        json_obj: パース済みJSONオブジェクト
        operation: 操作タイプ
        
    Returns:
        str: 抽出されたコンテンツ
    """
    if not json_obj or not isinstance(json_obj, dict):
        return "内容を抽出できません"
        
    # 操作タイプに応じて抽出
    if operation == "translate":
        return json_obj.get("translated_text", "翻訳内容が見つかりません")
    elif operation == "summarize":
        return json_obj.get("summary", "要約内容が見つかりません")
    elif operation == "extract_metadata_and_chapters":
        # メタデータ抽出の場合は構造化データなのでJSON形式で返す
        return json.dumps(json_obj, indent=2, ensure_ascii=False)
    else:
        # その他の操作の場合は、よく使われるキーを探す
        for key in ["text", "content", "result", "output", "data"]:
            if key in json_obj:
                return json_obj[key]
                
        # 最終手段: JSONをそのまま文字列化して返す
        return json.dumps(json_obj, indent=2, ensure_ascii=False)

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