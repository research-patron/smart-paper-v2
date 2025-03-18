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
requests>=2.25.0" > requirements.txt

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

echo -e "\n${GREEN}デプロイが完了しました！${NC}"
echo -e "以下のURLでCloud Functionsにアクセスできます:"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/process_pdf${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/process_pdf_background${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/get_signed_url${NC}"

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

echo -e "\n${GREEN}設定が完了しました！${NC}"
echo -e "${YELLOW}Firestoreの'process_time'コレクションに処理時間データが記録されます${NC}"