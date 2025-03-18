"""
Semantic Scholar API連携モジュール - シンプル化したバージョン
論文の関連論文を取得するためのヘルパー関数
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

def get_related_papers_direct(paper_id: str, max_papers: int = 15) -> List[Dict[str, Any]]:
    """
    Semantic Scholar APIを使用して論文IDから直接関連論文を取得
    CloudFunctionsにキャッシュした論文IDを使用する場合に使用
    
    Args:
        paper_id: Semantic Scholar論文ID
        max_papers: 取得する論文の最大数 (デフォルト: 15)
        
    Returns:
        List[Dict[str, Any]]: 関連論文のリスト
    """
    try:
        # APIキーを取得
        api_key = get_api_key()
        
        # APIヘッダー設定
        headers = {
            "x-api-key": api_key
        } if api_key else {}
        
        # 関連論文APIエンドポイント
        related_url = f"https://api.semanticscholar.org/graph/v1/paper/{paper_id}/related"
        related_params = {
            "fields": "paperId,title,authors,year,abstract,citationCount,url,venue,doi",
            "limit": max_papers
        }
        
        # 関連論文のリクエスト
        log_info("SemanticScholarAPI", f"Requesting related papers for paper_id: {paper_id}")
        related_response = requests.get(related_url, headers=headers, params=related_params)
        
        # エラーチェック
        if related_response.status_code != 200:
            log_error("SemanticScholarAPIError", f"API returned error: {related_response.status_code}", 
                     {"response": related_response.text})
            return _get_dummy_related_papers("関連論文の取得に失敗しました。しばらくしてからお試しください。")
        
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
        
        log_info("SemanticScholarAPI", f"Successfully retrieved {len(related_papers)} related papers")
        return related_papers
    except Exception as e:
        log_error("SemanticScholarAPIError", f"Failed to get related papers: {str(e)}")
        # エラー時はダミーデータを返す
        return _get_dummy_related_papers()

def get_paper_id_by_doi(doi: str) -> Optional[str]:
    """
    DOIから論文IDを取得する
    
    Args:
        doi: 論文のDOI
        
    Returns:
        Optional[str]: 論文ID (失敗時はNone)
    """
    try:
        # APIキーを取得
        api_key = get_api_key()
        
        # APIヘッダー設定
        headers = {
            "x-api-key": api_key
        } if api_key else {}
        
        # APIエンドポイント（論文情報取得）
        paper_url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}"
        paper_params = {
            "fields": "paperId"  # 最小限のフィールドのみ取得
        }
        
        # 論文IDのリクエスト
        log_info("SemanticScholarAPI", f"Requesting paper ID for DOI: {doi}")
        paper_response = requests.get(paper_url, headers=headers, params=paper_params)
        
        # エラーチェック
        if paper_response.status_code != 200:
            log_error("SemanticScholarAPIError", f"API returned error: {paper_response.status_code}", 
                     {"response": paper_response.text})
            return None
        
        # 論文IDを取得
        paper_data = paper_response.json()
        paper_id = paper_data.get("paperId")
        
        if paper_id:
            log_info("SemanticScholarAPI", f"Found paper ID: {paper_id} for DOI: {doi}")
            return paper_id
        else:
            log_warning("SemanticScholarAPIError", f"No paperId found for DOI: {doi}")
            return None
    except Exception as e:
        log_error("SemanticScholarAPIError", f"Failed to get paper ID: {str(e)}", {"doi": doi})
        return None

def get_paper_id_by_title(title: str) -> Optional[str]:
    """
    タイトルから論文IDを取得する
    
    Args:
        title: 論文のタイトル
        
    Returns:
        Optional[str]: 論文ID (失敗時はNone)
    """
    try:
        # APIキーを取得
        api_key = get_api_key()
        
        # APIヘッダー設定
        headers = {
            "x-api-key": api_key
        } if api_key else {}
        
        # APIエンドポイント（論文検索）
        search_url = "https://api.semanticscholar.org/graph/v1/paper/search"
        search_params = {
            "query": title,
            "fields": "paperId",  # 最小限のフィールドのみ取得
            "limit": 1  # 最も関連性の高い論文を1つだけ取得
        }
        
        # 論文検索
        log_info("SemanticScholarAPI", f"Searching for paper with title: {title}")
        search_response = requests.get(search_url, headers=headers, params=search_params)
        
        # エラーチェック
        if search_response.status_code != 200:
            log_error("SemanticScholarAPIError", f"API returned error: {search_response.status_code}", 
                     {"response": search_response.text})
            return None
        
        # 検索結果を解析
        search_data = search_response.json()
        papers = search_data.get("data", [])
        
        if not papers:
            log_warning("SemanticScholarAPIError", f"No papers found with title: {title}")
            return None
        
        # 最も関連性の高い論文のIDを取得
        paper_id = papers[0].get("paperId")
        
        if paper_id:
            log_info("SemanticScholarAPI", f"Found paper ID: {paper_id} for title: {title}")
            return paper_id
        else:
            log_warning("SemanticScholarAPIError", f"No paperId found for title: {title}")
            return None
    except Exception as e:
        log_error("SemanticScholarAPIError", f"Failed to get paper ID: {str(e)}", {"title": title})
        return None

def get_related_papers(paper_data: Dict[str, Any], max_papers: int = 15) -> List[Dict[str, Any]]:
    """
    論文メタデータから関連論文を取得（DOIがある場合はDOIを使用、ない場合はタイトルを使用）
    APIリクエストを最小限に抑えるため、重要なリクエストのみを行う
    
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
    paper_id = None
    
    # すでに関連論文がFirestoreに保存されている場合はそれを返す
    if paper_data.get("related_papers"):
        log_info("RelatedPapers", "Using cached related papers from Firestore")
        return paper_data["related_papers"]
    
    # 最初にFirestoreに保存されたSemantic Scholar IDをチェック
    if paper_data.get("semantic_scholar_id"):
        paper_id = paper_data["semantic_scholar_id"]
        log_info("RelatedPapers", f"Using cached Semantic Scholar ID: {paper_id}")
    
    # DOIから検索
    elif metadata.get("doi"):
        doi = metadata["doi"]
        log_info("RelatedPapers", f"Searching for paper ID using DOI: {doi}")
        # 遅延を入れる - システム全体の負荷軽減のため
        time.sleep(1)
        paper_id = get_paper_id_by_doi(doi)
    
    # タイトルから検索
    elif metadata.get("title"):
        title = metadata["title"]
        log_info("RelatedPapers", f"DOI not found. Searching for paper ID using title: {title}")
        # 遅延を入れる - システム全体の負荷軽減のため
        time.sleep(1)
        paper_id = get_paper_id_by_title(title)
    
    # 論文IDが取得できた場合は関連論文を取得
    if paper_id:
        # 少し待機 - APIレート制限への配慮
        time.sleep(2)
        return get_related_papers_direct(paper_id, max_papers)
    else:
        return _get_dummy_related_papers("論文が見つかりません")

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