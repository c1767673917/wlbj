#!/bin/bash

# 物流报价系统数据恢复脚本
# 支持从本地和云存储恢复数据

# =============================================================================
# 配置区域
# =============================================================================

APP_NAME="wlbj-logistics"
APP_DIR="/path/to/your/wlbj"  # 替换为实际路径
BACKUP_ROOT="/backup"
LOG_FILE="/var/log/restore-${APP_NAME}.log"

# =============================================================================
# 工具函数
# =============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error_exit() {
    log "❌ 错误: $1"
    exit 1
}

# 显示使用说明
show_usage() {
    echo "物流报价系统数据恢复工具"
    echo ""
    echo "用法: $0 [选项] [备份日期]"
    echo ""
    echo "选项:"
    echo "  -l, --list          列出可用的备份"
    echo "  -d, --database      仅恢复数据库"
    echo "  -c, --config        仅恢复配置文件"
    echo "  -f, --frontend      仅恢复前端文件"
    echo "  -a, --all           恢复所有数据 (默认)"
    echo "  -s, --source PATH   指定备份源路径"
    echo "  -h, --help          显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 --list                    # 列出所有备份"
    echo "  $0 20241201_143000          # 恢复指定日期的完整备份"
    echo "  $0 -d 20241201_143000       # 仅恢复数据库"
    echo "  $0 -s /custom/backup/path   # 从自定义路径恢复"
}

# 列出可用备份
list_backups() {
    log "📋 可用的备份列表:"
    echo ""
    
    if [ -d "$BACKUP_ROOT/$APP_NAME" ]; then
        local backups=($(ls -1 "$BACKUP_ROOT/$APP_NAME" | grep "^20" | sort -r))
        
        if [ ${#backups[@]} -eq 0 ]; then
            echo "  ❌ 未找到任何备份"
            return 1
        fi
        
        echo "  日期时间          大小      位置"
        echo "  ----------------------------------------"
        
        for backup in "${backups[@]}"; do
            local backup_path="$BACKUP_ROOT/$APP_NAME/$backup"
            local size=$(du -sh "$backup_path" 2>/dev/null | cut -f1)
            printf "  %-16s  %-8s  %s\n" "$backup" "$size" "$backup_path"
        done
    else
        echo "  ❌ 备份目录不存在: $BACKUP_ROOT/$APP_NAME"
        return 1
    fi
    
    echo ""
}

# 验证备份完整性
verify_backup() {
    local backup_path="$1"
    
    log "🔍 验证备份完整性: $backup_path"
    
    if [ ! -d "$backup_path" ]; then
        error_exit "备份路径不存在: $backup_path"
    fi
    
    # 检查关键文件
    local required_files=("database" "configs")
    for file in "${required_files[@]}"; do
        if [ ! -d "$backup_path/$file" ]; then
            log "⚠️  警告: 缺少 $file 目录"
        fi
    done
    
    log "✅ 备份验证完成"
}

# 创建恢复前备份
create_pre_restore_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local pre_backup_dir="$BACKUP_ROOT/$APP_NAME/pre_restore_$timestamp"
    
    log "💾 创建恢复前备份..."
    mkdir -p "$pre_backup_dir"
    
    # 备份当前数据
    if [ -f "$APP_DIR/data/logistics.db" ]; then
        cp "$APP_DIR/data/logistics.db" "$pre_backup_dir/"
        log "✅ 当前数据库已备份"
    fi
    
    # 备份当前配置
    local configs=(".env" "auth_config.json" "ip_whitelist.json")
    for config in "${configs[@]}"; do
        if [ -f "$APP_DIR/$config" ]; then
            cp "$APP_DIR/$config" "$pre_backup_dir/"
        fi
    done
    
    log "✅ 恢复前备份完成: $pre_backup_dir"
}

# 恢复数据库
restore_database() {
    local backup_path="$1"
    local db_backup_dir="$backup_path/database"
    
    log "📊 开始恢复数据库..."
    
    if [ ! -d "$db_backup_dir" ]; then
        log "⚠️  数据库备份目录不存在，跳过数据库恢复"
        return
    fi
    
    # 查找数据库备份文件
    local db_file=$(find "$db_backup_dir" -name "logistics_*.db.gz" | head -1)
    
    if [ -z "$db_file" ]; then
        log "⚠️  未找到数据库备份文件"
        return
    fi
    
    # 停止应用服务 (如果使用PM2)
    if command -v pm2 &> /dev/null; then
        pm2 stop "$APP_NAME" 2>/dev/null || true
        log "🛑 应用服务已停止"
    fi
    
    # 确保数据目录存在
    mkdir -p "$APP_DIR/data"
    
    # 解压并恢复数据库
    gunzip -c "$db_file" > "$APP_DIR/data/logistics.db"
    
    if [ $? -eq 0 ]; then
        log "✅ 数据库恢复完成"
        
        # 设置正确的权限
        chmod 644 "$APP_DIR/data/logistics.db"
        
        # 验证数据库完整性
        if sqlite3 "$APP_DIR/data/logistics.db" "PRAGMA integrity_check;" | grep -q "ok"; then
            log "✅ 数据库完整性验证通过"
        else
            log "❌ 数据库完整性验证失败"
        fi
    else
        error_exit "数据库恢复失败"
    fi
}

# 恢复配置文件
restore_configs() {
    local backup_path="$1"
    local config_backup_dir="$backup_path/configs"
    
    log "⚙️  开始恢复配置文件..."
    
    if [ ! -d "$config_backup_dir" ]; then
        log "⚠️  配置备份目录不存在，跳过配置恢复"
        return
    fi
    
    # 查找配置压缩包
    local config_archive=$(find "$config_backup_dir" -name "configs_*.tar.gz" | head -1)
    
    if [ -n "$config_archive" ]; then
        # 解压配置文件到临时目录
        local temp_dir=$(mktemp -d)
        tar -xzf "$config_archive" -C "$temp_dir"
        
        # 恢复配置文件
        local configs=(".env" "auth_config.json" "ip_whitelist.json")
        for config in "${configs[@]}"; do
            local config_file=$(find "$temp_dir" -name "${config}_*" | head -1)
            if [ -n "$config_file" ]; then
                cp "$config_file" "$APP_DIR/$config"
                log "✅ 配置文件恢复: $config"
            fi
        done
        
        # 清理临时目录
        rm -rf "$temp_dir"
    else
        # 直接从备份目录恢复
        local configs=(".env" "auth_config.json" "ip_whitelist.json")
        for config in "${configs[@]}"; do
            local config_file=$(find "$config_backup_dir" -name "${config}_*" | head -1)
            if [ -n "$config_file" ]; then
                cp "$config_file" "$APP_DIR/$config"
                log "✅ 配置文件恢复: $config"
            fi
        done
    fi
    
    log "✅ 配置文件恢复完成"
}

# 恢复前端文件
restore_frontend() {
    local backup_path="$1"
    local frontend_backup_dir="$backup_path/frontend"
    
    log "🎨 开始恢复前端文件..."
    
    if [ ! -d "$frontend_backup_dir" ]; then
        log "⚠️  前端备份目录不存在，跳过前端恢复"
        return
    fi
    
    # 查找前端备份文件
    local frontend_archive=$(find "$frontend_backup_dir" -name "frontend_dist_*.tar.gz" | head -1)
    
    if [ -n "$frontend_archive" ]; then
        # 删除现有前端文件
        if [ -d "$APP_DIR/frontend/dist" ]; then
            rm -rf "$APP_DIR/frontend/dist"
        fi
        
        # 解压前端文件
        mkdir -p "$APP_DIR/frontend"
        tar -xzf "$frontend_archive" -C "$APP_DIR/frontend"
        
        log "✅ 前端文件恢复完成"
    else
        log "⚠️  未找到前端备份文件"
    fi
}

# 重启服务
restart_services() {
    log "🔄 重启应用服务..."
    
    # 重启PM2服务
    if command -v pm2 &> /dev/null; then
        pm2 start "$APP_NAME" 2>/dev/null || pm2 restart "$APP_NAME" 2>/dev/null
        if [ $? -eq 0 ]; then
            log "✅ PM2服务重启成功"
        else
            log "⚠️  PM2服务重启失败，请手动启动"
        fi
    fi
    
    # 重启Nginx (如果存在)
    if command -v nginx &> /dev/null; then
        sudo systemctl reload nginx 2>/dev/null
        log "✅ Nginx配置已重载"
    fi
}

# 验证恢复结果
verify_restore() {
    log "🔍 验证恢复结果..."
    
    # 检查数据库
    if [ -f "$APP_DIR/data/logistics.db" ]; then
        local table_count=$(sqlite3 "$APP_DIR/data/logistics.db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null)
        log "📊 数据库表数量: $table_count"
    fi
    
    # 检查配置文件
    local configs=(".env" "auth_config.json")
    for config in "${configs[@]}"; do
        if [ -f "$APP_DIR/$config" ]; then
            log "✅ 配置文件存在: $config"
        else
            log "⚠️  配置文件缺失: $config"
        fi
    done
    
    # 检查前端文件
    if [ -d "$APP_DIR/frontend/dist" ]; then
        local file_count=$(find "$APP_DIR/frontend/dist" -type f | wc -l)
        log "🎨 前端文件数量: $file_count"
    fi
    
    log "✅ 恢复验证完成"
}

# =============================================================================
# 主函数
# =============================================================================

main() {
    local restore_database=false
    local restore_configs=false
    local restore_frontend=false
    local restore_all=true
    local backup_date=""
    local backup_source=""
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -l|--list)
                list_backups
                exit 0
                ;;
            -d|--database)
                restore_database=true
                restore_all=false
                shift
                ;;
            -c|--config)
                restore_configs=true
                restore_all=false
                shift
                ;;
            -f|--frontend)
                restore_frontend=true
                restore_all=false
                shift
                ;;
            -a|--all)
                restore_all=true
                shift
                ;;
            -s|--source)
                backup_source="$2"
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                backup_date="$1"
                shift
                ;;
        esac
    done
    
    # 确定备份路径
    local backup_path
    if [ -n "$backup_source" ]; then
        backup_path="$backup_source"
    elif [ -n "$backup_date" ]; then
        backup_path="$BACKUP_ROOT/$APP_NAME/$backup_date"
    else
        echo "请指定备份日期或使用 --list 查看可用备份"
        show_usage
        exit 1
    fi
    
    log "🚀 开始恢复 $APP_NAME 数据"
    log "📁 备份路径: $backup_path"
    
    # 验证备份
    verify_backup "$backup_path"
    
    # 创建恢复前备份
    create_pre_restore_backup
    
    # 执行恢复
    if [ "$restore_all" = true ]; then
        restore_database "$backup_path"
        restore_configs "$backup_path"
        restore_frontend "$backup_path"
    else
        [ "$restore_database" = true ] && restore_database "$backup_path"
        [ "$restore_configs" = true ] && restore_configs "$backup_path"
        [ "$restore_frontend" = true ] && restore_frontend "$backup_path"
    fi
    
    # 重启服务
    restart_services
    
    # 验证恢复结果
    verify_restore
    
    log "🎉 数据恢复完成！"
    log "💡 提示: 请检查应用是否正常运行"
}

# 执行主函数
main "$@"
