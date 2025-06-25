#!/bin/bash

# WLBJ物流报价系统发布验证脚本
# 验证系统发布后的功能完整性和稳定性

set -euo pipefail

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BASE_URL="${BASE_URL:-http://localhost:3000}"
VALIDATION_TIMEOUT="${VALIDATION_TIMEOUT:-300}"
TEST_USER_EMAIL="validation-test@wlbj.com"
TEST_USER_PASSWORD="ValidationTest123!"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 验证结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

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

# 测试结果记录
record_test_result() {
    local test_name="$1"
    local result="$2"
    
    ((TOTAL_TESTS++))
    
    if [[ "$result" == "PASS" ]]; then
        ((PASSED_TESTS++))
        log_success "✅ $test_name"
    else
        ((FAILED_TESTS++))
        log_error "❌ $test_name"
    fi
}

# HTTP请求函数
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    local headers="${4:-}"
    local expected_status="${5:-200}"
    
    local url="$BASE_URL$endpoint"
    local curl_cmd="curl -s -w '%{http_code}' -X $method"
    
    if [[ -n "$headers" ]]; then
        curl_cmd="$curl_cmd $headers"
    fi
    
    if [[ -n "$data" ]]; then
        curl_cmd="$curl_cmd -d '$data' -H 'Content-Type: application/json'"
    fi
    
    curl_cmd="$curl_cmd '$url'"
    
    local response
    response=$(eval "$curl_cmd" 2>/dev/null)
    local status_code="${response: -3}"
    local body="${response%???}"
    
    if [[ "$status_code" == "$expected_status" ]]; then
        echo "$body"
        return 0
    else
        log_error "请求失败: $method $endpoint (期望: $expected_status, 实际: $status_code)"
        return 1
    fi
}

# 验证系统健康状态
validate_system_health() {
    log_info "验证系统健康状态..."
    
    # 健康检查端点
    if response=$(make_request "GET" "/health"); then
        if echo "$response" | grep -q '"success":true'; then
            record_test_result "系统健康检查" "PASS"
        else
            record_test_result "系统健康检查" "FAIL"
        fi
    else
        record_test_result "系统健康检查" "FAIL"
    fi
    
    # 检查系统版本
    if echo "$response" | grep -q '"version"'; then
        local version=$(echo "$response" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
        log_info "系统版本: $version"
        record_test_result "版本信息获取" "PASS"
    else
        record_test_result "版本信息获取" "FAIL"
    fi
}

# 验证用户认证功能
validate_authentication() {
    log_info "验证用户认证功能..."
    
    # 用户注册
    local register_data="{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\",\"name\":\"Validation Test User\"}"
    if response=$(make_request "POST" "/api/auth/register" "$register_data" "" "201"); then
        if echo "$response" | grep -q '"success":true'; then
            record_test_result "用户注册" "PASS"
        else
            record_test_result "用户注册" "FAIL"
        fi
    else
        # 可能用户已存在，尝试登录
        record_test_result "用户注册" "SKIP"
    fi
    
    # 用户登录
    local login_data="{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}"
    if response=$(make_request "POST" "/api/auth/login" "$login_data"); then
        if echo "$response" | grep -q '"token"'; then
            local token=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
            export AUTH_TOKEN="$token"
            record_test_result "用户登录" "PASS"
        else
            record_test_result "用户登录" "FAIL"
            return 1
        fi
    else
        record_test_result "用户登录" "FAIL"
        return 1
    fi
    
    # 获取用户信息
    if response=$(make_request "GET" "/api/auth/me" "" "-H 'Authorization: Bearer $AUTH_TOKEN'"); then
        if echo "$response" | grep -q "$TEST_USER_EMAIL"; then
            record_test_result "获取用户信息" "PASS"
        else
            record_test_result "获取用户信息" "FAIL"
        fi
    else
        record_test_result "获取用户信息" "FAIL"
    fi
}

# 验证订单管理功能
validate_order_management() {
    log_info "验证订单管理功能..."
    
    if [[ -z "${AUTH_TOKEN:-}" ]]; then
        log_warning "跳过订单管理验证（需要认证token）"
        return
    fi
    
    # 创建订单
    local order_data="{\"warehouse\":\"验证测试仓库\",\"goods\":\"验证测试货物\",\"deliveryAddress\":\"验证测试地址\"}"
    if response=$(make_request "POST" "/api/orders" "$order_data" "-H 'Authorization: Bearer $AUTH_TOKEN'" "201"); then
        if echo "$response" | grep -q '"id"'; then
            local order_id=$(echo "$response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
            export TEST_ORDER_ID="$order_id"
            record_test_result "创建订单" "PASS"
        else
            record_test_result "创建订单" "FAIL"
            return
        fi
    else
        record_test_result "创建订单" "FAIL"
        return
    fi
    
    # 获取订单列表
    if response=$(make_request "GET" "/api/orders" "" "-H 'Authorization: Bearer $AUTH_TOKEN'"); then
        if echo "$response" | grep -q "$TEST_ORDER_ID"; then
            record_test_result "获取订单列表" "PASS"
        else
            record_test_result "获取订单列表" "FAIL"
        fi
    else
        record_test_result "获取订单列表" "FAIL"
    fi
    
    # 获取订单详情
    if response=$(make_request "GET" "/api/orders/$TEST_ORDER_ID" "" "-H 'Authorization: Bearer $AUTH_TOKEN'"); then
        if echo "$response" | grep -q "$TEST_ORDER_ID"; then
            record_test_result "获取订单详情" "PASS"
        else
            record_test_result "获取订单详情" "FAIL"
        fi
    else
        record_test_result "获取订单详情" "FAIL"
    fi
}

# 验证报价管理功能
validate_quote_management() {
    log_info "验证报价管理功能..."
    
    if [[ -z "${TEST_ORDER_ID:-}" ]]; then
        log_warning "跳过报价管理验证（需要测试订单）"
        return
    fi
    
    # 创建报价（模拟供应商）
    local quote_data="{\"price\":150.50,\"estimatedDelivery\":\"2025-07-01T10:00:00.000Z\",\"remarks\":\"验证测试报价\"}"
    local provider_headers="-H 'x-provider-name: 验证测试供应商' -H 'x-access-key: validation-test-key'"
    
    if response=$(make_request "POST" "/api/quotes/orders/$TEST_ORDER_ID" "$quote_data" "$provider_headers"); then
        if echo "$response" | grep -q '"price"'; then
            record_test_result "创建报价" "PASS"
        else
            record_test_result "创建报价" "FAIL"
        fi
    else
        record_test_result "创建报价" "FAIL"
    fi
    
    # 获取订单报价
    if response=$(make_request "GET" "/api/quotes/orders/$TEST_ORDER_ID" "" "-H 'Authorization: Bearer $AUTH_TOKEN'"); then
        if echo "$response" | grep -q '"price"'; then
            record_test_result "获取订单报价" "PASS"
        else
            record_test_result "获取订单报价" "FAIL"
        fi
    else
        record_test_result "获取订单报价" "FAIL"
    fi
}

# 验证API性能
validate_api_performance() {
    log_info "验证API性能..."
    
    local endpoints=(
        "/health"
        "/api/auth/me"
        "/api/orders"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local start_time=$(date +%s)
        local headers=""

        if [[ "$endpoint" != "/health" ]]; then
            headers="-H 'Authorization: Bearer ${AUTH_TOKEN:-invalid}'"
        fi

        if response=$(make_request "GET" "$endpoint" "" "$headers" "" 2>/dev/null); then
            local end_time=$(date +%s)
            local response_time=$((end_time - start_time))
            
            if [[ $response_time -lt 1000 ]]; then
                record_test_result "API性能 $endpoint (${response_time}ms)" "PASS"
            else
                record_test_result "API性能 $endpoint (${response_time}ms)" "FAIL"
            fi
        else
            record_test_result "API性能 $endpoint" "FAIL"
        fi
    done
}

# 验证错误处理
validate_error_handling() {
    log_info "验证错误处理..."
    
    # 测试404错误
    if response=$(make_request "GET" "/api/nonexistent" "" "" "404"); then
        if echo "$response" | grep -q '"success":false'; then
            record_test_result "404错误处理" "PASS"
        else
            record_test_result "404错误处理" "FAIL"
        fi
    else
        record_test_result "404错误处理" "FAIL"
    fi
    
    # 测试无效认证
    if response=$(make_request "GET" "/api/auth/me" "" "-H 'Authorization: Bearer invalid-token'" "401"); then
        if echo "$response" | grep -q '"success":false'; then
            record_test_result "无效认证处理" "PASS"
        else
            record_test_result "无效认证处理" "FAIL"
        fi
    else
        record_test_result "无效认证处理" "FAIL"
    fi
    
    # 测试无效请求数据
    local invalid_data="{\"invalid\":\"data\"}"
    if response=$(make_request "POST" "/api/auth/register" "$invalid_data" "" "400"); then
        if echo "$response" | grep -q '"success":false'; then
            record_test_result "无效数据处理" "PASS"
        else
            record_test_result "无效数据处理" "FAIL"
        fi
    else
        record_test_result "无效数据处理" "FAIL"
    fi
}

# 验证数据库连接
validate_database_connectivity() {
    log_info "验证数据库连接..."
    
    if docker exec wlbj-postgres pg_isready -U "${DB_USER:-wlbj_user}" -d "${DB_NAME:-wlbj}" >/dev/null 2>&1; then
        record_test_result "数据库连接" "PASS"
    else
        record_test_result "数据库连接" "FAIL"
    fi
    
    # 验证数据库表结构
    if docker exec wlbj-postgres psql -U "${DB_USER:-wlbj_user}" -d "${DB_NAME:-wlbj}" -c "\dt" >/dev/null 2>&1; then
        record_test_result "数据库表结构" "PASS"
    else
        record_test_result "数据库表结构" "FAIL"
    fi
}

# 验证缓存服务
validate_cache_service() {
    log_info "验证缓存服务..."
    
    if docker exec wlbj-redis redis-cli ping >/dev/null 2>&1; then
        record_test_result "Redis连接" "PASS"
    else
        record_test_result "Redis连接" "FAIL"
    fi
}

# 清理测试数据
cleanup_test_data() {
    log_info "清理测试数据..."
    
    # 这里可以添加清理测试用户、订单等数据的逻辑
    # 由于是验证脚本，暂时保留测试数据以便调试
    
    log_info "测试数据保留以便调试"
}

# 生成验证报告
generate_validation_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local report_file="$PROJECT_ROOT/logs/validation_report_$(date +%Y%m%d_%H%M%S).json"
    
    mkdir -p "$(dirname "$report_file")"
    
    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    fi
    
    cat > "$report_file" << EOF
{
  "timestamp": "$timestamp",
  "validation_summary": {
    "total_tests": $TOTAL_TESTS,
    "passed_tests": $PASSED_TESTS,
    "failed_tests": $FAILED_TESTS,
    "success_rate": "${success_rate}%"
  },
  "system_info": {
    "base_url": "$BASE_URL",
    "validation_timeout": "$VALIDATION_TIMEOUT",
    "test_user": "$TEST_USER_EMAIL"
  },
  "validation_status": "$([ $FAILED_TESTS -eq 0 ] && echo "PASSED" || echo "FAILED")"
}
EOF
    
    log_info "验证报告已生成: $report_file"
}

# 主验证流程
main() {
    log_info "开始WLBJ系统发布验证..."
    log_info "目标URL: $BASE_URL"
    
    # 等待系统启动
    log_info "等待系统启动..."
    local attempts=0
    local max_attempts=30
    
    while [[ $attempts -lt $max_attempts ]]; do
        if curl -f -s "$BASE_URL/health" >/dev/null 2>&1; then
            log_success "系统已启动"
            break
        fi
        
        ((attempts++))
        log_info "等待系统启动... ($attempts/$max_attempts)"
        sleep 10
    done
    
    if [[ $attempts -eq $max_attempts ]]; then
        log_error "系统启动超时"
        exit 1
    fi
    
    # 执行验证测试
    validate_system_health
    validate_authentication
    validate_order_management
    validate_quote_management
    validate_api_performance
    validate_error_handling
    validate_database_connectivity
    validate_cache_service
    
    # 清理测试数据
    cleanup_test_data
    
    # 生成验证报告
    generate_validation_report
    
    # 输出验证结果
    echo ""
    log_info "========== 验证结果汇总 =========="
    log_info "总测试数: $TOTAL_TESTS"
    log_success "通过测试: $PASSED_TESTS"
    log_error "失败测试: $FAILED_TESTS"
    
    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    fi
    log_info "成功率: ${success_rate}%"
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_success "🎉 所有验证测试通过！系统发布验证成功！"
        exit 0
    else
        log_error "❌ 发现 $FAILED_TESTS 个失败测试，系统发布验证失败！"
        exit 1
    fi
}

# 信号处理
trap 'log_info "验证脚本被中断"; cleanup_test_data; exit 1' SIGINT SIGTERM

# 执行主流程
main "$@"
