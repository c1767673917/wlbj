#!/bin/bash

# 系统状态检查脚本 - 全面检查应用和系统状态
# 用于快速诊断问题和获取系统信息

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 状态图标
CHECK="✓"
CROSS="✗"
WARN="⚠"
INFO="ℹ"

log_success() {
    echo -e "${GREEN}${CHECK}${NC} $1"
}

log_error() {
    echo -e "${RED}${CROSS}${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}${WARN}${NC} $1"
}

log_info() {
    echo -e "${BLUE}${INFO}${NC} $1"
}

log_section() {
    echo -e "\n${CYAN}=== $1 ===${NC}"
}

# 检查系统信息
check_system_info() {
    log_section "系统信息"
    
    echo "主机名: $(hostname)"
    echo "操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
    echo "内核版本: $(uname -r)"
    echo "架构: $(uname -m)"
    echo "运行时间: $(uptime -p)"
    echo "当前时间: $(date)"
    echo "时区: $(timedatectl show --property=Timezone --value 2>/dev/null || echo "未知")"
}

# 检查系统资源
check_system_resources() {
    log_section "系统资源"
    
    # CPU信息
    CPU_CORES=$(nproc)
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    echo "CPU核心数: $CPU_CORES"
    echo "CPU使用率: ${CPU_USAGE}%"
    
    # 内存信息
    MEMORY_INFO=$(free -h | grep Mem)
    MEMORY_TOTAL=$(echo $MEMORY_INFO | awk '{print $2}')
    MEMORY_USED=$(echo $MEMORY_INFO | awk '{print $3}')
    MEMORY_FREE=$(echo $MEMORY_INFO | awk '{print $4}')
    MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    
    echo "内存总量: $MEMORY_TOTAL"
    echo "已用内存: $MEMORY_USED (${MEMORY_USAGE}%)"
    echo "可用内存: $MEMORY_FREE"
    
    # 磁盘信息
    echo "磁盘使用情况:"
    df -h | grep -E '^/dev/' | while read line; do
        echo "  $line"
    done
    
    # 系统负载
    LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}')
    echo "系统负载:$LOAD_AVG"
}

# 检查网络状态
check_network() {
    log_section "网络状态"
    
    # 网络接口
    echo "网络接口:"
    ip addr show | grep -E '^[0-9]+:' | awk '{print "  " $2}' | sed 's/://'
    
    # IP地址
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "无法获取")
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    echo "公网IP: $PUBLIC_IP"
    echo "内网IP: $LOCAL_IP"
    
    # 端口监听
    echo "监听端口:"
    netstat -tlnp 2>/dev/null | grep -E ':(80|443|3000|22)\s' | while read line; do
        echo "  $line"
    done
}

# 检查应用状态
check_application() {
    log_section "应用状态"
    
    # 检查应用目录
    if [[ -d "/opt/wlbj" ]]; then
        log_success "应用目录存在: /opt/wlbj"
        
        # 检查应用文件
        cd /opt/wlbj
        if [[ -f "app.js" ]]; then
            log_success "主应用文件存在"
        else
            log_error "主应用文件不存在"
        fi
        
        if [[ -f "package.json" ]]; then
            APP_VERSION=$(grep '"version"' package.json | cut -d'"' -f4)
            log_success "应用版本: $APP_VERSION"
        else
            log_warn "package.json文件不存在"
        fi
        
        # 检查前端构建
        if [[ -d "frontend/dist" ]]; then
            log_success "前端已构建"
        else
            log_warn "前端未构建"
        fi
        
    else
        log_error "应用目录不存在: /opt/wlbj"
    fi
    
    # 检查PM2进程
    if command -v pm2 &> /dev/null; then
        log_success "PM2已安装"
        
        if pm2 list | grep -q "wlbj-app"; then
            PM2_STATUS=$(pm2 list | grep "wlbj-app" | awk '{print $10}')
            if [[ "$PM2_STATUS" == "online" ]]; then
                log_success "应用进程运行中"
            else
                log_error "应用进程状态: $PM2_STATUS"
            fi
        else
            log_error "应用进程未找到"
        fi
    else
        log_error "PM2未安装"
    fi
    
    # 检查HTTP响应
    if curl -s -f "http://localhost:3000" >/dev/null 2>&1; then
        log_success "应用HTTP响应正常"
    else
        log_error "应用HTTP响应失败"
    fi
}

# 检查数据库
check_database() {
    log_section "数据库状态"
    
    DB_FILE="/opt/wlbj/data/logistics.db"
    
    if [[ -f "$DB_FILE" ]]; then
        log_success "数据库文件存在"
        
        # 检查文件权限
        if [[ -r "$DB_FILE" ]]; then
            log_success "数据库文件可读"
        else
            log_error "数据库文件无读取权限"
        fi
        
        # 检查文件大小
        DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
        echo "数据库大小: $DB_SIZE"
        
        # 检查最后修改时间
        DB_MTIME=$(stat -c %y "$DB_FILE" 2>/dev/null || stat -f %Sm "$DB_FILE" 2>/dev/null || echo "未知")
        echo "最后修改: $DB_MTIME"
        
    else
        log_error "数据库文件不存在: $DB_FILE"
    fi
}

# 检查服务状态
check_services() {
    log_section "系统服务"
    
    # 检查Nginx
    if systemctl is-active --quiet nginx 2>/dev/null; then
        log_success "Nginx服务运行中"
        
        # 检查Nginx配置
        if nginx -t 2>/dev/null; then
            log_success "Nginx配置正确"
        else
            log_error "Nginx配置错误"
        fi
    else
        log_error "Nginx服务未运行"
    fi
    
    # 检查Redis
    if systemctl list-units --full -all | grep -q redis; then
        if systemctl is-active --quiet redis 2>/dev/null; then
            log_success "Redis服务运行中"
        else
            log_warn "Redis服务未运行"
        fi
    else
        log_info "Redis服务未安装"
    fi
    
    # 检查防火墙
    if command -v ufw &> /dev/null; then
        if ufw status | grep -q "Status: active"; then
            log_success "UFW防火墙已启用"
        else
            log_warn "UFW防火墙未启用"
        fi
    elif command -v firewall-cmd &> /dev/null; then
        if systemctl is-active --quiet firewalld; then
            log_success "Firewalld防火墙已启用"
        else
            log_warn "Firewalld防火墙未启用"
        fi
    else
        log_warn "未检测到防火墙"
    fi
}

# 检查SSL证书
check_ssl() {
    log_section "SSL证书"
    
    if [[ -d "/etc/letsencrypt/live" ]]; then
        CERT_DIRS=$(find /etc/letsencrypt/live -maxdepth 1 -type d -not -name live | wc -l)
        if [[ $CERT_DIRS -gt 0 ]]; then
            log_success "SSL证书已安装"
            
            # 检查证书有效期
            find /etc/letsencrypt/live -name "cert.pem" | while read cert; do
                DOMAIN=$(basename $(dirname $cert))
                EXPIRY=$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2)
                if [[ -n "$EXPIRY" ]]; then
                    echo "  $DOMAIN: 到期时间 $EXPIRY"
                fi
            done
        else
            log_warn "SSL证书目录存在但无证书"
        fi
    else
        log_warn "未安装SSL证书"
    fi
}

# 检查日志
check_logs() {
    log_section "日志状态"
    
    LOG_DIR="/opt/wlbj/logs"
    
    if [[ -d "$LOG_DIR" ]]; then
        log_success "日志目录存在"
        
        # 检查日志文件
        for log_file in "$LOG_DIR"/*.log; do
            if [[ -f "$log_file" ]]; then
                LOG_NAME=$(basename "$log_file")
                LOG_SIZE=$(du -h "$log_file" | cut -f1)
                LOG_LINES=$(wc -l < "$log_file")
                echo "  $LOG_NAME: $LOG_SIZE ($LOG_LINES 行)"
                
                # 检查最近的错误
                ERROR_COUNT=$(grep -c "ERROR" "$log_file" 2>/dev/null || echo "0")
                if [[ $ERROR_COUNT -gt 0 ]]; then
                    echo "    最近错误: $ERROR_COUNT 个"
                fi
            fi
        done
    else
        log_warn "日志目录不存在"
    fi
    
    # 检查系统日志
    if command -v journalctl &> /dev/null; then
        JOURNAL_ERRORS=$(journalctl -u wlbj --since "1 hour ago" --no-pager -q | grep -c "ERROR" || echo "0")
        echo "系统日志错误 (最近1小时): $JOURNAL_ERRORS 个"
    fi
}

# 检查安全状态
check_security() {
    log_section "安全状态"
    
    # 检查文件权限
    if [[ -f "/opt/wlbj/.env" ]]; then
        ENV_PERMS=$(stat -c %a "/opt/wlbj/.env" 2>/dev/null || stat -f %A "/opt/wlbj/.env" 2>/dev/null)
        if [[ "$ENV_PERMS" == "600" ]]; then
            log_success "环境变量文件权限正确"
        else
            log_warn "环境变量文件权限: $ENV_PERMS (建议600)"
        fi
    else
        log_warn "环境变量文件不存在"
    fi
    
    # 检查SSH配置
    if [[ -f "/etc/ssh/sshd_config" ]]; then
        if grep -q "PasswordAuthentication no" /etc/ssh/sshd_config; then
            log_success "SSH密码认证已禁用"
        else
            log_warn "SSH密码认证未禁用"
        fi
    fi
    
    # 检查fail2ban
    if systemctl is-active --quiet fail2ban 2>/dev/null; then
        log_success "Fail2ban服务运行中"
    else
        log_warn "Fail2ban服务未运行"
    fi
}

# 生成状态报告
generate_report() {
    local report_file="/tmp/wlbj_status_report_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "物流报价系统状态报告"
        echo "====================="
        echo "生成时间: $(date)"
        echo "主机名: $(hostname)"
        echo ""
        
        echo "系统信息:"
        echo "- 操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
        echo "- 内核版本: $(uname -r)"
        echo "- 运行时间: $(uptime -p)"
        echo ""
        
        echo "资源使用:"
        echo "- CPU使用率: ${CPU_USAGE:-N/A}%"
        echo "- 内存使用率: $(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')%"
        echo "- 磁盘使用率: $(df / | tail -1 | awk '{print $5}')"
        echo ""
        
        echo "应用状态:"
        if pm2 list | grep -q "wlbj-app.*online"; then
            echo "- 应用状态: 运行中"
        else
            echo "- 应用状态: 未运行"
        fi
        
        if curl -s -f "http://localhost:3000" >/dev/null 2>&1; then
            echo "- HTTP响应: 正常"
        else
            echo "- HTTP响应: 异常"
        fi
        echo ""
        
        echo "服务状态:"
        echo "- Nginx: $(systemctl is-active nginx 2>/dev/null || echo "未知")"
        echo "- Redis: $(systemctl is-active redis 2>/dev/null || echo "未安装")"
        echo ""
        
        echo "网络信息:"
        echo "- 公网IP: $(curl -s ifconfig.me 2>/dev/null || echo "无法获取")"
        echo "- 内网IP: $(hostname -I | awk '{print $1}')"
        echo ""
        
    } > "$report_file"
    
    echo "$report_file"
}

# 显示使用帮助
show_help() {
    cat << EOF
物流报价系统状态检查脚本

用法: $0 [选项]

选项:
  -h, --help          显示此帮助信息
  -r, --report        生成状态报告文件
  -q, --quiet         静默模式，只显示错误
  --system            仅检查系统状态
  --app               仅检查应用状态
  --services          仅检查服务状态
  --security          仅检查安全状态

示例:
  $0                  # 完整状态检查
  $0 -r               # 生成状态报告
  $0 --app            # 仅检查应用状态

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
            -r|--report)
                GENERATE_REPORT=true
                shift
                ;;
            -q|--quiet)
                QUIET_MODE=true
                shift
                ;;
            --system)
                CHECK_SYSTEM_ONLY=true
                shift
                ;;
            --app)
                CHECK_APP_ONLY=true
                shift
                ;;
            --services)
                CHECK_SERVICES_ONLY=true
                shift
                ;;
            --security)
                CHECK_SECURITY_ONLY=true
                shift
                ;;
            *)
                echo "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 主函数
main() {
    parse_args "$@"
    
    if [[ "$QUIET_MODE" != "true" ]]; then
        echo -e "${CYAN}物流报价系统状态检查${NC}"
        echo "=============================="
    fi
    
    if [[ "$CHECK_SYSTEM_ONLY" == "true" ]]; then
        check_system_info
        check_system_resources
        check_network
    elif [[ "$CHECK_APP_ONLY" == "true" ]]; then
        check_application
        check_database
    elif [[ "$CHECK_SERVICES_ONLY" == "true" ]]; then
        check_services
        check_ssl
    elif [[ "$CHECK_SECURITY_ONLY" == "true" ]]; then
        check_security
    else
        check_system_info
        check_system_resources
        check_network
        check_application
        check_database
        check_services
        check_ssl
        check_logs
        check_security
    fi
    
    if [[ "$GENERATE_REPORT" == "true" ]]; then
        report_file=$(generate_report)
        echo ""
        log_info "状态报告已生成: $report_file"
    fi
    
    if [[ "$QUIET_MODE" != "true" ]]; then
        echo ""
        echo -e "${CYAN}状态检查完成${NC}"
    fi
}

# 执行主函数
main "$@"
