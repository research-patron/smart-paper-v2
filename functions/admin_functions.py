import functions_framework
from flask import jsonify, Request
from google.cloud import firestore
import datetime
from firebase_admin import auth as firebase_auth
from error_handling import (
    log_error,
    log_info,
    AuthenticationError,
    ValidationError
)

db = firestore.Client()

@functions_framework.http
def share_paper_with_admin(request: Request):
    """
    指定された論文を管理者アカウントと共有する
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

        # リクエストデータの取得
        request_json = request.get_json(silent=True)
        if not request_json:
            raise ValidationError("リクエストデータが見つかりません")

        paper_id = request_json.get("paper_id")
        admin_email = request_json.get("admin_email")
        report_id = request_json.get("report_id")

        if not paper_id or not admin_email:
            raise ValidationError("論文IDと管理者メールアドレスは必須です")

        # 認証の確認
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            raise AuthenticationError("認証が必要です")

        token = auth_header[7:]  # 'Bearer 'の後の部分
        decoded_token = firebase_auth.verify_id_token(token)
        user_id = decoded_token['uid']

        log_info("SharePaper", f"User {user_id} is sharing paper {paper_id} with admin {admin_email}")

        # 論文ドキュメントを取得して所有者を確認
        paper_ref = db.collection("papers").document(paper_id)
        paper_doc = paper_ref.get()

        if not paper_doc.exists:
            raise ValidationError(f"論文 {paper_id} が見つかりません")

        paper_data = paper_doc.to_dict()
        paper_owner = paper_data.get("user_id")

        if paper_owner != user_id:
            raise AuthenticationError("この論文を共有する権限がありません")

        # 管理者ユーザーを検索 - メールアドレスからユーザーを取得
        try:
            admin_user = firebase_auth.get_user_by_email(admin_email)
            admin_uid = admin_user.uid
        except Exception as e:
            log_error("AdminLookupError", f"Failed to find admin user with email {admin_email}", {"error": str(e)})
            # 管理者ユーザーが見つからなくてもエラーにはしない
            admin_uid = None

        # 論文の shared_with_admins サブコレクションに管理者を追加
        shared_ref = paper_ref.collection("shared_with_admins").document(admin_email.replace('@', '_at_'))
        shared_ref.set({
            "email": admin_email,
            "uid": admin_uid,
            "shared_at": datetime.datetime.now(),
            "shared_by": user_id,
            "report_id": report_id
        })

        # 問題報告ドキュメントを更新 - 修正: サブコレクションに適切にアクセス
        if report_id:
            # 正しいコレクションパスを使用
            report_ref = db.collection("inquiries").document("pdf").collection("items").document(report_id)
            report_doc = report_ref.get()
            if report_doc.exists:
                report_data = report_doc.to_dict()
                
                # 論文ドキュメントの状態を更新
                update_data = {
                    "reported_at": datetime.datetime.now(),
                    "report_id": report_id,
                    # 重大な問題として報告された場合は'problem'ステータスに設定
                    "status": "problem" if report_data.get("severity") == "high" else "reported"
                }
                paper_ref.update(update_data)
                
                # 問題報告の状態を更新（トランザクションで確実に更新）
                @firestore.transactional
                def update_report_in_transaction(transaction, ref):
                    doc = ref.get(transaction=transaction)
                    if doc.exists:
                        transaction.update(ref, {
                            "paper_shared": True,
                            "updated_at": datetime.datetime.now()
                        })

                transaction = db.transaction()
                update_report_in_transaction(transaction, report_ref)

        log_info("SharePaper", f"Successfully shared paper {paper_id} with admin {admin_email}")

        return jsonify({
            "success": True,
            "message": "論文が管理者と共有されました"
        }), 200, headers

    except AuthenticationError as e:
        log_error("AuthError", e.message)
        return jsonify({"error": e.message}), 401, headers
    except ValidationError as e:
        log_error("ValidationError", e.message)
        return jsonify({"error": e.message}), 400, headers
    except Exception as e:
        log_error("SharePaperError", f"Failed to share paper: {str(e)}")
        return jsonify({"error": "論文の共有に失敗しました"}), 500, headers
