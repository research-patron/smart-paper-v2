"""
Stripeからのwebhookイベントをログに記録するモジュール
"""
import json
import logging
import firebase_admin
from firebase_admin import firestore
from datetime import datetime

def log_webhook_event(event_type, event_data, result=None):
    """
    Webhookイベントをログに記録し、必要に応じてFirestoreに保存
    
    Args:
        event_type: Stripeイベントタイプ (例: checkout.session.completed)
        event_data: イベントデータ
        result: 処理結果 (オプション)
    """
    # ロギング
    logging.info(f"Webhook event: {event_type}")
    
    try:
        # Firestoreに保存
        db = firestore.client()
        log_ref = db.collection('webhook_logs').document()
        
        # センシティブ情報をマスク
        sanitized_data = sanitize_sensitive_data(event_data)
        
        log_data = {
            'event_type': event_type,
            'event_data': sanitized_data,
            'result': result,
            'timestamp': datetime.now()
        }
        
        log_ref.set(log_data)
        logging.info(f"Webhook event logged to Firestore: {log_ref.id}")
        
    except Exception as e:
        logging.error(f"Error logging webhook event: {str(e)}")

def sanitize_sensitive_data(data):
    """
    センシティブなデータをマスクする
    
    Args:
        data: 処理するデータ
        
    Returns:
        dict: マスクされたデータ
    """
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            # クレジットカード情報などのセンシティブデータをマスク
            if key in ['card', 'source', 'payment_method_details']:
                result[key] = "**MASKED**"
            elif isinstance(value, (dict, list)):
                result[key] = sanitize_sensitive_data(value)
            else:
                result[key] = value
        return result
    elif isinstance(data, list):
        return [sanitize_sensitive_data(item) for item in data]
    else:
        return data

def get_recent_webhook_logs(limit=10):
    """
    最近のWebhookログを取得
    
    Args:
        limit: 取得するログの最大数
        
    Returns:
        list: ログのリスト
    """
    try:
        db = firestore.client()
        logs_ref = db.collection('webhook_logs').order_by('timestamp', direction='DESCENDING').limit(limit)
        logs = logs_ref.stream()
        
        result = []
        for log in logs:
            log_data = log.to_dict()
            log_data['id'] = log.id
            result.append(log_data)
        
        return result
    except Exception as e:
        logging.error(f"Error getting webhook logs: {str(e)}")
        return []