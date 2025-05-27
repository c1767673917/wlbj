#!/bin/bash

# 物流报价系统生产环境构建脚本

echo "🏗️  构建物流报价系统生产版本..."

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: npm 未安装，请先安装 npm"
    exit 1
fi

# 安装后端依赖
echo "📦 安装后端依赖..."
npm install --production

# 安装前端依赖
echo "📦 安装前端依赖..."
cd frontend
npm install

# 构建前端
echo "🔨 构建前端应用..."
npm run build

cd ..

# 检查构建结果
if [ -d "frontend/dist" ]; then
    echo "✅ 前端构建成功！"
    echo "📁 构建文件位置: frontend/dist/"
    
    # 显示构建文件大小
    echo ""
    echo "📊 构建文件大小:"
    du -sh frontend/dist/*
    
    echo ""
    echo "🚀 生产环境启动命令:"
    echo "   NODE_ENV=production node app.js"
    echo ""
    echo "💡 提示:"
    echo "   - 确保已配置好 auth_config.json"
    echo "   - 生产环境将在端口 3000 提供服务"
    echo "   - 前端静态文件将由后端服务器提供"
else
    echo "❌ 前端构建失败！"
    exit 1
fi
