#!/bin/bash

PROJECT_NAME="boomGoldenFlower"
PROJECT_DIR="/home/$PROJECT_NAME"
GIT_URL="https://github.com/lyingshine/boomGoldenFlower.git"
WEB_ROOT="/opt/1panel/www/sites/115.159.68.212/index"  # 网站根目录，根据实际情况修改

echo "=== 停止当前运行的服务器 ==="
pm2 delete boom 2>/dev/null || true

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
cd "$PROJECT_DIR"
pm2 start server.js --name boom
pm2 save
echo "服务器已通过 pm2 启动"
echo "查看日志: pm2 logs boom"
echo "查看状态: pm2 status"
