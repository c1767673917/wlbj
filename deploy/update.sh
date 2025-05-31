#!/bin/bash

# 零停机更新脚本 - 支持从GitHub自动更新应用
# 包含回滚机制和安全检查

set -e

# 配置变量
APP_DIR="/opt/wlbj"
BACKUP_DIR="/opt/backups/wlbj/updates"
APP_USER="wlbj"
APP_NAME="wlbj-app"
HEALTH_CHECK_URL="http://localhost:3000"
HEALTH_CHECK_TIMEOUT=30

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

# 检查权限
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行"
        exit 1
    fi
}

# 检查应用状态
check_app_health() {
    local timeout=${1:-$HEALTH_CHECK_TIMEOUT}
    local count=0
    
    while [[ $count -lt $timeout ]]; do
        if curl -s -f "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        ((count++))
    done
    
    return 1
}

# 创建备份
create_backup() {
    log_step "创建更新前备份..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/backup_$timestamp"
    
    mkdir -p "$backup_path"
    
    # 备份当前代码
    cd "$APP_DIR"
    tar --exclude='node_modules' \
        --exclude='frontend/node_modules' \
        --exclude='frontend/dist' \
        --exclude='logs' \
        --exclude='data' \
        -czf "$backup_path/code.tar.gz" .
    
    # 备份数据库
    if [[ -f "data/logistics.db" ]]; then
        cp "data/logistics.db" "$backup_path/"
    fi
    
    # 备份配置文件
    cp .env "$backup_path/" 2>/dev/null || true
    cp auth_config.json "$backup_path/" 2>/dev/null || true
    cp ip_whitelist.json "$backup_path/" 2>/dev/null || true
    
    # 记录Git信息
    git rev-parse HEAD > "$backup_path/git_commit.txt" 2>/dev/null || echo "unknown" > "$backup_path/git_commit.txt"
    git rev-parse --abbrev-ref HEAD > "$backup_path/git_branch.txt" 2>/dev/null || echo "unknown" > "$backup_path/git_branch.txt"
    
    echo "$backup_path" > /tmp/wlbj_last_backup
    log_info "备份已创建: $backup_path"
}

# 拉取最新代码
pull_latest_code() {
    log_step "拉取最新代码..."
    
    cd "$APP_DIR"
    
    # 检查Git状态
    if [[ ! -d ".git" ]]; then
        log_error "不是Git仓库，无法更新"
        exit 1
    fi
    
    # 保存本地修改
    git stash push -m "Auto stash before update $(date)"
    
    # 拉取最新代码
    git fetch origin
    
    # 获取当前分支
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    
    # 更新代码
    git reset --hard "origin/$current_branch"
    
    log_info "代码更新完成"
}

# 安装依赖
install_dependencies() {
    log_step "安装/更新依赖..."
    
    cd "$APP_DIR"
    
    # 切换到应用用户
    sudo -u "$APP_USER" bash << 'EOF'
        cd /opt/wlbj
        
        # 更新后端依赖
        npm install --production
        
        # 更新前端依赖并构建
        cd frontend
        npm install
        npm run build
        cd ..
EOF
    
    log_info "依赖安装完成"
}

# 运行数据库迁移 (如果需要)
run_migrations() {
    log_step "检查数据库迁移..."
    
    # 这里可以添加数据库迁移逻辑
    # 例如运行SQL脚本或Node.js迁移脚本
    
    log_info "数据库检查完成"
}

# 重启应用
restart_application() {
    log_step "重启应用..."
    
    # 使用PM2的reload功能实现零停机重启
    sudo -u "$APP_USER" pm2 reload "$APP_NAME"
    
    # 等待应用启动
    sleep 5
    
    log_info "应用重启完成"
}

# 验证更新
verify_update() {
    log_step "验证更新..."
    
    # 健康检查
    if check_app_health; then
        log_info "应用健康检查通过"
    else
        log_error "应用健康检查失败"
        return 1
    fi
    
    # 检查关键功能
    if curl -s -f "$HEALTH_CHECK_URL/api/orders" >/dev/null 2>&1; then
        log_info "API功能检查通过"
    else
        log_warn "API功能检查失败"
    fi
    
    # 检查前端资源
    if curl -s -f "$HEALTH_CHECK_URL/assets/" >/dev/null 2>&1; then
        log_info "前端资源检查通过"
    else
        log_warn "前端资源检查失败"
    fi
    
    log_info "更新验证完成"
}

# 回滚
rollback() {
    log_step "执行回滚..."
    
    local backup_path
    if [[ -f "/tmp/wlbj_last_backup" ]]; then
        backup_path=$(cat /tmp/wlbj_last_backup)
    else
        log_error "找不到备份路径"
        exit 1
    fi
    
    if [[ ! -d "$backup_path" ]]; then
        log_error "备份目录不存在: $backup_path"
        exit 1
    fi
    
    cd "$APP_DIR"
    
    # 恢复代码
    tar -xzf "$backup_path/code.tar.gz" -C .
    
    # 恢复数据库
    if [[ -f "$backup_path/logistics.db" ]]; then
        cp "$backup_path/logistics.db" "data/"
    fi
    
    # 恢复配置文件
    cp "$backup_path/.env" . 2>/dev/null || true
    cp "$backup_path/auth_config.json" . 2>/dev/null || true
    cp "$backup_path/ip_whitelist.json" . 2>/dev/null || true
    
    # 重新安装依赖
    sudo -u "$APP_USER" bash << 'EOF'
        cd /opt/wlbj
        npm install --production
        cd frontend
        npm install
        npm run build
        cd ..
EOF
    
    # 重启应用
    sudo -u "$APP_USER" pm2 reload "$APP_NAME"
    
    # 验证回滚
    if check_app_health; then
        log_info "回滚成功"
    else
        log_error "回滚失败"
        exit 1
    fi
}

# 清理旧备份
cleanup_old_backups() {
    log_step "清理旧备份..."
    
    # 保留最近10个备份
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" | sort -r | tail -n +11 | xargs rm -rf
    
    log_info "旧备份清理完成"
}

# 发送更新通知
send_notification() {
    local status="$1"
    local message="$2"
    
    # 这里可以添加邮件或Webhook通知
    log_info "更新通知: $status - $message"
}

# 显示使用帮助
show_help() {
    cat << EOF
物流报价系统更新脚本

用法: $0 [选项]

选项:
  -h, --help          显示此帮助信息
  -f, --force         强制更新，跳过确认
  -r, --rollback      回滚到上一个版本
  --no-backup         跳过备份步骤
  --check-only        仅检查更新，不执行
  --branch BRANCH     指定更新分支 (默认: 当前分支)

示例:
  $0                  # 标准更新流程
  $0 -f               # 强制更新
  $0 -r               # 回滚到上一版本
  $0 --check-only     # 检查是否有更新

EOF
}

# 检查更新
check_for_updates() {
    log_step "检查更新..."
    
    cd "$APP_DIR"
    
    git fetch origin
    
    local current_commit=$(git rev-parse HEAD)
    local remote_commit=$(git rev-parse origin/$(git rev-parse --abbrev-ref HEAD))
    
    if [[ "$current_commit" == "$remote_commit" ]]; then
        log_info "已是最新版本"
        return 1
    else
        log_info "发现新版本"
        log_info "当前版本: ${current_commit:0:8}"
        log_info "最新版本: ${remote_commit:0:8}"
        return 0
    fi
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -f|--force)
                FORCE_UPDATE=true
                shift
                ;;
            -r|--rollback)
                ROLLBACK_MODE=true
                shift
                ;;
            --no-backup)
                NO_BACKUP=true
                shift
                ;;
            --check-only)
                CHECK_ONLY=true
                shift
                ;;
            --branch)
                TARGET_BRANCH="$2"
                shift 2
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 主函数
main() {
    log_info "开始更新物流报价系统..."
    
    parse_args "$@"
    check_permissions
    
    # 创建备份目录
    mkdir -p "$BACKUP_DIR"
    
    if [[ "$ROLLBACK_MODE" == "true" ]]; then
        rollback
        send_notification "SUCCESS" "系统已回滚到上一版本"
        exit 0
    fi
    
    if [[ "$CHECK_ONLY" == "true" ]]; then
        check_for_updates
        exit $?
    fi
    
    # 检查是否有更新
    if ! check_for_updates && [[ "$FORCE_UPDATE" != "true" ]]; then
        exit 0
    fi
    
    # 确认更新
    if [[ "$FORCE_UPDATE" != "true" ]]; then
        read -p "确认执行更新? (y/N): " confirm
        if [[ ! $confirm =~ ^[Yy]$ ]]; then
            log_info "更新已取消"
            exit 0
        fi
    fi
    
    # 执行更新流程
    if [[ "$NO_BACKUP" != "true" ]]; then
        create_backup
    fi
    
    pull_latest_code
    install_dependencies
    run_migrations
    restart_application
    
    # 验证更新
    if verify_update; then
        cleanup_old_backups
        send_notification "SUCCESS" "系统更新成功"
        log_info "更新完成！"
    else
        log_error "更新验证失败，开始回滚..."
        rollback
        send_notification "FAILED" "系统更新失败，已自动回滚"
        exit 1
    fi
}

# 执行主函数
main "$@"
