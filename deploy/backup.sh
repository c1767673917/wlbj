#!/bin/bash

# 自动备份脚本 - 数据库、配置文件和代码备份
# 支持本地备份和远程备份

set -e

# 配置变量
BACKUP_DIR="/opt/backups/wlbj"
APP_DIR="/opt/wlbj"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

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

# 创建备份目录
create_backup_dir() {
    log_step "创建备份目录..."
    
    mkdir -p "$BACKUP_DIR"/{database,config,logs,code}
    
    log_info "备份目录已创建: $BACKUP_DIR"
}

# 备份数据库
backup_database() {
    log_step "备份数据库..."
    
    if [[ -f "$APP_DIR/data/logistics.db" ]]; then
        # SQLite数据库备份
        cp "$APP_DIR/data/logistics.db" "$BACKUP_DIR/database/logistics_$DATE.db"
        
        # 压缩备份
        gzip "$BACKUP_DIR/database/logistics_$DATE.db"
        
        log_info "数据库备份完成: logistics_$DATE.db.gz"
    else
        log_warn "数据库文件不存在，跳过备份"
    fi
}

# 备份配置文件
backup_config() {
    log_step "备份配置文件..."
    
    CONFIG_BACKUP_DIR="$BACKUP_DIR/config/config_$DATE"
    mkdir -p "$CONFIG_BACKUP_DIR"
    
    # 备份应用配置
    if [[ -f "$APP_DIR/.env" ]]; then
        cp "$APP_DIR/.env" "$CONFIG_BACKUP_DIR/"
    fi
    
    if [[ -f "$APP_DIR/auth_config.json" ]]; then
        cp "$APP_DIR/auth_config.json" "$CONFIG_BACKUP_DIR/"
    fi
    
    if [[ -f "$APP_DIR/ip_whitelist.json" ]]; then
        cp "$APP_DIR/ip_whitelist.json" "$CONFIG_BACKUP_DIR/"
    fi
    
    if [[ -f "$APP_DIR/ecosystem.config.js" ]]; then
        cp "$APP_DIR/ecosystem.config.js" "$CONFIG_BACKUP_DIR/"
    fi
    
    # 备份Nginx配置
    if [[ -f "/etc/nginx/sites-available/wlbj" ]]; then
        cp "/etc/nginx/sites-available/wlbj" "$CONFIG_BACKUP_DIR/nginx_wlbj.conf"
    fi
    
    # 备份SSL证书信息
    if [[ -d "/etc/letsencrypt/live" ]]; then
        cp -r "/etc/letsencrypt/live" "$CONFIG_BACKUP_DIR/" 2>/dev/null || true
    fi
    
    # 压缩配置备份
    tar -czf "$BACKUP_DIR/config/config_$DATE.tar.gz" -C "$BACKUP_DIR/config" "config_$DATE"
    rm -rf "$CONFIG_BACKUP_DIR"
    
    log_info "配置文件备份完成: config_$DATE.tar.gz"
}

# 备份日志文件
backup_logs() {
    log_step "备份日志文件..."
    
    if [[ -d "$APP_DIR/logs" ]]; then
        tar -czf "$BACKUP_DIR/logs/logs_$DATE.tar.gz" -C "$APP_DIR" logs/
        log_info "日志文件备份完成: logs_$DATE.tar.gz"
    else
        log_warn "日志目录不存在，跳过备份"
    fi
}

# 备份代码
backup_code() {
    log_step "备份应用代码..."
    
    cd "$APP_DIR"
    
    # 获取Git信息
    if [[ -d ".git" ]]; then
        GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
        GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
        
        echo "Git Commit: $GIT_COMMIT" > "$BACKUP_DIR/code/git_info_$DATE.txt"
        echo "Git Branch: $GIT_BRANCH" >> "$BACKUP_DIR/code/git_info_$DATE.txt"
        echo "Backup Date: $(date)" >> "$BACKUP_DIR/code/git_info_$DATE.txt"
    fi
    
    # 创建代码备份（排除node_modules和其他不必要文件）
    tar --exclude='node_modules' \
        --exclude='frontend/node_modules' \
        --exclude='frontend/dist' \
        --exclude='.git' \
        --exclude='logs' \
        --exclude='data' \
        -czf "$BACKUP_DIR/code/code_$DATE.tar.gz" \
        -C "$(dirname $APP_DIR)" \
        "$(basename $APP_DIR)"
    
    log_info "代码备份完成: code_$DATE.tar.gz"
}

# 清理旧备份
cleanup_old_backups() {
    log_step "清理旧备份文件..."
    
    # 清理超过保留期的备份
    find "$BACKUP_DIR" -type f -name "*.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -type f -name "*.txt" -mtime +$RETENTION_DAYS -delete
    
    # 清理空目录
    find "$BACKUP_DIR" -type d -empty -delete 2>/dev/null || true
    
    log_info "已清理超过 $RETENTION_DAYS 天的旧备份"
}

# 生成备份报告
generate_report() {
    log_step "生成备份报告..."
    
    REPORT_FILE="$BACKUP_DIR/backup_report_$DATE.txt"
    
    cat > "$REPORT_FILE" << EOF
物流报价系统备份报告
==================

备份时间: $(date)
备份目录: $BACKUP_DIR
保留天数: $RETENTION_DAYS 天

备份文件:
$(find "$BACKUP_DIR" -name "*$DATE*" -type f -exec ls -lh {} \;)

磁盘使用情况:
$(df -h "$BACKUP_DIR")

备份目录大小:
$(du -sh "$BACKUP_DIR")

系统信息:
- 主机名: $(hostname)
- 操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
- 内核版本: $(uname -r)
- 负载平均: $(uptime | awk -F'load average:' '{print $2}')

应用状态:
$(pm2 list 2>/dev/null || echo "PM2未运行")

备份完成状态: 成功
EOF
    
    log_info "备份报告已生成: $REPORT_FILE"
}

# 发送备份通知 (可选)
send_notification() {
    log_step "发送备份通知..."
    
    # 检查是否配置了邮件通知
    if command -v mail &> /dev/null && [[ -n "$BACKUP_EMAIL" ]]; then
        SUBJECT="物流报价系统备份完成 - $(date +%Y-%m-%d)"
        mail -s "$SUBJECT" "$BACKUP_EMAIL" < "$BACKUP_DIR/backup_report_$DATE.txt"
        log_info "备份通知已发送到: $BACKUP_EMAIL"
    else
        log_info "未配置邮件通知，跳过发送"
    fi
}

# 验证备份完整性
verify_backup() {
    log_step "验证备份完整性..."
    
    # 检查数据库备份
    if [[ -f "$BACKUP_DIR/database/logistics_$DATE.db.gz" ]]; then
        if gzip -t "$BACKUP_DIR/database/logistics_$DATE.db.gz"; then
            log_info "数据库备份文件完整性验证通过"
        else
            log_error "数据库备份文件损坏"
            return 1
        fi
    fi
    
    # 检查配置备份
    if [[ -f "$BACKUP_DIR/config/config_$DATE.tar.gz" ]]; then
        if tar -tzf "$BACKUP_DIR/config/config_$DATE.tar.gz" >/dev/null; then
            log_info "配置文件备份完整性验证通过"
        else
            log_error "配置文件备份损坏"
            return 1
        fi
    fi
    
    # 检查代码备份
    if [[ -f "$BACKUP_DIR/code/code_$DATE.tar.gz" ]]; then
        if tar -tzf "$BACKUP_DIR/code/code_$DATE.tar.gz" >/dev/null; then
            log_info "代码备份完整性验证通过"
        else
            log_error "代码备份损坏"
            return 1
        fi
    fi
    
    log_info "所有备份文件完整性验证通过"
}

# 显示使用帮助
show_help() {
    cat << EOF
物流报价系统备份脚本

用法: $0 [选项]

选项:
  -h, --help          显示此帮助信息
  -d, --dir DIR       指定备份目录 (默认: /opt/backups/wlbj)
  -r, --retention N   设置备份保留天数 (默认: 30)
  -e, --email EMAIL   设置备份通知邮箱
  --database-only     仅备份数据库
  --config-only       仅备份配置文件
  --verify-only       仅验证现有备份

示例:
  $0                                    # 完整备份
  $0 -d /backup/wlbj -r 7              # 自定义目录和保留期
  $0 -e admin@example.com              # 启用邮件通知
  $0 --database-only                   # 仅备份数据库

EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            -r|--retention)
                RETENTION_DAYS="$2"
                shift 2
                ;;
            -e|--email)
                BACKUP_EMAIL="$2"
                shift 2
                ;;
            --database-only)
                DATABASE_ONLY=true
                shift
                ;;
            --config-only)
                CONFIG_ONLY=true
                shift
                ;;
            --verify-only)
                VERIFY_ONLY=true
                shift
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
    log_info "开始执行备份任务..."
    
    parse_args "$@"
    
    if [[ "$VERIFY_ONLY" == "true" ]]; then
        verify_backup
        exit 0
    fi
    
    create_backup_dir
    
    if [[ "$DATABASE_ONLY" == "true" ]]; then
        backup_database
    elif [[ "$CONFIG_ONLY" == "true" ]]; then
        backup_config
    else
        backup_database
        backup_config
        backup_logs
        backup_code
    fi
    
    cleanup_old_backups
    generate_report
    verify_backup
    send_notification
    
    log_info "备份任务完成！"
    log_info "备份位置: $BACKUP_DIR"
}

# 执行主函数
main "$@"
