#!/bin/bash

# WLBJ物流报价系统监控脚本
# 监控系统关键指标和健康状态

set -euo pipefail

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITOR_INTERVAL="${MONITOR_INTERVAL:-30}"
LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/logs/monitor.log}"
ALERT_THRESHOLD_CPU="${ALERT_THRESHOLD_CPU:-80}"
ALERT_THRESHOLD_MEMORY="${ALERT_THRESHOLD_MEMORY:-85}"
ALERT_THRESHOLD_DISK="${ALERT_THRESHOLD_DISK:-90}"
ALERT_THRESHOLD_RESPONSE_TIME="${ALERT_THRESHOLD_RESPONSE_TIME:-1000}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    local message="$1"
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $message" | tee -a "$LOG_FILE"
}

log_success() {
    local message="$1"
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $message" | tee -a "$LOG_FILE"
}

log_warning() {
    local message="$1"
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') $message" | tee -a "$LOG_FILE"
}

log_error() {
    local message="$1"
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $message" | tee -a "$LOG_FILE"
}

# 确保日志目录存在
mkdir -p "$(dirname "$LOG_FILE")"

# 检查Docker容器状态
check_container_status() {
    log_info "检查容器状态..."
    
    local containers=("wlbj-app" "wlbj-postgres" "wlbj-redis" "wlbj-nginx")
    local all_healthy=true
    
    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "$container"; then
            local status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
            if [[ "$status" == "healthy" || "$status" == "unknown" ]]; then
                log_success "容器 $container 运行正常"
            else
                log_error "容器 $container 状态异常: $status"
                all_healthy=false
            fi
        else
            log_error "容器 $container 未运行"
            all_healthy=false
        fi
    done
    
    return $([[ "$all_healthy" == "true" ]] && echo 0 || echo 1)
}

# 检查应用健康状态
check_application_health() {
    log_info "检查应用健康状态..."
    
    local health_url="${HEALTH_URL:-http://localhost:3000/health}"
    local start_time=$(date +%s%3N)
    
    if response=$(curl -s -w "%{http_code}" -o /tmp/health_response "$health_url" 2>/dev/null); then
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        local http_code="${response: -3}"
        
        if [[ "$http_code" == "200" ]]; then
            log_success "应用健康检查通过 (响应时间: ${response_time}ms)"
            
            # 检查响应时间
            if [[ $response_time -gt $ALERT_THRESHOLD_RESPONSE_TIME ]]; then
                log_warning "响应时间过长: ${response_time}ms (阈值: ${ALERT_THRESHOLD_RESPONSE_TIME}ms)"
                return 1
            fi
            
            return 0
        else
            log_error "应用健康检查失败: HTTP $http_code"
            return 1
        fi
    else
        log_error "无法连接到应用健康检查端点"
        return 1
    fi
}

# 检查数据库连接
check_database_connection() {
    log_info "检查数据库连接..."
    
    if docker exec wlbj-postgres pg_isready -U "${DB_USER:-wlbj_user}" -d "${DB_NAME:-wlbj}" >/dev/null 2>&1; then
        log_success "数据库连接正常"
        return 0
    else
        log_error "数据库连接失败"
        return 1
    fi
}

# 检查Redis连接
check_redis_connection() {
    log_info "检查Redis连接..."
    
    if docker exec wlbj-redis redis-cli ping >/dev/null 2>&1; then
        log_success "Redis连接正常"
        return 0
    else
        log_error "Redis连接失败"
        return 1
    fi
}

# 监控系统资源使用
monitor_system_resources() {
    log_info "监控系统资源使用..."
    
    # CPU使用率
    local cpu_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}" | grep wlbj-app | awk '{print $2}' | sed 's/%//')
    if [[ -n "$cpu_usage" ]]; then
        if (( $(echo "$cpu_usage > $ALERT_THRESHOLD_CPU" | bc -l) )); then
            log_warning "CPU使用率过高: ${cpu_usage}% (阈值: ${ALERT_THRESHOLD_CPU}%)"
        else
            log_success "CPU使用率正常: ${cpu_usage}%"
        fi
    fi
    
    # 内存使用率
    local memory_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemPerc}}" | grep wlbj-app | awk '{print $2}' | sed 's/%//')
    if [[ -n "$memory_usage" ]]; then
        if (( $(echo "$memory_usage > $ALERT_THRESHOLD_MEMORY" | bc -l) )); then
            log_warning "内存使用率过高: ${memory_usage}% (阈值: ${ALERT_THRESHOLD_MEMORY}%)"
        else
            log_success "内存使用率正常: ${memory_usage}%"
        fi
    fi
    
    # 磁盘使用率
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if (( disk_usage > ALERT_THRESHOLD_DISK )); then
        log_warning "磁盘使用率过高: ${disk_usage}% (阈值: ${ALERT_THRESHOLD_DISK}%)"
    else
        log_success "磁盘使用率正常: ${disk_usage}%"
    fi
}

# 检查关键业务指标
check_business_metrics() {
    log_info "检查关键业务指标..."
    
    # 这里可以添加具体的业务指标检查
    # 例如：API调用成功率、订单处理成功率等
    
    local api_endpoints=(
        "/api/auth/me"
        "/api/orders"
        "/api/quotes/orders/test"
    )
    
    for endpoint in "${api_endpoints[@]}"; do
        local url="http://localhost:3000$endpoint"
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" -H "Authorization: Bearer test-token" 2>/dev/null || echo "000")
        
        if [[ "$response_code" =~ ^[2-3][0-9][0-9]$ ]]; then
            log_success "API端点 $endpoint 响应正常: $response_code"
        else
            log_warning "API端点 $endpoint 响应异常: $response_code"
        fi
    done
}

# 检查日志错误
check_log_errors() {
    log_info "检查应用日志错误..."
    
    local log_files=(
        "$PROJECT_ROOT/logs/app.log"
        "$PROJECT_ROOT/logs/error.log"
    )
    
    for log_file in "${log_files[@]}"; do
        if [[ -f "$log_file" ]]; then
            local error_count=$(tail -n 100 "$log_file" | grep -i "error\|exception\|fatal" | wc -l)
            if [[ $error_count -gt 0 ]]; then
                log_warning "发现 $error_count 个错误日志在 $log_file"
            else
                log_success "日志文件 $log_file 无错误"
            fi
        fi
    done
}

# 生成监控报告
generate_monitor_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local report_file="$PROJECT_ROOT/logs/monitor_report_$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$timestamp",
  "system_status": {
    "containers": $(check_container_status && echo "\"healthy\"" || echo "\"unhealthy\""),
    "application": $(check_application_health && echo "\"healthy\"" || echo "\"unhealthy\""),
    "database": $(check_database_connection && echo "\"healthy\"" || echo "\"unhealthy\""),
    "redis": $(check_redis_connection && echo "\"healthy\"" || echo "\"unhealthy\"")
  },
  "resource_usage": {
    "cpu_usage": "$(docker stats --no-stream --format "{{.CPUPerc}}" wlbj-app 2>/dev/null || echo "N/A")",
    "memory_usage": "$(docker stats --no-stream --format "{{.MemPerc}}" wlbj-app 2>/dev/null || echo "N/A")",
    "disk_usage": "$(df -h / | awk 'NR==2 {print $5}')"
  },
  "thresholds": {
    "cpu_threshold": "$ALERT_THRESHOLD_CPU%",
    "memory_threshold": "$ALERT_THRESHOLD_MEMORY%",
    "disk_threshold": "$ALERT_THRESHOLD_DISK%",
    "response_time_threshold": "${ALERT_THRESHOLD_RESPONSE_TIME}ms"
  }
}
EOF
    
    log_info "监控报告已生成: $report_file"
}

# 发送告警通知
send_alert() {
    local alert_type="$1"
    local message="$2"
    
    log_error "告警: $alert_type - $message"
    
    # 发送到Slack（如果配置了）
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 WLBJ系统告警: $alert_type - $message\"}" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1
    fi
    
    # 发送邮件（如果配置了）
    if [[ -n "${ALERT_EMAIL:-}" ]]; then
        echo "$message" | mail -s "WLBJ系统告警: $alert_type" "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

# 执行完整监控检查
run_full_monitoring() {
    log_info "开始完整系统监控检查..."
    
    local issues=0
    
    # 检查容器状态
    if ! check_container_status; then
        send_alert "容器状态异常" "一个或多个容器状态不正常"
        ((issues++))
    fi
    
    # 检查应用健康状态
    if ! check_application_health; then
        send_alert "应用健康检查失败" "应用健康检查端点响应异常"
        ((issues++))
    fi
    
    # 检查数据库连接
    if ! check_database_connection; then
        send_alert "数据库连接失败" "无法连接到PostgreSQL数据库"
        ((issues++))
    fi
    
    # 检查Redis连接
    if ! check_redis_connection; then
        send_alert "Redis连接失败" "无法连接到Redis服务"
        ((issues++))
    fi
    
    # 监控系统资源
    monitor_system_resources
    
    # 检查业务指标
    check_business_metrics
    
    # 检查日志错误
    check_log_errors
    
    # 生成监控报告
    generate_monitor_report
    
    if [[ $issues -eq 0 ]]; then
        log_success "系统监控检查完成，所有检查项正常"
    else
        log_warning "系统监控检查完成，发现 $issues 个问题"
    fi
    
    return $issues
}

# 持续监控模式
continuous_monitoring() {
    log_info "启动持续监控模式，间隔: ${MONITOR_INTERVAL}秒"
    
    while true; do
        run_full_monitoring
        sleep "$MONITOR_INTERVAL"
    done
}

# 显示帮助信息
show_help() {
    cat << EOF
WLBJ系统监控脚本

用法: $0 [选项]

选项:
  -c, --continuous    持续监控模式
  -o, --once         执行一次监控检查
  -h, --help         显示帮助信息

环境变量:
  MONITOR_INTERVAL              监控间隔（秒，默认30）
  LOG_FILE                      日志文件路径
  ALERT_THRESHOLD_CPU           CPU使用率告警阈值（默认80%）
  ALERT_THRESHOLD_MEMORY        内存使用率告警阈值（默认85%）
  ALERT_THRESHOLD_DISK          磁盘使用率告警阈值（默认90%）
  ALERT_THRESHOLD_RESPONSE_TIME 响应时间告警阈值（默认1000ms）
  SLACK_WEBHOOK_URL             Slack通知URL
  ALERT_EMAIL                   告警邮件地址

示例:
  $0 --once                     执行一次监控检查
  $0 --continuous               启动持续监控
  MONITOR_INTERVAL=60 $0 -c     以60秒间隔持续监控
EOF
}

# 主函数
main() {
    case "${1:-}" in
        -c|--continuous)
            continuous_monitoring
            ;;
        -o|--once)
            run_full_monitoring
            ;;
        -h|--help)
            show_help
            ;;
        "")
            run_full_monitoring
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
}

# 信号处理
trap 'log_info "监控脚本停止"; exit 0' SIGINT SIGTERM

# 执行主函数
main "$@"
