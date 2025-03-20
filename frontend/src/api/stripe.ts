// ~/Desktop/smart-paper-v2/frontend/src/api/stripe.ts
import { getCurrentUserToken } from './papers';

// Stripe公開鍵の取得（環境変数から）
export const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;

// Cloud Functions APIのベースURL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://us-central1-smart-paper-v2.cloudfunctions.net';

/**
 * Stripeチェックアウトセッションを作成する
 * @param planId プランID ('monthly' or 'annual')
 * @returns セッション情報（sessionId, url）
 */
export const createCheckoutSession = async (planId: string): Promise<{ session_id: string; url: string }> => {
  try {
    // 認証トークンを取得
    const token = await getCurrentUserToken();
    if (!token) {
      throw new Error('認証が必要です');
    }
    
    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    const response = await fetch(`${API_BASE_URL}/create_stripe_checkout`, {
      method: 'POST',
      headers,
      mode: 'cors',
      body: JSON.stringify({ plan_id: planId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'チェックアウトセッションの作成に失敗しました');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * サブスクリプションを解約する
 * @returns 解約結果（canceled, end_date）
 */
export const cancelSubscription = async (): Promise<{ canceled: boolean; end_date: string }> => {
  try {
    // 認証トークンを取得
    const token = await getCurrentUserToken();
    if (!token) {
      throw new Error('認証が必要です');
    }
    
    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    const response = await fetch(`${API_BASE_URL}/cancel_stripe_subscription`, {
      method: 'POST',
      headers,
      mode: 'cors'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'サブスクリプションの解約に失敗しました');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

/**
 * 支払い方法を更新するためのセッションを作成する
 * @returns セッション情報（url）
 */
export const updatePaymentMethod = async (): Promise<{ url: string }> => {
  try {
    // 認証トークンを取得
    const token = await getCurrentUserToken();
    if (!token) {
      throw new Error('認証が必要です');
    }
    
    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    const response = await fetch(`${API_BASE_URL}/update_payment_method`, {
      method: 'POST',
      headers,
      mode: 'cors'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || '支払い方法の更新に失敗しました');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating payment method:', error);
    throw error;
  }
};

/**
 * Stripeのチェックアウトページにリダイレクトする
 * @param planId プランID ('monthly' or 'annual')
 */
export const redirectToCheckout = async (planId: string): Promise<void> => {
  try {
    // チェックアウトセッションを作成
    const { url } = await createCheckoutSession(planId);
    
    // Stripeのチェックアウトページにリダイレクト
    window.location.href = url;
  } catch (error) {
    console.error('Error redirecting to checkout:', error);
    throw error;
  }
};

/**
 * カード更新ページにリダイレクトする
 */
export const redirectToCardUpdate = async (): Promise<void> => {
  try {
    // カード更新セッションを作成
    const { url } = await updatePaymentMethod();
    
    // Stripeのカード更新ページにリダイレクト
    window.location.href = url;
  } catch (error) {
    console.error('Error redirecting to card update:', error);
    throw error;
  }
};