#!/bin/bash

# SSL证书配置脚本 - Let's Encrypt自动化配置
# 支持自动申请、配置和续期SSL证书

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查root权限
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行"
        exit 1
    fi
}

# 安装Certbot
install_certbot() {
    log_step "安装Certbot..."
    
    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    elif command -v yum &> /dev/null; then
        yum install -y certbot python3-certbot-nginx
    else
        log_error "不支持的包管理器"
        exit 1
    fi
    
    log_info "Certbot安装完成"
}

# 获取域名信息
get_domain_info() {
    log_step "配置域名信息..."
    
    echo "请输入您的域名信息："
    read -p "主域名 (例如: example.com): " DOMAIN
    read -p "是否添加www子域名? (y/N): " ADD_WWW
    
    if [[ -z "$DOMAIN" ]]; then
        log_error "域名不能为空"
        exit 1
    fi
    
    # 验证域名格式
    if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]]; then
        log_error "域名格式不正确"
        exit 1
    fi
    
    DOMAINS="$DOMAIN"
    if [[ $ADD_WWW =~ ^[Yy]$ ]]; then
        DOMAINS="$DOMAIN,www.$DOMAIN"
    fi
    
    log_info "将为以下域名申请证书: $DOMAINS"
}

# 验证域名解析
verify_dns() {
    log_step "验证域名解析..."
    
    SERVER_IP=$(curl -s ifconfig.me)
    
    for domain in $(echo $DOMAINS | tr ',' ' '); do
        RESOLVED_IP=$(dig +short $domain | tail -n1)
        
        if [[ "$RESOLVED_IP" != "$SERVER_IP" ]]; then
            log_warn "域名 $domain 解析IP ($RESOLVED_IP) 与服务器IP ($SERVER_IP) 不匹配"
            read -p "是否继续? (y/N): " CONTINUE
            if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
                log_error "请先配置正确的DNS解析"
                exit 1
            fi
        else
            log_info "域名 $domain 解析正确"
        fi
    done
}

# 更新Nginx配置
update_nginx_config() {
    log_step "更新Nginx配置..."
    
    # 备份原配置
    cp /etc/nginx/sites-available/wlbj /etc/nginx/sites-available/wlbj.backup
    
    # 创建新的Nginx配置
    cat > /etc/nginx/sites-available/wlbj << EOF
# HTTP重定向到HTTPS
server {
    listen 80;
    server_name $DOMAINS;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS配置
server {
    listen 443 ssl http2;
    server_name $DOMAINS;
    
    # SSL配置
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # 静态文件
    location /assets/ {
        alias /opt/wlbj/frontend/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # 安全配置
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Server \$host;
    }
    
    # 主应用
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # 安全配置
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Server \$host;
    }
}
EOF
    
    log_info "Nginx配置已更新"
}

# 申请SSL证书
obtain_certificate() {
    log_step "申请SSL证书..."
    
    # 获取邮箱
    read -p "请输入邮箱地址 (用于证书通知): " EMAIL
    
    if [[ -z "$EMAIL" ]]; then
        log_error "邮箱地址不能为空"
        exit 1
    fi
    
    # 申请证书
    certbot certonly \
        --nginx \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domains "$DOMAINS"
    
    if [[ $? -eq 0 ]]; then
        log_info "SSL证书申请成功"
    else
        log_error "SSL证书申请失败"
        exit 1
    fi
}

# 配置自动续期
setup_auto_renewal() {
    log_step "配置证书自动续期..."
    
    # 创建续期脚本
    cat > /etc/cron.d/certbot-renewal << 'EOF'
# 每天凌晨2点检查证书续期
0 2 * * * root certbot renew --quiet --post-hook "systemctl reload nginx"
EOF
    
    # 测试续期
    certbot renew --dry-run
    
    if [[ $? -eq 0 ]]; then
        log_info "证书自动续期配置成功"
    else
        log_warn "证书续期测试失败，请检查配置"
    fi
}

# 重启服务
restart_services() {
    log_step "重启服务..."
    
    # 测试Nginx配置
    nginx -t
    
    if [[ $? -eq 0 ]]; then
        systemctl reload nginx
        log_info "Nginx配置重载成功"
    else
        log_error "Nginx配置测试失败，恢复备份配置"
        cp /etc/nginx/sites-available/wlbj.backup /etc/nginx/sites-available/wlbj
        systemctl reload nginx
        exit 1
    fi
}

# 验证SSL配置
verify_ssl() {
    log_step "验证SSL配置..."
    
    sleep 5  # 等待服务重启
    
    # 测试HTTPS连接
    if curl -s -I "https://$DOMAIN" | grep -q "HTTP/"; then
        log_info "HTTPS连接测试成功"
    else
        log_warn "HTTPS连接测试失败，请检查配置"
    fi
    
    # 显示SSL评级信息
    log_info "SSL配置完成！"
    log_info "您可以访问以下网站测试SSL配置:"
    log_info "- https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
    log_info "- https://www.qualys.com/ssl-labs/"
}

# 主函数
main() {
    log_info "开始配置SSL证书..."
    
    check_root
    install_certbot
    get_domain_info
    verify_dns
    obtain_certificate
    update_nginx_config
    setup_auto_renewal
    restart_services
    verify_ssl
    
    log_info "SSL证书配置完成！"
    log_info "您的网站现在可以通过 https://$DOMAIN 访问"
    log_warn "请确保防火墙已开放443端口"
}

# 执行主函数
main "$@"
