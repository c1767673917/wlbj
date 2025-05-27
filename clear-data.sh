#!/bin/bash

# 物流报价系统数据清理脚本
# 用于清空后端和前端的原始数据，为新前端测试做准备

echo "🧹 开始清理物流报价系统数据..."

# 1. 清理后端数据
echo "📦 清理后端数据..."

# 删除SQLite数据库文件
if [ -f "data/logistics.db" ]; then
    rm -f data/logistics.db
    echo "✅ 已删除数据库文件: data/logistics.db"
else
    echo "ℹ️  数据库文件不存在: data/logistics.db"
fi

# 清空日志目录
if [ -d "logs" ]; then
    rm -rf logs/*
    echo "✅ 已清空日志目录"
else
    echo "ℹ️  日志目录不存在"
fi

# 确保数据目录存在但为空
mkdir -p data
echo "✅ 数据目录已准备就绪"

# 2. 清理前端数据
echo "🎨 清理前端数据..."

# 清理前端构建文件
if [ -d "frontend/dist" ]; then
    rm -rf frontend/dist
    echo "✅ 已删除前端构建文件"
else
    echo "ℹ️  前端构建文件不存在"
fi

# 清理前端node_modules缓存（可选）
if [ -d "frontend/node_modules/.cache" ]; then
    rm -rf frontend/node_modules/.cache
    echo "✅ 已清理前端缓存"
fi

# 3. 清理临时文件
echo "🗑️  清理临时文件..."

# 清理可能的临时文件
find . -name "*.tmp" -type f -delete 2>/dev/null || true
find . -name "*.log" -type f -delete 2>/dev/null || true
find . -name ".DS_Store" -type f -delete 2>/dev/null || true

echo "✅ 已清理临时文件"

# 4. 重新初始化数据库结构
echo "🔄 重新初始化数据库..."

# 启动Node.js来初始化数据库
node -e "
const db = require('./db/database.js');
console.log('数据库初始化完成');
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('关闭数据库时出错:', err.message);
        } else {
            console.log('数据库连接已关闭');
        }
        process.exit(0);
    });
}, 2000);
"

echo "✅ 数据库重新初始化完成"

# 5. 验证清理结果
echo "🔍 验证清理结果..."

echo "📊 数据目录状态:"
ls -la data/ 2>/dev/null || echo "  数据目录为空或不存在"

echo "📊 日志目录状态:"
ls -la logs/ 2>/dev/null || echo "  日志目录为空或不存在"

echo "📊 前端构建状态:"
if [ -d "frontend/dist" ]; then
    echo "  ⚠️  前端构建文件仍然存在"
else
    echo "  ✅ 前端构建文件已清理"
fi

echo ""
echo "🎉 数据清理完成！"
echo ""
echo "📋 清理摘要:"
echo "  ✅ 后端数据库已重置"
echo "  ✅ 日志文件已清空"
echo "  ✅ 前端构建文件已清理"
echo "  ✅ 临时文件已清理"
echo "  ✅ 数据库结构已重新初始化"
echo ""
echo "🚀 系统已准备好进行新前端测试！"
echo ""
echo "💡 下一步操作建议:"
echo "  1. 启动后端服务: npm start 或 node app.js"
echo "  2. 构建前端: cd frontend && npm run build"
echo "  3. 访问系统进行测试"
echo ""
