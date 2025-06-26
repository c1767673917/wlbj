#!/bin/bash

# WLBJ物流报价系统部署脚本
# 支持蓝绿部署策略，确保零停机时间

set -euo pipefail

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_ENV="${1:-production}"
DEPLOY_TYPE="${2:-blue-green}"
VERSION="${3:-latest}"

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

# 检查必需的工具
check_prerequisites() {
    log_info "检查部署前置条件..."
    
    local tools=("docker" "docker-compose" "curl" "jq")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "缺少必需工具: $tool"
            exit 1
        fi
    done
    
    # 检查Docker是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker服务未运行"
        exit 1
    fi
    
    log_success "前置条件检查通过"
}

# 加载环境配置
load_environment() {
    log_info "加载环境配置: $DEPLOY_ENV"
    
    local env_file="$PROJECT_ROOT/.env.$DEPLOY_ENV"
    if [[ -f "$env_file" ]]; then
        set -a
        source "$env_file"
        set +a
        log_success "环境配置加载完成"
    else
        log_warning "环境配置文件不存在: $env_file"
    fi
}

# 构建Docker镜像
build_image() {
    log_info "构建Docker镜像..."
    
    local image_tag="wlbj:$VERSION"
    
    cd "$PROJECT_ROOT"
    docker build -t "$image_tag" --target runner .
    
    # 标记为latest（如果是生产环境）
    if [[ "$DEPLOY_ENV" == "production" ]]; then
        docker tag "$image_tag" "wlbj:latest"
    fi
    
    log_success "Docker镜像构建完成: $image_tag"
}

# 运行数据库迁移
run_migrations() {
    log_info "运行数据库迁移..."
    
    # 创建临时容器运行迁移
    docker run --rm \
        --network wlbj-network \
        -e NODE_ENV="$DEPLOY_ENV" \
        -e DB_HOST="$DB_HOST" \
        -e DB_PORT="$DB_PORT" \
        -e DB_NAME="$DB_NAME" \
        -e DB_USER="$DB_USER" \
        -e DB_PASSWORD="$DB_PASSWORD" \
        "wlbj:$VERSION" \
        npm run migrate:latest
    
    log_success "数据库迁移完成"
}

# 健康检查
health_check() {
    local service_url="$1"
    local max_attempts="${2:-30}"
    local attempt=1
    
    log_info "执行健康检查: $service_url"
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$service_url/health" > /dev/null; then
            log_success "健康检查通过"
            return 0
        fi
        
        log_info "健康检查失败，重试 $attempt/$max_attempts"
        sleep 5
        ((attempt++))
    done
    
    log_error "健康检查失败，服务可能未正常启动"
    return 1
}

# 蓝绿部署
blue_green_deploy() {
    log_info "开始蓝绿部署..."
    
    # 确定当前活跃环境
    local current_env
    if docker ps --format "table {{.Names}}" | grep -q "wlbj-app-blue"; then
        current_env="blue"
        target_env="green"
    else
        current_env="green"
        target_env="blue"
    fi
    
    log_info "当前环境: $current_env, 目标环境: $target_env"
    
    # 启动目标环境
    log_info "启动$target_env环境..."
    docker-compose -f docker-compose.yml -f "docker-compose.$target_env.yml" up -d
    
    # 等待服务启动
    sleep 10
    
    # 健康检查
    local target_port
    if [[ "$target_env" == "blue" ]]; then
        target_port="${BLUE_PORT:-3001}"
    else
        target_port="${GREEN_PORT:-3002}"
    fi
    
    if health_check "http://localhost:$target_port"; then
        # 切换流量
        log_info "切换流量到$target_env环境..."
        update_load_balancer "$target_env"
        
        # 等待流量切换完成
        sleep 5
        
        # 停止旧环境
        if [[ "$current_env" != "unknown" ]]; then
            log_info "停止$current_env环境..."
            docker-compose -f docker-compose.yml -f "docker-compose.$current_env.yml" down
        fi
        
        log_success "蓝绿部署完成"
    else
        log_error "目标环境健康检查失败，回滚部署"
        docker-compose -f docker-compose.yml -f "docker-compose.$target_env.yml" down
        exit 1
    fi
}

# 滚动部署
rolling_deploy() {
    log_info "开始滚动部署..."
    
    # 更新服务
    docker-compose -f docker-compose.yml up -d --no-deps app
    
    # 健康检查
    if health_check "http://localhost:${PORT:-3000}"; then
        log_success "滚动部署完成"
    else
        log_error "滚动部署失败"
        exit 1
    fi
}

# 更新负载均衡器配置
update_load_balancer() {
    local target_env="$1"
    
    log_info "更新负载均衡器配置..."
    
    # 这里可以集成具体的负载均衡器更新逻辑
    # 例如：更新Nginx配置、AWS ALB目标组等
    
    # 示例：更新Nginx upstream配置
    if [[ -f "/etc/nginx/conf.d/wlbj.conf" ]]; then
        local target_port
        if [[ "$target_env" == "blue" ]]; then
            target_port="${BLUE_PORT:-3001}"
        else
            target_port="${GREEN_PORT:-3002}"
        fi
        
        sed -i "s/server app:[0-9]*/server app:$target_port/" /etc/nginx/conf.d/wlbj.conf
        nginx -s reload
    fi
    
    log_success "负载均衡器配置更新完成"
}

# 备份数据库
backup_database() {
    log_info "备份数据库..."
    
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    local backup_path="$PROJECT_ROOT/backups/$backup_file"
    
    mkdir -p "$PROJECT_ROOT/backups"
    
    docker exec wlbj-postgres pg_dump -U "$DB_USER" -d "$DB_NAME" > "$backup_path"
    
    # 压缩备份文件
    gzip "$backup_path"
    
    log_success "数据库备份完成: $backup_path.gz"
}

# 清理旧镜像
cleanup_old_images() {
    log_info "清理旧Docker镜像..."
    
    # 保留最近5个版本的镜像
    docker images wlbj --format "table {{.Tag}}" | tail -n +6 | xargs -r docker rmi "wlbj:{}"
    
    # 清理悬空镜像
    docker image prune -f
    
    log_success "镜像清理完成"
}

# 发送部署通知
send_notification() {
    local status="$1"
    local message="$2"
    
    # 这里可以集成通知系统，如Slack、邮件等
    log_info "发送部署通知: $status - $message"
    
    # 示例：发送到Slack
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"WLBJ部署通知: $status - $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
}

# 主部署流程
main() {
    log_info "开始部署WLBJ物流报价系统"
    log_info "环境: $DEPLOY_ENV, 类型: $DEPLOY_TYPE, 版本: $VERSION"
    
    # 检查前置条件
    check_prerequisites
    
    # 加载环境配置
    load_environment
    
    # 备份数据库
    backup_database
    
    # 构建镜像
    build_image
    
    # 运行数据库迁移
    run_migrations
    
    # 执行部署
    case "$DEPLOY_TYPE" in
        "blue-green")
            blue_green_deploy
            ;;
        "rolling")
            rolling_deploy
            ;;
        *)
            log_error "不支持的部署类型: $DEPLOY_TYPE"
            exit 1
            ;;
    esac
    
    # 清理旧镜像
    cleanup_old_images
    
    # 发送成功通知
    send_notification "SUCCESS" "部署完成 - 环境: $DEPLOY_ENV, 版本: $VERSION"
    
    log_success "部署完成！"
}

# 错误处理
trap 'log_error "部署失败！"; send_notification "FAILED" "部署失败 - 环境: $DEPLOY_ENV, 版本: $VERSION"; exit 1' ERR

# 执行主流程
main "$@"
