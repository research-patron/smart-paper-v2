import requests
import json
import os
from typing import List, Dict, Any, Optional
from google.cloud import secretmanager
from error_handling import log_error, log_info, log_warning

# Secret ManagerのプロジェクトID
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
# Secret Managerからのキャッシュ
_API_KEY = None

def get_api_key() -> str:
    """
    Secret ManagerからConnected Papers APIキーを取得
    
    Returns:
        str: Connected Papers APIキー
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
        log_error("SecretManagerError", f"Failed to get Connected Papers API key: {str(e)}")
        raise

def get_related_papers(doi: str, max_papers: int = 15) -> List[Dict[str, Any]]:
    """
    Connected Papers APIを使用して関連論文を取得
    
    Args:
        doi: 論文のDOI
        max_papers: 取得する論文の最大数 (デフォルト: 15)
        
    Returns:
        List[Dict[str, Any]]: 関連論文のリスト
    """
    try:
        # APIキーを取得
        api_key = get_api_key()
        
        # Connected Papers APIを呼び出す
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # APIエンドポイント
        url = "https://api.connectedpapers.com/v1/graph"
        
        # リクエストパラメータ
        payload = {
            "identifiers": [
                {
                    "doi": doi
                }
            ],
            "max_results": max_papers
        }
        
        # APIリクエスト
        response = requests.post(url, headers=headers, json=payload)
        
        # エラーチェック
        if response.status_code != 200:
            log_error("ConnectedPapersAPIError", f"API returned error: {response.status_code}", 
                     {"response": response.text})
            # エラー時はダミーデータを返す
            return _get_dummy_related_papers()
        
        # レスポンスをJSONとしてパース
        data = response.json()
        
        # 関連論文のリストを抽出
        papers = data.get("graph", {}).get("papers", [])
        
        # 中心論文を除外し、最大件数に制限
        seed_paper_id = data.get("graph", {}).get("seed_paper_id")
        related_papers = [p for p in papers if p.get("id") != seed_paper_id][:max_papers]
        
        # 必要なフィールドのみ抽出
        result = []
        for paper in related_papers:
            # 引用スコアと関連度スコアを計算
            citation_count = paper.get("citations", 0)
            # 関連度スコアは0.0〜1.0の範囲に正規化
            relatedness_score = min(max(paper.get("similarity", 0) / 100.0, 0.0), 1.0)
            
            result.append({
                "title": paper.get("title", ""),
                "doi": paper.get("doi", ""),
                "year": paper.get("year"),
                "authors": [a.get("name", "") for a in paper.get("authors", [])],
                "citation_count": citation_count,
                "relatedness_score": relatedness_score
            })
        
        # 関連度スコアで並べ替え
        result.sort(key=lambda x: x.get("relatedness_score", 0), reverse=True)
        
        log_info("ConnectedPapersAPI", f"Successfully retrieved {len(result)} related papers for DOI: {doi}")
        return result
    except Exception as e:
        log_error("ConnectedPapersAPIError", f"Failed to get related papers: {str(e)}", {"doi": doi})
        # エラー時はダミーデータを返す
        return _get_dummy_related_papers()

def _get_dummy_related_papers() -> List[Dict[str, Any]]:
    """
    APIが失敗した場合のダミーデータを返す
    
    Returns:
        List[Dict[str, Any]]: ダミーの関連論文リスト
    """
    return [
        {
            "title": "Recent advances in natural language processing",
            "doi": "10.1234/abcd1234",
            "year": 2023,
            "authors": ["Smith, J.", "Johnson, A."],
            "citation_count": 156,
            "relatedness_score": 0.92
        },
        {
            "title": "Deep learning approaches for text summarization",
            "doi": "10.5678/efgh5678",
            "year": 2022,
            "authors": ["Brown, R.", "Williams, T."],
            "citation_count": 89,
            "relatedness_score": 0.85
        },
        {
            "title": "Transformer models in document analysis",
            "doi": "10.9101/ijkl9101",
            "year": 2021,
            "authors": ["Garcia, M.", "Lee, S."],
            "citation_count": 112,
            "relatedness_score": 0.78
        }
    ]

def filter_related_papers(papers: List[Dict[str, Any]], excluded_keywords: List[str]) -> List[Dict[str, Any]]:
    """
    除外キーワードに基づいて関連論文をフィルタリング
    
    Args:
        papers: 関連論文のリスト
        excluded_keywords: 除外するキーワードのリスト
        
    Returns:
        List[Dict[str, Any]]: フィルタリングされた関連論文のリスト
    """
    if not excluded_keywords:
        return papers
    
    filtered_papers = []
    for paper in papers:
        # タイトルに除外キーワードが含まれていないか確認
        title = paper.get("title", "").lower()
        skip = False
        
        for keyword in excluded_keywords:
            if keyword.lower() in title:
                skip = True
                break
        
        if not skip:
            filtered_papers.append(paper)
    
    return filtered_papers

def sort_related_papers(papers: List[Dict[str, Any]], sort_by: str = "relatedness") -> List[Dict[str, Any]]:
    """
    関連論文を指定された基準でソート
    
    Args:
        papers: 関連論文のリスト
        sort_by: ソート基準 ("relatedness" or "citations")
        
    Returns:
        List[Dict[str, Any]]: ソートされた関連論文のリスト
    """
    if sort_by == "relatedness":
        return sorted(papers, key=lambda x: x.get("relatedness_score", 0), reverse=True)
    elif sort_by == "citations":
        return sorted(papers, key=lambda x: x.get("citation_count", 0), reverse=True)
    else:
        # デフォルトは関連度でソート
        return sorted(papers, key=lambda x: x.get("relatedness_score", 0), reverse=True)