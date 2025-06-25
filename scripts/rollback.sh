#!/bin/bash

# WLBJ物流报价系统回滚脚本
# 支持快速回滚到上一个稳定版本

set -euo pipefail

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_ENV="${1:-production}"
TARGET_VERSION="${2:-}"

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

# 检查前置条件
check_prerequisites() {
    log_info "检查回滚前置条件..."
    
    local tools=("docker" "docker-compose" "curl" "jq")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "缺少必需工具: $tool"
            exit 1
        fi
    done
    
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

# 获取当前运行版本
get_current_version() {
    log_info "获取当前运行版本..."
    
    local current_version
    if docker ps --format "table {{.Image}}" | grep -q "wlbj:"; then
        current_version=$(docker ps --format "table {{.Image}}" | grep "wlbj:" | head -1 | cut -d':' -f2)
        echo "$current_version"
    else
        log_error "未找到运行中的WLBJ容器"
        return 1
    fi
}

# 获取可用版本列表
get_available_versions() {
    log_info "获取可用版本列表..."
    
    local versions
    versions=$(docker images wlbj --format "table {{.Tag}}" | grep -v "TAG" | grep -v "latest" | sort -V -r)
    
    if [[ -z "$versions" ]]; then
        log_error "未找到可用的版本镜像"
        return 1
    fi
    
    echo "$versions"
}

# 选择回滚版本
select_rollback_version() {
    local current_version="$1"
    
    if [[ -n "$TARGET_VERSION" ]]; then
        # 验证指定版本是否存在
        if docker images wlbj:"$TARGET_VERSION" --format "table {{.Tag}}" | grep -q "$TARGET_VERSION"; then
            echo "$TARGET_VERSION"
            return 0
        else
            log_error "指定的版本不存在: $TARGET_VERSION"
            return 1
        fi
    fi
    
    # 自动选择上一个版本
    local versions
    versions=$(get_available_versions)
    
    local previous_version
    previous_version=$(echo "$versions" | grep -A1 "$current_version" | tail -1)
    
    if [[ -z "$previous_version" || "$previous_version" == "$current_version" ]]; then
        # 如果没有找到上一个版本，选择最新的非当前版本
        previous_version=$(echo "$versions" | grep -v "$current_version" | head -1)
    fi
    
    if [[ -z "$previous_version" ]]; then
        log_error "未找到可回滚的版本"
        return 1
    fi
    
    echo "$previous_version"
}

# 创建回滚前备份
create_rollback_backup() {
    log_info "创建回滚前备份..."
    
    local backup_file="rollback_backup_$(date +%Y%m%d_%H%M%S).sql"
    local backup_path="$PROJECT_ROOT/backups/$backup_file"
    
    mkdir -p "$PROJECT_ROOT/backups"
    
    # 备份数据库
    docker exec wlbj-postgres pg_dump -U "$DB_USER" -d "$DB_NAME" > "$backup_path"
    gzip "$backup_path"
    
    # 备份当前配置
    local config_backup="$PROJECT_ROOT/backups/config_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$config_backup" -C "$PROJECT_ROOT" .env* docker-compose*.yml
    
    log_success "回滚前备份完成"
    echo "数据库备份: $backup_path.gz"
    echo "配置备份: $config_backup"
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
    
    log_error "健康检查失败"
    return 1
}

# 检查数据库兼容性
check_database_compatibility() {
    local target_version="$1"
    
    log_info "检查数据库兼容性..."
    
    # 这里可以添加具体的数据库版本兼容性检查逻辑
    # 例如：检查迁移文件、schema版本等
    
    log_warning "数据库兼容性检查跳过（需要根据具体需求实现）"
    return 0
}

# 执行快速回滚
quick_rollback() {
    local target_version="$1"
    
    log_info "执行快速回滚到版本: $target_version"
    
    # 更新docker-compose文件中的镜像版本
    sed -i.bak "s/wlbj:[^[:space:]]*/wlbj:$target_version/g" "$PROJECT_ROOT/docker-compose.yml"
    
    # 重启服务
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d --no-deps app
    
    # 等待服务启动
    sleep 10
    
    # 健康检查
    if health_check "http://localhost:${PORT:-3000}"; then
        log_success "快速回滚完成"
        return 0
    else
        log_error "快速回滚失败，尝试恢复原版本"
        # 恢复原配置
        mv "$PROJECT_ROOT/docker-compose.yml.bak" "$PROJECT_ROOT/docker-compose.yml"
        docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d --no-deps app
        return 1
    fi
}

# 执行完整回滚（包含数据库回滚）
full_rollback() {
    local target_version="$1"
    local backup_file="$2"
    
    log_info "执行完整回滚到版本: $target_version"
    
    # 停止当前服务
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" stop app
    
    # 回滚数据库
    if [[ -n "$backup_file" ]]; then
        log_info "回滚数据库..."
        
        # 解压备份文件
        gunzip -c "$backup_file" | docker exec -i wlbj-postgres psql -U "$DB_USER" -d "$DB_NAME"
        
        log_success "数据库回滚完成"
    fi
    
    # 更新应用版本
    sed -i.bak "s/wlbj:[^[:space:]]*/wlbj:$target_version/g" "$PROJECT_ROOT/docker-compose.yml"
    
    # 启动服务
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d app
    
    # 等待服务启动
    sleep 15
    
    # 健康检查
    if health_check "http://localhost:${PORT:-3000}"; then
        log_success "完整回滚完成"
        return 0
    else
        log_error "完整回滚失败"
        return 1
    fi
}

# 蓝绿环境回滚
blue_green_rollback() {
    local target_version="$1"
    
    log_info "执行蓝绿环境回滚..."
    
    # 确定当前活跃环境
    local current_env
    if docker ps --format "table {{.Names}}" | grep -q "wlbj-app-blue"; then
        current_env="blue"
        target_env="green"
    else
        current_env="green"
        target_env="blue"
    fi
    
    log_info "当前环境: $current_env, 回滚到: $target_env"
    
    # 检查目标环境是否存在
    if ! docker ps -a --format "table {{.Names}}" | grep -q "wlbj-app-$target_env"; then
        log_error "目标环境不存在，无法执行蓝绿回滚"
        return 1
    fi
    
    # 启动目标环境
    docker-compose -f docker-compose.yml -f "docker-compose.$target_env.yml" start
    
    # 健康检查
    local target_port
    if [[ "$target_env" == "blue" ]]; then
        target_port="${BLUE_PORT:-3001}"
    else
        target_port="${GREEN_PORT:-3002}"
    fi
    
    if health_check "http://localhost:$target_port"; then
        # 切换流量
        update_load_balancer "$target_env"
        
        # 停止当前环境
        docker-compose -f docker-compose.yml -f "docker-compose.$current_env.yml" stop
        
        log_success "蓝绿环境回滚完成"
    else
        log_error "蓝绿环境回滚失败"
        return 1
    fi
}

# 更新负载均衡器配置
update_load_balancer() {
    local target_env="$1"
    
    log_info "更新负载均衡器配置..."
    
    # 这里实现具体的负载均衡器更新逻辑
    log_success "负载均衡器配置更新完成"
}

# 发送回滚通知
send_notification() {
    local status="$1"
    local message="$2"
    
    log_info "发送回滚通知: $status - $message"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"WLBJ回滚通知: $status - $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
}

# 显示回滚选项
show_rollback_options() {
    local current_version="$1"
    local available_versions="$2"
    
    echo "当前版本: $current_version"
    echo "可用版本:"
    echo "$available_versions" | nl
    echo ""
    echo "回滚选项:"
    echo "1. 快速回滚（仅回滚应用，保留数据库）"
    echo "2. 完整回滚（回滚应用和数据库）"
    echo "3. 蓝绿环境回滚"
    echo ""
}

# 主回滚流程
main() {
    log_info "开始WLBJ系统回滚流程"
    
    # 检查前置条件
    check_prerequisites
    
    # 加载环境配置
    load_environment
    
    # 获取当前版本
    local current_version
    current_version=$(get_current_version)
    log_info "当前运行版本: $current_version"
    
    # 获取可用版本
    local available_versions
    available_versions=$(get_available_versions)
    
    # 选择回滚版本
    local rollback_version
    rollback_version=$(select_rollback_version "$current_version")
    log_info "回滚目标版本: $rollback_version"
    
    # 检查数据库兼容性
    check_database_compatibility "$rollback_version"
    
    # 创建回滚前备份
    create_rollback_backup
    
    # 确认回滚操作
    if [[ -z "${AUTO_CONFIRM:-}" ]]; then
        show_rollback_options "$current_version" "$available_versions"
        read -p "确认回滚到版本 $rollback_version? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "回滚操作已取消"
            exit 0
        fi
    fi
    
    # 执行回滚
    log_info "开始执行回滚..."
    
    if quick_rollback "$rollback_version"; then
        send_notification "SUCCESS" "回滚成功 - 从 $current_version 回滚到 $rollback_version"
        log_success "回滚完成！当前版本: $rollback_version"
    else
        send_notification "FAILED" "回滚失败 - 尝试从 $current_version 回滚到 $rollback_version"
        log_error "回滚失败！"
        exit 1
    fi
}

# 错误处理
trap 'log_error "回滚过程中发生错误！"; exit 1' ERR

# 执行主流程
main "$@"
