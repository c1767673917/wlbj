#!/bin/bash

# 物流报价平台 Docker 部署脚本
set -e

# 颜色输出函数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查Docker和Docker Compose
check_requirements() {
    print_step "检查系统要求..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    print_info "Docker 环境检查通过"
}

# 检查环境变量文件
check_env_file() {
    print_step "检查环境变量配置..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.docker.example" ]; then
            print_warn ".env 文件不存在，正在从示例文件创建..."
            cp .env.docker.example .env
            print_warn "请编辑 .env 文件并设置正确的 SILICONFLOW_API_KEY"
            read -p "是否现在编辑 .env 文件? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                ${EDITOR:-nano} .env
            fi
        else
            print_error ".env 文件和示例文件都不存在"
            exit 1
        fi
    fi
    
    # 检查关键环境变量
    source .env
    if [ -z "$SILICONFLOW_API_KEY" ] || [ "$SILICONFLOW_API_KEY" = "your_siliconflow_api_key_here" ]; then
        print_warn "SILICONFLOW_API_KEY 未正确设置，AI功能将不可用"
    fi
}

# 构建和启动服务
deploy_services() {
    print_step "构建和启动服务..."
    
    # 构建镜像
    print_info "构建应用镜像..."
    docker-compose build
    
    # 启动服务
    print_info "启动服务..."
    docker-compose up -d
    
    # 等待服务启动
    print_info "等待服务启动..."
    sleep 10
    
    # 检查服务状态
    if docker-compose ps | grep -q "Up"; then
        print_info "服务启动成功！"
    else
        print_error "服务启动失败，请检查日志"
        docker-compose logs
        exit 1
    fi
}

# 显示部署信息
show_deployment_info() {
    print_step "部署信息"
    
    echo "=================================="
    echo "物流报价平台 Docker 部署完成"
    echo "=================================="
    echo
    echo "访问地址:"
    echo "  - 应用主页: http://localhost:3000"
    echo "  - 用户端: http://localhost:3000/user"
    echo
    echo "常用命令:"
    echo "  - 查看日志: docker-compose logs -f"
    echo "  - 停止服务: docker-compose down"
    echo "  - 重启服务: docker-compose restart"
    echo "  - 查看状态: docker-compose ps"
    echo
    echo "配置文件位置:"
    echo "  - 环境变量: .env"
    echo "  - 用户密码: 容器内 /app/config-persistent/auth_config.json"
    echo
    echo "数据持久化:"
    echo "  - 数据库: wlbj-data volume"
    echo "  - 日志: wlbj-logs volume"
    echo "  - 配置: wlbj-config volume"
    echo
}

# 主函数
main() {
    echo "========================================"
    echo "物流报价平台 Docker 部署脚本"
    echo "========================================"
    echo
    
    check_requirements
    check_env_file
    deploy_services
    show_deployment_info
    
    print_info "部署完成！"
}

# 处理命令行参数
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "stop")
        print_info "停止服务..."
        docker-compose down
        ;;
    "restart")
        print_info "重启服务..."
        docker-compose restart
        ;;
    "logs")
        docker-compose logs -f
        ;;
    "status")
        docker-compose ps
        ;;
    "clean")
        print_warn "这将删除所有容器、镜像和数据卷！"
        read -p "确定要继续吗? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose down -v --rmi all
            print_info "清理完成"
        fi
        ;;
    *)
        echo "用法: $0 {deploy|stop|restart|logs|status|clean}"
        echo
        echo "命令说明:"
        echo "  deploy  - 部署服务 (默认)"
        echo "  stop    - 停止服务"
        echo "  restart - 重启服务"
        echo "  logs    - 查看日志"
        echo "  status  - 查看状态"
        echo "  clean   - 清理所有数据"
        exit 1
        ;;
esac
