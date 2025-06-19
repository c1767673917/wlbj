#!/bin/bash

# 设置安全修复脚本的执行权限

echo "设置安全修复脚本执行权限..."

# 进入脚本目录
cd "$(dirname "$0")/scripts"

# 设置所有JavaScript脚本为可执行
chmod +x *.js

echo "✅ 脚本权限设置完成"

# 显示脚本列表
echo ""
echo "可执行的修复脚本："
ls -la *.js

echo ""
echo "使用方法："
echo "  node run-all-fixes.js          # 运行主修复脚本（推荐）"
echo "  node fix-jwt-security.js       # JWT安全修复"
echo "  node encrypt-sensitive-data.js # 敏感数据加密"
echo "  node update-cors-config.js     # CORS配置修复"
echo "  node enable-foreign-keys.js    # 外键约束启用"
