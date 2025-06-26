#!/bin/bash

# WLBJ物流报价系统 - 生产环境兼容性验证脚本

set -euo pipefail

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# 验证结果统计
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# 记录检查结果
record_check() {
    local result=$1
    local message=$2
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ "$result" = "pass" ]; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        log_success "$message"
    else
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        log_error "$message"
    fi
}

# 检查Node.js环境
check_node_environment() {
    log_info "检查Node.js环境..."
    
    # 检查Node.js版本
    if command -v node &> /dev/null; then
        local node_version=$(node -v)
        if node -e "process.exit(process.version.slice(1).split('.').map(Number).reduce((a,b,i)=>(a||0)*1000+b,0) >= '18.0.0'.split('.').map(Number).reduce((a,b,i)=>(a||0)*1000+b,0) ? 0 : 1)"; then
            record_check "pass" "Node.js版本符合要求: $node_version"
        else
            record_check "fail" "Node.js版本过低: $node_version (需要 >= 18.0.0)"
        fi
    else
        record_check "fail" "Node.js未安装"
    fi
    
    # 检查npm版本
    if command -v npm &> /dev/null; then
        local npm_version=$(npm -v)
        record_check "pass" "npm版本: $npm_version"
    else
        record_check "fail" "npm未安装"
    fi
}

# 检查项目依赖
check_dependencies() {
    log_info "检查项目依赖..."
    
    cd "$PROJECT_ROOT"
    
    # 检查package.json
    if [ -f "package.json" ]; then
        record_check "pass" "package.json存在"
    else
        record_check "fail" "package.json不存在"
        return
    fi
    
    # 检查依赖安装
    if [ -d "node_modules" ]; then
        record_check "pass" "依赖已安装"
    else
        log_warning "依赖未安装，正在安装..."
        if npm ci --only=production; then
            record_check "pass" "生产依赖安装成功"
        else
            record_check "fail" "生产依赖安装失败"
        fi
    fi
    
    # 检查安全漏洞
    if npm audit --audit-level moderate --only=prod 2>/dev/null; then
        record_check "pass" "依赖安全检查通过"
    else
        record_check "warning" "发现依赖安全漏洞"
    fi
}

# 检查应用结构
check_application_structure() {
    log_info "检查应用结构..."
    
    cd "$PROJECT_ROOT"
    
    # 检查关键文件
    local required_files=(
        "src/app.js"
        "src/config/env.js"
        "src/config/logger.js"
        "src/routes/index.js"
        "src/middleware/index.js"
        "package.json"
        "knexfile.js"
    )
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            record_check "pass" "关键文件存在: $file"
        else
            record_check "fail" "关键文件缺失: $file"
        fi
    done
    
    # 检查目录结构
    local required_dirs=(
        "src/controllers"
        "src/services"
        "src/repositories"
        "src/middleware"
        "src/routes"
        "migrations"
        "logs"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            record_check "pass" "目录存在: $dir"
        else
            record_check "fail" "目录缺失: $dir"
        fi
    done
}

# 检查环境配置
check_environment_config() {
    log_info "检查环境配置..."
    
    cd "$PROJECT_ROOT"
    
    # 检查环境配置文件
    if [ -f ".env.production.example" ]; then
        record_check "pass" "生产环境配置模板存在"
    else
        record_check "fail" "生产环境配置模板缺失"
    fi
    
    # 检查必需的环境变量
    local required_env_vars=(
        "NODE_ENV"
        "PORT"
        "JWT_SECRET"
    )
    
    # 临时设置生产环境
    export NODE_ENV=production
    export JWT_SECRET=test-secret-for-validation
    export PORT=3000
    
    # 尝试加载配置
    if node -e "require('./src/config/env')" 2>/dev/null; then
        record_check "pass" "环境配置加载成功"
    else
        record_check "fail" "环境配置加载失败"
    fi
}

# 检查数据库配置
check_database_config() {
    log_info "检查数据库配置..."
    
    cd "$PROJECT_ROOT"
    
    # 检查knex配置
    if node -e "require('./knexfile')" 2>/dev/null; then
        record_check "pass" "数据库配置有效"
    else
        record_check "fail" "数据库配置无效"
    fi
    
    # 检查迁移文件
    if [ -d "migrations" ] && [ "$(ls -A migrations)" ]; then
        record_check "pass" "数据库迁移文件存在"
    else
        record_check "fail" "数据库迁移文件缺失"
    fi
}

# 检查Docker配置
check_docker_config() {
    log_info "检查Docker配置..."
    
    cd "$PROJECT_ROOT"
    
    # 检查Dockerfile
    if [ -f "Dockerfile" ]; then
        record_check "pass" "Dockerfile存在"
        
        # 验证Dockerfile语法
        if command -v docker &> /dev/null; then
            if docker build -t wlbj-validation:test --target runner . >/dev/null 2>&1; then
                record_check "pass" "Dockerfile构建成功"
                docker rmi wlbj-validation:test >/dev/null 2>&1 || true
            else
                record_check "fail" "Dockerfile构建失败"
            fi
        else
            record_check "warning" "Docker未安装，跳过构建测试"
        fi
    else
        record_check "fail" "Dockerfile不存在"
    fi
    
    # 检查docker-compose配置
    if [ -f "docker-compose.yml" ]; then
        record_check "pass" "docker-compose.yml存在"
    else
        record_check "fail" "docker-compose.yml不存在"
    fi
}

# 检查启动脚本
check_startup_scripts() {
    log_info "检查启动脚本..."
    
    cd "$PROJECT_ROOT"
    
    # 检查package.json脚本
    local required_scripts=("start" "dev" "test")
    
    for script in "${required_scripts[@]}"; do
        if npm run "$script" --silent 2>/dev/null | grep -q "Missing script"; then
            record_check "fail" "缺少npm脚本: $script"
        else
            record_check "pass" "npm脚本存在: $script"
        fi
    done
    
    # 检查自定义启动脚本
    if [ -f "scripts/start.sh" ] && [ -x "scripts/start.sh" ]; then
        record_check "pass" "自定义启动脚本存在且可执行"
    else
        record_check "warning" "自定义启动脚本不存在或不可执行"
    fi
}

# 性能测试
check_performance() {
    log_info "检查性能配置..."
    
    cd "$PROJECT_ROOT"
    
    # 检查内存使用配置
    if grep -q "max-old-space-size" package.json 2>/dev/null; then
        record_check "pass" "Node.js内存配置已设置"
    else
        record_check "warning" "未设置Node.js内存配置"
    fi
    
    # 检查生产优化
    export NODE_ENV=production
    if node -e "console.log(process.env.NODE_ENV)" | grep -q "production"; then
        record_check "pass" "生产环境变量设置正确"
    else
        record_check "fail" "生产环境变量设置错误"
    fi
}

# 安全检查
check_security() {
    log_info "检查安全配置..."
    
    cd "$PROJECT_ROOT"
    
    # 检查安全中间件
    if grep -q "helmet" src/app.js 2>/dev/null; then
        record_check "pass" "安全头中间件已配置"
    else
        record_check "fail" "安全头中间件未配置"
    fi
    
    # 检查CORS配置
    if grep -q "cors" src/app.js 2>/dev/null; then
        record_check "pass" "CORS配置已设置"
    else
        record_check "fail" "CORS配置未设置"
    fi
    
    # 检查限流配置
    if grep -q "rate-limit" src/app.js 2>/dev/null || find src -name "*.js" -exec grep -l "rate.*limit" {} \; | head -1 >/dev/null; then
        record_check "pass" "限流配置已设置"
    else
        record_check "warning" "限流配置未设置"
    fi
}

# 生成报告
generate_report() {
    echo ""
    log_info "生产环境兼容性验证报告"
    echo "=================================="
    echo "总检查项: $TOTAL_CHECKS"
    echo "通过: $PASSED_CHECKS"
    echo "失败: $FAILED_CHECKS"
    echo ""
    
    local success_rate=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    
    if [ $success_rate -ge 90 ]; then
        log_success "验证通过率: ${success_rate}% - 生产环境就绪"
        return 0
    elif [ $success_rate -ge 70 ]; then
        log_warning "验证通过率: ${success_rate}% - 需要修复部分问题"
        return 1
    else
        log_error "验证通过率: ${success_rate}% - 不建议部署到生产环境"
        return 2
    fi
}

# 主函数
main() {
    log_info "开始生产环境兼容性验证..."
    
    check_node_environment
    check_dependencies
    check_application_structure
    check_environment_config
    check_database_config
    check_docker_config
    check_startup_scripts
    check_performance
    check_security
    
    generate_report
}

# 执行主流程
main "$@"
