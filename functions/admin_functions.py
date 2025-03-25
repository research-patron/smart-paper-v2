# ~/Desktop/smart-paper-v2/functions/admin_functions.py
import functions_framework
from flask import Request, jsonify
from google.cloud import firestore
import firebase_admin
from firebase_admin import auth as firebase_auth
import datetime
from error_handling import (
    log_error,
    log_info,
    log_warning,
    APIError,
    ValidationError,
    AuthenticationError,
    NotFoundError
)

# 論文を管理者と共有する関数
@functions_framework.http
def share_paper_with_admin(request: Request):
    """
    論文を管理者アカウントと共有する
    """
    try:
        # CORSヘッダーの設定
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)

        headers = {'Access-Control-Allow-Origin': '*'}
        
        # リクエスト検証
        request_json = request.get_json(silent=True)
        if not request_json:
            raise ValidationError("No JSON payload received")
            
        paper_id = request_json.get("paper_id")
        admin_email = request_json.get("admin_email")
        report_id = request_json.get("report_id")
        
        if not paper_id or not admin_email:
            raise ValidationError("Paper ID and admin email are required")
        
        # 認証を必須に
        user_id = require_authentication(request)
        log_info("Auth", f"Paper sharing initiated by authenticated user: {user_id}")
        
        # Firestoreクライアント
        db = firestore.Client()
        
        # 論文ドキュメントを取得
        doc_ref = db.collection("papers").document(paper_id)
        doc_snap = doc_ref.get()
        
        if not doc_snap.exists:
            raise NotFoundError(f"Paper with ID {paper_id} not found")
        
        paper_data = doc_snap.to_dict()
            
        # 権限チェック：paper.user_id とリクエストユーザーIDが一致することを確認
        paper_owner_id = paper_data.get("user_id")
        if paper_owner_id != user_id:
            log_error("AuthError", "User is not authorized to share this paper", 
                     {"user_id": user_id, "paper_id": paper_id, "paper_owner_id": paper_owner_id})
            raise AuthenticationError("この論文へのアクセス権限がありません")
            
        # 管理者ユーザーの取得（メールアドレスから）
        admin_user = None
        try:
            admin_user = firebase_auth.get_user_by_email(admin_email)
            log_info("Admin", f"Found admin user with email {admin_email}, uid: {admin_user.uid}")
        except Exception as e:
            log_warning("AdminNotFound", f"Admin user with email {admin_email} not found", {"error": str(e)})
            # フロントエンドには成功レスポンスを返す（管理者ユーザーが見つからなくても、共有情報は記録する）
        
        # 管理者情報
        admin_info = {
            "admin_email": admin_email,
            "admin_uid": admin_user.uid if admin_user else None,
            "report_id": report_id,
            "shared_at": datetime.datetime.now()
        }
        
        # 共有設定の記録
        if "shared_with_admins" not in paper_data:
            # 配列が存在しない場合は新しく作成
            doc_ref.update({
                "shared_with_admins": [admin_info]
            })
        else:
            # 既存の配列に追加
            doc_ref.update({
                "shared_with_admins": firestore.ArrayUnion([admin_info])
            })
        
        log_info("PaperSharing", f"Paper {paper_id} shared with admin {admin_email}")
        
        # 問題報告ドキュメントに共有情報を追加
        if report_id:
            inquiry_ref = db.collection("inquiries").document(report_id)
            inquiry_snap = inquiry_ref.get()
            
            if inquiry_snap.exists:
                inquiry_ref.update({
                    "paper_shared": True,
                    "paper_share_info": admin_info
                })
                log_info("PaperSharing", f"Updated problem report {report_id} with sharing info")
            else:
                log_warning("ReportNotFound", f"Problem report with ID {report_id} not found")
        
        # 成功レスポンス
        return jsonify({
            "success": True,
            "message": "Paper shared with admin successfully"
        }), 200, headers
        
    except APIError as e:
        log_error("APIError", e.message, {"details": e.details})
        return jsonify(e.to_dict()), e.status_code, headers
    except Exception as e:
        log_error("UnhandledError", "An internal server error occurred", {"error": str(e)})
        return jsonify({"error": "An internal server error occurred"}), 500, headers

# リクエストから認証情報を取得する関数 (main.pyからコピー)
def require_authentication(request: Request):
    """
    リクエストから認証情報を取得し、未認証の場合は例外をスロー
    
    Args:
        request: Flaskのリクエストオブジェクト
        
    Returns:
        str: 認証済みユーザーID
        
    Raises:
        AuthenticationError: 認証情報がない、または無効な場合
    """
    user_id = None
    
    try:
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]  # 'Bearer 'の後の部分を取得
                try:
                    # Firebase Admin SDKを使用してIDトークンを検証
                    decoded_token = firebase_auth.verify_id_token(token)
                    user_id = decoded_token['uid']
                    log_info("Auth", f"Successfully verified user token: {user_id}")
                except Exception as e:
                    log_error("AuthError", "Invalid ID token", {"error": str(e)})
                    raise AuthenticationError("Invalid ID token")
    except AuthenticationError:
        raise
    except Exception as e:
        log_error("AuthError", "Error verifying token", {"error": str(e)})
    
    if not user_id:
        log_error("AuthError", "Authentication required", {"path": request.path})
        raise AuthenticationError("このAPIを使用するには認証が必要です")
        
    return user_id