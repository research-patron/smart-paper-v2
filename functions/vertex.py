import vertexai
import json
import os
import datetime
from vertexai.generative_models import Part, GenerationConfig, GenerativeModel, ChatSession
from google.api_core import exceptions
from google.cloud import firestore
from error_handling import log_error, log_info, log_warning, VertexAIError
# 新しい共通モジュールからインポート
from json_utils import extract_json_from_response, extract_content_from_json

# 環境変数から設定を取得
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = "us-central1"  # Vertex AIのリージョン
MODEL_NAME = "gemini-2.0-flash"  # 最新のモデル名に更新

# チャットセッションを保持する辞書
# キー: 論文ID、値: ChatSessionオブジェクト
active_chat_sessions = {}

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

def start_chat_session(paper_id: str, pdf_gs_path: str) -> ChatSession:
    """
    PDFファイルを使用して新しいチャットセッションを開始する

    Args:
        paper_id: 論文のID (セッションのキーとして使用)
        pdf_gs_path: PDFファイルのパス (gs://から始まる)

    Returns:
        ChatSession: 初期化されたチャットセッション
    """
    try:
        # すでにセッションが存在する場合は再利用
        if paper_id in active_chat_sessions:
            log_info("VertexAI", f"Reusing existing chat session for paper: {paper_id}")
            return active_chat_sessions[paper_id]

        # モデルの取得
        model = get_model()
        
        # PDFファイルを読み込む
        pdf_content = Part.from_uri(pdf_gs_path, mime_type="application/pdf")
        
        # 初期プロンプト - PDFの内容を保持するための指示
        initial_prompt = "これから解析する論文のPDFファイルです。このPDFの内容を記憶し、これ以降の質問や指示に対して、このPDFの内容に基づいて回答してください。"
        
        # チャットセッションを開始 - response_validationをFalseに設定
        chat = model.start_chat(response_validation=False)
        
        # 初期メッセージ送信（PDFを含む）
        chat.send_message([initial_prompt, pdf_content])
        
        # セッションを保存
        active_chat_sessions[paper_id] = chat
        
        log_info("VertexAI", f"Created new chat session for paper: {paper_id}")
        return chat
    except Exception as e:
        log_error("VertexAIError", f"Failed to start chat session", {"error": str(e), "paper_id": paper_id})
        raise VertexAIError(f"Failed to start chat session: {str(e)}") from e

def log_gemini_details(paper_id: str, operation: str, prompt: str, response: str, params: dict = None):
    """
    Geminiのプロンプトとレスポンスの詳細をFirestoreに保存する
    
    Args:
        paper_id: 論文ID
        operation: 操作タイプ ('translate', 'summarize', 'extract_metadata_and_chapters')
        prompt: 送信されたプロンプト全文
        response: 受信したレスポンス全文
        params: 生成パラメータ (オプション)
    """
    try:
        db = firestore.Client()
        
        # papers/<paper_id>/gemini_logs/<timestamp> にデータを保存
        log_ref = db.collection("papers").document(paper_id).collection("gemini_logs").document()
        
        # JSONパース結果とその内容を保存
        processed_json = None
        extracted_content = None
        
        try:
            # JSONを抽出
            processed_json = extract_json_from_response(response, operation)
            
            # さらにJSONから内容を抽出
            extracted_content = extract_content_from_json(processed_json, operation)
            
        except Exception as json_error:
            log_warning("GeminiLogs", f"Failed to extract JSON from response: {str(json_error)}")
            processed_json = {"error": str(json_error)}
            extracted_content = "JSONパースエラー: " + str(json_error)
        
        log_data = {
            "operation": operation,
            "prompt": prompt,
            "response": response,
            "processed_json": processed_json,      # JSONパース結果
            "extracted_content": extracted_content, # JSONから抽出した内容
            "timestamp": firestore.SERVER_TIMESTAMP,
            "model": MODEL_NAME
        }
        
        if params:
            log_data["parameters"] = params
            
        log_ref.set(log_data)
        log_info("GeminiLogs", f"Saved Gemini details for paper: {paper_id}, operation: {operation}")
    except Exception as e:
        log_error("GeminiLogsError", f"Failed to save Gemini details: {str(e)}")
        # この関数の失敗で主要な処理を止めないようエラーは内部で処理する

def process_with_chat(paper_id: str, prompt: str, temperature: float = 1, max_retries: int = 2, operation: str = "unknown") -> str:
    """
    既存のチャットセッションを使用してプロンプトを処理する

    Args:
        paper_id: 論文のID
        prompt: プロンプト文字列
        temperature: 生成の温度パラメータ（デフォルト: 0.2）
        max_retries: 最大リトライ回数
        operation: 操作タイプ (追加: 処理の種類を識別するため)

    Returns:
        str: 生成されたテキスト
    """
    retry_count = 0
    
    while True:
        try:
            # セッションが存在するか確認
            if paper_id not in active_chat_sessions:
                raise VertexAIError(f"No active chat session found for paper: {paper_id}")
            
            chat = active_chat_sessions[paper_id]
            
            # 生成パラメータを設定
            generation_config = GenerationConfig(
                temperature=temperature,
                max_output_tokens=8192,
                top_p=0.95,
                top_k=40,
            )
            
            # メッセージを送信
            response = chat.send_message(
                prompt,
                generation_config=generation_config
            )
            
            log_info("VertexAI", f"Successfully processed prompt with chat session for paper: {paper_id}")
            
            # パラメータ情報を完全に保存するよう修正
            full_params = {
                "model": MODEL_NAME,
                "temperature": temperature,
                "max_output_tokens": 8192,
                "top_p": 0.95,
                "top_k": 40,
                "retry_count": retry_count,
                "location": LOCATION,
                "prompt_length": len(prompt),
                "response_length": len(response.text),
                "timestamp": datetime.datetime.now().isoformat()
            }
            
            # Geminiのプロンプトとレスポンスをログに保存
            log_gemini_details(
                paper_id, 
                operation, 
                prompt, 
                response.text, 
                full_params
            )
            
            return response.text
            
        except exceptions.DeadlineExceeded as e:
            log_error("VertexAITimeout", "API request timed out", {"error": str(e), "paper_id": paper_id})
            if retry_count >= max_retries:
                raise VertexAIError(f"API request timed out after {max_retries} retries: {str(e)}") from e
            retry_count += 1
            
        except exceptions.ServiceUnavailable as e:
            log_error("VertexAIUnavailable", "Service unavailable", {"error": str(e), "paper_id": paper_id})
            if retry_count >= max_retries:
                raise VertexAIError(f"Service unavailable after {max_retries} retries: {str(e)}") from e
            retry_count += 1
            
        except exceptions.ResponseValidationError as e:
            log_error("VertexAIValidationError", "Response validation error", {"error": str(e), "paper_id": paper_id})
            if retry_count >= max_retries:
                # 応答検証エラーの場合、一般的なテキストを返す
                return "翻訳処理中にエラーが発生しました。"
            retry_count += 1
            
        except Exception as e:
            log_error("VertexAIError", "Error processing with chat", {"error": str(e), "paper_id": paper_id})
            raise VertexAIError(f"Error processing with chat: {str(e)}") from e

def end_chat_session(paper_id: str) -> bool:
    """
    チャットセッションを終了し、リソースを解放する

    Args:
        paper_id: 論文のID

    Returns:
        bool: 成功した場合はTrue
    """
    if paper_id in active_chat_sessions:
        del active_chat_sessions[paper_id]
        log_info("VertexAI", f"Ended chat session for paper: {paper_id}")
        return True
    return False

# 以下の関数は互換性のために残しておくが、内部では新しい会話ベースの関数を使用
def process_pdf_content(model: GenerativeModel, pdf_gs_path: str, prompt: str, 
                       temperature: float = 1, paper_id: str = None) -> str:
    """
    PDFファイルの内容を処理する (互換性のために残す)

    Args:
        model: 生成モデル (使用しない)
        pdf_gs_path: PDFファイルのパス
        prompt: プロンプト文字列
        temperature: 生成の温度パラメータ
        paper_id: 論文ID (新規追加パラメータ)

    Returns:
        str: 生成されたテキスト
    """
    if not paper_id:
        # paper_idが指定されていない場合はエラー
        raise VertexAIError("paper_id is required for processing PDF content")
    
    try:
        # 既存のセッションがあるか確認し、なければ新規作成
        if paper_id not in active_chat_sessions:
            start_chat_session(paper_id, pdf_gs_path)
        
        # チャットセッションでプロンプトを処理
        return process_with_chat(paper_id, prompt, temperature)
    except Exception as e:
        log_error("VertexAIError", "Error in process_pdf_content", 
                 {"error": str(e), "paper_id": paper_id})
        raise VertexAIError(f"Error in process_pdf_content: {str(e)}") from e

def generate_content(model: GenerativeModel, prompt: str, temperature: float = 1, max_retries: int = 3, paper_id: str = None) -> str:
    """
    Vertex AIのGenerative AIモデルを呼び出す (互換性のために残す)

    Args:
        model: 生成モデル (使用しない)
        prompt: プロンプト文字列
        temperature: 生成の温度パラメータ
        max_retries: 最大リトライ回数 (使用しない)
        paper_id: 論文ID (新規追加パラメータ)

    Returns:
        str: 生成されたテキスト
    """
    if not paper_id:
        # paper_idが指定されていない場合はエラー
        raise VertexAIError("paper_id is required for generating content")
    
    try:
        # チャットセッションでプロンプトを処理
        return process_with_chat(paper_id, prompt, temperature)
    except Exception as e:
        log_error("VertexAIError", "Error in generate_content", 
                 {"error": str(e), "paper_id": paper_id})
        raise VertexAIError(f"Error in generate_content: {str(e)}") from e

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