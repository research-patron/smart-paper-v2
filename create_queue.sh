#!/bin/bash

# プロジェクトIDとリージョンを設定
PROJECT_ID="smart-paper-v2"
REGION="us-central1"
QUEUE_NAME="paper-processing-queue"

# 色を使用してログを分かりやすく表示
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Cloud Tasks queue作成スクリプト${NC}"
echo -e "${YELLOW}プロジェクトID: ${PROJECT_ID}${NC}"
echo -e "${YELLOW}リージョン: ${REGION}${NC}"
echo -e "${YELLOW}キュー名: ${QUEUE_NAME}${NC}"

# Cloud Tasksが有効になっていることを確認
echo -e "\n${BLUE}Cloud Tasks APIを有効化...${NC}"
gcloud services enable cloudtasks.googleapis.com

# キューがすでに存在するか確認
QUEUE_EXISTS=$(gcloud tasks queues describe $QUEUE_NAME --location=$REGION 2>&1 | grep -c "ERROR")

if [ "$QUEUE_EXISTS" -eq 0 ]; then
  echo -e "${YELLOW}キューはすでに存在します。設定を更新します...${NC}"
  
  # キューの設定を更新
  gcloud tasks queues update $QUEUE_NAME \
    --location=$REGION \
    --max-dispatches-per-second=5 \
    --max-concurrent-dispatches=10 \
    --max-attempts=5 \
    --min-backoff=1s \
    --max-backoff=10s \
    --max-retry-duration=1800s \
    --max-doublings=5
  
  echo -e "${GREEN}キュー設定を更新しました${NC}"
else
  echo -e "${YELLOW}新しいキューを作成します...${NC}"
  
  # 新しいキューを作成
  gcloud tasks queues create $QUEUE_NAME \
    --location=$REGION \
    --max-dispatches-per-second=5 \
    --max-concurrent-dispatches=10 \
    --max-attempts=5 \
    --min-backoff=1s \
    --max-backoff=10s \
    --max-retry-duration=1800s \
    --max-doublings=5
  
  echo -e "${GREEN}キューを作成しました${NC}"
fi

# キューの詳細を表示
echo -e "\n${BLUE}キュー設定の詳細:${NC}"
gcloud tasks queues describe $QUEUE_NAME --location=$REGION

echo -e "\n${GREEN}スクリプト実行完了${NC}"