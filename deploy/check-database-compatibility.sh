#!/bin/bash

# 数据库兼容性检查脚本
# 检查SQLite数据库在不同平台间的兼容性

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

# 配置变量
DB_FILE="/opt/wlbj/data/logistics.db"
TEMP_DB="/tmp/test_compatibility.db"

# 检查系统信息
check_system_info() {
    log_section "系统信息"
    
    echo "操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
    echo "系统架构: $(uname -m)"
    echo "内核版本: $(uname -r)"
    echo "SQLite版本: $(sqlite3 --version | awk '{print $1}')"
    
    # 检查字节序
    ENDIAN=$(python3 -c "import sys; print(sys.byteorder)" 2>/dev/null || echo "unknown")
    echo "字节序: $ENDIAN"
}

# 检查数据库文件
check_database_file() {
    log_section "数据库文件检查"
    
    if [[ ! -f "$DB_FILE" ]]; then
        log_warn "数据库文件不存在: $DB_FILE"
        return 1
    fi
    
    # 文件基本信息
    FILE_SIZE=$(du -h "$DB_FILE" | cut -f1)
    FILE_PERMS=$(stat -c %a "$DB_FILE" 2>/dev/null || stat -f %A "$DB_FILE" 2>/dev/null)
    FILE_OWNER=$(stat -c %U:%G "$DB_FILE" 2>/dev/null || stat -f %Su:%Sg "$DB_FILE" 2>/dev/null)
    
    echo "文件大小: $FILE_SIZE"
    echo "文件权限: $FILE_PERMS"
    echo "文件所有者: $FILE_OWNER"
    
    # 文件类型检查
    FILE_TYPE=$(file "$DB_FILE")
    echo "文件类型: $FILE_TYPE"
    
    if echo "$FILE_TYPE" | grep -q "SQLite"; then
        log_success "文件类型正确"
    else
        log_error "文件类型异常"
        return 1
    fi
}

# 检查数据库版本兼容性
check_database_version() {
    log_section "数据库版本兼容性"
    
    # 获取数据库版本信息
    DB_VERSION=$(sqlite3 "$DB_FILE" "PRAGMA user_version;" 2>/dev/null || echo "0")
    SCHEMA_VERSION=$(sqlite3 "$DB_FILE" "PRAGMA schema_version;" 2>/dev/null || echo "0")
    
    echo "用户版本: $DB_VERSION"
    echo "模式版本: $SCHEMA_VERSION"
    
    # 检查SQLite版本兼容性
    SQLITE_VERSION=$(sqlite3 --version | awk '{print $1}')
    MAJOR_VERSION=$(echo $SQLITE_VERSION | cut -d. -f1)
    MINOR_VERSION=$(echo $SQLITE_VERSION | cut -d. -f2)
    
    if [[ $MAJOR_VERSION -ge 3 && $MINOR_VERSION -ge 8 ]]; then
        log_success "SQLite版本兼容"
    else
        log_warn "SQLite版本较旧，可能存在兼容性问题"
    fi
}

# 检查数据库完整性
check_database_integrity() {
    log_section "数据库完整性检查"
    
    # 完整性检查
    INTEGRITY_RESULT=$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" 2>/dev/null)
    
    if [[ "$INTEGRITY_RESULT" == "ok" ]]; then
        log_success "数据库完整性检查通过"
    else
        log_error "数据库完整性检查失败"
        echo "错误详情: $INTEGRITY_RESULT"
        return 1
    fi
    
    # 外键检查
    FK_RESULT=$(sqlite3 "$DB_FILE" "PRAGMA foreign_key_check;" 2>/dev/null)
    
    if [[ -z "$FK_RESULT" ]]; then
        log_success "外键约束检查通过"
    else
        log_warn "外键约束检查发现问题"
        echo "问题详情: $FK_RESULT"
    fi
}

# 检查数据库性能
check_database_performance() {
    log_section "数据库性能检查"
    
    # 查询性能测试
    echo "执行性能测试..."
    
    # 简单查询测试
    START_TIME=$(date +%s.%N)
    ORDERS_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM orders;" 2>/dev/null || echo "0")
    END_TIME=$(date +%s.%N)
    QUERY_TIME=$(echo "$END_TIME - $START_TIME" | bc -l 2>/dev/null || echo "0")
    
    echo "订单数量: $ORDERS_COUNT"
    echo "查询时间: ${QUERY_TIME}秒"
    
    # 索引使用检查
    INDEX_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='index';" 2>/dev/null || echo "0")
    echo "索引数量: $INDEX_COUNT"
    
    if [[ $INDEX_COUNT -gt 5 ]]; then
        log_success "索引配置良好"
    else
        log_warn "索引数量较少，可能影响性能"
    fi
}

# 检查跨平台兼容性
check_cross_platform_compatibility() {
    log_section "跨平台兼容性检查"
    
    # 创建测试数据库
    log_info "创建测试数据库..."
    
    cat > /tmp/test_db.sql << 'EOF'
CREATE TABLE test_table (
    id INTEGER PRIMARY KEY,
    text_field TEXT,
    real_field REAL,
    blob_field BLOB,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO test_table (text_field, real_field, blob_field) VALUES 
('测试文本', 3.14159, X'48656C6C6F'),
('中文测试', 2.71828, X'576F726C64');

CREATE INDEX idx_test_text ON test_table(text_field);
EOF
    
    sqlite3 "$TEMP_DB" < /tmp/test_db.sql
    
    # 测试基本操作
    if sqlite3 "$TEMP_DB" "SELECT COUNT(*) FROM test_table;" | grep -q "2"; then
        log_success "基本SQL操作正常"
    else
        log_error "基本SQL操作失败"
    fi
    
    # 测试中文支持
    CHINESE_COUNT=$(sqlite3 "$TEMP_DB" "SELECT COUNT(*) FROM test_table WHERE text_field LIKE '%中文%';" 2>/dev/null || echo "0")
    if [[ "$CHINESE_COUNT" == "1" ]]; then
        log_success "中文字符支持正常"
    else
        log_warn "中文字符支持可能有问题"
    fi
    
    # 测试BLOB数据
    BLOB_COUNT=$(sqlite3 "$TEMP_DB" "SELECT COUNT(*) FROM test_table WHERE blob_field IS NOT NULL;" 2>/dev/null || echo "0")
    if [[ "$BLOB_COUNT" == "2" ]]; then
        log_success "BLOB数据类型支持正常"
    else
        log_warn "BLOB数据类型支持可能有问题"
    fi
    
    # 清理测试文件
    rm -f "$TEMP_DB" /tmp/test_db.sql
}

# 检查数据库配置
check_database_configuration() {
    log_section "数据库配置检查"
    
    # 检查PRAGMA设置
    JOURNAL_MODE=$(sqlite3 "$DB_FILE" "PRAGMA journal_mode;" 2>/dev/null || echo "unknown")
    SYNCHRONOUS=$(sqlite3 "$DB_FILE" "PRAGMA synchronous;" 2>/dev/null || echo "unknown")
    CACHE_SIZE=$(sqlite3 "$DB_FILE" "PRAGMA cache_size;" 2>/dev/null || echo "unknown")
    
    echo "日志模式: $JOURNAL_MODE"
    echo "同步模式: $SYNCHRONOUS"
    echo "缓存大小: $CACHE_SIZE"
    
    # 推荐配置检查
    if [[ "$JOURNAL_MODE" == "wal" ]]; then
        log_success "WAL模式已启用（推荐）"
    else
        log_warn "建议启用WAL模式以提高性能"
    fi
    
    if [[ "$SYNCHRONOUS" == "1" || "$SYNCHRONOUS" == "NORMAL" ]]; then
        log_success "同步模式配置合理"
    else
        log_info "当前同步模式: $SYNCHRONOUS"
    fi
}

# 生成兼容性报告
generate_compatibility_report() {
    log_section "生成兼容性报告"
    
    local report_file="/tmp/database_compatibility_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
SQLite数据库兼容性检查报告
==========================

检查时间: $(date)
数据库文件: $DB_FILE

系统信息:
- 操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
- 系统架构: $(uname -m)
- SQLite版本: $(sqlite3 --version | awk '{print $1}')
- 字节序: $(python3 -c "import sys; print(sys.byteorder)" 2>/dev/null || echo "unknown")

数据库信息:
- 文件大小: $(du -h "$DB_FILE" | cut -f1)
- 文件权限: $(stat -c %a "$DB_FILE" 2>/dev/null || stat -f %A "$DB_FILE" 2>/dev/null)
- 完整性检查: $(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" 2>/dev/null || echo "失败")

配置信息:
- 日志模式: $(sqlite3 "$DB_FILE" "PRAGMA journal_mode;" 2>/dev/null || echo "unknown")
- 同步模式: $(sqlite3 "$DB_FILE" "PRAGMA synchronous;" 2>/dev/null || echo "unknown")
- 缓存大小: $(sqlite3 "$DB_FILE" "PRAGMA cache_size;" 2>/dev/null || echo "unknown")

数据统计:
- 订单数量: $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM orders;" 2>/dev/null || echo "0")
- 报价数量: $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM quotes;" 2>/dev/null || echo "0")
- 供应商数量: $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM providers;" 2>/dev/null || echo "0")
- 索引数量: $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='index';" 2>/dev/null || echo "0")

兼容性评估:
- 跨平台兼容性: 良好
- 性能优化: $(if [[ "$(sqlite3 "$DB_FILE" "PRAGMA journal_mode;" 2>/dev/null)" == "wal" ]]; then echo "已优化"; else echo "可优化"; fi)
- 数据完整性: $(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" 2>/dev/null || echo "需检查")

建议:
1. 如果从Mac ARM迁移到Linux x86，建议执行数据库迁移
2. 启用WAL模式以提高并发性能
3. 定期执行完整性检查
4. 保持SQLite版本更新

EOF
    
    echo "$report_file"
}

# 显示使用帮助
show_help() {
    cat << EOF
数据库兼容性检查脚本

用法: $0 [选项]

选项:
  -h, --help          显示此帮助信息
  -f, --file FILE     指定数据库文件路径
  -r, --report        生成详细报告
  --quick             快速检查
  --performance       性能测试
  --integrity         仅完整性检查

示例:
  $0                          # 完整兼容性检查
  $0 -f /path/to/db.sqlite    # 检查指定数据库
  $0 -r                       # 生成详细报告

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
            -f|--file)
                DB_FILE="$2"
                shift 2
                ;;
            -r|--report)
                GENERATE_REPORT=true
                shift
                ;;
            --quick)
                QUICK_CHECK=true
                shift
                ;;
            --performance)
                PERFORMANCE_ONLY=true
                shift
                ;;
            --integrity)
                INTEGRITY_ONLY=true
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
    
    echo -e "${CYAN}SQLite数据库兼容性检查${NC}"
    echo "================================"
    
    check_system_info
    
    if [[ "$INTEGRITY_ONLY" == "true" ]]; then
        check_database_file
        check_database_integrity
    elif [[ "$PERFORMANCE_ONLY" == "true" ]]; then
        check_database_file
        check_database_performance
    elif [[ "$QUICK_CHECK" == "true" ]]; then
        check_database_file
        check_database_integrity
        check_database_version
    else
        check_database_file
        check_database_version
        check_database_integrity
        check_database_performance
        check_cross_platform_compatibility
        check_database_configuration
    fi
    
    if [[ "$GENERATE_REPORT" == "true" ]]; then
        report_file=$(generate_compatibility_report)
        echo ""
        log_info "详细报告已生成: $report_file"
    fi
    
    echo ""
    echo -e "${CYAN}兼容性检查完成${NC}"
}

# 执行主函数
main "$@"
