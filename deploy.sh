#!/bin/bash

PROJECT_NAME="boomGoldenFlower"
PROJECT_DIR="/home/$PROJECT_NAME"
GIT_URL="https://gitclone.com/github.com/lyingshine/boomGoldenFlower.git"
WEB_ROOT="/opt/1panel/www/sites/115.159.68.212/index"  # 网站根目录，根据实际情况修改

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

echo "=== 构建前端项目 ==="
npm run build

echo "=== 复制编译文件到网站根目录 ==="
rm -rf "$WEB_ROOT"/*
cp -r "$PROJECT_DIR/dist/"* "$WEB_ROOT/"
echo "前端文件已部署到 $WEB_ROOT"

echo "=== 启动服务器 ==="
nohup npm run server > server.log 2>&1 &
echo "服务器已在后台启动，日志文件: $PROJECT_DIR/server.log"
