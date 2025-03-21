#!/bin/bash

# プロジェクトID (環境に合わせて変更してください)
PROJECT_ID="smart-paper-v2"
BUCKET_NAME="${PROJECT_ID}.firebasestorage.app"

# 色を使用してログを分かりやすく表示
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Smart Paper v2 CORS設定スクリプト${NC}"
echo -e "${YELLOW}プロジェクトID: ${PROJECT_ID}${NC}"
echo -e "${YELLOW}バケット名: ${BUCKET_NAME}${NC}"

# CORS設定ファイルの作成
echo -e "\n${BLUE}CORS設定ファイルを作成...${NC}"
cat > cors-config.json << EOF
[
  {
    "origin": ["https://smart-paper-v2.web.app", "https://smart-paper-v2.firebaseapp.com", "http://localhost:3000"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Range", "Content-Disposition", "Cache-Control"],
    "maxAgeSeconds": 3600
  }
]
EOF

# CORSポリシーの設定
echo -e "\n${BLUE}Cloud Storageバケットに CORS ポリシーを適用しています...${NC}"
gsutil cors set cors-config.json gs://${BUCKET_NAME}

# 設定の確認
echo -e "\n${BLUE}CORS設定の確認...${NC}"
gsutil cors get gs://${BUCKET_NAME}

echo -e "\n${GREEN}CORS設定が完了しました！${NC}"