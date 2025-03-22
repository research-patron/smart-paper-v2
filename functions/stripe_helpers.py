import stripe
import os
import json
import time
from datetime import datetime, timedelta
from google.cloud import secretmanager
from firebase_admin import firestore
from error_handling import (
    log_error,
    log_info,
    log_warning,
    APIError,
    ValidationError,
    json_serializable
)

# Webhookイベントのロギング機能をインポート
try:
    from webhook_logger import log_webhook_event
except ImportError:
    # ロガーがインポートできない場合は空の関数を定義
    def log_webhook_event(event_type, event_data, result=None):
        log_info("WebhookEvent", f"Event: {event_type}", {"result": result})

# サブスクリプションプラン情報
# 注意: price_idは実際のStripeダッシュボードで作成したプランのIDに置き換えてください
# Stripeダッシュボードの「製品」タブから作成したプランのIDを確認できます
SUBSCRIPTION_PLANS = {
    'monthly': {
        'price_id': 'price_1R4bJwHI4NoEudKd1ZhXt8mX',  # 月額プランのStripe Price ID - 実際のIDに置き換え必須
        'name': 'プレミアムプラン(月額)',
        'amount': 300,  # 月額300円
        'interval': 'month',
        'duration_days': 30,
    },
    'annual': {
        'price_id': 'price_1R4bKrHI4NoEudKdA7ZqlmVm',  # 年額プランのStripe Price ID - 実際のIDに置き換え必須
        'name': 'プレミアムプラン(年額)',
        'amount': 3000,  # 年額3000円
        'interval': 'year',
        'duration_days': 365,
    }
}

# 初期化フラグ
_stripe_initialized = False
_db = None

# Secret Managerからシークレットを取得する汎用関数
def get_secret(secret_name, fallback_env_var=None):
    """Secret Managerから最新のシークレットを取得する汎用関数"""
    try:
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
        if not project_id:
            log_error("SecretManagerError", "GOOGLE_CLOUD_PROJECT environment variable not set")
            if fallback_env_var and os.environ.get(fallback_env_var):
                return os.environ.get(fallback_env_var)
            return ""
            
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
        
        log_info("SecretManager", f"Fetching latest version of secret: {secret_name}")
        
        try:
            response = client.access_secret_version(request={"name": name})
            secret_value = response.payload.data.decode("UTF-8").strip()
            
            # シークレットの長さをログに記録（値自体は記録しない）
            log_info("SecretManager", f"Successfully retrieved secret", {
                "secret_name": secret_name,
                "length": len(secret_value),
                "version": "latest"
            })
            
            # 取得したシークレットが空でないことを確認
            if not secret_value:
                log_warning("SecretManager", f"Retrieved secret is empty: {secret_name}")
                if fallback_env_var and os.environ.get(fallback_env_var):
                    log_info("SecretManager", f"Using fallback from environment variable: {fallback_env_var}")
                    return os.environ.get(fallback_env_var)
            
            return secret_value
            
        except Exception as e:
            log_error("SecretManagerError", f"Error accessing secret: {str(e)}", 
                     {"secret_name": secret_name, "error_type": type(e).__name__})
            
            # フォールバック: 環境変数から取得
            if fallback_env_var and os.environ.get(fallback_env_var):
                log_info("SecretManager", f"Using fallback from environment variable: {fallback_env_var}")
                return os.environ.get(fallback_env_var)
            
            return ""
    except Exception as e:
        log_error("SecretManagerError", f"Unexpected error: {str(e)}", 
                 {"secret_name": secret_name, "error_type": type(e).__name__})
        
        # フォールバック: 環境変数から取得
        if fallback_env_var and os.environ.get(fallback_env_var):
            log_info("SecretManager", f"Using fallback from environment variable: {fallback_env_var}")
            return os.environ.get(fallback_env_var)
        
        return ""

# Secret ManagerからStripeの秘密鍵を取得する関数
def get_stripe_secret_key():
    """Secret ManagerからStripeの秘密鍵を取得（最新バージョン）"""
    return get_secret("STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY")

# Secret ManagerからStripeのWebhook Secretを取得する関数
def get_stripe_webhook_secret():
    """Secret ManagerからStripeのWebhook Secretを取得（最新バージョン）"""
    # 環境変数から直接取得を試みる（デバッグ用）
    if "STRIPE_WEBHOOK_SECRET" in os.environ and os.environ.get("STRIPE_WEBHOOK_SECRET"):
        secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
        log_info("StripeWebhook", "Using webhook secret from environment variable", {"length": len(secret)})
        return secret
        
    # Secret Managerから最新バージョンを取得
    return get_secret("STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET")

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

# ユーザーデータを安全に更新する関数 (datetime処理を改善)
def update_user_subscription_status(user_id, subscription_data):
    """
    ユーザーのサブスクリプション状態を更新する共通関数
    
    Args:
        user_id: ユーザーID
        subscription_data: 更新するサブスクリプションデータの辞書
    
    Returns:
        bool: 更新が成功したかどうか
    """
    try:
        db = get_db()
        user_ref = db.collection('users').document(user_id)
        
        # 最新のユーザーデータを取得して確認
        user_doc = user_ref.get()
        if not user_doc.exists:
            log_warning("UserUpdateWarning", f"User document does not exist: {user_id}")
            return False
        
        # ユーザーデータを取得
        user_data = user_doc.to_dict()
        
        # 更新データを加工（Noneの値は削除）
        update_data = {k: v for k, v in subscription_data.items() if v is not None}
        
        # サブスクリプションステータスを明示的に設定
        if 'subscription_status' not in update_data and 'stripe_subscription_id' in update_data:
            update_data['subscription_status'] = 'paid'
        
        # 常に更新タイムスタンプを設定
        update_data['updated_at'] = firestore.SERVER_TIMESTAMP
        
        # ログ記録用の安全な形式に変換 (直接datetimeを使わない)
        log_data = {
            "current_status": user_data.get('subscription_status'),
            "new_status": update_data.get('subscription_status', "未変更")
        }
        
        # 更新データをログ用にコピーし、datetimeを文字列に変換
        log_update_data = {}
        for k, v in update_data.items():
            if isinstance(v, (datetime, firestore.SERVER_TIMESTAMP.__class__)):
                if v == firestore.SERVER_TIMESTAMP:
                    log_update_data[k] = "SERVER_TIMESTAMP"
                else:
                    log_update_data[k] = v.isoformat() if hasattr(v, 'isoformat') else str(v)
            else:
                log_update_data[k] = v
        
        log_data["update_data"] = log_update_data
        
        # ログを追加
        try:
            log_info("UserSubscriptionUpdate", 
                    f"Updating user {user_id} subscription data", 
                    log_data)
        except Exception as log_err:
            # ログ記録に失敗しても処理は続行
            print(f"Warning: Failed to log subscription update: {str(log_err)}")
        
        # Firestoreを更新
        user_ref.update(update_data)
        
        # 更新後、再度データを取得して変更が反映されたか確認
        try:
            updated_doc = user_ref.get()
            updated_data = updated_doc.to_dict()
            log_info("UserSubscriptionUpdateResult", 
                    f"User {user_id} subscription updated", 
                    {"new_status": updated_data.get('subscription_status'),
                     "stripe_subscription_id": updated_data.get('stripe_subscription_id')})
        except Exception as verify_err:
            # 確認時のエラーは無視して処理を続行
            log_warning("UserUpdateVerification", f"Failed to verify update: {str(verify_err)}")
                 
        return True
        
    except Exception as e:
        # エラーログ用にdatetimeオブジェクトをフィルタリング
        safe_subscription_data = {}
        try:
            for k, v in subscription_data.items():
                if isinstance(v, (datetime, firestore.SERVER_TIMESTAMP.__class__)):
                    if v == firestore.SERVER_TIMESTAMP:
                        safe_subscription_data[k] = "SERVER_TIMESTAMP"
                    else:
                        safe_subscription_data[k] = v.isoformat() if hasattr(v, 'isoformat') else str(v)
                else:
                    safe_subscription_data[k] = v
                    
            log_error("UserUpdateError", f"Failed to update user subscription: {str(e)}", 
                     {"user_id": user_id, "subscription_data": safe_subscription_data})
        except Exception as log_err:
            # ログ記録に失敗した場合の最小限のログ記録
            print(f"Critical: Failed to log update error: {str(log_err)}, original error: {str(e)}")
            
        # 緊急フォールバック：エラーが発生しても最低限のサブスクリプションステータスの更新を試みる
        try:
            if 'subscription_status' in subscription_data and subscription_data['subscription_status'] == 'paid':
                # 最小限の更新データでリトライ
                user_ref = get_db().collection('users').document(user_id)
                user_ref.update({
                    'subscription_status': 'paid',
                    'updated_at': firestore.SERVER_TIMESTAMP
                })
                log_info("UserUpdateRecovery", f"Emergency update succeeded for user {user_id}")
                return True
        except Exception as fallback_err:
            log_error("UserUpdateFallbackError", f"Emergency update failed: {str(fallback_err)}")
            
        return False

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
        
        user_data = {}
        if user_doc.exists:
            user_data = user_doc.to_dict()
        else:
            # ユーザードキュメントが存在しない場合、Firebase Authからユーザー情報を取得
            try:
                from firebase_admin import auth
                auth_user = auth.get_user(user_id)
                
                # 基本的なユーザー情報を設定
                user_data = {
                    'email': auth_user.email,
                    'name': auth_user.display_name or auth_user.email.split('@')[0],
                    'created_at': datetime.now(),
                    'updated_at': datetime.now(),
                    'subscription_status': 'free',
                    'subscription_end_date': None
                }
                
                # Firestoreにユーザー情報を保存
                user_ref.set(user_data)
                log_info("UserCreated", f"Created user document for user: {user_id}")
            except Exception as auth_error:
                log_error("AuthError", f"Failed to get user from Firebase Auth: {str(auth_error)}")
                # 最小限の情報でユーザーを作成（Emailなど取得できない場合）
                user_data = {
                    'email': f"user_{user_id}@example.com",  # ダミーemail
                    'name': f"User {user_id[:6]}",  # 短縮ユーザーID
                    'created_at': datetime.now(),
                    'updated_at': datetime.now(),
                    'subscription_status': 'free',
                    'subscription_end_date': None
                }
                # Firestoreにユーザー情報を保存
                user_ref.set(user_data)
                log_info("UserCreated", f"Created minimal user document for user: {user_id}")
        
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
        
        log_info("CheckoutSessionCreated", f"Created checkout session for user: {user_id}", 
                {"plan_id": plan_id, "session_id": session.id})
        
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
    
    # ログを追加
    log_info("StripeWebhook", "Processing webhook with signature", {
        "signature_length": len(sig_header) if sig_header else 0,
        "webhook_secret_length": len(webhook_secret) if webhook_secret else 0,
        "payload_size": len(payload) if payload else 0
    })
    
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
        
        # Webhookイベントをログに記録
        log_webhook_event(event_type, data_obj)
        
        # 各イベントタイプに応じた処理
        result = None
        if event_type == 'checkout.session.completed':
            # チェックアウト完了イベント
            result = handle_checkout_session_completed(data_obj)
            
        elif event_type == 'customer.subscription.created':
            # サブスクリプション作成イベント
            result = handle_subscription_created(data_obj)
            
        elif event_type == 'customer.subscription.updated':
            # サブスクリプション更新イベント
            result = handle_subscription_updated(data_obj)
            
        elif event_type == 'customer.subscription.deleted':
            # サブスクリプション削除イベント
            result = handle_subscription_deleted(data_obj)
            
        elif event_type == 'invoice.payment_succeeded':
            # 支払い成功イベント
            result = handle_payment_succeeded(data_obj)
            
        elif event_type == 'invoice.payment_failed':
            # 支払い失敗イベント
            result = handle_payment_failed(data_obj)
        
        # 処理結果をログに記録
        if result:
            log_webhook_event(event_type, data_obj, result)
            
        # その他のイベントは単純にログ記録
        if not result:
            log_info("StripeWebhook", f"Unhandled webhook event type: {event_type}")
            result = {
                'status': 'ignored',
                'event_type': event_type
            }
            
        return result
    
    except stripe.error.SignatureVerificationError as e:
        log_error("WebhookSignatureError", f"Invalid signature: {str(e)}", {
            "signature_length": len(sig_header) if sig_header else 0,
            "webhook_secret_length": len(webhook_secret) if webhook_secret else 0
        })
        raise APIError("Invalid webhook signature", 400)
    except json.JSONDecodeError as e:
        log_error("WebhookJsonError", f"Invalid payload: {str(e)}")
        raise APIError("Invalid JSON payload", 400)
    except Exception as e:
        log_error("WebhookError", f"Error handling webhook event: {str(e)}")
        raise APIError(f"Error handling webhook event: {str(e)}", 500)

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
    
    log_info("CheckoutSessionCompleted", f"Processing checkout session completed for user {user_id}", 
            {"plan_id": plan_id, "session_id": session.get('id')})
    
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
        
        # 最新のサブスクリプション情報をStripeから取得
        end_date = None
        try:
            sub = stripe.Subscription.retrieve(subscription_id)
            # 実際の期間終了日が取得できれば、それを使用
            if sub.current_period_end:
                end_date = datetime.fromtimestamp(sub.current_period_end)
                log_info("SubscriptionEndDate", f"Using actual subscription end date from Stripe: {end_date.isoformat()}")
        except Exception as stripe_err:
            log_warning("SubscriptionWarning", f"Could not retrieve subscription from Stripe: {str(stripe_err)}")
            # エラー発生時はデフォルトの計算値を使用
            duration_days = plan.get('duration_days', 30)
            now = datetime.now()
            end_date = now + timedelta(days=duration_days)
            log_info("SubscriptionEndDate", f"Using calculated subscription end date: {end_date.isoformat()}")
        
        # ユーザー情報を更新
        update_data = {
            'subscription_status': 'paid',
            'stripe_subscription_id': subscription_id,
            'subscription_plan': plan_id,
            'subscription_start_date': datetime.now(),
            'subscription_end_date': end_date,
            'subscription_cancel_at_period_end': False,
        }
        
        # ユーザーデータを更新
        success = update_user_subscription_status(user_id, update_data)
        
        # 成功したかどうかをログに記録
        log_info("UserUpdate", f"User subscription update {'succeeded' if success else 'failed'}", 
                {"user_id": user_id})
        
        # 2回目のトライを試みる（念のため）
        if not success:
            log_info("UserUpdate", "Retrying user subscription update...")
            # 少し待機してから再試行
            time.sleep(2)
            success = update_user_subscription_status(user_id, update_data)
            log_info("UserUpdate", f"Second attempt {'succeeded' if success else 'failed'}")
        
        # 3回目のトライ（最終手段）
        if not success:
            log_info("UserUpdate", "Last attempt for user subscription update...")
            time.sleep(3)
            
            # 最終手段：直接 subscription_status のみを更新
            try:
                db = get_db()
                user_ref = db.collection('users').document(user_id)
                user_ref.update({
                    'subscription_status': 'paid',
                    'updated_at': firestore.SERVER_TIMESTAMP
                })
                log_info("UserUpdate", "Final attempt to update subscription status completed")
                success = True
            except Exception as final_err:
                log_error("UserUpdateFinalError", f"Final update attempt failed: {str(final_err)}")
        
        return {
            'status': 'success',
            'user_id': user_id,
            'plan_id': plan_id,
            'subscription_id': subscription_id,
            'update_success': success
        }
    except Exception as e:
        log_error("CheckoutCompletedError", f"Error processing checkout completed: {str(e)}")
        
        # エラーが発生した場合でも、直接Firestoreを更新して確実に有料ステータスにする緊急対応
        try:
            db = get_db()
            user_ref = db.collection('users').document(user_id)
            user_ref.update({
                'subscription_status': 'paid',
                'stripe_subscription_id': subscription_id,
                'updated_at': firestore.SERVER_TIMESTAMP
            })
            log_info("EmergencyUpdate", f"Direct Firestore update for user {user_id} after error")
        except Exception as emergency_err:
            log_error("EmergencyUpdateError", f"Failed emergency update: {str(emergency_err)}")
        
        return {
            'status': 'error',
            'message': str(e),
            'emergency_update': 'attempted'
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
        
        # ユーザー情報を更新
        update_data = {
            'subscription_status': 'paid' if status == 'active' else 'pending',
            'stripe_subscription_id': subscription.get('id'),
        }
        
        if current_period_start and current_period_end:
            start_date = datetime.fromtimestamp(current_period_start)
            end_date = datetime.fromtimestamp(current_period_end)
            
            update_data['subscription_start_date'] = start_date
            update_data['subscription_end_date'] = end_date
        
        # ユーザーデータを更新
        success = update_user_subscription_status(user_id, update_data)
        
        # 成功したかどうかをログに記録
        log_info("UserUpdate", f"User subscription creation update {'succeeded' if success else 'failed'}", 
                {"user_id": user_id})
        
        # 2回目のトライを試みる（念のため）
        if not success:
            log_info("UserUpdate", "Retrying user subscription update for creation...")
            # 少し待機してから再試行
            time.sleep(2)
            success = update_user_subscription_status(user_id, update_data)
            log_info("UserUpdate", f"Second attempt for creation {'succeeded' if success else 'failed'}")
        
        # 3回目のトライ（最終手段）- 重要なので追加
        if not success:
            log_info("UserUpdate", "Last attempt for user subscription update...")
            time.sleep(3)
            
            # 最終手段：直接 subscription_status のみを更新
            try:
                user_ref.update({
                    'subscription_status': 'paid',
                    'updated_at': firestore.SERVER_TIMESTAMP
                })
                log_info("UserUpdate", "Final attempt to update subscription status completed")
                success = True
            except Exception as final_err:
                log_error("UserUpdateFinalError", f"Final update attempt failed: {str(final_err)}")
        
        return {
            'status': 'success',
            'user_id': user_id,
            'subscription_status': status,
            'update_success': success
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
        }
        
        if current_period_end:
            end_date = datetime.fromtimestamp(current_period_end)
            update_data['subscription_end_date'] = end_date
        
        # 期間終了時の解約フラグを更新
        update_data['subscription_cancel_at_period_end'] = cancel_at_period_end
        
        # ユーザーデータを更新
        success = update_user_subscription_status(user_id, update_data)
        
        # 成功したかどうかをログに記録
        log_info("UserUpdate", f"User subscription update {'succeeded' if success else 'failed'}", 
                {"user_id": user_id})
        
        # 2回目のトライを試みる（念のため）
        if not success:
            log_info("UserUpdate", "Retrying user subscription update...")
            # 少し待機してから再試行
            time.sleep(2)
            success = update_user_subscription_status(user_id, update_data)
            log_info("UserUpdate", f"Second attempt {'succeeded' if success else 'failed'}")
            
        # 3回目のトライ（最終手段）- 重要なので追加
        if not success and status == 'active':
            log_info("UserUpdate", "Last attempt for user subscription update...")
            time.sleep(3)
            
            # 最終手段：直接 subscription_status のみを更新
            try:
                user_ref.update({
                    'subscription_status': 'paid',
                    'updated_at': firestore.SERVER_TIMESTAMP
                })
                log_info("UserUpdate", "Final attempt to update subscription status completed")
                success = True
            except Exception as final_err:
                log_error("UserUpdateFinalError", f"Final update attempt failed: {str(final_err)}")
        
        return {
            'status': 'success',
            'user_id': user_id,
            'subscription_status': status,
            'cancel_at_period_end': cancel_at_period_end,
            'update_success': success
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
        update_data = {
            'subscription_status': 'free',  # 無料会員に戻す
            'stripe_subscription_id': None,
            'subscription_plan': None,
            'subscription_cancel_at_period_end': False,
        }
        
        # ユーザーデータを更新
        success = update_user_subscription_status(user_id, update_data)
        
        # 成功したかどうかをログに記録
        log_info("UserUpdate", f"User subscription deletion update {'succeeded' if success else 'failed'}", 
                {"user_id": user_id})
        
        # 2回目のトライを試みる（念のため）
        if not success:
            log_info("UserUpdate", "Retrying user subscription update for deletion...")
            # 少し待機してから再試行
            time.sleep(2)
            success = update_user_subscription_status(user_id, update_data)
            log_info("UserUpdate", f"Second attempt for deletion {'succeeded' if success else 'failed'}")
            
        # 3回目のトライ（最終手段）- 重要なので追加
        if not success:
            log_info("UserUpdate", "Last attempt for user subscription update...")
            time.sleep(3)
            
            # 最終手段：直接 subscription_status のみを更新
            try:
                user_ref.update({
                    'subscription_status': 'free',
                    'updated_at': firestore.SERVER_TIMESTAMP
                })
                log_info("UserUpdate", "Final attempt to update subscription status completed")
                success = True
            except Exception as final_err:
                log_error("UserUpdateFinalError", f"Final update attempt failed: {str(final_err)}")
        
        return {
            'status': 'success',
            'user_id': user_id,
            'subscription_status': 'free',
            'update_success': success
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
        
        # ユーザーデータを明示的に'paid'に設定
        update_data = {
            'subscription_status': 'paid',  # 支払い成功したら必ず paid にする
        }
        
        # 最新のサブスクリプション情報をStripeから取得
        try:
            sub = stripe.Subscription.retrieve(subscription_id)
            # 実際の期間終了日が取得できれば、それを使用
            if sub.current_period_end:
                end_date = datetime.fromtimestamp(sub.current_period_end)
                update_data['subscription_end_date'] = end_date
                log_info("SubscriptionEndDate", f"Using actual subscription end date from Stripe: {end_date.isoformat()}")
        except Exception as stripe_err:
            log_warning("SubscriptionWarning", f"Could not retrieve subscription from Stripe: {str(stripe_err)}")
        
        # ユーザーデータを更新
        success = update_user_subscription_status(user_id, update_data)
        
        # 成功したかどうかをログに記録
        log_info("UserUpdate", f"User payment succeeded update {'succeeded' if success else 'failed'}", 
                {"user_id": user_id})
        
        # 2回目のトライを試みる（念のため）
        if not success:
            log_info("UserUpdate", "Retrying user subscription update after payment...")
            # 少し待機してから再試行
            time.sleep(2)
            success = update_user_subscription_status(user_id, update_data)
            log_info("UserUpdate", f"Second attempt after payment {'succeeded' if success else 'failed'}")
            
        # 3回目のトライ（最終手段）- 重要なので追加
        if not success:
            log_info("UserUpdate", "Last attempt for user subscription update...")
            time.sleep(3)
            
            # 最終手段：直接 subscription_status のみを更新
            try:
                user_ref.update({
                    'subscription_status': 'paid',
                    'updated_at': firestore.SERVER_TIMESTAMP
                })
                log_info("UserUpdate", "Final attempt to update subscription status completed")
                success = True
            except Exception as final_err:
                log_error("UserUpdateFinalError", f"Final update attempt failed: {str(final_err)}")
        
        # 支払い履歴コレクションに追加
        try:
            payment_ref = db.collection('users').document(user_id).collection('payments').document()
            payment_ref.set({
                'stripe_invoice_id': invoice.get('id'),
                'stripe_subscription_id': subscription_id,
                'amount': invoice.get('amount_paid', 0),
                'currency': invoice.get('currency', 'jpy'),
                'status': 'paid',
                'created_at': firestore.SERVER_TIMESTAMP
            })
        except Exception as payment_err:
            log_error("PaymentHistoryError", f"Failed to record payment history: {str(payment_err)}")
        
        return {
            'status': 'success',
            'user_id': user_id,
            'invoice_id': invoice.get('id'),
            'update_success': success
        }
    except Exception as e:
        log_error("PaymentSucceededError", f"Error processing payment succeeded: {str(e)}")
        # 最終手段 - エラーが発生しても直接ユーザーIDがわかっていれば更新を試みる
        if 'user_id' in locals() and user_id:
            try:
                db = get_db()
                user_ref = db.collection('users').document(user_id)
                user_ref.update({
                    'subscription_status': 'paid',
                    'updated_at': firestore.SERVER_TIMESTAMP
                })
                log_info("EmergencyUpdate", f"Direct Firestore update for user {user_id} after payment error")
                return {
                    'status': 'recovered',
                    'user_id': user_id,
                    'invoice_id': invoice.get('id'),
                    'message': 'Emergency update succeeded'
                }
            except Exception as fallback_err:
                log_error("EmergencyUpdateError", f"Failed emergency update: {str(fallback_err)}")
                
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
        
        # 支払い失敗回数
        attempt_count = invoice.get('attempt_count', 1)
        
        # 支払い失敗が3回以上の場合はステータスを変更
        if attempt_count >= 3:
            # ユーザーデータの更新
            update_data = {
                'subscription_status': 'payment_failed',
            }
            success = update_user_subscription_status(user_id, update_data)
            
            log_info("UserUpdate", "Updated user status to payment_failed due to multiple failed attempts", 
                    {"user_id": user_id, "attempt_count": attempt_count, "success": success})
            
            # 2回目のトライを試みる（念のため）
            if not success:
                log_info("UserUpdate", "Retrying user subscription update for payment failure...")
                # 少し待機してから再試行
                time.sleep(2)
                success = update_user_subscription_status(user_id, update_data)
                log_info("UserUpdate", f"Second attempt for payment failure {'succeeded' if success else 'failed'}")
        
        # 支払い履歴コレクションに追加
        try:
            payment_ref = db.collection('users').document(user_id).collection('payments').document()
            payment_ref.set({
                'stripe_invoice_id': invoice.get('id'),
                'stripe_subscription_id': subscription_id,
                'amount': invoice.get('amount_due', 0),
                'currency': invoice.get('currency', 'jpy'),
                'status': 'failed',
                'attempt_count': attempt_count,
                'created_at': firestore.SERVER_TIMESTAMP
            })
        except Exception as payment_err:
            log_error("PaymentHistoryError", f"Failed to record payment history: {str(payment_err)}")
        
        return {
            'status': 'success',
            'user_id': user_id,
            'invoice_id': invoice.get('id'),
            'attempt_count': attempt_count
        }
    except Exception as e:
        log_error("PaymentFailedError", f"Error processing payment failed: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }