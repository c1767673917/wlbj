#!/bin/bash

# 物流报价平台 Docker 监控脚本
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  物流报价平台 Docker 监控${NC}"
    echo -e "${BLUE}================================${NC}"
    echo
}

print_section() {
    echo -e "${GREEN}[$1]${NC}"
    echo "------------------------"
}

# 检查服务状态
check_services() {
    print_section "服务状态"
    
    if docker-compose ps | grep -q "Up"; then
        echo -e "${GREEN}✓${NC} 服务正在运行"
        docker-compose ps
    else
        echo -e "${RED}✗${NC} 服务未运行或异常"
        docker-compose ps
        return 1
    fi
    echo
}

# 检查健康状态
check_health() {
    print_section "健康检查"
    
    # 检查应用健康状态
    if curl -s http://localhost:3000 > /dev/null; then
        echo -e "${GREEN}✓${NC} 应用响应正常"
    else
        echo -e "${RED}✗${NC} 应用无响应"
    fi
    
    # 检查Docker健康状态
    health_status=$(docker inspect --format='{{.State.Health.Status}}' $(docker-compose ps -q wlbj-app) 2>/dev/null || echo "unknown")
    case $health_status in
        "healthy")
            echo -e "${GREEN}✓${NC} Docker健康检查: 健康"
            ;;
        "unhealthy")
            echo -e "${RED}✗${NC} Docker健康检查: 不健康"
            ;;
        "starting")
            echo -e "${YELLOW}⚠${NC} Docker健康检查: 启动中"
            ;;
        *)
            echo -e "${YELLOW}?${NC} Docker健康检查: 未知状态"
            ;;
    esac
    echo
}

# 检查资源使用
check_resources() {
    print_section "资源使用情况"
    
    # 获取容器统计信息
    if command -v docker stats >/dev/null 2>&1; then
        echo "容器资源使用:"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" $(docker-compose ps -q) 2>/dev/null || echo "无法获取统计信息"
    fi
    echo
}

# 检查数据卷
check_volumes() {
    print_section "数据卷状态"
    
    volumes=("wlbj-data" "wlbj-logs" "wlbj-config")
    
    for volume in "${volumes[@]}"; do
        if docker volume inspect "$volume" >/dev/null 2>&1; then
            size=$(docker run --rm -v "$volume":/data alpine du -sh /data 2>/dev/null | cut -f1 || echo "未知")
            echo -e "${GREEN}✓${NC} $volume: $size"
        else
            echo -e "${RED}✗${NC} $volume: 不存在"
        fi
    done
    echo
}

# 检查日志
check_logs() {
    print_section "最近日志 (最后10行)"
    
    echo "应用日志:"
    docker-compose logs --tail=10 wlbj-app 2>/dev/null || echo "无法获取日志"
    echo
}

# 检查网络连接
check_network() {
    print_section "网络连接"
    
    # 检查端口监听
    if netstat -tuln 2>/dev/null | grep -q ":3000"; then
        echo -e "${GREEN}✓${NC} 端口3000正在监听"
    else
        echo -e "${RED}✗${NC} 端口3000未监听"
    fi
    
    # 检查Docker网络
    network_name=$(docker-compose config | grep -A 5 "networks:" | grep -v "networks:" | head -1 | sed 's/^[[:space:]]*//' | sed 's/:.*$//')
    if [ -n "$network_name" ]; then
        if docker network inspect "${PWD##*/}_${network_name}" >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Docker网络正常"
        else
            echo -e "${RED}✗${NC} Docker网络异常"
        fi
    fi
    echo
}

# 检查配置文件
check_config() {
    print_section "配置文件检查"
    
    # 检查环境变量文件
    if [ -f ".env" ]; then
        echo -e "${GREEN}✓${NC} .env 文件存在"
        
        # 检查关键配置
        if grep -q "SILICONFLOW_API_KEY=" .env && ! grep -q "your_siliconflow_api_key_here" .env; then
            echo -e "${GREEN}✓${NC} API密钥已配置"
        else
            echo -e "${YELLOW}⚠${NC} API密钥未配置或为默认值"
        fi
    else
        echo -e "${RED}✗${NC} .env 文件不存在"
    fi
    
    # 检查认证配置
    auth_config_status=$(docker-compose exec -T wlbj-app test -f /app/config-persistent/auth_config.json && echo "exists" || echo "missing")
    if [ "$auth_config_status" = "exists" ]; then
        echo -e "${GREEN}✓${NC} 用户认证配置存在"
        
        # 检查是否为默认密码
        default_password=$(docker-compose exec -T wlbj-app grep -q "changeme_please_ASAP_!" /app/config-persistent/auth_config.json && echo "default" || echo "changed")
        if [ "$default_password" = "default" ]; then
            echo -e "${YELLOW}⚠${NC} 仍在使用默认密码，建议修改"
        else
            echo -e "${GREEN}✓${NC} 已修改默认密码"
        fi
    else
        echo -e "${RED}✗${NC} 用户认证配置不存在"
    fi
    echo
}

# 生成报告
generate_report() {
    print_section "监控报告"
    
    echo "生成时间: $(date)"
    echo "项目目录: $(pwd)"
    echo "Docker版本: $(docker --version)"
    echo "Docker Compose版本: $(docker-compose --version)"
    echo
}

# 主函数
main() {
    print_header
    
    # 检查Docker Compose文件是否存在
    if [ ! -f "docker-compose.yml" ]; then
        echo -e "${RED}错误: docker-compose.yml 文件不存在${NC}"
        echo "请确保在正确的项目目录中运行此脚本"
        exit 1
    fi
    
    generate_report
    check_services
    check_health
    check_resources
    check_volumes
    check_network
    check_config
    check_logs
    
    echo -e "${GREEN}监控检查完成！${NC}"
}

# 处理命令行参数
case "${1:-monitor}" in
    "monitor")
        main
        ;;
    "health")
        check_health
        ;;
    "resources")
        check_resources
        ;;
    "logs")
        check_logs
        ;;
    "config")
        check_config
        ;;
    *)
        echo "用法: $0 {monitor|health|resources|logs|config}"
        echo
        echo "命令说明:"
        echo "  monitor   - 完整监控检查 (默认)"
        echo "  health    - 仅检查健康状态"
        echo "  resources - 仅检查资源使用"
        echo "  logs      - 仅查看日志"
        echo "  config    - 仅检查配置"
        exit 1
        ;;
esac
