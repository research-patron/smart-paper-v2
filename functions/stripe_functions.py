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
    Stripeからのwebhookイベントを処理するAPI（改良版）
    """
    # 詳細なデバッグログを追加
    method = request.method
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ['authorization']}
    content_length = request.content_length
    remote_addr = request.remote_addr
    
    log_info("StripeWebhookDebug", "Request received", {
        "method": method,
        "remote_addr": remote_addr,
        "content_length": content_length,
        "headers": headers
    })
    
    try:
        if request.method == 'OPTIONS':
            # CORSプリフライトリクエスト対応
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
                'Access-Control-Max-Age': '3600'
            }
            log_info("StripeWebhookDebug", "Responding to OPTIONS request")
            return ('', 204, headers)
            
        # レスポンスヘッダー
        response_headers = {'Access-Control-Allow-Origin': '*'}
        
        # 最小確認として、GETリクエストには単純なレスポンスを返す（デバッグ用）
        if request.method == 'GET':
            log_info("StripeWebhookDebug", "Responding to GET request (health check)")
            return jsonify({"status": "webhook endpoint is up"}), 200, response_headers
        
        # POSTリクエスト（実際のWebhook）の処理
        # リクエストボディを取得
        try:
            payload = request.data
            log_info("StripeWebhookDebug", "Request payload received", {"payload_size": len(payload) if payload else 0})
            
            # ペイロードの先頭部分をログに記録（機密情報に注意）
            if payload:
                payload_preview = payload[:200].decode('utf-8') if payload else "EMPTY"
                log_info("StripeWebhookDebug", "Payload preview", {"preview": payload_preview[:50] + "..."})
        except Exception as payload_err:
            log_error("StripeWebhookDebug", f"Error reading payload: {str(payload_err)}")
            payload = None
            
        # Stripeシグネチャを取得
        sig_header = request.headers.get('Stripe-Signature')
        if not sig_header:
            log_error("StripeWebhookDebug", "Missing Stripe-Signature header")
            return jsonify({"error": "Stripe-Signature header is missing"}), 400, response_headers
            
        log_info("StripeWebhookDebug", "Webhook handling", {
            "signature_header_length": len(sig_header) if sig_header else 0,
            "payload_size": len(payload) if payload else 0
        })
        
        # リクエストを処理し結果を返す
        result = handle_webhook_event(payload, sig_header)
        
        # 成功レスポンスを返す
        log_info("StripeWebhookDebug", "Webhook processed successfully", {"result": result})
        return jsonify({"received": True, "result": result}), 200, response_headers
    
    except APIError as e:
        log_error("WebhookError", f"API error: {e.message}", {"details": e.details})
        return jsonify(e.to_dict()), e.status_code, {'Access-Control-Allow-Origin': '*'}
    except Exception as e:
        # 全体的な例外処理
        log_error("StripeWebhookDebug", f"Global exception: {str(e)}")
        return jsonify({"error": "Internal server error", "message": str(e)}), 500, {'Access-Control-Allow-Origin': '*'}

@functions_framework.http
def stripe_webhook_test(request: Request):
    """
    Stripe Webhook用のシンプルテストエンドポイント
    署名検証をスキップして、リクエスト情報のみをログに出力する
    """
    try:
        # CORSヘッダーの設定
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)

        headers = {'Access-Control-Allow-Origin': '*'}

        # リクエスト情報をログに記録
        log_info("WebhookTest", "Webhook test endpoint called", {
            "method": request.method,
            "path": request.path,
            "content_length": request.content_length,
            "headers": {k: v for k, v in request.headers.items() if k.lower() not in ['authorization']}
        })

        # リクエストボディを取得して記録
        if request.method == 'POST':
            try:
                payload = request.data
                if payload:
                    payload_text = payload.decode('utf-8')[:500]  # 長すぎる場合は切り詰める
                    log_info("WebhookTest", "Request payload", {"payload_preview": payload_text[:100] + "..."})
                    
                    # JSON解析を試みる
                    try:
                        payload_json = json.loads(payload)
                        event_type = payload_json.get('type', 'unknown')
                        event_id = payload_json.get('id', 'unknown')
                        log_info("WebhookTest", "Parsed JSON payload", {
                            "event_type": event_type,
                            "event_id": event_id
                        })
                    except json.JSONDecodeError:
                        log_warning("WebhookTest", "Could not parse payload as JSON")
            except Exception as e:
                log_error("WebhookTest", f"Error reading payload: {str(e)}")

        # 成功レスポンスを返す
        return jsonify({
            "status": "success",
            "message": "Webhook test endpoint received request",
            "method": request.method,
            "timestamp": str(int(time.time()))
        }), 200, headers

    except Exception as e:
        log_error("WebhookTestError", f"Unhandled error: {str(e)}")
        return jsonify({"error": str(e)}), 500, {'Access-Control-Allow-Origin': '*'}