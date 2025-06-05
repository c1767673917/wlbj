#!/bin/bash

# 物流报价系统备份监控脚本
# 监控备份状态、存储空间、云端同步等

# =============================================================================
# 配置区域
# =============================================================================

APP_NAME="wlbj-logistics"
APP_DIR="/path/to/your/wlbj"  # 替换为实际路径
BACKUP_ROOT="/backup"
LOG_FILE="/var/log/backup-monitor-${APP_NAME}.log"

# 告警阈值
DISK_USAGE_THRESHOLD=80        # 磁盘使用率告警阈值 (%)
BACKUP_AGE_THRESHOLD=24        # 备份文件最大年龄 (小时)
MIN_BACKUP_COUNT=3             # 最少备份文件数量

# 企业微信告警配置
WECHAT_WEBHOOK_URL=""          # 企业微信群机器人Webhook URL
ALERT_ENABLED=true             # 是否启用告警

# =============================================================================
# 工具函数
# =============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 发送企业微信告警
send_wechat_alert() {
    local message="$1"
    local level="$2"  # info, warning, error
    
    if [ "$ALERT_ENABLED" != true ] || [ -z "$WECHAT_WEBHOOK_URL" ]; then
        return
    fi
    
    local emoji
    case $level in
        "error") emoji="🚨" ;;
        "warning") emoji="⚠️" ;;
        *) emoji="ℹ️" ;;
    esac
    
    local full_message="${emoji} 【物流报价系统备份监控】\n\n${message}\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')"
    
    curl -s -X POST "$WECHAT_WEBHOOK_URL" \
         -H 'Content-Type: application/json' \
         -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$full_message\"}}" \
         > /dev/null 2>&1
}

# 格式化字节大小
format_bytes() {
    local bytes=$1
    local units=("B" "KB" "MB" "GB" "TB")
    local unit=0
    
    while [ $bytes -gt 1024 ] && [ $unit -lt 4 ]; do
        bytes=$((bytes / 1024))
        unit=$((unit + 1))
    done
    
    echo "${bytes}${units[$unit]}"
}

# =============================================================================
# 监控函数
# =============================================================================

# 检查磁盘空间
check_disk_space() {
    log "💾 检查磁盘空间..."
    
    local backup_disk_usage=$(df "$BACKUP_ROOT" | awk 'NR==2 {print $5}' | sed 's/%//')
    local app_disk_usage=$(df "$APP_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    log "📊 备份目录磁盘使用率: ${backup_disk_usage}%"
    log "📊 应用目录磁盘使用率: ${app_disk_usage}%"
    
    # 检查备份目录磁盘使用率
    if [ "$backup_disk_usage" -gt "$DISK_USAGE_THRESHOLD" ]; then
        local message="备份目录磁盘使用率过高: ${backup_disk_usage}%\n路径: $BACKUP_ROOT\n建议清理旧备份文件"
        log "⚠️  $message"
        send_wechat_alert "$message" "warning"
    fi
    
    # 检查应用目录磁盘使用率
    if [ "$app_disk_usage" -gt "$DISK_USAGE_THRESHOLD" ]; then
        local message="应用目录磁盘使用率过高: ${app_disk_usage}%\n路径: $APP_DIR\n建议清理日志文件"
        log "⚠️  $message"
        send_wechat_alert "$message" "warning"
    fi
}

# 检查备份文件状态
check_backup_files() {
    log "📁 检查备份文件状态..."
    
    local backup_dir="$BACKUP_ROOT/$APP_NAME"
    
    if [ ! -d "$backup_dir" ]; then
        local message="备份目录不存在: $backup_dir"
        log "❌ $message"
        send_wechat_alert "$message" "error"
        return 1
    fi
    
    # 统计备份文件
    local backup_count=$(ls -1 "$backup_dir" | grep "^20" | wc -l)
    log "📊 备份文件数量: $backup_count"
    
    if [ "$backup_count" -lt "$MIN_BACKUP_COUNT" ]; then
        local message="备份文件数量不足: $backup_count (最少需要: $MIN_BACKUP_COUNT)"
        log "⚠️  $message"
        send_wechat_alert "$message" "warning"
    fi
    
    # 检查最新备份时间
    local latest_backup=$(ls -1t "$backup_dir" | grep "^20" | head -1)
    
    if [ -n "$latest_backup" ]; then
        local backup_path="$backup_dir/$latest_backup"
        local backup_time=$(stat -c %Y "$backup_path" 2>/dev/null || stat -f %m "$backup_path" 2>/dev/null)
        local current_time=$(date +%s)
        local age_hours=$(( (current_time - backup_time) / 3600 ))
        
        log "📊 最新备份: $latest_backup (${age_hours}小时前)"
        
        if [ "$age_hours" -gt "$BACKUP_AGE_THRESHOLD" ]; then
            local message="最新备份过期: ${age_hours}小时前\n备份: $latest_backup\n建议检查备份任务"
            log "⚠️  $message"
            send_wechat_alert "$message" "warning"
        fi
        
        # 检查备份完整性
        check_backup_integrity "$backup_path"
    else
        local message="未找到任何备份文件"
        log "❌ $message"
        send_wechat_alert "$message" "error"
    fi
}

# 检查备份完整性
check_backup_integrity() {
    local backup_path="$1"
    
    log "🔍 检查备份完整性: $(basename "$backup_path")"
    
    local issues=()
    
    # 检查数据库备份
    if [ ! -d "$backup_path/database" ]; then
        issues+=("缺少数据库备份目录")
    else
        local db_files=$(find "$backup_path/database" -name "*.db.gz" | wc -l)
        if [ "$db_files" -eq 0 ]; then
            issues+=("数据库备份文件缺失")
        fi
    fi
    
    # 检查配置备份
    if [ ! -d "$backup_path/configs" ]; then
        issues+=("缺少配置备份目录")
    fi
    
    # 检查日志备份
    if [ ! -d "$backup_path/logs" ]; then
        issues+=("缺少日志备份目录")
    fi
    
    if [ ${#issues[@]} -gt 0 ]; then
        local message="备份完整性检查失败:\n$(printf '%s\n' "${issues[@]}")"
        log "❌ $message"
        send_wechat_alert "$message" "error"
        return 1
    else
        log "✅ 备份完整性检查通过"
        return 0
    fi
}

# 检查数据库状态
check_database_status() {
    log "🗄️  检查数据库状态..."
    
    local db_path="$APP_DIR/data/logistics.db"
    
    if [ ! -f "$db_path" ]; then
        local message="数据库文件不存在: $db_path"
        log "❌ $message"
        send_wechat_alert "$message" "error"
        return 1
    fi
    
    # 检查数据库大小
    local db_size=$(stat -c%s "$db_path" 2>/dev/null || stat -f%z "$db_path" 2>/dev/null)
    local db_size_formatted=$(format_bytes "$db_size")
    log "📊 数据库大小: $db_size_formatted"
    
    # 检查数据库完整性
    if command -v sqlite3 &> /dev/null; then
        local integrity_result=$(sqlite3 "$db_path" "PRAGMA integrity_check;" 2>/dev/null)
        
        if echo "$integrity_result" | grep -q "ok"; then
            log "✅ 数据库完整性检查通过"
        else
            local message="数据库完整性检查失败\n结果: $integrity_result"
            log "❌ $message"
            send_wechat_alert "$message" "error"
        fi
        
        # 检查表数量
        local table_count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null)
        log "📊 数据库表数量: $table_count"
        
        # 检查记录数量
        local order_count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM orders;" 2>/dev/null)
        local quote_count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM quotes;" 2>/dev/null)
        log "📊 订单数量: $order_count, 报价数量: $quote_count"
    else
        log "⚠️  sqlite3命令不可用，跳过数据库详细检查"
    fi
}

# 检查应用服务状态
check_service_status() {
    log "🔧 检查应用服务状态..."
    
    # 检查PM2进程
    if command -v pm2 &> /dev/null; then
        local pm2_status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.status" 2>/dev/null)
        
        if [ "$pm2_status" = "online" ]; then
            log "✅ PM2服务运行正常"
        elif [ -n "$pm2_status" ]; then
            local message="PM2服务状态异常: $pm2_status"
            log "⚠️  $message"
            send_wechat_alert "$message" "warning"
        else
            log "ℹ️  PM2中未找到应用进程"
        fi
    fi
    
    # 检查端口监听
    local port=3000
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        log "✅ 应用端口 $port 正在监听"
    else
        local message="应用端口 $port 未在监听"
        log "⚠️  $message"
        send_wechat_alert "$message" "warning"
    fi
    
    # 检查日志文件
    local log_dir="$APP_DIR/logs"
    if [ -d "$log_dir" ]; then
        local error_count=$(grep -c "ERROR\|Error\|error" "$log_dir/error.log" 2>/dev/null || echo "0")
        log "📊 错误日志数量: $error_count"
        
        if [ "$error_count" -gt 10 ]; then
            local message="错误日志数量过多: $error_count\n建议检查应用状态"
            log "⚠️  $message"
            send_wechat_alert "$message" "warning"
        fi
    fi
}

# 生成监控报告
generate_report() {
    log "📊 生成监控报告..."
    
    local report_file="/tmp/backup-monitor-report-$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "物流报价系统备份监控报告"
        echo "生成时间: $(date)"
        echo "========================================"
        echo ""
        
        echo "📁 备份状态:"
        local backup_count=$(ls -1 "$BACKUP_ROOT/$APP_NAME" 2>/dev/null | grep "^20" | wc -l)
        echo "  备份文件数量: $backup_count"
        
        local latest_backup=$(ls -1t "$BACKUP_ROOT/$APP_NAME" 2>/dev/null | grep "^20" | head -1)
        if [ -n "$latest_backup" ]; then
            echo "  最新备份: $latest_backup"
        fi
        
        echo ""
        echo "💾 磁盘使用:"
        df -h "$BACKUP_ROOT" | tail -1
        df -h "$APP_DIR" | tail -1
        
        echo ""
        echo "🗄️  数据库状态:"
        if [ -f "$APP_DIR/data/logistics.db" ]; then
            local db_size=$(stat -c%s "$APP_DIR/data/logistics.db" 2>/dev/null || stat -f%z "$APP_DIR/data/logistics.db" 2>/dev/null)
            echo "  数据库大小: $(format_bytes "$db_size")"
        fi
        
        echo ""
        echo "🔧 服务状态:"
        if command -v pm2 &> /dev/null; then
            pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$APP_NAME\") | \"  PM2状态: \" + .pm2_env.status" 2>/dev/null || echo "  PM2状态: 未知"
        fi
        
    } > "$report_file"
    
    log "📄 监控报告已生成: $report_file"
    
    # 可选：发送报告到企业微信
    if [ "$ALERT_ENABLED" = true ] && [ -n "$WECHAT_WEBHOOK_URL" ]; then
        local report_summary=$(head -20 "$report_file" | tail -10)
        send_wechat_alert "监控报告摘要:\n$report_summary" "info"
    fi
}

# =============================================================================
# 主函数
# =============================================================================

main() {
    log "🚀 开始执行备份监控检查"
    
    # 执行各项检查
    check_disk_space
    check_backup_files
    check_database_status
    check_service_status
    
    # 生成报告
    generate_report
    
    log "✅ 备份监控检查完成"
}

# 检查是否以cron方式运行
if [ "$1" = "--cron" ]; then
    # Cron模式：只在有问题时输出
    main 2>&1 | grep -E "(❌|⚠️|ERROR|WARNING)" || true
else
    # 交互模式：显示所有输出
    main
fi
