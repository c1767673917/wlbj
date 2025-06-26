#!/bin/bash

# WLBJ物流报价系统启动脚本
# 适用于重构后的分层架构

set -euo pipefail

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV="${1:-development}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Node.js版本
check_node_version() {
    log_info "检查Node.js版本..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js未安装"
        exit 1
    fi
    
    local node_version=$(node -v | cut -d'v' -f2)
    local required_version="18.0.0"
    
    if ! node -e "process.exit(process.version.slice(1).split('.').map(Number).reduce((a,b,i)=>(a||0)*1000+b,0) >= '$required_version'.split('.').map(Number).reduce((a,b,i)=>(a||0)*1000+b,0) ? 0 : 1)"; then
        log_error "Node.js版本过低，需要 >= $required_version，当前版本: $node_version"
        exit 1
    fi
    
    log_success "Node.js版本检查通过: $node_version"
}

# 检查依赖
check_dependencies() {
    log_info "检查项目依赖..."
    
    cd "$PROJECT_ROOT"
    
    if [ ! -d "node_modules" ]; then
        log_warning "依赖未安装，正在安装..."
        npm ci
    fi
    
    log_success "依赖检查完成"
}

# 加载环境配置
load_environment() {
    log_info "加载环境配置: $ENV"
    
    local env_file="$PROJECT_ROOT/.env.$ENV"
    
    # 如果环境配置文件不存在，尝试从示例文件复制
    if [ ! -f "$env_file" ]; then
        local example_file="$PROJECT_ROOT/.env.$ENV.example"
        if [ -f "$example_file" ]; then
            log_warning "环境配置文件不存在，从示例文件复制: $env_file"
            cp "$example_file" "$env_file"
            log_warning "请编辑 $env_file 文件并填入正确的配置值"
        else
            log_warning "环境配置文件不存在: $env_file"
        fi
    fi
    
    # 设置NODE_ENV
    export NODE_ENV="$ENV"
    
    log_success "环境配置加载完成"
}

# 初始化数据库
init_database() {
    log_info "初始化数据库..."
    
    cd "$PROJECT_ROOT"
    
    # 创建数据目录
    mkdir -p data
    
    # 运行数据库迁移
    if npm run migrate:latest; then
        log_success "数据库迁移完成"
    else
        log_warning "数据库迁移失败，可能是首次运行"
    fi
    
    # 如果是开发或测试环境，运行种子数据
    if [ "$ENV" = "development" ] || [ "$ENV" = "test" ]; then
        if npm run seed:run 2>/dev/null; then
            log_success "测试数据初始化完成"
        else
            log_warning "测试数据初始化跳过（无种子文件）"
        fi
    fi
}

# 健康检查
health_check() {
    local max_attempts=30
    local attempt=1
    local port="${PORT:-3000}"
    
    log_info "等待服务启动..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:$port/health" > /dev/null 2>&1; then
            log_success "服务健康检查通过"
            return 0
        fi
        
        sleep 2
        ((attempt++))
    done
    
    log_error "服务启动失败或健康检查超时"
    return 1
}

# 启动应用
start_application() {
    log_info "启动WLBJ应用..."
    
    cd "$PROJECT_ROOT"
    
    case "$ENV" in
        "development")
            log_info "启动开发模式..."
            npm run dev
            ;;
        "production")
            log_info "启动生产模式..."
            npm start
            ;;
        "test")
            log_info "启动测试模式..."
            NODE_ENV=test npm start
            ;;
        *)
            log_error "不支持的环境: $ENV"
            exit 1
            ;;
    esac
}

# 显示使用说明
show_usage() {
    echo "用法: $0 [environment]"
    echo ""
    echo "环境选项:"
    echo "  development  - 开发环境（默认）"
    echo "  production   - 生产环境"
    echo "  test         - 测试环境"
    echo ""
    echo "示例:"
    echo "  $0                    # 启动开发环境"
    echo "  $0 development        # 启动开发环境"
    echo "  $0 production         # 启动生产环境"
}

# 主函数
main() {
    # 检查参数
    if [ "$#" -gt 1 ]; then
        show_usage
        exit 1
    fi
    
    if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
        show_usage
        exit 0
    fi
    
    log_info "启动WLBJ物流报价系统 - 环境: $ENV"
    
    # 执行启动流程
    check_node_version
    load_environment
    check_dependencies
    init_database
    start_application
}

# 错误处理
trap 'log_error "启动失败！"; exit 1' ERR

# 执行主流程
main "$@"
