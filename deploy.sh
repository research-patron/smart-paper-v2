#!/bin/bash

# プロジェクトID (環境に合わせて変更してください)
PROJECT_ID="smart-paper-v2"
REGION="us-central1"
BUCKET_NAME="${PROJECT_ID}.firebasestorage.app"
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

# 色を使用してログを分かりやすく表示
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Smart Paper v2 デプロイスクリプト${NC}"
echo -e "${YELLOW}プロジェクトID: ${PROJECT_ID}${NC}"
echo -e "${YELLOW}リージョン: ${REGION}${NC}"
echo -e "${YELLOW}バケット名: ${BUCKET_NAME}${NC}"
echo -e "${YELLOW}サービスアカウント: ${SERVICE_ACCOUNT}${NC}"

# Firebaseプロジェクトを確認
echo -e "\n${BLUE}Firebaseプロジェクト設定の確認...${NC}"
firebase projects:list

# デプロイするプロジェクトを選択
echo -e "\n${BLUE}デプロイするプロジェクトを選択してください:${NC}"
firebase use ${PROJECT_ID}

# サービスアカウントに必要な権限を付与
echo -e "\n${BLUE}サービスアカウントのロールを設定...${NC}"

# デプロイ用サービスアカウントに必要な権限を付与
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member=serviceAccount:${SERVICE_ACCOUNT} \
  --role=roles/cloudfunctions.invoker || true

# Secret Managerへのアクセス権限を付与
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member=serviceAccount:${SERVICE_ACCOUNT} \
  --role=roles/secretmanager.secretAccessor || true

# Firestore/Datastore書き込み権限を追加（パフォーマンスデータ保存用）
echo -e "\n${BLUE}Firestoreへの書き込み権限を追加...${NC}"
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member=serviceAccount:${SERVICE_ACCOUNT} \
  --role=roles/datastore.user || true

# Vertex AI APIを有効化
echo -e "\n${BLUE}Vertex AI APIを有効化...${NC}"
gcloud services enable aiplatform.googleapis.com

# Secret Manager APIを有効化
echo -e "\n${BLUE}Secret Manager APIを有効化...${NC}"
gcloud services enable secretmanager.googleapis.com

# Firestoreが有効になっていることを確認
echo -e "\n${BLUE}Firestore APIを有効化...${NC}"
gcloud services enable firestore.googleapis.com

# Firebase Auth APIを有効化
echo -e "\n${BLUE}Firebase Auth APIを有効化...${NC}"
gcloud services enable identitytoolkit.googleapis.com

# Cloud Functions依存関係のインストール
echo -e "\n${BLUE}Cloud Functions依存関係のインストール...${NC}"
cd functions
# requirements.txtを修正 - 最新バージョンを使用
echo "firebase-functions>=0.4.2
google-cloud-firestore>=2.0.0
google-cloud-storage>=2.0.0
google-cloud-aiplatform>=1.0.0
google-cloud-secret-manager>=2.0.0
Flask>=2.0.0
python-dateutil>=2.8.2
requests>=2.25.0
firebase-admin>=6.0.0
stripe==5.0.0" > requirements.txt

# ローカル環境に依存関係をインストール（古いライブラリがある場合はクリーンアップ）
rm -rf lib
mkdir -p lib
python -m pip install --upgrade pip
pip install -r requirements.txt -t lib --upgrade
cd ..

# 追加した性能計測モジュールが存在することを確認
echo -e "\n${BLUE}性能計測モジュールの確認...${NC}"
if [ ! -f "functions/performance.py" ]; then
  echo -e "${RED}Error: functions/performance.py が見つかりません${NC}"
  exit 1
fi

# stripe_functions.pyが存在することを確認
echo -e "\n${BLUE}Stripeモジュールの確認...${NC}"
if [ ! -f "functions/stripe_functions.py" ]; then
  echo -e "${RED}Error: functions/stripe_functions.py が見つかりません${NC}"
  exit 1
fi

# ==========================================
# Secret Managerのシークレット取得と設定
# ==========================================
echo -e "\n${BLUE}Secret Managerからシークレットキーを取得中...${NC}"

# Stripe Webhook Secret Keyを取得
WEBHOOK_SECRET=$(gcloud secrets versions access latest --secret=STRIPE_WEBHOOK_SECRET --project=${PROJECT_ID} 2>/dev/null || echo "")

if [ -z "$WEBHOOK_SECRET" ]; then
  echo -e "${YELLOW}Secret Manager に STRIPE_WEBHOOK_SECRET が見つかりません${NC}"
  
  # 手動入力を求める
  echo -e "${YELLOW}Stripeダッシュボードから新しいシークレットキーを取得し、入力してください${NC}"
  echo -e "${YELLOW}ウェブフック > エンドポイント > シークレットキーの表示${NC}"
  read -s -p "Webhook Secret Key: " WEBHOOK_SECRET
  
  if [ -z "$WEBHOOK_SECRET" ]; then
    echo -e "\n${RED}キーが入力されていません。${NC}"
    echo -e "${YELLOW}警告: Webhook関数はStripe Webhookを処理できない可能性があります${NC}"
  else
    echo -e "\n${GREEN}シークレットキーを受け取りました。Secret Manager に保存します...${NC}"
    
    # 新しいシークレットをSecret Managerに保存
    echo -n "$WEBHOOK_SECRET" | gcloud secrets versions add STRIPE_WEBHOOK_SECRET --data-file=- --project=${PROJECT_ID}
    
    if [ $? -ne 0 ]; then
      echo -e "${RED}シークレットの保存に失敗しました。権限を確認してください。${NC}"
      WEBHOOK_SECRET=""
    else
      echo -e "${GREEN}シークレットを Secret Manager に保存しました。${NC}"
    fi
  fi
else
  echo -e "${GREEN}Webhook Secret Key を Secret Manager から取得しました (${#WEBHOOK_SECRET} 文字)${NC}"
fi

# Stripeの秘密鍵を取得
STRIPE_SECRET_KEY=$(gcloud secrets versions access latest --secret=STRIPE_SECRET_KEY --project=${PROJECT_ID} 2>/dev/null || echo "")

if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo -e "${YELLOW}Secret Manager に STRIPE_SECRET_KEY が見つかりません${NC}"
  read -s -p "Stripe Secret Key (sk_...): " STRIPE_SECRET_KEY
  
  if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo -e "\n${RED}キーが入力されていません。${NC}"
    echo -e "${YELLOW}警告: Stripe決済機能は動作しません${NC}"
  else
    echo -e "\n${GREEN}Stripe Secret Key を受け取りました。Secret Manager に保存します...${NC}"
    echo -n "$STRIPE_SECRET_KEY" | gcloud secrets versions add STRIPE_SECRET_KEY --data-file=- --project=${PROJECT_ID}
    
    if [ $? -ne 0 ]; then
      echo -e "${RED}シークレットの保存に失敗しました。権限を確認してください。${NC}"
      STRIPE_SECRET_KEY=""
    else
      echo -e "${GREEN}シークレットを Secret Manager に保存しました。${NC}"
    fi
  fi
else
  echo -e "${GREEN}Stripe Secret Key を Secret Manager から取得しました (${#STRIPE_SECRET_KEY} 文字)${NC}"
fi

# ==========================================
# Cloud Functionsのデプロイ
# ==========================================
echo -e "\n${BLUE}Cloud Functions をデプロイしています...${NC}"

# PDF処理関連の関数
echo -e "\n${BLUE}process_pdf 関数をデプロイしています...${NC}"
gcloud functions deploy process_pdf \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=process_pdf \
  --memory=2048MB \
  --timeout=540s \
  --allow-unauthenticated \
  --set-env-vars=BUCKET_NAME=${BUCKET_NAME},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},CLOUD_FUNCTIONS_SA=${SERVICE_ACCOUNT}

echo -e "\n${BLUE}process_pdf_background 関数をデプロイしています...${NC}"
gcloud functions deploy process_pdf_background \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=process_pdf_background \
  --memory=4096MB \
  --timeout=540s \
  --allow-unauthenticated \
  --set-env-vars=BUCKET_NAME=${BUCKET_NAME},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},CLOUD_FUNCTIONS_SA=${SERVICE_ACCOUNT}

echo -e "\n${BLUE}get_signed_url 関数をデプロイしています...${NC}"
gcloud functions deploy get_signed_url \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=get_signed_url \
  --memory=512MB \
  --timeout=60s \
  --allow-unauthenticated \
  --set-env-vars=BUCKET_NAME=${BUCKET_NAME},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}

# Stripe関連のCloud Functions
echo -e "\n${BLUE}Stripe関連のCloud Functionsをデプロイしています...${NC}"

echo -e "\n${BLUE}create_stripe_checkout 関数をデプロイしています...${NC}"
gcloud functions deploy create_stripe_checkout \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=create_stripe_checkout \
  --memory=512MB \
  --timeout=60s \
  --allow-unauthenticated \
  --set-env-vars=STRIPE_SUCCESS_URL=https://${PROJECT_ID}.web.app/subscription?success=true,STRIPE_CANCEL_URL=https://${PROJECT_ID}.web.app/subscription?canceled=true,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}

echo -e "\n${BLUE}cancel_stripe_subscription 関数をデプロイしています...${NC}"
gcloud functions deploy cancel_stripe_subscription \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=cancel_stripe_subscription \
  --memory=512MB \
  --timeout=60s \
  --allow-unauthenticated \
  --set-env-vars=GOOGLE_CLOUD_PROJECT=${PROJECT_ID},STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}

echo -e "\n${BLUE}update_payment_method 関数をデプロイしています...${NC}"
gcloud functions deploy update_payment_method \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=update_payment_method \
  --memory=512MB \
  --timeout=60s \
  --allow-unauthenticated \
  --set-env-vars=STRIPE_RETURN_URL=https://${PROJECT_ID}.web.app/subscription,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}

# Stripe Webhook関数
echo -e "\n${BLUE}stripe_webhook 関数をデプロイしています...${NC}"
gcloud functions deploy stripe_webhook \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=stripe_webhook \
  --memory=512MB \
  --timeout=60s \
  --allow-unauthenticated \
  --set-env-vars=GOOGLE_CLOUD_PROJECT=${PROJECT_ID},STRIPE_WEBHOOK_SECRET=${WEBHOOK_SECRET},STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}

echo -e "\n${GREEN}デプロイが完了しました！${NC}"
echo -e "以下のURLでCloud Functionsにアクセスできます:"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/process_pdf${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/process_pdf_background${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/get_signed_url${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/create_stripe_checkout${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/cancel_stripe_subscription${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/update_payment_method${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/stripe_webhook${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/stripe_webhook_test${NC}"

# Firestoreコレクションの存在確認とインデックス作成
echo -e "\n${BLUE}Firestoreインデックスの設定...${NC}"
echo -e "${YELLOW}process_timeコレクションのインデックスを作成します...${NC}"
echo "{
  \"indexes\": [
    {
      \"collectionGroup\": \"process_time\",
      \"queryScope\": \"COLLECTION\",
      \"fields\": [
        { \"fieldPath\": \"function_name\", \"order\": \"ASCENDING\" },
        { \"fieldPath\": \"week_id\", \"order\": \"ASCENDING\" },
        { \"fieldPath\": \"timestamp\", \"order\": \"ASCENDING\" }
      ]
    },
    {
      \"collectionGroup\": \"process_time\",
      \"queryScope\": \"COLLECTION\",
      \"fields\": [
        { \"fieldPath\": \"week_id\", \"order\": \"ASCENDING\" },
        { \"fieldPath\": \"function_name\", \"order\": \"ASCENDING\" },
        { \"fieldPath\": \"processing_time_ms\", \"order\": \"ASCENDING\" }
      ]
    }
  ]
}" > firestore.indexes.json

# Stripe Webhook設定の確認方法を表示
echo -e "\n${BLUE}Stripe Webhook 設定方法:${NC}"
echo -e "1. Stripeダッシュボードで以下のURLを登録:"
echo -e "   ${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/stripe_webhook${NC}"
echo -e "2. イベントを追加 (以下のイベントが必要):"
echo -e "   - checkout.session.completed"
echo -e "   - customer.subscription.created"
echo -e "   - customer.subscription.updated"
echo -e "   - customer.subscription.deleted"
echo -e "   - invoice.payment_succeeded"
echo -e "   - invoice.payment_failed"
echo -e "3. シークレットを確認 (既に Secret Manager に保存済み)"

echo -e "\n${GREEN}設定が完了しました！${NC}"
echo -e "${YELLOW}Firestoreの'process_time'コレクションに処理時間データが記録されます${NC}"
