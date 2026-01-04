#!/bin/bash

PROJECT_NAME="boomGoldenFlower"
PROJECT_DIR="/home/$PROJECT_NAME"
GIT_URL="https://github.com/lyingshine/boomGoldenFlower.git"

echo "=== 停止当前运行的服务器 ==="
pkill -f "node.*server" || true

echo "=== 删除旧项目目录 ==="
rm -rf "$PROJECT_DIR"

echo "=== 从 Git 拉取项目 ==="
cd /home
git clone "$GIT_URL"

echo "=== 安装依赖 ==="
cd "$PROJECT_DIR"
npm install

echo "=== 构建项目 ==="
npm run build

echo "=== 启动服务器 ==="
nohup npm run server > server.log 2>&1 &
echo "服务器已在后台启动，日志文件: $PROJECT_DIR/server.log"
