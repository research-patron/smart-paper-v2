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

# Cloud Tasks実行権限を付与
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member=serviceAccount:${SERVICE_ACCOUNT} \
  --role=roles/cloudtasks.enqueuer || true

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

# Cloud Tasks APIを有効化
echo -e "\n${BLUE}Cloud Tasks APIを有効化...${NC}"
gcloud services enable cloudtasks.googleapis.com

# Cloud Functions依存関係のインストール
echo -e "\n${BLUE}Cloud Functions依存関係のインストール...${NC}"
cd functions
# requirements.txtを修正 - 最新バージョンとCloud Tasksを追加
echo "firebase-functions>=0.4.2
google-cloud-firestore>=2.0.0
google-cloud-storage>=2.0.0
google-cloud-aiplatform>=1.0.0
google-cloud-secret-manager>=2.0.0
google-cloud-tasks>=2.7.1
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

# Cloud Tasks キューの作成スクリプトを実行
echo -e "\n${BLUE}Cloud Tasks キューを作成/更新しています...${NC}"
bash ./create_queue.sh

# ==========================================
# Cloud Functionsのデプロイ
# ==========================================
echo -e "\n${BLUE}Cloud Functions をデプロイしています...${NC}"

# 主要なPDF処理関数
echo -e "\n${BLUE}process_pdf 関数をデプロイしています...${NC}"
gcloud functions deploy process_pdf \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=process_pdf \
  --memory=512MB \
  --timeout=540s \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars=BUCKET_NAME=${BUCKET_NAME},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},CLOUD_FUNCTIONS_SA=${SERVICE_ACCOUNT}

echo -e "\n${BLUE}process_pdf_background 関数をデプロイしています...${NC}"
gcloud functions deploy process_pdf_background \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=process_pdf_background \
  --memory=512MB \
  --timeout=540s \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars=BUCKET_NAME=${BUCKET_NAME},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},CLOUD_FUNCTIONS_SA=${SERVICE_ACCOUNT}

# 非同期処理用の新しい関数をデプロイ
echo -e "\n${BLUE}process_chapter_translation 関数をデプロイしています...${NC}"
gcloud functions deploy process_chapter_translation \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=process_chapter_translation \
  --memory=512MB \
  --timeout=540s \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars=BUCKET_NAME=${BUCKET_NAME},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}

echo -e "\n${BLUE}process_paper_summary 関数をデプロイしています...${NC}"
gcloud functions deploy process_paper_summary \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=process_paper_summary \
  --memory=512MB \
  --timeout=540s \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars=BUCKET_NAME=${BUCKET_NAME},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}

echo -e "\n${BLUE}check_paper_completion 関数をデプロイしています...${NC}"
gcloud functions deploy check_paper_completion \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=check_paper_completion \
  --memory=512MB \
  --timeout=60s \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars=BUCKET_NAME=${BUCKET_NAME},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}

echo -e "\n${BLUE}get_signed_url 関数をデプロイしています...${NC}"
gcloud functions deploy get_signed_url \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=get_signed_url \
  --memory=512MB \
  --timeout=60s \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars=BUCKET_NAME=${BUCKET_NAME},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}

# 処理時間データ取得の関数を追加
echo -e "\n${BLUE}get_processing_time 関数をデプロイしています...${NC}"
gcloud functions deploy get_processing_time \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=get_processing_time_router \
  --memory=512MB \
  --timeout=60s \
  --max-instances=10 \
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

# 管理者機能関連の関数
echo -e "\n${BLUE}share_paper_with_admin 関数をデプロイしています...${NC}"
gcloud functions deploy share_paper_with_admin \
  --region=${REGION} \
  --runtime=python310 \
  --trigger-http \
  --source=./functions \
  --entry-point=share_paper_with_admin_router \
  --memory=512MB \
  --timeout=60s \
  --allow-unauthenticated \
  --set-env-vars=GOOGLE_CLOUD_PROJECT=${PROJECT_ID},ADMIN_EMAIL_MASTER=s.kosei0626@gmail.com,ADMIN_EMAIL_SERVICE=smart-paper-v2@student-subscription.com

# フロントエンドのビルドとデプロイ
echo -e "\n${BLUE}フロントエンドをビルドしています...${NC}"
cd frontend
npm install
npm run build

echo -e "\n${BLUE}Firebase Hostingをデプロイしています...${NC}"
firebase deploy --only hosting

# Firestoreルールのデプロイ
echo -e "\n${BLUE}Firestoreセキュリティルールをデプロイしています...${NC}"
cd ..
firebase deploy --only firestore:rules

echo -e "\n${GREEN}デプロイが完了しました！${NC}"
echo -e "以下のURLでCloud Functionsにアクセスできます:"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/process_pdf${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/process_pdf_background${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/process_chapter_translation${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/process_paper_summary${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/check_paper_completion${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/get_signed_url${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/get_processing_time${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/create_stripe_checkout${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/cancel_stripe_subscription${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/update_payment_method${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/stripe_webhook${NC}"
echo -e "${YELLOW}https://${REGION}-${PROJECT_ID}.cloudfunctions.net/share_paper_with_admin${NC}"

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
    },
    {
      \"collectionGroup\": \"inquiries\", 
      \"queryScope\": \"COLLECTION\",
      \"fields\": [
        { \"fieldPath\": \"type\", \"order\": \"ASCENDING\" },
        { \"fieldPath\": \"created_at\", \"order\": \"DESCENDING\" }
      ]
    }
  ]
}" > firestore.indexes.json

# Indexを更新
firebase deploy --only firestore:indexes

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

echo -e "\n${GREEN}処理時間分析機能がデプロイされました！${NC}"
echo -e "${YELLOW}管理者ページの「Geminiログを表示」ボタンから「処理時間分析」ボタンを押すことで、論文処理の詳細な時間分析ができます${NC}"
echo -e "${YELLOW}CSV出力機能で処理時間データをダウンロードすることも可能です${NC}"