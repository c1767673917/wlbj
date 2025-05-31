#!/bin/bash

# 系统监控脚本 - 监控应用状态、系统资源和服务健康
# 支持告警通知和自动恢复

set -e

# 配置变量
APP_NAME="wlbj-app"
APP_URL="http://localhost:3000"
LOG_FILE="/var/log/wlbj/monitor.log"
ALERT_EMAIL=""
ALERT_WEBHOOK=""
CHECK_INTERVAL=60  # 检查间隔(秒)

# 阈值配置
CPU_THRESHOLD=80
MEMORY_THRESHOLD=80
DISK_THRESHOLD=85
LOAD_THRESHOLD=2.0

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
    echo -e "${GREEN}$msg${NC}"
    echo "$msg" >> "$LOG_FILE"
}

log_warn() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $1"
    echo -e "${YELLOW}$msg${NC}"
    echo "$msg" >> "$LOG_FILE"
}

log_error() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1"
    echo -e "${RED}$msg${NC}"
    echo "$msg" >> "$LOG_FILE"
}

log_step() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [STEP] $1"
    echo -e "${BLUE}$msg${NC}"
    echo "$msg" >> "$LOG_FILE"
}

# 创建日志目录
create_log_dir() {
    mkdir -p "$(dirname "$LOG_FILE")"
}

# 检查应用状态
check_app_status() {
    log_step "检查应用状态..."
    
    # 检查PM2进程
    if ! pm2 list | grep -q "$APP_NAME.*online"; then
        log_error "应用进程未运行"
        return 1
    fi
    
    # 检查HTTP响应
    if ! curl -s -f "$APP_URL" >/dev/null; then
        log_error "应用HTTP检查失败"
        return 1
    fi
    
    # 检查API健康
    if ! curl -s -f "$APP_URL/api/health" >/dev/null 2>&1; then
        log_warn "API健康检查失败"
    fi
    
    log_info "应用状态正常"
    return 0
}

# 检查系统资源
check_system_resources() {
    log_step "检查系统资源..."
    
    # CPU使用率
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    if (( $(echo "$CPU_USAGE > $CPU_THRESHOLD" | bc -l) )); then
        log_warn "CPU使用率过高: ${CPU_USAGE}%"
    fi
    
    # 内存使用率
    MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    if (( $(echo "$MEMORY_USAGE > $MEMORY_THRESHOLD" | bc -l) )); then
        log_warn "内存使用率过高: ${MEMORY_USAGE}%"
    fi
    
    # 磁盘使用率
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ $DISK_USAGE -gt $DISK_THRESHOLD ]]; then
        log_warn "磁盘使用率过高: ${DISK_USAGE}%"
    fi
    
    # 系统负载
    LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    if (( $(echo "$LOAD_AVG > $LOAD_THRESHOLD" | bc -l) )); then
        log_warn "系统负载过高: $LOAD_AVG"
    fi
    
    log_info "系统资源检查完成 - CPU: ${CPU_USAGE}%, 内存: ${MEMORY_USAGE}%, 磁盘: ${DISK_USAGE}%, 负载: $LOAD_AVG"
}

# 检查服务状态
check_services() {
    log_step "检查服务状态..."
    
    # 检查Nginx
    if ! systemctl is-active --quiet nginx; then
        log_error "Nginx服务未运行"
        return 1
    fi
    
    # 检查Redis (如果安装)
    if systemctl list-units --full -all | grep -q redis; then
        if ! systemctl is-active --quiet redis; then
            log_warn "Redis服务未运行"
        fi
    fi
    
    # 检查防火墙
    if command -v ufw &> /dev/null; then
        if ! ufw status | grep -q "Status: active"; then
            log_warn "UFW防火墙未启用"
        fi
    fi
    
    log_info "服务状态检查完成"
}

# 检查数据库
check_database() {
    log_step "检查数据库..."
    
    DB_FILE="/opt/wlbj/data/logistics.db"
    
    if [[ ! -f "$DB_FILE" ]]; then
        log_error "数据库文件不存在"
        return 1
    fi
    
    # 检查数据库文件权限
    if [[ ! -r "$DB_FILE" ]]; then
        log_error "数据库文件无读取权限"
        return 1
    fi
    
    # 检查数据库大小
    DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
    log_info "数据库大小: $DB_SIZE"
    
    # 检查数据库连接 (通过应用API)
    if curl -s -f "$APP_URL/api/health/database" >/dev/null 2>&1; then
        log_info "数据库连接正常"
    else
        log_warn "数据库连接检查失败"
    fi
}

# 检查日志文件
check_logs() {
    log_step "检查日志文件..."
    
    LOG_DIR="/opt/wlbj/logs"
    
    if [[ -d "$LOG_DIR" ]]; then
        # 检查错误日志
        ERROR_COUNT=$(grep -c "ERROR" "$LOG_DIR/error.log" 2>/dev/null || echo "0")
        if [[ $ERROR_COUNT -gt 10 ]]; then
            log_warn "发现 $ERROR_COUNT 个错误日志"
        fi
        
        # 检查日志文件大小
        for log_file in "$LOG_DIR"/*.log; do
            if [[ -f "$log_file" ]]; then
                LOG_SIZE=$(du -m "$log_file" | cut -f1)
                if [[ $LOG_SIZE -gt 100 ]]; then
                    log_warn "日志文件过大: $(basename "$log_file") - ${LOG_SIZE}MB"
                fi
            fi
        done
    fi
    
    log_info "日志文件检查完成"
}

# 自动恢复
auto_recovery() {
    log_step "尝试自动恢复..."
    
    # 重启应用
    if ! check_app_status; then
        log_info "尝试重启应用..."
        pm2 restart "$APP_NAME"
        sleep 10
        
        if check_app_status; then
            log_info "应用重启成功"
            send_alert "应用自动恢复成功" "应用已自动重启并恢复正常"
        else
            log_error "应用重启失败"
            send_alert "应用自动恢复失败" "应用重启后仍无法正常运行，需要人工干预"
        fi
    fi
    
    # 重启Nginx
    if ! systemctl is-active --quiet nginx; then
        log_info "尝试重启Nginx..."
        systemctl restart nginx
        
        if systemctl is-active --quiet nginx; then
            log_info "Nginx重启成功"
        else
            log_error "Nginx重启失败"
        fi
    fi
}

# 发送告警
send_alert() {
    local subject="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 邮件告警
    if [[ -n "$ALERT_EMAIL" ]] && command -v mail &> /dev/null; then
        echo -e "时间: $timestamp\n主机: $(hostname)\n\n$message" | mail -s "[$subject] 物流报价系统告警" "$ALERT_EMAIL"
        log_info "告警邮件已发送到: $ALERT_EMAIL"
    fi
    
    # Webhook告警
    if [[ -n "$ALERT_WEBHOOK" ]]; then
        curl -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"[$subject] $message\nTime: $timestamp\nHost: $(hostname)\"}" \
            >/dev/null 2>&1
        log_info "告警已发送到Webhook"
    fi
}

# 生成监控报告
generate_report() {
    local report_file="/tmp/wlbj_monitor_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
物流报价系统监控报告
==================

生成时间: $(date)
主机名: $(hostname)
操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)

系统资源:
- CPU使用率: ${CPU_USAGE:-N/A}%
- 内存使用率: ${MEMORY_USAGE:-N/A}%
- 磁盘使用率: ${DISK_USAGE:-N/A}%
- 系统负载: ${LOAD_AVG:-N/A}

应用状态:
$(pm2 list 2>/dev/null || echo "PM2未运行")

服务状态:
- Nginx: $(systemctl is-active nginx 2>/dev/null || echo "未知")
- Redis: $(systemctl is-active redis 2>/dev/null || echo "未安装/未运行")

网络连接:
$(netstat -tlnp | grep :3000 || echo "应用端口未监听")

最近错误日志:
$(tail -10 /opt/wlbj/logs/error.log 2>/dev/null || echo "无错误日志")

EOF
    
    echo "$report_file"
}

# 显示使用帮助
show_help() {
    cat << EOF
物流报价系统监控脚本

用法: $0 [选项]

选项:
  -h, --help              显示此帮助信息
  -d, --daemon            以守护进程模式运行
  -i, --interval N        设置检查间隔(秒，默认60)
  -e, --email EMAIL       设置告警邮箱
  -w, --webhook URL       设置告警Webhook
  --cpu-threshold N       CPU使用率告警阈值(默认80%)
  --memory-threshold N    内存使用率告警阈值(默认80%)
  --disk-threshold N      磁盘使用率告警阈值(默认85%)
  --report                生成监控报告
  --check-only            仅执行一次检查

示例:
  $0                                    # 执行一次完整检查
  $0 -d -i 30                          # 守护进程模式，30秒间隔
  $0 -e admin@example.com              # 启用邮件告警
  $0 --report                          # 生成监控报告

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
            -d|--daemon)
                DAEMON_MODE=true
                shift
                ;;
            -i|--interval)
                CHECK_INTERVAL="$2"
                shift 2
                ;;
            -e|--email)
                ALERT_EMAIL="$2"
                shift 2
                ;;
            -w|--webhook)
                ALERT_WEBHOOK="$2"
                shift 2
                ;;
            --cpu-threshold)
                CPU_THRESHOLD="$2"
                shift 2
                ;;
            --memory-threshold)
                MEMORY_THRESHOLD="$2"
                shift 2
                ;;
            --disk-threshold)
                DISK_THRESHOLD="$2"
                shift 2
                ;;
            --report)
                REPORT_ONLY=true
                shift
                ;;
            --check-only)
                CHECK_ONLY=true
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

# 执行监控检查
run_checks() {
    local has_error=false
    
    if ! check_app_status; then
        has_error=true
    fi
    
    check_system_resources
    check_services
    check_database
    check_logs
    
    if [[ "$has_error" == "true" ]]; then
        auto_recovery
    fi
}

# 主函数
main() {
    parse_args "$@"
    create_log_dir
    
    if [[ "$REPORT_ONLY" == "true" ]]; then
        report_file=$(generate_report)
        log_info "监控报告已生成: $report_file"
        cat "$report_file"
        exit 0
    fi
    
    log_info "开始监控物流报价系统..."
    
    if [[ "$DAEMON_MODE" == "true" ]]; then
        log_info "以守护进程模式运行，检查间隔: ${CHECK_INTERVAL}秒"
        while true; do
            run_checks
            sleep "$CHECK_INTERVAL"
        done
    else
        run_checks
        if [[ "$CHECK_ONLY" != "true" ]]; then
            log_info "监控检查完成"
        fi
    fi
}

# 执行主函数
main "$@"
