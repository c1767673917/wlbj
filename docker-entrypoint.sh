#!/bin/sh
set -e

# 颜色输出函数
print_info() {
    echo "\033[32m[INFO]\033[0m $1"
}

print_warn() {
    echo "\033[33m[WARN]\033[0m $1"
}

print_error() {
    echo "\033[31m[ERROR]\033[0m $1"
}

print_info "启动物流报价平台 Docker 容器..."

# 检查必要的环境变量
if [ -z "$SILICONFLOW_API_KEY" ]; then
    print_warn "SILICONFLOW_API_KEY 环境变量未设置，AI功能将不可用"
fi

# 创建必要的目录
mkdir -p /app/data /app/logs /app/config-persistent

# 检查并创建默认配置文件
if [ ! -f "/app/config-persistent/auth_config.json" ]; then
    print_info "创建默认用户认证配置文件..."
    cat > /app/config-persistent/auth_config.json << EOF
{
  "password": "changeme_please_ASAP_!"
}
EOF
    print_warn "请立即修改 auth_config.json 中的默认密码！"
fi

# 创建软链接到持久化配置
if [ ! -L "/app/auth_config.json" ]; then
    ln -sf /app/config-persistent/auth_config.json /app/auth_config.json
fi

if [ ! -L "/app/ip_whitelist.json" ] && [ -f "/app/config-persistent/ip_whitelist.json" ]; then
    ln -sf /app/config-persistent/ip_whitelist.json /app/ip_whitelist.json
fi

# 检查数据库文件
if [ ! -f "/app/data/logistics.db" ]; then
    print_info "首次启动，将创建新的数据库文件"
fi

# 设置文件权限
chown -R nodejs:nodejs /app/data /app/logs /app/config-persistent 2>/dev/null || true

print_info "配置检查完成，启动应用..."

# 执行传入的命令
exec "$@"
