#!/bin/bash

# 物流报价系统 - Linux生产环境一键部署脚本
# 版本: v2.0.0
# 作者: wlbj项目组
# 描述: 自动化部署脚本，包含所有必要的配置和安全设置

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
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

# 检查是否以root权限运行
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行，请使用 sudo"
        exit 1
    fi
}

# 检测操作系统
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        log_error "无法检测操作系统版本"
        exit 1
    fi
    
    log_info "检测到操作系统: $OS $VER"
}

# 检查系统要求
check_requirements() {
    log_step "检查系统要求..."
    
    # 检查内存
    MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
    if [[ $MEMORY_GB -lt 1 ]]; then
        log_warn "系统内存少于1GB，可能影响性能"
    fi
    
    # 检查磁盘空间
    DISK_GB=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    if [[ $DISK_GB -lt 10 ]]; then
        log_error "可用磁盘空间少于10GB，无法继续部署"
        exit 1
    fi
    
    log_info "系统要求检查通过"
}

# 创建应用用户
create_app_user() {
    log_step "创建应用用户..."
    
    if ! id "wlbj" &>/dev/null; then
        useradd -r -s /bin/bash -d /opt/wlbj -m wlbj
        log_info "已创建用户: wlbj"
    else
        log_info "用户 wlbj 已存在"
    fi
}

# 安装系统依赖
install_dependencies() {
    log_step "安装系统依赖..."
    
    # 更新包管理器
    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y curl wget git nginx ufw fail2ban logrotate
    elif command -v yum &> /dev/null; then
        yum update -y
        yum install -y curl wget git nginx firewalld fail2ban logrotate
    else
        log_error "不支持的包管理器"
        exit 1
    fi
    
    log_info "系统依赖安装完成"
}

# 安装Node.js
install_nodejs() {
    log_step "安装Node.js..."
    
    if ! command -v node &> /dev/null; then
        # 安装NodeSource仓库
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
    
    NODE_VERSION=$(node --version)
    log_info "Node.js版本: $NODE_VERSION"
    
    # 安装PM2
    npm install -g pm2
    log_info "PM2已安装"
}

# 安装Redis (可选)
install_redis() {
    log_step "安装Redis缓存服务..."
    
    read -p "是否安装Redis缓存服务? (y/N): " install_redis_choice
    if [[ $install_redis_choice =~ ^[Yy]$ ]]; then
        if command -v apt-get &> /dev/null; then
            apt-get install -y redis-server
        elif command -v yum &> /dev/null; then
            yum install -y redis
        fi
        
        systemctl enable redis
        systemctl start redis
        log_info "Redis已安装并启动"
    else
        log_info "跳过Redis安装"
    fi
}

# 配置防火墙
setup_firewall() {
    log_step "配置防火墙..."
    
    if command -v ufw &> /dev/null; then
        ufw --force reset
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw --force enable
    elif command -v firewall-cmd &> /dev/null; then
        systemctl enable firewalld
        systemctl start firewalld
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
    fi
    
    log_info "防火墙配置完成"
}

# 部署应用
deploy_application() {
    log_step "部署应用..."

    # 切换到应用目录
    cd /opt/wlbj

    # 如果是首次部署，克隆代码
    if [[ ! -d ".git" ]]; then
        log_info "克隆应用代码..."
        git clone https://github.com/c1767673917/wlbj.git .
        chown -R wlbj:wlbj /opt/wlbj
    fi

    # 切换到wlbj用户执行后续操作
    sudo -u wlbj bash << 'EOF'
        cd /opt/wlbj

        # 安装后端依赖
        npm install --production

        # 安装前端依赖并构建
        cd frontend
        npm install
        npm run build
        cd ..

        # 创建必要的目录
        mkdir -p logs data

        # 设置环境变量
        if [[ ! -f .env ]]; then
            cp env.example .env
            echo "请编辑 .env 文件配置必要的环境变量"
        fi
EOF

    log_info "应用部署完成"
}

# 处理数据库迁移
handle_database_migration() {
    log_step "处理数据库迁移..."

    # 检查是否存在Mac ARM创建的数据库
    if [[ -f "/opt/wlbj/data/logistics.db" ]]; then
        log_info "检测到现有数据库，检查是否需要迁移..."

        # 检查系统架构
        CURRENT_ARCH=$(uname -m)
        if [[ "$CURRENT_ARCH" == "x86_64" ]]; then
            log_warn "检测到x86_64架构，建议执行数据库迁移以确保兼容性"

            read -p "是否执行数据库迁移? (推荐) (Y/n): " migrate_choice
            if [[ ! $migrate_choice =~ ^[Nn]$ ]]; then
                log_info "执行数据库迁移..."
                if [[ -f "/opt/wlbj/deploy/migrate-database.sh" ]]; then
                    /opt/wlbj/deploy/migrate-database.sh -f
                    log_info "数据库迁移完成"
                else
                    log_warn "迁移脚本不存在，跳过迁移"
                fi
            else
                log_info "跳过数据库迁移"
            fi
        else
            log_info "当前架构为 $CURRENT_ARCH，无需迁移"
        fi
    else
        log_info "未检测到现有数据库，将创建新数据库"

        # 初始化新数据库
        sudo -u wlbj bash << 'EOF'
            cd /opt/wlbj
            node -e "require('./db/database')"
EOF
        log_info "新数据库初始化完成"
    fi
}

# 配置Nginx
setup_nginx() {
    log_step "配置Nginx..."
    
    # 创建Nginx配置
    cat > /etc/nginx/sites-available/wlbj << 'EOF'
server {
    listen 80;
    server_name _;
    
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
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 主应用
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
    
    # 启用站点
    ln -sf /etc/nginx/sites-available/wlbj /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # 测试配置
    nginx -t
    systemctl enable nginx
    systemctl restart nginx
    
    log_info "Nginx配置完成"
}

# 配置PM2
setup_pm2() {
    log_step "配置PM2进程管理..."
    
    # 创建PM2配置文件
    sudo -u wlbj cat > /opt/wlbj/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'wlbj-app',
    script: 'app.js',
    cwd: '/opt/wlbj',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/opt/wlbj/logs/pm2-error.log',
    out_file: '/opt/wlbj/logs/pm2-out.log',
    log_file: '/opt/wlbj/logs/pm2-combined.log',
    time: true,
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512'
  }]
};
EOF
    
    # 启动应用
    sudo -u wlbj bash << 'EOF'
        cd /opt/wlbj
        pm2 start ecosystem.config.js
        pm2 save
EOF
    
    # 设置PM2开机自启
    pm2 startup systemd -u wlbj --hp /opt/wlbj
    
    log_info "PM2配置完成"
}

# 主函数
main() {
    log_info "开始部署物流报价系统到Linux生产环境..."
    
    check_root
    detect_os
    check_requirements
    create_app_user
    install_dependencies
    install_nodejs
    install_redis
    setup_firewall
    deploy_application
    handle_database_migration
    setup_nginx
    setup_pm2
    
    log_info "部署完成！"
    log_info "请访问 http://$(hostname -I | awk '{print $1}') 查看应用"
    log_warn "建议配置SSL证书: sudo ./deploy/setup-ssl.sh"
    log_warn "请编辑 /opt/wlbj/.env 文件配置必要的环境变量"
}

# 执行主函数
main "$@"
