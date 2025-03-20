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

echo -e "${BLUE}Smart Paper v2 Stripe関連機能デプロイスクリプト${NC}"
echo -e "${YELLOW}プロジェクトID: ${PROJECT_ID}${NC}"
echo -e "${YELLOW}リージョン: ${REGION}${NC}"

# Firebaseプロジェクトを確認
echo -e "\n${BLUE}Firebaseプロジェクト設定の確認...${NC}"
firebase projects:list

# デプロイするプロジェクトを選択
echo -e "\n${BLUE}デプロイするプロジェクトを選択してください:${NC}"
firebase use ${PROJECT_ID}

# Stripe APIを有効化
echo -e "\n${BLUE}Stripe関連のAPIを有効化...${NC}"
gcloud services enable secretmanager.googleapis.com

# Secret Managerに必要な秘密鍵を保存
# 注: 実際の秘密鍵は手動で設定する必要があります
echo -e "\n${BLUE}Secret Managerでの設定を確認してください:${NC}"
echo -e "${YELLOW}以下の秘密鍵が必要です:${NC}"
echo -e "- STRIPE_SECRET_KEY: Stripeの秘密鍵"
echo -e "- STRIPE_WEBHOOK_SECRET: Stripeのwebhook秘密鍵"

# Cloud Functions依存関係のインストール
echo -e "\n${BLUE}Cloud Functions依存関係のインストール...${NC}"
cd functions
# requirements.txtを変更済み（stripe追加）
# ローカル環境に依存関係をインストール（古いライブラリがある場合はクリーンアップ）
pip install -r requirements.txt
cd ..

# Stripeに関連するCloud Functionsのデプロイ
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
  --set-env-vars=GOOGLE_CLOUD_PROJECT=${PROJECT_ID},STRIPE_SUCCESS_URL=https://student-subscription.com/react-app/smart-paper-v2/subscription?success=true,STRIPE_CANCEL_URL=https://student-subscription.com/react-app/smart-paper-v2/subscription?canceled=true

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
  --set-env-vars=GOOGLE_CLOUD_PROJECT=${PROJECT_ID}

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
  --set-env-vars=GOOGLE_CLOUD_PROJECT=${PROJECT_ID},STRIPE_RETURN_URL=https://student-subscription.com/react-app/smart-paper-v2/subscription

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
  --set-env-vars=GOOGLE_CLOUD_PROJECT=${PROJECT_ID}

echo -e "\n${GREEN}Stripe関連のCloud Functionsのデプロイが完了しました！${NC}"
echo -e "以下のURLでCloud Functionsにアクセスできます:"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/create_stripe_checkout${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/cancel_stripe_subscription${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/update_payment_method${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/stripe_webhook${NC}"

echo -e "\n${GREEN}設定が完了しました！${NC}"
echo -e "${YELLOW}Stripeの管理画面でWebhook URLを以下に設定してください:${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/stripe_webhook${NC}"