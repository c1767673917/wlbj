#!/bin/bash

# 物流报价系统开发环境启动脚本

echo "🚀 启动物流报价系统开发环境..."

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

# 检查后端依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装后端依赖..."
    npm install
fi

# 检查前端依赖
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd frontend
    npm install
    cd ..
fi

echo "🔧 启动后端服务器 (端口 3000)..."
# 在后台启动后端服务器
NODE_ENV=development node app.js &
BACKEND_PID=$!

# 等待后端启动
sleep 3

echo "🎨 启动前端开发服务器 (端口 5173)..."
# 启动前端开发服务器
cd frontend
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "✅ 开发环境启动成功！"
echo ""
echo "📍 访问地址:"
echo "   前端: http://localhost:5173"
echo "   后端: http://localhost:3000"
echo ""
echo "💡 提示:"
echo "   - 前端会自动代理API请求到后端"
echo "   - 修改代码会自动重新加载"
echo "   - 按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
wait

# 清理进程
echo "🛑 正在停止服务..."
kill $BACKEND_PID 2>/dev/null
kill $FRONTEND_PID 2>/dev/null
echo "✅ 服务已停止"
