#!/bin/bash

# 数据库迁移脚本 - 从Mac ARM到Linux x86的SQLite数据库迁移
# 确保跨平台兼容性和性能优化

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 配置变量
APP_DIR="/opt/wlbj"
DATA_DIR="$APP_DIR/data"
BACKUP_DIR="/opt/backups/wlbj/migration"
OLD_DB="$DATA_DIR/logistics.db"
NEW_DB="$DATA_DIR/logistics_new.db"
EXPORT_FILE="$BACKUP_DIR/database_export_$(date +%Y%m%d_%H%M%S).sql"

# 检查环境
check_environment() {
    log_step "检查迁移环境..."
    
    # 检查SQLite版本
    SQLITE_VERSION=$(sqlite3 --version | awk '{print $1}')
    log_info "SQLite版本: $SQLITE_VERSION"
    
    # 检查系统架构
    ARCH=$(uname -m)
    log_info "系统架构: $ARCH"
    
    # 检查操作系统
    OS=$(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
    log_info "操作系统: $OS"
    
    # 创建备份目录
    mkdir -p "$BACKUP_DIR"
    
    log_info "环境检查完成"
}

# 备份原数据库
backup_original_database() {
    log_step "备份原数据库..."
    
    if [[ -f "$OLD_DB" ]]; then
        # 创建二进制备份
        cp "$OLD_DB" "$BACKUP_DIR/logistics_original_$(date +%Y%m%d_%H%M%S).db"
        
        # 导出SQL格式备份
        sqlite3 "$OLD_DB" ".dump" > "$EXPORT_FILE"
        
        log_info "数据库备份完成"
        log_info "二进制备份: $BACKUP_DIR/"
        log_info "SQL导出: $EXPORT_FILE"
    else
        log_warn "原数据库文件不存在，将创建新数据库"
    fi
}

# 验证数据完整性
verify_data_integrity() {
    log_step "验证数据完整性..."
    
    if [[ -f "$OLD_DB" ]]; then
        # 检查数据库完整性
        if sqlite3 "$OLD_DB" "PRAGMA integrity_check;" | grep -q "ok"; then
            log_info "数据库完整性检查通过"
        else
            log_error "数据库完整性检查失败"
            return 1
        fi
        
        # 统计数据量
        ORDERS_COUNT=$(sqlite3 "$OLD_DB" "SELECT COUNT(*) FROM orders;")
        QUOTES_COUNT=$(sqlite3 "$OLD_DB" "SELECT COUNT(*) FROM quotes;")
        PROVIDERS_COUNT=$(sqlite3 "$OLD_DB" "SELECT COUNT(*) FROM providers;")
        
        log_info "数据统计:"
        log_info "  订单数量: $ORDERS_COUNT"
        log_info "  报价数量: $QUOTES_COUNT"
        log_info "  供应商数量: $PROVIDERS_COUNT"
        
        # 保存统计信息
        cat > "$BACKUP_DIR/data_stats.txt" << EOF
数据库迁移统计信息
==================
迁移时间: $(date)
原系统: Mac ARM
目标系统: Linux x86

数据统计:
- 订单数量: $ORDERS_COUNT
- 报价数量: $QUOTES_COUNT
- 供应商数量: $PROVIDERS_COUNT

SQLite版本: $SQLITE_VERSION
系统架构: $ARCH
操作系统: $OS
EOF
        
    else
        log_info "原数据库不存在，将创建空数据库"
    fi
}

# 创建新数据库结构
create_new_database() {
    log_step "创建新数据库结构..."
    
    # 删除旧的新数据库文件（如果存在）
    rm -f "$NEW_DB"
    
    # 使用Node.js脚本创建新数据库
    cd "$APP_DIR"
    
    # 创建临时初始化脚本
    cat > /tmp/init_db.js << 'EOF'
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.argv[2];
console.log('创建新数据库:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库创建失败:', err.message);
        process.exit(1);
    }
    console.log('数据库连接成功');
});

// 创建表结构
const createTables = `
-- 订单表
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    warehouse TEXT NOT NULL,
    goods TEXT NOT NULL,
    deliveryAddress TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT,
    status TEXT DEFAULT 'active',
    selectedProvider TEXT,
    selectedPrice REAL,
    selectedAt TEXT
);

-- 报价表
CREATE TABLE quotes (
    id TEXT PRIMARY KEY,
    orderId TEXT NOT NULL,
    provider TEXT NOT NULL,
    price REAL NOT NULL,
    estimatedDelivery TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (orderId) REFERENCES orders(id)
);

-- 供应商表
CREATE TABLE providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    accessKey TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    wechat_webhook_url TEXT
);

-- 创建索引
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(createdAt DESC);
CREATE INDEX idx_orders_status_created ON orders(status, createdAt DESC);
CREATE INDEX idx_orders_warehouse ON orders(warehouse);
CREATE INDEX idx_quotes_order_id ON quotes(orderId);
CREATE INDEX idx_quotes_provider ON quotes(provider);
CREATE INDEX idx_quotes_order_provider ON quotes(orderId, provider);
CREATE INDEX idx_quotes_price ON quotes(price);
CREATE INDEX idx_quotes_created_at ON quotes(createdAt DESC);
CREATE INDEX idx_providers_access_key ON providers(accessKey);
CREATE INDEX idx_providers_name ON providers(name);
`;

db.exec(createTables, (err) => {
    if (err) {
        console.error('表创建失败:', err.message);
        process.exit(1);
    }
    console.log('数据库表创建成功');
    
    // 优化数据库设置
    const optimizations = `
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = 10000;
        PRAGMA temp_store = memory;
        PRAGMA mmap_size = 268435456;
    `;
    
    db.exec(optimizations, (err) => {
        if (err) {
            console.error('数据库优化失败:', err.message);
        } else {
            console.log('数据库优化完成');
        }
        
        db.close((err) => {
            if (err) {
                console.error('数据库关闭失败:', err.message);
                process.exit(1);
            }
            console.log('数据库初始化完成');
        });
    });
});
EOF
    
    # 执行数据库初始化
    node /tmp/init_db.js "$NEW_DB"
    
    # 清理临时文件
    rm -f /tmp/init_db.js
    
    log_info "新数据库创建完成"
}

# 迁移数据
migrate_data() {
    log_step "迁移数据..."
    
    if [[ -f "$OLD_DB" && -f "$EXPORT_FILE" ]]; then
        # 使用SQL导出文件迁移数据
        log_info "从SQL导出文件迁移数据..."
        
        # 提取INSERT语句
        grep "^INSERT INTO" "$EXPORT_FILE" > /tmp/data_only.sql
        
        # 导入数据到新数据库
        sqlite3 "$NEW_DB" < /tmp/data_only.sql
        
        # 清理临时文件
        rm -f /tmp/data_only.sql
        
        log_info "数据迁移完成"
    else
        log_info "无原数据需要迁移，使用空数据库"
    fi
}

# 验证迁移结果
verify_migration() {
    log_step "验证迁移结果..."
    
    # 检查新数据库完整性
    if sqlite3 "$NEW_DB" "PRAGMA integrity_check;" | grep -q "ok"; then
        log_info "新数据库完整性检查通过"
    else
        log_error "新数据库完整性检查失败"
        return 1
    fi
    
    # 统计新数据库数据量
    NEW_ORDERS_COUNT=$(sqlite3 "$NEW_DB" "SELECT COUNT(*) FROM orders;")
    NEW_QUOTES_COUNT=$(sqlite3 "$NEW_DB" "SELECT COUNT(*) FROM quotes;")
    NEW_PROVIDERS_COUNT=$(sqlite3 "$NEW_DB" "SELECT COUNT(*) FROM providers;")
    
    log_info "新数据库统计:"
    log_info "  订单数量: $NEW_ORDERS_COUNT"
    log_info "  报价数量: $NEW_QUOTES_COUNT"
    log_info "  供应商数量: $NEW_PROVIDERS_COUNT"
    
    # 如果有原数据，比较数据量
    if [[ -f "$OLD_DB" ]]; then
        ORDERS_COUNT=$(sqlite3 "$OLD_DB" "SELECT COUNT(*) FROM orders;")
        QUOTES_COUNT=$(sqlite3 "$OLD_DB" "SELECT COUNT(*) FROM quotes;")
        PROVIDERS_COUNT=$(sqlite3 "$OLD_DB" "SELECT COUNT(*) FROM providers;")
        
        if [[ "$NEW_ORDERS_COUNT" == "$ORDERS_COUNT" && 
              "$NEW_QUOTES_COUNT" == "$QUOTES_COUNT" && 
              "$NEW_PROVIDERS_COUNT" == "$PROVIDERS_COUNT" ]]; then
            log_info "数据迁移验证成功，数据量一致"
        else
            log_error "数据迁移验证失败，数据量不一致"
            log_error "原数据: 订单$ORDERS_COUNT, 报价$QUOTES_COUNT, 供应商$PROVIDERS_COUNT"
            log_error "新数据: 订单$NEW_ORDERS_COUNT, 报价$NEW_QUOTES_COUNT, 供应商$NEW_PROVIDERS_COUNT"
            return 1
        fi
    fi
    
    # 测试数据库性能
    log_info "测试数据库性能..."
    time sqlite3 "$NEW_DB" "SELECT COUNT(*) FROM orders WHERE status = 'active';" >/dev/null
    
    log_info "迁移验证完成"
}

# 替换数据库文件
replace_database() {
    log_step "替换数据库文件..."
    
    # 停止应用（如果正在运行）
    if command -v pm2 &> /dev/null && pm2 list | grep -q "wlbj-app"; then
        log_info "停止应用..."
        pm2 stop wlbj-app
        NEED_RESTART=true
    fi
    
    # 备份当前数据库
    if [[ -f "$OLD_DB" ]]; then
        mv "$OLD_DB" "$OLD_DB.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # 替换为新数据库
    mv "$NEW_DB" "$OLD_DB"
    
    # 设置正确的权限
    chown wlbj:wlbj "$OLD_DB"
    chmod 644 "$OLD_DB"
    
    # 重启应用（如果之前在运行）
    if [[ "$NEED_RESTART" == "true" ]]; then
        log_info "重启应用..."
        pm2 start wlbj-app
    fi
    
    log_info "数据库替换完成"
}

# 清理临时文件
cleanup() {
    log_step "清理临时文件..."
    
    # 清理WAL和SHM文件
    rm -f "$DATA_DIR"/*.db-wal "$DATA_DIR"/*.db-shm
    
    log_info "清理完成"
}

# 生成迁移报告
generate_report() {
    log_step "生成迁移报告..."
    
    local report_file="$BACKUP_DIR/migration_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
数据库迁移报告
==============

迁移时间: $(date)
迁移类型: Mac ARM SQLite -> Linux x86 SQLite

系统信息:
- 操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
- 系统架构: $(uname -m)
- SQLite版本: $(sqlite3 --version | awk '{print $1}')

迁移结果:
- 状态: 成功
- 数据完整性: 通过
- 性能优化: 已应用

数据统计:
$(sqlite3 "$OLD_DB" "
SELECT 
    '- 订单数量: ' || COUNT(*) 
FROM orders
UNION ALL
SELECT 
    '- 报价数量: ' || COUNT(*) 
FROM quotes
UNION ALL
SELECT 
    '- 供应商数量: ' || COUNT(*) 
FROM providers;
")

备份文件:
- 原数据库备份: $BACKUP_DIR/
- SQL导出文件: $EXPORT_FILE

注意事项:
1. 原数据库已备份，可安全回滚
2. 新数据库已优化性能配置
3. 建议定期备份数据库
4. 监控应用运行状态

EOF
    
    log_info "迁移报告已生成: $report_file"
}

# 显示使用帮助
show_help() {
    cat << EOF
数据库迁移脚本 - Mac ARM到Linux x86

用法: $0 [选项]

选项:
  -h, --help          显示此帮助信息
  -f, --force         强制迁移，跳过确认
  --backup-only       仅备份，不执行迁移
  --verify-only       仅验证，不执行迁移
  --rollback          回滚到备份

示例:
  $0                  # 完整迁移流程
  $0 -f               # 强制迁移
  $0 --backup-only    # 仅备份数据库

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
            -f|--force)
                FORCE_MIGRATION=true
                shift
                ;;
            --backup-only)
                BACKUP_ONLY=true
                shift
                ;;
            --verify-only)
                VERIFY_ONLY=true
                shift
                ;;
            --rollback)
                ROLLBACK_MODE=true
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 主函数
main() {
    log_info "开始数据库迁移 (Mac ARM -> Linux x86)..."
    
    parse_args "$@"
    check_environment
    
    if [[ "$ROLLBACK_MODE" == "true" ]]; then
        log_info "回滚功能待实现"
        exit 0
    fi
    
    if [[ "$BACKUP_ONLY" == "true" ]]; then
        backup_original_database
        verify_data_integrity
        exit 0
    fi
    
    if [[ "$VERIFY_ONLY" == "true" ]]; then
        verify_data_integrity
        exit 0
    fi
    
    # 确认迁移
    if [[ "$FORCE_MIGRATION" != "true" ]]; then
        echo "此操作将迁移SQLite数据库以确保Linux x86兼容性"
        read -p "确认执行迁移? (y/N): " confirm
        if [[ ! $confirm =~ ^[Yy]$ ]]; then
            log_info "迁移已取消"
            exit 0
        fi
    fi
    
    # 执行迁移流程
    backup_original_database
    verify_data_integrity
    create_new_database
    migrate_data
    verify_migration
    replace_database
    cleanup
    generate_report
    
    log_info "数据库迁移完成！"
    log_info "建议运行应用测试以确保功能正常"
}

# 执行主函数
main "$@"
