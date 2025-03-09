import sys
import json
import traceback
import logging
import datetime

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

def log_warning(warning_type: str, message: str, details: dict = None):
    """
    警告情報を構造化ログとして標準出力に出力

    Args:
        warning_type: 警告の種類
        message: 警告メッセージ
        details: 警告の詳細情報（オプション）
    """
    # Cloud Logging で認識される形式でログを出力
    logging.warning(json.dumps({
        "severity": "WARNING",  # Cloud Logging で警告として認識される
        "warning_type": warning_type,
        "message": message,
        "timestamp": datetime.datetime.now().isoformat(),
        "details": details,
    }))

def log_info(info_type: str, message: str, details: dict = None):
    """
    情報を構造化ログとして標準出力に出力

    Args:
        info_type: 情報の種類
        message: 情報メッセージ
        details: 情報の詳細（オプション）
    """
    # Cloud Logging で認識される形式でログを出力
    logging.info(json.dumps({
        "severity": "INFO",  # Cloud Logging で情報として認識される
        "info_type": info_type,
        "message": message,
        "timestamp": datetime.datetime.now().isoformat(),
        "details": details,
    }))

def format_exception(e: Exception) -> dict:
    """
    例外情報を辞書形式に整形

    Args:
        e: 例外オブジェクト

    Returns:
        dict: 例外情報を含む辞書
    """
    return {
        "type": e.__class__.__name__,
        "message": str(e),
        "stack_trace": traceback.format_exc()
    }

class APIError(Exception):
    """APIエラーの基底クラス"""
    def __init__(self, message, status_code=500, details=None):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(self.message)

    def to_dict(self):
        """エラー情報を辞書形式に変換"""
        error_dict = {
            "error": {
                "code": self.__class__.__name__,
                "message": self.message
            }
        }
        if self.details:
            error_dict["error"]["details"] = self.details
        return error_dict

class ValidationError(APIError):
    """バリデーションエラー"""
    def __init__(self, message, details=None):
        super().__init__(message, status_code=400, details=details)

class AuthenticationError(APIError):
    """認証エラー"""
    def __init__(self, message, details=None):
        super().__init__(message, status_code=401, details=details)

class NotFoundError(APIError):
    """リソース未発見エラー"""
    def __init__(self, message, details=None):
        super().__init__(message, status_code=404, details=details)

class VertexAIError(APIError):
    """Vertex AI APIエラー"""
    def __init__(self, message, details=None):
        super().__init__(message, status_code=500, details=details)

class FirestoreError(APIError):
    """Firestore操作エラー"""
    def __init__(self, message, details=None):
        super().__init__(message, status_code=500, details=details)

class CloudStorageError(APIError):
    """Cloud Storage操作エラー"""
    def __init__(self, message, details=None):
        super().__init__(message, status_code=500, details=details)