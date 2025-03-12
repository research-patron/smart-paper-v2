import vertexai
import json
import os
from vertexai.generative_models import Part, GenerationConfig, GenerativeModel
from google.api_core import exceptions
from error_handling import log_error, log_info, VertexAIError

# 環境変数から設定を取得
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = "us-central1"  # Vertex AIのリージョン
MODEL_NAME = "gemini-2.0-flash-001"

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

def get_model() -> GenerativeModel:
    """
    Vertex AIのGenerativeModelを初期化して取得する

    Returns:
        GenerativeModel: 生成モデル
    """
    try:
        model = GenerativeModel(MODEL_NAME)
        return model
    except Exception as e:
        log_error("VertexAIError", "Failed to initialize model", {"error": str(e)})
        raise VertexAIError(f"Failed to initialize model: {str(e)}") from e

def process_pdf_content(model: GenerativeModel, pdf_gs_path: str, prompt: str, 
                       temperature: float = 0.2) -> str:
    """
    PDFファイルの内容を直接処理する

    Args:
        model: 生成モデル
        pdf_gs_path: PDFファイルのパス (gs://から始まる)
        prompt: プロンプト文字列
        temperature: 生成の温度パラメータ（デフォルト: 0.2）

    Returns:
        str: 生成されたテキスト

    Raises:
        VertexAIError: API呼び出しに失敗した場合
    """
    try:
        # PDFファイルとプロンプトを正しい形式で準備
        contents = [
            Part.from_uri(pdf_gs_path, mime_type="application/pdf"),
            Part.text(prompt)
        ]
        
        # 生成設定
        generation_config = GenerationConfig(
            temperature=temperature,
            max_output_tokens=8192,
            top_p=0.95,
            top_k=40,
        )
        
        # コンテンツを生成
        log_info("VertexAI", "Generating content with PDF", 
                {"file_path": pdf_gs_path})
        
        response = model.generate_content(
            contents=contents,
            generation_config=generation_config,
            safety_settings=None,
        )
        
        if not response or not response.text:
            raise VertexAIError("Empty response from Vertex AI")
            
        return response.text
        
    except Exception as e:
        log_error("VertexAIError", "Error processing PDF content", 
                 {"error": str(e), "file_path": pdf_gs_path})
        raise VertexAIError(f"Error processing PDF content: {str(e)}") from e

def generate_content(model: GenerativeModel, prompt: str, temperature: float = 0.2) -> str:
    """
    Vertex AIのGenerative AIモデルを呼び出す

    Args:
        model: 生成モデル
        prompt: プロンプト文字列
        temperature: 生成の温度パラメータ（デフォルト: 0.2）

    Returns:
        str: 生成されたテキスト

    Raises:
        VertexAIError: API呼び出しに失敗した場合
    """
    try:
        log_info("VertexAI", "Generating content")
        
        # プロンプトを正しい形式で準備
        contents = [Part.text(prompt)]
        
        # 生成設定
        generation_config = GenerationConfig(
            temperature=temperature,
            max_output_tokens=8192,  # 出力トークン数の上限
            top_p=0.95,
            top_k=40,
        )
        
        response = model.generate_content(
            contents=contents,
            generation_config=generation_config,
            safety_settings=None,  # デフォルトの安全設定を使用
        )
        
        if not response or not response.text:
            raise VertexAIError("Empty response from Vertex AI")
        
        log_info("VertexAI", "Content generated successfully")
        return response.text
    except Exception as e:
        log_error("VertexAIError", "Error generating content", {"error": str(e)})
        raise VertexAIError(f"Error generating content: {str(e)}") from e

from typing import List, Dict, Any, Optional
import re

def extract_json_block(text: str) -> str:
    """
    テキストからJSONブロックを抽出

    Args:
        text: 入力テキスト

    Returns:
        str: 抽出されたJSON文字列
    """
    # ```jsonブロックを探す
    if "```json" in text:
        blocks = text.split("```json")
        if len(blocks) > 1:
            json_block = blocks[-1].split("```")[0].strip()
            return json_block

    # 通常の```ブロックを探す
    if "```" in text:
        blocks = text.split("```")
        if len(blocks) > 1:
            json_block = blocks[1].strip()
            return json_block

    # ブロックが見つからない場合は全体を使用
    return text.strip()

def process_json_response(text: str, operation: str = None) -> dict:
    """
    Vertex AIからのレスポンスをJSON形式として解析

    Args:
        text: 生成されたテキスト
        operation: 処理の種類 ('translate', 'summarize', 'metadata')

    Returns:
        dict: JSON形式のレスポンス

    Raises:
        VertexAIError: JSONの解析に失敗し、フォールバックもできない場合
    """
    try:
        # レスポンスから有効なJSONを探す方法を順番に試行
        json_text = None
        
        # 1. ```json ブロックを探す
        if "```json" in text:
            blocks = text.split("```json")
            if len(blocks) > 1:
                json_text = blocks[-1].split("```")[0].strip()
                try:
                    result = json.loads(json_text)
                    log_info("JSONProcess", "Successfully parsed ```json block")
                    return validate_json_result(result, operation)
                except json.JSONDecodeError:
                    json_text = None
        
        # 2. 通常の``` ブロックを探す
        if not json_text and "```" in text:
            blocks = text.split("```")
            if len(blocks) > 1:
                json_text = blocks[1].strip()
                try:
                    result = json.loads(json_text)
                    log_info("JSONProcess", "Successfully parsed ``` block")
                    return validate_json_result(result, operation)
                except json.JSONDecodeError:
                    json_text = None
        
        # 3. テキスト全体を試す
        if not json_text:
            try:
                result = json.loads(text.strip())
                log_info("JSONProcess", "Successfully parsed entire text")
                return validate_json_result(result, operation)
            except json.JSONDecodeError:
                # 全ての方法が失敗した場合、フォールバック処理を試みる
                return fallback_json_processing(text, operation)
                
    except Exception as e:
        log_error("JSONProcessError", str(e), {"text": text[:1000]})
        raise VertexAIError(f"Failed to process JSON response: {str(e)}")

def validate_json_result(result: dict, operation: str) -> dict:
    """結果のバリデーションを行う"""
    if operation == "translate":
        if "translated_text" not in result:
            raise VertexAIError("Missing translated_text field in response")
    elif operation == "summarize":
        if "summary" not in result:
            raise VertexAIError("Missing summary field in response")
    elif operation == "metadata":
        if "metadata" not in result or "chapters" not in result:
            raise VertexAIError("Missing required fields in metadata response")
    return result

def fallback_json_processing(text: str, operation: str) -> dict:
    """JSON解析失敗時のフォールバック処理"""
    log_warning("JSONProcess", "Using fallback processing", {"operation": operation})
    
    if operation == "translate":
        return {"translated_text": text.strip()}
    elif operation == "summarize":
        return {"summary": text.strip()}
    else:
        raise VertexAIError(f"No fallback available for operation: {operation}")
