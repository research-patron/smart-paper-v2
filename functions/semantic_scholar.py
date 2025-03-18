"""
Semantic Scholar API連携モジュール
論文の関連論文を取得するためのヘルパー関数群
"""
import requests
import json
import os
import time
from typing import List, Dict, Any, Optional
from google.cloud import secretmanager
from error_handling import log_error, log_info, log_warning

# Secret ManagerのプロジェクトID
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
# Secret Managerからのキャッシュ
_API_KEY = None

def get_api_key() -> str:
    """
    Secret ManagerからSemantic Scholar APIキーを取得
    
    Returns:
        str: Semantic Scholar APIキー
    """
    global _API_KEY
    
    # キャッシュがあればそれを返す
    if _API_KEY:
        return _API_KEY
    
    try:
        # Secret Managerクライアントを初期化
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{PROJECT_ID}/secrets/connected-papers-api-key/versions/latest"
        response = client.access_secret_version(request={"name": name})
        _API_KEY = response.payload.data.decode("UTF-8").strip()
        return _API_KEY
    except Exception as e:
        log_error("SecretManagerError", f"Failed to get Semantic Scholar API key: {str(e)}")
        # エラー時はデフォルトの認証情報を返す（開発環境のフォールバック）
        return None

def get_related_papers_by_doi(doi: str, max_papers: int = 15) -> List[Dict[str, Any]]:
    """
    Semantic Scholar APIを使用してDOIから関連論文を取得
    
    Args:
        doi: 論文のDOI
        max_papers: 取得する論文の最大数 (デフォルト: 15)
        
    Returns:
        List[Dict[str, Any]]: 関連論文のリスト
    """
    try:
        # APIキーを取得
        api_key = get_api_key()
        
        # Semantic Scholar APIを呼び出す
        headers = {
            "x-api-key": api_key
        }
        
        # APIエンドポイント（論文情報取得）
        paper_url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}"
        paper_params = {
            "fields": "paperId,title,abstract,authors,year,citationCount"
        }
        
        # レート制限に対応するため少し待機
        time.sleep(1)
        
        # 論文情報の取得
        paper_response = requests.get(paper_url, headers=headers, params=paper_params)
        
        # エラーチェック
        if paper_response.status_code == 404:
            log_warning("SemanticScholarAPIError", f"Paper with DOI {doi} not found", 
                       {"response": paper_response.text})
            return _get_dummy_related_papers("DOIに一致する論文が見つかりませんでした")
            
        if paper_response.status_code != 200:
            log_error("SemanticScholarAPIError", f"API returned error: {paper_response.status_code}", 
                     {"response": paper_response.text})
            return _get_dummy_related_papers()
        
        # 論文情報を取得
        paper_data = paper_response.json()
        paper_id = paper_data.get("paperId")
        
        if not paper_id:
            log_warning("SemanticScholarAPIError", f"No paperId found for DOI {doi}")
            return _get_dummy_related_papers("この論文のIDが取得できませんでした")
        
        # レート制限に対応するため少し待機
        time.sleep(1)
        
        # 関連論文APIエンドポイント
        related_url = f"https://api.semanticscholar.org/graph/v1/paper/{paper_id}/related"
        related_params = {
            "fields": "paperId,title,authors,year,abstract,citationCount,url,venue,doi",
            "limit": max_papers
        }
        
        # 関連論文の取得
        related_response = requests.get(related_url, headers=headers, params=related_params)
        
        # エラーチェック
        if related_response.status_code != 200:
            log_error("SemanticScholarAPIError", f"API returned error: {related_response.status_code}", 
                     {"response": related_response.text})
            return _get_dummy_related_papers()
        
        # 関連論文データを解析
        related_data = related_response.json()
        related_papers = []
        
        for paper in related_data.get("data", []):
            # 著者リストの作成
            authors = []
            for author in paper.get("authors", []):
                authors.append(author.get("name", ""))
            
            # 関連論文情報の整形
            related_papers.append({
                "title": paper.get("title", ""),
                "doi": paper.get("doi", ""),
                "year": paper.get("year"),
                "authors": authors,
                "citation_count": paper.get("citationCount", 0),
                "relatedness_score": 0.9,  # APIが関連度を直接提供していないため、固定値を使用
                "url": paper.get("url", f"https://doi.org/{paper.get('doi')}" if paper.get("doi") else "")
            })
        
        log_info("SemanticScholarAPI", f"Successfully retrieved {len(related_papers)} related papers for DOI: {doi}")
        return related_papers
    except Exception as e:
        log_error("SemanticScholarAPIError", f"Failed to get related papers: {str(e)}", {"doi": doi})
        # エラー時はダミーデータを返す
        return _get_dummy_related_papers()

def get_related_papers_by_title(title: str, max_papers: int = 15) -> List[Dict[str, Any]]:
    """
    Semantic Scholar APIを使用してタイトルから関連論文を取得
    
    Args:
        title: 論文のタイトル
        max_papers: 取得する論文の最大数 (デフォルト: 15)
        
    Returns:
        List[Dict[str, Any]]: 関連論文のリスト
    """
    try:
        # APIキーを取得
        api_key = get_api_key()
        
        # Semantic Scholar APIを呼び出す
        headers = {
            "x-api-key": api_key
        }
        
        # APIエンドポイント（論文検索）
        search_url = "https://api.semanticscholar.org/graph/v1/paper/search"
        search_params = {
            "query": title,
            "fields": "paperId,title,abstract,authors,year,citationCount",
            "limit": 1  # 最も関連性の高い論文を1つだけ取得
        }
        
        # 論文検索
        search_response = requests.get(search_url, headers=headers, params=search_params)
        
        # エラーチェック
        if search_response.status_code != 200:
            log_error("SemanticScholarAPIError", f"API returned error: {search_response.status_code}", 
                     {"response": search_response.text})
            return _get_dummy_related_papers()
        
        # 検索結果を解析
        search_data = search_response.json()
        papers = search_data.get("data", [])
        
        if not papers:
            log_warning("SemanticScholarAPIError", f"No papers found with title: {title}")
            return _get_dummy_related_papers("タイトルに一致する論文が見つかりませんでした")
        
        # 最も関連性の高い論文のIDを取得
        paper_id = papers[0].get("paperId")
        
        if not paper_id:
            log_warning("SemanticScholarAPIError", f"No paperId found for title: {title}")
            return _get_dummy_related_papers("この論文のIDが取得できませんでした")
        
        # レート制限に対応するため少し待機
        time.sleep(1)
        
        # 関連論文APIエンドポイント
        related_url = f"https://api.semanticscholar.org/graph/v1/paper/{paper_id}/related"
        related_params = {
            "fields": "paperId,title,authors,year,abstract,citationCount,url,venue,doi",
            "limit": max_papers
        }
        
        # 関連論文の取得
        related_response = requests.get(related_url, headers=headers, params=related_params)
        
        # エラーチェック
        if related_response.status_code != 200:
            log_error("SemanticScholarAPIError", f"API returned error: {related_response.status_code}", 
                     {"response": related_response.text})
            return _get_dummy_related_papers()
        
        # 関連論文データを解析
        related_data = related_response.json()
        related_papers = []
        
        for paper in related_data.get("data", []):
            # 著者リストの作成
            authors = []
            for author in paper.get("authors", []):
                authors.append(author.get("name", ""))
            
            # 関連論文情報の整形
            related_papers.append({
                "title": paper.get("title", ""),
                "doi": paper.get("doi", ""),
                "year": paper.get("year"),
                "authors": authors,
                "citation_count": paper.get("citationCount", 0),
                "relatedness_score": 0.8,  # タイトル検索は関連度をやや低く設定
                "url": paper.get("url", f"https://doi.org/{paper.get('doi')}" if paper.get("doi") else "")
            })
        
        log_info("SemanticScholarAPI", f"Successfully retrieved {len(related_papers)} related papers for title: {title}")
        return related_papers
    except Exception as e:
        log_error("SemanticScholarAPIError", f"Failed to get related papers by title: {str(e)}", {"title": title})
        # エラー時はダミーデータを返す
        return _get_dummy_related_papers()

def get_related_papers(paper_data: Dict[str, Any], max_papers: int = 15) -> List[Dict[str, Any]]:
    """
    論文メタデータから関連論文を取得（DOIがある場合はDOIを使用、ない場合はタイトルを使用）
    
    Args:
        paper_data: 論文メタデータ
        max_papers: 取得する論文の最大数 (デフォルト: 15)
        
    Returns:
        List[Dict[str, Any]]: 関連論文のリスト
    """
    # メタデータがない場合はダミーデータを返す
    if not paper_data or "metadata" not in paper_data:
        return _get_dummy_related_papers("論文のメタデータが見つかりません")
    
    metadata = paper_data["metadata"]
    
    # DOIがある場合はDOIを使用
    if metadata.get("doi"):
        doi = metadata["doi"]
        log_info("RelatedPapers", f"Searching related papers using DOI: {doi}")
        return get_related_papers_by_doi(doi, max_papers)
    
    # DOIがない場合はタイトルを使用
    elif metadata.get("title"):
        title = metadata["title"]
        log_info("RelatedPapers", f"DOI not found. Searching related papers using title: {title}")
        return get_related_papers_by_title(title, max_papers)
    
    # DOIもタイトルもない場合はダミーデータを返す
    else:
        return _get_dummy_related_papers("論文のDOIもタイトルも見つかりません")

def _get_dummy_related_papers(message: str = "関連論文の取得中にエラーが発生しました") -> List[Dict[str, Any]]:
    """
    APIが失敗した場合のダミーデータを返す
    
    Args:
        message: 表示するメッセージ
        
    Returns:
        List[Dict[str, Any]]: ダミーの関連論文リスト
    """
    return [
        {
            "title": message,
            "doi": "",
            "year": None,
            "authors": ["一時的なエラーが発生しました。もう一度試してください。"],
            "citation_count": 0,
            "relatedness_score": 0
        }
    ]