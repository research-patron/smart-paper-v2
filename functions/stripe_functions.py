import functions_framework
from flask import jsonify, Request
import json
import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from error_handling import (
    log_error,
    log_info,
    log_warning,
    APIError,
    ValidationError,
    AuthenticationError,
    NotFoundError
)
from stripe_helpers import (
    create_checkout_session,
    cancel_subscription,
    create_card_update_session,
    handle_webhook_event
)

# Firebaseの認証トークンを検証し、ユーザーIDを取得する関数
def verify_firebase_token(request: Request):
    """
    リクエストヘッダーからFirebase認証トークンを取得・検証し、ユーザーIDを返す
    
    Args:
        request: Flaskのリクエストオブジェクト
    
    Returns:
        str: 検証されたユーザーID、または認証情報がない場合はNone
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
    
    return user_id

@functions_framework.http
def create_stripe_checkout(request: Request):
    """
    Stripeのチェックアウトセッションを作成するAPI
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

        # 認証確認
        user_id = verify_firebase_token(request)
        if not user_id:
            raise AuthenticationError("認証が必要です")

        # リクエストのバリデーション
        request_json = request.get_json(silent=True)
        if not request_json:
            raise ValidationError("リクエストボディがありません")

        plan_id = request_json.get('plan_id')
        if not plan_id:
            raise ValidationError("plan_idは必須です")

        log_info("StripeCheckout", f"Creating checkout session for user {user_id}, plan {plan_id}")

        # サブスクリプションセッションを作成
        result = create_checkout_session(user_id, plan_id)
        
        # 詳細なログ出力
        log_info("StripeCheckout", f"Checkout session created successfully", 
                {"user_id": user_id, "plan_id": plan_id, "session_id": result.get('session_id')})
        
        # 成功レスポンスを返す
        return jsonify(result), 200, headers

    except APIError as e:
        log_error("CreateCheckoutError", f"API error occurred: {e.message}", {"details": e.details})
        return jsonify(e.to_dict()), e.status_code, headers
    except Exception as e:
        log_error("CreateCheckoutError", f"Unhandled error: {str(e)}")
        return jsonify({"error": {"message": "内部サーバーエラーが発生しました"}}), 500, headers

@functions_framework.http
def cancel_stripe_subscription(request: Request):
    """
    Stripeのサブスクリプションを解約するAPI
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

        # 認証確認
        user_id = verify_firebase_token(request)
        if not user_id:
            raise AuthenticationError("認証が必要です")

        log_info("CancelSubscription", f"Cancelling subscription for user {user_id}")

        # サブスクリプションを解約
        result = cancel_subscription(user_id)
        
        # 詳細なログ出力
        log_info("CancelSubscription", f"Subscription cancelled successfully", 
                {"user_id": user_id, "end_date": result.get('end_date')})
        
        # 成功レスポンスを返す
        return jsonify(result), 200, headers

    except APIError as e:
        log_error("CancelSubscriptionError", f"API error occurred: {e.message}", {"details": e.details})
        return jsonify(e.to_dict()), e.status_code, headers
    except Exception as e:
        log_error("CancelSubscriptionError", f"Unhandled error: {str(e)}")
        return jsonify({"error": {"message": "内部サーバーエラーが発生しました"}}), 500, headers

@functions_framework.http
def update_payment_method(request: Request):
    """
    Stripeの支払い方法を更新するためのセッションを作成するAPI
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

        # 認証確認
        user_id = verify_firebase_token(request)
        if not user_id:
            raise AuthenticationError("認証が必要です")

        log_info("UpdatePaymentMethod", f"Creating payment update session for user {user_id}")

        # カード更新セッションを作成
        result = create_card_update_session(user_id)
        
        # 詳細なログ出力
        log_info("UpdatePaymentMethod", f"Payment update session created successfully", 
                {"user_id": user_id})
        
        # 成功レスポンスを返す
        return jsonify(result), 200, headers

    except APIError as e:
        log_error("UpdatePaymentMethodError", f"API error occurred: {e.message}", {"details": e.details})
        return jsonify(e.to_dict()), e.status_code, headers
    except Exception as e:
        log_error("UpdatePaymentMethodError", f"Unhandled error: {str(e)}")
        return jsonify({"error": {"message": "内部サーバーエラーが発生しました"}}), 500, headers

@functions_framework.http
def stripe_webhook(request: Request):
    """
    Stripeからのwebhookイベントを処理するAPI
    """
    try:
        # リクエストの詳細をログに記録
        log_info("StripeWebhook", "Received webhook request", {
            "method": request.method,
            "path": request.path,
            "content_length": request.content_length,
            "headers": {k: v for k, v in request.headers.items() if k.lower() not in ['authorization']}
        })
        
        # webhookのシグネチャを検証するために生のデータが必要
        payload = request.data
        sig_header = request.headers.get('Stripe-Signature')

        if not sig_header:
            log_error("StripeWebhook", "Missing Stripe-Signature header")
            raise ValidationError("Stripe-Signatureヘッダーがありません")

        # webhookイベントを処理
        log_info("StripeWebhook", "Processing webhook event", {"payload_size": len(payload) if payload else 0})
        result = handle_webhook_event(payload, sig_header)
        
        # 成功レスポンスを返す
        log_info("StripeWebhook", "Webhook processed successfully", {"result": result})
        return jsonify({"received": True, "result": result}), 200

    except APIError as e:
        log_error("WebhookError", f"API error: {e.message}", {"details": e.details})
        return jsonify(e.to_dict()), e.status_code
    except Exception as e:
        log_error("WebhookError", f"Unhandled error: {str(e)}")
        return jsonify({"error": {"message": "内部サーバーエラーが発生しました"}}), 500