#!/bin/bash

# 订单报价显示功能测试脚本
# 使用方法: chmod +x tests/quote-display-test.sh && ./tests/quote-display-test.sh

BASE_URL="http://localhost:3000/api"
TEST_USER='{"email":"lcs","password":"lcslcs"}'

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 测试结果统计
PASSED=0
FAILED=0
TOTAL=0

# 断言函数
assert() {
    local condition=$1
    local message=$2
    TOTAL=$((TOTAL + 1))
    
    if [ "$condition" = "true" ]; then
        PASSED=$((PASSED + 1))
        echo -e "${GREEN}✓ $message${NC}"
        return 0
    else
        FAILED=$((FAILED + 1))
        echo -e "${RED}✗ $message${NC}"
        return 1
    fi
}

# 检查JSON响应是否包含指定字段
check_json_field() {
    local json=$1
    local field=$2
    echo "$json" | grep -q "\"$field\""
}

# 检查HTTP状态码
check_status() {
    local status=$1
    [ "$status" = "200" ]
}

echo -e "${YELLOW}开始执行订单报价显示功能测试...${NC}\n"

# 1. 用户登录测试
echo -e "${BLUE}=== 用户登录测试 ===${NC}"
LOGIN_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "$TEST_USER")

HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed -e 's/HTTPSTATUS:.*//g')

if check_status "$HTTP_STATUS"; then
    TOKEN=$(echo "$LOGIN_BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        assert "true" "用户登录成功，获取到访问令牌"
    else
        assert "false" "登录响应中未找到访问令牌"
        exit 1
    fi
else
    assert "false" "用户登录失败，HTTP状态码: $HTTP_STATUS"
    exit 1
fi

# 2. 最低报价批量查询测试
echo -e "\n${BLUE}=== 最低报价批量查询测试 ===${NC}"
ORDER_IDS="RX250616-004,RX250616-005,RX250618-002,RX250618-001"
BATCH_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X GET \
    "$BASE_URL/quotes/lowest-batch?orderIds=$ORDER_IDS" \
    -H "Authorization: Bearer $TOKEN")

HTTP_STATUS=$(echo "$BATCH_RESPONSE" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BATCH_BODY=$(echo "$BATCH_RESPONSE" | sed -e 's/HTTPSTATUS:.*//g')

if check_status "$HTTP_STATUS"; then
    assert "true" "批量查询API响应成功"
    
    # 检查有报价的订单
    if echo "$BATCH_BODY" | grep -q '"RX250616-004":{"provider"'; then
        assert "true" "RX250616-004 返回了正确的最低报价信息"
        PROVIDER=$(echo "$BATCH_BODY" | grep -o '"RX250616-004":{"provider":"[^"]*"' | cut -d'"' -f6)
        PRICE=$(echo "$BATCH_BODY" | grep -o '"RX250616-004":{"provider":"[^"]*","price":[0-9]*' | grep -o '[0-9]*$')
        echo -e "${CYAN}  RX250616-004: $PROVIDER ¥$PRICE${NC}"
    else
        assert "false" "RX250616-004 未返回正确的最低报价信息"
    fi
    
    # 检查无报价的订单
    if echo "$BATCH_BODY" | grep -q '"RX250618-001":null'; then
        assert "true" "RX250618-001 正确返回null（无报价）"
    else
        assert "false" "RX250618-001 应该返回null"
    fi
else
    assert "false" "批量查询失败，HTTP状态码: $HTTP_STATUS"
fi

# 3. 单个订单最低报价查询测试
echo -e "\n${BLUE}=== 单个订单最低报价查询测试 ===${NC}"
SINGLE_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X GET \
    "$BASE_URL/quotes/lowest/RX250616-004" \
    -H "Authorization: Bearer $TOKEN")

HTTP_STATUS=$(echo "$SINGLE_RESPONSE" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
SINGLE_BODY=$(echo "$SINGLE_RESPONSE" | sed -e 's/HTTPSTATUS:.*//g')

if check_status "$HTTP_STATUS"; then
    if echo "$SINGLE_BODY" | grep -q '"provider"'; then
        assert "true" "RX250616-004 单个查询返回正确的最低报价"
        PROVIDER=$(echo "$SINGLE_BODY" | grep -o '"provider":"[^"]*"' | cut -d'"' -f4)
        PRICE=$(echo "$SINGLE_BODY" | grep -o '"price":[0-9]*' | grep -o '[0-9]*')
        echo -e "${CYAN}  最低报价: $PROVIDER ¥$PRICE${NC}"
    else
        assert "false" "RX250616-004 单个查询未返回正确数据"
    fi
else
    assert "false" "单个查询失败，HTTP状态码: $HTTP_STATUS"
fi

# 4. 历史订单选择报价测试
echo -e "\n${BLUE}=== 历史订单选择报价测试 ===${NC}"
CLOSED_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X GET \
    "$BASE_URL/orders/closed" \
    -H "Authorization: Bearer $TOKEN")

HTTP_STATUS=$(echo "$CLOSED_RESPONSE" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
CLOSED_BODY=$(echo "$CLOSED_RESPONSE" | sed -e 's/HTTPSTATUS:.*//g')

if check_status "$HTTP_STATUS"; then
    assert "true" "历史订单查询API响应成功"
    
    if echo "$CLOSED_BODY" | grep -q '"items":\['; then
        assert "true" "历史订单返回数据格式正确"
        
        # 检查已选择报价的订单
        if echo "$CLOSED_BODY" | grep -q '"selectedProvider":"[^"]*"'; then
            assert "true" "找到已选择报价的历史订单"
            # 提取第一个已选择报价的订单信息
            SELECTED_ORDER=$(echo "$CLOSED_BODY" | grep -o '"id":"[^"]*"[^}]*"selectedProvider":"[^"]*"[^}]*"selectedPrice":[0-9]*' | head -1)
            if [ -n "$SELECTED_ORDER" ]; then
                ORDER_ID=$(echo "$SELECTED_ORDER" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
                PROVIDER=$(echo "$SELECTED_ORDER" | grep -o '"selectedProvider":"[^"]*"' | cut -d'"' -f4)
                PRICE=$(echo "$SELECTED_ORDER" | grep -o '"selectedPrice":[0-9]*' | grep -o '[0-9]*')
                echo -e "${CYAN}  $ORDER_ID: $PROVIDER ¥$PRICE${NC}"
            fi
        fi
        
        # 检查未选择报价的订单
        if echo "$CLOSED_BODY" | grep -q '"selectedProvider":null'; then
            assert "true" "找到未选择报价的历史订单"
        fi
    else
        assert "false" "历史订单返回数据格式错误"
    fi
else
    assert "false" "历史订单查询失败，HTTP状态码: $HTTP_STATUS"
fi

# 5. 活跃订单查询测试
echo -e "\n${BLUE}=== 活跃订单查询测试 ===${NC}"
ACTIVE_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X GET \
    "$BASE_URL/orders?status=active" \
    -H "Authorization: Bearer $TOKEN")

HTTP_STATUS=$(echo "$ACTIVE_RESPONSE" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
ACTIVE_BODY=$(echo "$ACTIVE_RESPONSE" | sed -e 's/HTTPSTATUS:.*//g')

if check_status "$HTTP_STATUS"; then
    assert "true" "活跃订单查询API响应成功"
    
    if echo "$ACTIVE_BODY" | grep -q '"items":\['; then
        assert "true" "活跃订单返回数据格式正确"
        
        if echo "$ACTIVE_BODY" | grep -q '"totalItems":[0-9]*'; then
            assert "true" "总数量字段存在"
        fi
        
        if echo "$ACTIVE_BODY" | grep -q '"currentPage":[0-9]*'; then
            assert "true" "当前页码字段存在"
        fi
        
        # 检查字段兼容性
        if echo "$ACTIVE_BODY" | grep -q '"warehouse"'; then
            assert "true" "订单包含warehouse字段（新字段）"
        fi
        
        if echo "$ACTIVE_BODY" | grep -q '"deliveryAddress"'; then
            assert "true" "订单包含deliveryAddress字段（新字段）"
        fi
    else
        assert "false" "活跃订单返回数据格式错误"
    fi
else
    assert "false" "活跃订单查询失败，HTTP状态码: $HTTP_STATUS"
fi

# 6. 性能测试
echo -e "\n${BLUE}=== 性能测试 ===${NC}"
START_TIME=$(date +%s%3N)
PERF_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X GET \
    "$BASE_URL/quotes/lowest-batch?orderIds=RX250616-004,RX250616-005,RX250618-002" \
    -H "Authorization: Bearer $TOKEN")
END_TIME=$(date +%s%3N)

HTTP_STATUS=$(echo "$PERF_RESPONSE" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
DURATION=$((END_TIME - START_TIME))

if check_status "$HTTP_STATUS"; then
    if [ "$DURATION" -lt 2000 ]; then
        assert "true" "批量查询响应时间 ${DURATION}ms < 2000ms"
    else
        assert "false" "批量查询响应时间 ${DURATION}ms >= 2000ms"
    fi
    echo -e "${CYAN}  批量查询耗时: ${DURATION}ms${NC}"
else
    assert "false" "性能测试失败，HTTP状态码: $HTTP_STATUS"
fi

# 输出测试结果
echo -e "\n${YELLOW}=== 测试结果汇总 ===${NC}"
echo "总测试数: $TOTAL"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"

if [ "$TOTAL" -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc -l)
    echo "成功率: ${SUCCESS_RATE}%"
fi

if [ "$FAILED" -eq 0 ]; then
    echo -e "\n${GREEN}🎉 所有测试通过！修复功能正常工作。${NC}"
    exit 0
else
    echo -e "\n${RED}❌ 部分测试失败，请检查相关功能。${NC}"
    exit 1
fi
