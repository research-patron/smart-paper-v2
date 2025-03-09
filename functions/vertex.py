import vertexai
import datetime
import json
import os
from vertexai.generative_models import Part, GenerationConfig
from vertexai.preview import caching
from vertexai.preview.generative_models import GenerativeModel
from google.api_core import exceptions, retry
from error_handling import log_error, log_info, VertexAIError

# 環境変数から設定を取得
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = "us-central1"  # Vertex AIのリージョン

# 使用するモデル名
MODEL_NAME = "gemini-1.5-flash-002"

def initialize_vertex_ai():
    """
    Vertex AIの初期化
    """
    try:
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        log_info("VertexAI", "Vertex AI initialized successfully")
    except Exception as e:
        log_error("VertexAIInitError", "Failed to initialize Vertex AI", {"error": str(e)})
        raise VertexAIError("Vertex AI initialization failed") from e

def create_context_cache(pdf_gs_path: str, display_name: str) -> str:
    """
    PDFファイルからコンテキストキャッシュを生成する

    Args:
        pdf_gs_path: Cloud Storage上のPDFファイルパス (gs://で始まる)
        display_name: キャッシュ表示名

    Returns:
        str: キャッシュID
    """
    try:
        log_info("VertexAI", f"Creating context cache for {pdf_gs_path}")
        
        contents = [
            Part.from_uri(
                pdf_gs_path,
                mime_type="application/pdf",
            )
        ]

        cached_content = caching.CachedContent.create(
            model_name=MODEL_NAME,
            contents=contents,
            ttl=None,  # TTLは設定しない
            display_name=display_name
        )

        log_info("VertexAI", f"Context cache created successfully: {cached_content.name}")
        return cached_content.name
    except Exception as e:
        log_error("VertexAICacheError", "Failed to create context cache", 
                 {"error": str(e), "file_path": pdf_gs_path})
        raise VertexAIError(f"Failed to create context cache: {str(e)}") from e

def get_cached_model(cache_id: str) -> GenerativeModel:
    """
    キャッシュIDからGenerativeModelを取得する

    Args:
        cache_id: コンテキストキャッシュID

    Returns:
        GenerativeModel: 生成モデル
    """
    try:
        cached_content = caching.CachedContent(cached_content_name=cache_id)
        model = GenerativeModel.from_cached_content(
            cached_content=cached_content, 
            model_name=MODEL_NAME
        )
        return model
    except Exception as e:
        log_error("VertexAIError", "Failed to get cached model", {"error": str(e), "cache_id": cache_id})
        raise VertexAIError(f"Failed to get cached model: {str(e)}") from e

def generate_content(model, prompt: str, temperature: float = 0.2, max_retries: int = 3) -> str:
    """
    Vertex AIのGenerative AIモデルを呼び出し、リトライロジックを組み込む

    Args:
        model: 生成モデル
        prompt: プロンプト文字列
        temperature: 生成の温度パラメータ（デフォルト: 0.2）
        max_retries: 最大リトライ回数

    Returns:
        str: 生成されたテキスト
    """
    retries = 0
    last_error = None

    while retries < max_retries:
        try:
            log_info("VertexAI", f"Generating content, attempt {retries + 1}/{max_retries}")
            
            # 生成設定
            generation_config = GenerationConfig(
                temperature=temperature,
                max_output_tokens=8192,  # 出力トークン数の上限
                top_p=0.95,
                top_k=40,
            )
            
            response = model.generate_content(
                prompt,
                generation_config=generation_config,
                safety_settings=None,  # デフォルトの安全設定を使用
            )
            
            log_info("VertexAI", "Content generated successfully")
            return response.text
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
            raise VertexAIError(f"Error generating content: {str(e)}") from e

    # すべてのリトライが失敗
    log_error("VertexAIMaxRetries", "All retries failed", {"error": str(last_error)})
    raise VertexAIError(f"Failed to generate content after {max_retries} retries") from last_error

def process_json_response(text: str) -> dict:
    """
    Vertex AIからのレスポンスをJSON形式として解析

    Args:
        text: 生成されたテキスト

    Returns:
        dict: JSON形式のレスポンス
    """
    try:
        # JSONブロックの抽出（```json〜```の形式に対応）
        if "```json" in text and "```" in text.split("```json", 1)[1]:
            json_text = text.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in text and "```" in text.split("```", 1)[1]:
            # jsonキーワードなしの場合
            json_text = text.split("```", 1)[1].split("```", 1)[0].strip()
        else:
            # コードブロックがない場合はテキスト全体を使用
            json_text = text.strip()
        
        # JSON解析
        result = json.loads(json_text)
        return result
    except json.JSONDecodeError as e:
        log_error("JSONDecodeError", "Invalid JSON response from Vertex AI", 
                 {"response_text": text, "error": str(e)})
        # エラーをそのまま伝播
        raise

def delete_context_cache(cache_id: str):
    """
    コンテキストキャッシュを削除する

    Args:
        cache_id: キャッシュID
    """
    try:
        log_info("VertexAI", f"Deleting context cache: {cache_id}")
        cached_content = caching.CachedContent(cached_content_name=cache_id)
        cached_content.delete()
        log_info("VertexAI", f"Context cache deleted successfully: {cache_id}")
    except Exception as e:
        log_error("VertexAIError", "Failed to delete context cache", {"error": str(e), "cache_id": cache_id})
        # キャッシュ削除の失敗は致命的ではないのでエラーをスローしない