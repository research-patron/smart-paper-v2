import stripe
import os
import json
from datetime import datetime, timedelta
from google.cloud import secretmanager
from firebase_admin import firestore
from error_handling import (
    log_error,
    log_info,
    log_warning,
    APIError,
    ValidationError
)

# サブスクリプションプラン情報
SUBSCRIPTION_PLANS = {
    'monthly': {
        'price_id': 'price_1R4bJwHI4NoEudKd1ZhXt8mX',  # 実際のStripeプランIDに置き換える必要あり
        'name': 'プレミアムプラン(月額)',
        'amount': 300,  # 月額300円
        'interval': 'month',
        'duration_days': 30,
    },
    'annual': {
        'price_id': 'price_1R4bKrHI4NoEudKdA7ZqlmVm',  # 実際のStripeプランIDに置き換える必要あり
        'name': 'プレミアムプラン(年額)',
        'amount': 3000,  # 年額3000円
        'interval': 'year',
        'duration_days': 365,
    }
}

# 初期化フラグ
_stripe_initialized = False
_db = None

# Secret Managerからストライプの秘密鍵を取得する関数
def get_stripe_secret_key():
    """Secret ManagerからStripeの秘密鍵を取得"""
    try:
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/STRIPE_SECRET_KEY/versions/latest"
        response = client.access_secret_version(request={"name": name})
        secret_key = response.payload.data.decode("UTF-8")
        return secret_key.strip()
    except Exception as e:
        log_error("StripeSecretError", f"Failed to get Stripe secret key: {str(e)}")
        # 開発環境ではフォールバックとして環境変数から取得
        return os.environ.get("STRIPE_SECRET_KEY", "")

# Secret ManagerからStripeのWebhook Secretを取得する関数
def get_stripe_webhook_secret():
    """Secret ManagerからStripeのWebhook Secretを取得"""
    try:
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/STRIPE_WEBHOOK_SECRET/versions/latest"
        response = client.access_secret_version(request={"name": name})
        webhook_secret = response.payload.data.decode("UTF-8")
        return webhook_secret.strip()
    except Exception as e:
        log_error("StripeWebhookSecretError", f"Failed to get Stripe webhook secret: {str(e)}")
        # 開発環境ではフォールバックとして環境変数から取得
        return os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Stripeの初期化
def initialize_stripe():
    """Stripeを初期化する"""
    global _stripe_initialized
    
    if not _stripe_initialized:
        stripe_secret_key = get_stripe_secret_key()
        if not stripe_secret_key:
            log_error("StripeInitError", "Stripe secret key is not provided")
            raise APIError("Stripe secret key is not configured", 500)
        
        stripe.api_key = stripe_secret_key
        _stripe_initialized = True
        log_info("Stripe", "Stripe initialized successfully")

# Firestoreの初期化
def get_db():
    """Firestoreクライアントを取得または初期化する"""
    global _db
    if _db is None:
        _db = firestore.client()
    return _db

# サブスクリプションセッションの作成
def create_checkout_session(user_id, plan_id):
    """
    Stripeチェックアウトセッションを作成する
    
    Args:
        user_id: ユーザーID
        plan_id: プランID ('monthly' or 'annual')
        
    Returns:
        dict: セッション情報
    """
    # Stripeを初期化
    initialize_stripe()
    
    # プラン情報を取得
    if plan_id not in SUBSCRIPTION_PLANS:
        raise ValidationError(f"Invalid plan ID: {plan_id}")
    
    plan = SUBSCRIPTION_PLANS[plan_id]
    
    try:
        # ユーザー情報を取得
        db = get_db()
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise ValidationError(f"User not found: {user_id}")
        
        user_data = user_doc.to_dict()
        
        # 既存のStripeカスタマーIDを取得または新規作成
        customer_id = user_data.get('stripe_customer_id')
        
        if not customer_id:
            # Stripeカスタマーを作成
            customer = stripe.Customer.create(
                email=user_data.get('email'),
                name=user_data.get('name', 'Smart Paper User'),
                metadata={
                    'user_id': user_id
                }
            )
            customer_id = customer.id
            
            # ユーザーデータにStripeカスタマーIDを保存
            user_ref.update({
                'stripe_customer_id': customer_id,
                'updated_at': firestore.SERVER_TIMESTAMP
            })
        
        # サブスクリプションメタデータ
        metadata = {
            'user_id': user_id,
            'plan_id': plan_id,
            'plan_name': plan['name']
        }
        
        # サクセスURLとキャンセルURL
        success_url = os.environ.get('STRIPE_SUCCESS_URL', 'https://your-domain.com/subscription?success=true')
        cancel_url = os.environ.get('STRIPE_CANCEL_URL', 'https://your-domain.com/subscription?canceled=true')
        
        # チェックアウトセッションを作成
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[
                {
                    'price': plan['price_id'],
                    'quantity': 1,
                },
            ],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        )
        
        return {
            'session_id': session.id,
            'url': session.url
        }
    
    except stripe.error.StripeError as e:
        log_error("StripeError", f"Stripe error: {str(e)}")
        raise APIError(f"Stripe error: {str(e)}", 500)
    except Exception as e:
        log_error("CheckoutSessionError", f"Error creating checkout session: {str(e)}")
        raise APIError(f"Error creating checkout session: {str(e)}", 500)

# サブスクリプションの解約
def cancel_subscription(user_id):
    """
    ユーザーのサブスクリプションを解約する
    
    Args:
        user_id: ユーザーID
        
    Returns:
        dict: 解約結果
    """
    # Stripeを初期化
    initialize_stripe()
    
    try:
        # ユーザー情報を取得
        db = get_db()
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise ValidationError(f"User not found: {user_id}")
        
        user_data = user_doc.to_dict()
        subscription_id = user_data.get('stripe_subscription_id')
        
        if not subscription_id:
            raise ValidationError("No active subscription found")
        
        # Stripeサブスクリプションを取得
        subscription = stripe.Subscription.retrieve(subscription_id)
        
        # 既に解約されているか確認
        if subscription.status == 'canceled':
            return {
                'canceled': True,
                'message': 'Subscription is already canceled'
            }
        
        # サブスクリプションを期間終了時に解約
        stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True
        )
        
        # Firestoreの更新（解約日を設定）
        current_period_end = datetime.fromtimestamp(subscription.current_period_end)
        
        user_ref.update({
            'subscription_end_date': current_period_end,
            'subscription_cancel_at_period_end': True,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        return {
            'canceled': True,
            'end_date': current_period_end.isoformat()
        }
    
    except stripe.error.StripeError as e:
        log_error("StripeError", f"Stripe error: {str(e)}")
        raise APIError(f"Stripe error: {str(e)}", 500)
    except Exception as e:
        log_error("CancelSubscriptionError", f"Error canceling subscription: {str(e)}")
        raise APIError(f"Error canceling subscription: {str(e)}", 500)

# カードを更新するためのセッションを作成
def create_card_update_session(user_id):
    """
    カード情報更新用のセッションを作成
    
    Args:
        user_id: ユーザーID
        
    Returns:
        dict: セッション情報
    """
    # Stripeを初期化
    initialize_stripe()
    
    try:
        # ユーザー情報を取得
        db = get_db()
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise ValidationError(f"User not found: {user_id}")
        
        user_data = user_doc.to_dict()
        customer_id = user_data.get('stripe_customer_id')
        
        if not customer_id:
            raise ValidationError("No Stripe customer found for this user")
        
        # 顧客ポータルセッションを作成
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=os.environ.get('STRIPE_RETURN_URL', 'https://your-domain.com/subscription')
        )
        
        return {
            'url': session.url
        }
    
    except stripe.error.StripeError as e:
        log_error("StripeError", f"Stripe error: {str(e)}")
        raise APIError(f"Stripe error: {str(e)}", 500)
    except Exception as e:
        log_error("CardUpdateSessionError", f"Error creating card update session: {str(e)}")
        raise APIError(f"Error creating card update session: {str(e)}", 500)

# Stripeウェブフックイベントの処理
def handle_webhook_event(payload, sig_header):
    """
    Stripeウェブフックイベントを処理する
    
    Args:
        payload: イベントデータ
        sig_header: Stripeシグネチャヘッダー
        
    Returns:
        dict: 処理結果
    """
    # Stripeを初期化
    initialize_stripe()
    
    # Webhookシークレットを取得
    webhook_secret = get_stripe_webhook_secret()
    if not webhook_secret:
        log_error("WebhookSecretError", "Stripe webhook secret is not provided")
        raise APIError("Stripe webhook secret is not configured", 500)
    
    try:
        # イベントを検証
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
        
        # イベントタイプに基づいて処理
        event_type = event['type']
        log_info("StripeWebhook", f"Processing webhook event: {event_type}")
        
        # データオブジェクトを取得
        data_obj = event['data']['object']
        
        # 各イベントタイプに応じた処理
        if event_type == 'checkout.session.completed':
            # チェックアウト完了イベント
            return handle_checkout_session_completed(data_obj)
            
        elif event_type == 'customer.subscription.created':
            # サブスクリプション作成イベント
            return handle_subscription_created(data_obj)
            
        elif event_type == 'customer.subscription.updated':
            # サブスクリプション更新イベント
            return handle_subscription_updated(data_obj)
            
        elif event_type == 'customer.subscription.deleted':
            # サブスクリプション削除イベント
            return handle_subscription_deleted(data_obj)
            
        elif event_type == 'invoice.payment_succeeded':
            # 支払い成功イベント
            return handle_payment_succeeded(data_obj)
            
        elif event_type == 'invoice.payment_failed':
            # 支払い失敗イベント
            return handle_payment_failed(data_obj)
            
        # その他のイベントは単純にログ記録
        log_info("StripeWebhook", f"Unhandled webhook event type: {event_type}")
        return {
            'status': 'ignored',
            'event_type': event_type
        }
    
    except stripe.error.SignatureVerificationError as e:
        log_error("WebhookSignatureError", f"Invalid signature: {str(e)}")
        raise APIError("Invalid webhook signature", 400)
    except json.JSONDecodeError as e:
        log_error("WebhookJsonError", f"Invalid payload: {str(e)}")
        raise APIError("Invalid JSON payload", 400)
    except Exception as e:
        log_error("WebhookError", f"Error handling webhook event: {str(e)}")
        raise APIError(f"Error handling webhook event: {str(e)}", 500)

# Webhookイベントハンドラー関数
def handle_checkout_session_completed(session):
    """
    チェックアウトセッション完了イベントを処理
    
    Args:
        session: セッションオブジェクト
        
    Returns:
        dict: 処理結果
    """
    # メタデータからユーザーIDとプランIDを取得
    metadata = session.get('metadata', {})
    user_id = metadata.get('user_id')
    plan_id = metadata.get('plan_id')
    
    if not user_id or not plan_id:
        log_warning("CheckoutSessionWarning", "Missing user_id or plan_id in session metadata")
        return {
            'status': 'warning',
            'message': 'Missing metadata'
        }
    
    # サブスクリプションIDを取得
    subscription_id = session.get('subscription')
    if not subscription_id:
        log_warning("CheckoutSessionWarning", "No subscription ID in completed session")
        return {
            'status': 'warning',
            'message': 'No subscription ID'
        }
    
    try:
        # プラン情報を取得
        plan = SUBSCRIPTION_PLANS.get(plan_id)
        if not plan:
            log_warning("CheckoutSessionWarning", f"Invalid plan ID: {plan_id}")
            return {
                'status': 'warning',
                'message': 'Invalid plan ID'
            }
        
        # サブスクリプション情報をFirestoreに保存
        db = get_db()
        user_ref = db.collection('users').document(user_id)
        
        # サブスクリプション終了日を計算
        duration_days = plan.get('duration_days', 30)
        now = datetime.now()
        end_date = now + timedelta(days=duration_days)
        
        # ユーザー情報を更新
        user_ref.update({
            'subscription_status': 'paid',
            'stripe_subscription_id': subscription_id,
            'subscription_plan': plan_id,
            'subscription_start_date': now,
            'subscription_end_date': end_date,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        return {
            'status': 'success',
            'user_id': user_id,
            'plan_id': plan_id,
            'subscription_id': subscription_id
        }
    except Exception as e:
        log_error("CheckoutCompletedError", f"Error processing checkout completed: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }

def handle_subscription_created(subscription):
    """
    サブスクリプション作成イベントを処理
    
    Args:
        subscription: サブスクリプションオブジェクト
        
    Returns:
        dict: 処理結果
    """
    # カスタマーIDを取得
    customer_id = subscription.get('customer')
    if not customer_id:
        log_warning("SubscriptionCreatedWarning", "No customer ID in subscription")
        return {
            'status': 'warning',
            'message': 'No customer ID'
        }
    
    try:
        # ユーザーを検索
        db = get_db()
        users_ref = db.collection('users')
        query = users_ref.where('stripe_customer_id', '==', customer_id).limit(1)
        users = query.stream()
        
        # ユーザーが見つからない場合
        user_list = list(users)
        if not user_list:
            log_warning("SubscriptionCreatedWarning", f"No user found for customer ID: {customer_id}")
            return {
                'status': 'warning',
                'message': 'No user found'
            }
        
        user_ref = user_list[0].reference
        user_id = user_ref.id
        
        # サブスクリプションのステータスを確認
        status = subscription.get('status')
        
        # 期間を取得
        current_period_start = subscription.get('current_period_start')
        current_period_end = subscription.get('current_period_end')
        
        if current_period_start and current_period_end:
            start_date = datetime.fromtimestamp(current_period_start)
            end_date = datetime.fromtimestamp(current_period_end)
            
            # ユーザー情報を更新
            user_ref.update({
                'subscription_status': 'paid' if status == 'active' else 'pending',
                'stripe_subscription_id': subscription.get('id'),
                'subscription_start_date': start_date,
                'subscription_end_date': end_date,
                'updated_at': firestore.SERVER_TIMESTAMP
            })
        
        return {
            'status': 'success',
            'user_id': user_id,
            'subscription_status': status
        }
    except Exception as e:
        log_error("SubscriptionCreatedError", f"Error processing subscription created: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }

def handle_subscription_updated(subscription):
    """
    サブスクリプション更新イベントを処理
    
    Args:
        subscription: サブスクリプションオブジェクト
        
    Returns:
        dict: 処理結果
    """
    # サブスクリプションIDとカスタマーIDを取得
    subscription_id = subscription.get('id')
    customer_id = subscription.get('customer')
    
    if not subscription_id or not customer_id:
        log_warning("SubscriptionUpdatedWarning", "Missing subscription ID or customer ID")
        return {
            'status': 'warning',
            'message': 'Missing IDs'
        }
    
    try:
        # ユーザーを検索
        db = get_db()
        users_ref = db.collection('users')
        query = users_ref.where('stripe_customer_id', '==', customer_id).limit(1)
        users = query.stream()
        
        # ユーザーが見つからない場合
        user_list = list(users)
        if not user_list:
            log_warning("SubscriptionUpdatedWarning", f"No user found for customer ID: {customer_id}")
            return {
                'status': 'warning',
                'message': 'No user found'
            }
        
        user_ref = user_list[0].reference
        user_id = user_ref.id
        
        # サブスクリプションのステータスを確認
        status = subscription.get('status')
        
        # 期間を取得
        current_period_end = subscription.get('current_period_end')
        cancel_at_period_end = subscription.get('cancel_at_period_end', False)
        
        update_data = {
            'subscription_status': 'paid' if status == 'active' else status,
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        
        if current_period_end:
            end_date = datetime.fromtimestamp(current_period_end)
            update_data['subscription_end_date'] = end_date
        
        # 期間終了時の解約フラグを更新
        update_data['subscription_cancel_at_period_end'] = cancel_at_period_end
        
        # ユーザー情報を更新
        user_ref.update(update_data)
        
        return {
            'status': 'success',
            'user_id': user_id,
            'subscription_status': status,
            'cancel_at_period_end': cancel_at_period_end
        }
    except Exception as e:
        log_error("SubscriptionUpdatedError", f"Error processing subscription updated: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }

def handle_subscription_deleted(subscription):
    """
    サブスクリプション削除イベントを処理
    
    Args:
        subscription: サブスクリプションオブジェクト
        
    Returns:
        dict: 処理結果
    """
    # サブスクリプションIDとカスタマーIDを取得
    subscription_id = subscription.get('id')
    customer_id = subscription.get('customer')
    
    if not subscription_id or not customer_id:
        log_warning("SubscriptionDeletedWarning", "Missing subscription ID or customer ID")
        return {
            'status': 'warning',
            'message': 'Missing IDs'
        }
    
    try:
        # ユーザーを検索
        db = get_db()
        users_ref = db.collection('users')
        query = users_ref.where('stripe_customer_id', '==', customer_id).limit(1)
        users = query.stream()
        
        # ユーザーが見つからない場合
        user_list = list(users)
        if not user_list:
            log_warning("SubscriptionDeletedWarning", f"No user found for customer ID: {customer_id}")
            return {
                'status': 'warning',
                'message': 'No user found'
            }
        
        user_ref = user_list[0].reference
        user_id = user_ref.id
        
        # ユーザー情報を更新
        user_ref.update({
            'subscription_status': 'free',  # 無料会員に戻す
            'stripe_subscription_id': None,
            'subscription_plan': None,
            'subscription_cancel_at_period_end': False,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        return {
            'status': 'success',
            'user_id': user_id,
            'subscription_status': 'free'
        }
    except Exception as e:
        log_error("SubscriptionDeletedError", f"Error processing subscription deleted: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }

def handle_payment_succeeded(invoice):
    """
    支払い成功イベントを処理
    
    Args:
        invoice: 請求書オブジェクト
        
    Returns:
        dict: 処理結果
    """
    # サブスクリプションIDとカスタマーIDを取得
    subscription_id = invoice.get('subscription')
    customer_id = invoice.get('customer')
    
    if not subscription_id or not customer_id:
        log_warning("PaymentSucceededWarning", "Missing subscription ID or customer ID")
        return {
            'status': 'warning',
            'message': 'Missing IDs'
        }
    
    try:
        # ユーザーを検索
        db = get_db()
        users_ref = db.collection('users')
        query = users_ref.where('stripe_customer_id', '==', customer_id).limit(1)
        users = query.stream()
        
        # ユーザーが見つからない場合
        user_list = list(users)
        if not user_list:
            log_warning("PaymentSucceededWarning", f"No user found for customer ID: {customer_id}")
            return {
                'status': 'warning',
                'message': 'No user found'
            }
        
        user_ref = user_list[0].reference
        user_id = user_ref.id
        
        # 支払い履歴コレクションに追加
        payment_ref = db.collection('users').document(user_id).collection('payments').document()
        payment_ref.set({
            'stripe_invoice_id': invoice.get('id'),
            'stripe_subscription_id': subscription_id,
            'amount': invoice.get('amount_paid', 0),
            'currency': invoice.get('currency', 'jpy'),
            'status': 'paid',
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        return {
            'status': 'success',
            'user_id': user_id,
            'invoice_id': invoice.get('id')
        }
    except Exception as e:
        log_error("PaymentSucceededError", f"Error processing payment succeeded: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }

def handle_payment_failed(invoice):
    """
    支払い失敗イベントを処理
    
    Args:
        invoice: 請求書オブジェクト
        
    Returns:
        dict: 処理結果
    """
    # サブスクリプションIDとカスタマーIDを取得
    subscription_id = invoice.get('subscription')
    customer_id = invoice.get('customer')
    
    if not subscription_id or not customer_id:
        log_warning("PaymentFailedWarning", "Missing subscription ID or customer ID")
        return {
            'status': 'warning',
            'message': 'Missing IDs'
        }
    
    try:
        # ユーザーを検索
        db = get_db()
        users_ref = db.collection('users')
        query = users_ref.where('stripe_customer_id', '==', customer_id).limit(1)
        users = query.stream()
        
        # ユーザーが見つからない場合
        user_list = list(users)
        if not user_list:
            log_warning("PaymentFailedWarning", f"No user found for customer ID: {customer_id}")
            return {
                'status': 'warning',
                'message': 'No user found'
            }
        
        user_ref = user_list[0].reference
        user_id = user_ref.id
        
        # 支払い履歴コレクションに追加
        payment_ref = db.collection('users').document(user_id).collection('payments').document()
        payment_ref.set({
            'stripe_invoice_id': invoice.get('id'),
            'stripe_subscription_id': subscription_id,
            'amount': invoice.get('amount_due', 0),
            'currency': invoice.get('currency', 'jpy'),
            'status': 'failed',
            'attempt_count': invoice.get('attempt_count', 1),
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        # 支払い失敗回数に応じた処理（オプション）
        # 複数回失敗した場合にサブスクリプションステータスを変更するなど
        
        return {
            'status': 'success',
            'user_id': user_id,
            'invoice_id': invoice.get('id'),
            'attempt_count': invoice.get('attempt_count', 1)
        }
    except Exception as e:
        log_error("PaymentFailedError", f"Error processing payment failed: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }