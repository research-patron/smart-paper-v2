#!/bin/bash

# プロジェクトID (環境に合わせて変更してください)
PROJECT_ID="smart-paper-v2"
REGION="us-central1"
BUCKET_NAME="${PROJECT_ID}.appspot.com"
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

# Cloud Tasks キューを作成
echo -e "\n${BLUE}Cloud Tasks キューの作成...${NC}"
gcloud tasks queues create translate-pdf-queue \
  --location=${REGION} \
  --max-dispatches-per-second=5 \
  --max-concurrent-dispatches=10 \
  --max-attempts=1 || true

# サービスアカウントに必要なロールを付与
echo -e "\n${BLUE}サービスアカウントのロールを設定...${NC}"
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member=serviceAccount:${SERVICE_ACCOUNT} \
  --role=roles/cloudtasks.enqueuer || true

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member=serviceAccount:${SERVICE_ACCOUNT} \
  --role=roles/cloudfunctions.invoker || true

# Cloud Functions依存関係のインストール
echo -e "\n${BLUE}Cloud Functions依存関係のインストール...${NC}"
cd functions
# requirements.txtを修正
echo "firebase-functions>=0.1.0
google-cloud-firestore>=2.5.0
google-cloud-storage>=2.1.0
google-cloud-tasks>=2.7.0
google-cloud-aiplatform>=1.24.0
google-cloud-secret-manager
Flask>=2.3.2
python-dateutil>=2.8.2
requests>=2.25.0" > requirements.txt

python -m pip install --upgrade pip
pip install -r requirements.txt -t lib --upgrade
cd ..

# Cloud Functions のデプロイ
echo -e "\n${BLUE}Cloud Functions をデプロイしています...${NC}"
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

echo -e "\n${BLUE}process_pdf_task 関数をデプロイしています...${NC}"
gcloud functions deploy process_pdf_task \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=process_pdf_task \
  --memory=2048MB \
  --timeout=540s \
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

echo -e "\n${GREEN}デプロイが完了しました！${NC}"
echo -e "以下のURLでCloud Functionsにアクセスできます:"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/process_pdf${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/get_signed_url${NC}"
