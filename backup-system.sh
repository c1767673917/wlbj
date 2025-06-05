#!/bin/bash

# 物流报价系统异地备份脚本
# 支持多种云存储服务的自动化备份

# =============================================================================
# 配置区域 - 请根据实际情况修改
# =============================================================================

# 基础配置
APP_NAME="wlbj-logistics"
APP_DIR="/path/to/your/wlbj"  # 替换为实际路径
BACKUP_ROOT="/backup"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/backup-${APP_NAME}.log"

# 云存储配置 (选择一种或多种)
# 阿里云OSS配置
ALIYUN_OSS_ENDPOINT="oss-cn-hangzhou.aliyuncs.com"
ALIYUN_OSS_BUCKET="your-backup-bucket"
ALIYUN_ACCESS_KEY="your-access-key"
ALIYUN_SECRET_KEY="your-secret-key"

# 腾讯云COS配置
TENCENT_COS_REGION="ap-guangzhou"
TENCENT_COS_BUCKET="your-backup-bucket"
TENCENT_SECRET_ID="your-secret-id"
TENCENT_SECRET_KEY="your-secret-key"

# 七牛云配置
QINIU_ACCESS_KEY="your-access-key"
QINIU_SECRET_KEY="your-secret-key"
QINIU_BUCKET="your-backup-bucket"

# 备份保留策略
LOCAL_RETENTION_DAYS=7      # 本地保留天数
CLOUD_RETENTION_DAYS=30     # 云端保留天数

# =============================================================================
# 工具函数
# =============================================================================

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 错误处理
error_exit() {
    log "❌ 错误: $1"
    exit 1
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        error_exit "命令 $1 未找到，请先安装"
    fi
}

# 创建备份目录
create_backup_dirs() {
    local backup_dir="$BACKUP_ROOT/$APP_NAME/$DATE"
    mkdir -p "$backup_dir" || error_exit "无法创建备份目录: $backup_dir"
    echo "$backup_dir"
}

# =============================================================================
# 数据备份函数
# =============================================================================

# 备份数据库
backup_database() {
    local backup_dir="$1"
    local db_backup_dir="$backup_dir/database"
    
    log "📊 开始备份数据库..."
    mkdir -p "$db_backup_dir"
    
    # 备份SQLite数据库文件
    if [ -f "$APP_DIR/data/logistics.db" ]; then
        # 使用SQLite的备份API进行一致性备份
        sqlite3 "$APP_DIR/data/logistics.db" ".backup '$db_backup_dir/logistics_${DATE}.db'"
        
        # 压缩数据库备份
        gzip "$db_backup_dir/logistics_${DATE}.db"
        
        log "✅ 数据库备份完成: logistics_${DATE}.db.gz"
    else
        log "⚠️  数据库文件不存在: $APP_DIR/data/logistics.db"
    fi
}

# 备份配置文件
backup_configs() {
    local backup_dir="$1"
    local config_backup_dir="$backup_dir/configs"
    
    log "⚙️  开始备份配置文件..."
    mkdir -p "$config_backup_dir"
    
    # 备份关键配置文件
    local configs=(".env" "auth_config.json" "ip_whitelist.json" "package.json")
    
    for config in "${configs[@]}"; do
        if [ -f "$APP_DIR/$config" ]; then
            cp "$APP_DIR/$config" "$config_backup_dir/${config}_${DATE}"
            log "✅ 配置文件备份: $config"
        fi
    done
    
    # 压缩配置文件
    tar -czf "$config_backup_dir/configs_${DATE}.tar.gz" -C "$config_backup_dir" .
    rm -f "$config_backup_dir"/*.json_* "$config_backup_dir"/.env_*
}

# 备份日志文件
backup_logs() {
    local backup_dir="$1"
    local log_backup_dir="$backup_dir/logs"
    
    log "📝 开始备份日志文件..."
    mkdir -p "$log_backup_dir"
    
    if [ -d "$APP_DIR/logs" ]; then
        # 压缩日志文件
        tar -czf "$log_backup_dir/logs_${DATE}.tar.gz" -C "$APP_DIR" logs/
        log "✅ 日志文件备份完成"
    else
        log "⚠️  日志目录不存在: $APP_DIR/logs"
    fi
}

# 备份前端构建文件
backup_frontend() {
    local backup_dir="$1"
    local frontend_backup_dir="$backup_dir/frontend"
    
    log "🎨 开始备份前端文件..."
    mkdir -p "$frontend_backup_dir"
    
    if [ -d "$APP_DIR/frontend/dist" ]; then
        tar -czf "$frontend_backup_dir/frontend_dist_${DATE}.tar.gz" -C "$APP_DIR/frontend" dist/
        log "✅ 前端文件备份完成"
    else
        log "⚠️  前端构建目录不存在: $APP_DIR/frontend/dist"
    fi
}

# =============================================================================
# 云存储上传函数
# =============================================================================

# 上传到阿里云OSS
upload_to_aliyun() {
    local backup_dir="$1"
    
    if [ -z "$ALIYUN_ACCESS_KEY" ]; then
        log "⚠️  阿里云OSS配置未设置，跳过上传"
        return
    fi
    
    log "☁️  开始上传到阿里云OSS..."
    
    # 检查ossutil工具
    if ! command -v ossutil &> /dev/null; then
        log "⚠️  ossutil未安装，跳过阿里云OSS上传"
        return
    fi
    
    # 配置ossutil
    ossutil config -e "$ALIYUN_OSS_ENDPOINT" -i "$ALIYUN_ACCESS_KEY" -k "$ALIYUN_SECRET_KEY"
    
    # 上传备份文件
    ossutil cp -r "$backup_dir" "oss://$ALIYUN_OSS_BUCKET/backups/$APP_NAME/"
    
    if [ $? -eq 0 ]; then
        log "✅ 阿里云OSS上传完成"
    else
        log "❌ 阿里云OSS上传失败"
    fi
}

# 上传到腾讯云COS
upload_to_tencent() {
    local backup_dir="$1"
    
    if [ -z "$TENCENT_SECRET_ID" ]; then
        log "⚠️  腾讯云COS配置未设置，跳过上传"
        return
    fi
    
    log "☁️  开始上传到腾讯云COS..."
    
    # 检查coscli工具
    if ! command -v coscli &> /dev/null; then
        log "⚠️  coscli未安装，跳过腾讯云COS上传"
        return
    fi
    
    # 配置coscli
    coscli config set -s "$TENCENT_SECRET_ID" -k "$TENCENT_SECRET_KEY" -r "$TENCENT_COS_REGION"
    
    # 上传备份文件
    coscli cp -r "$backup_dir" "cos://$TENCENT_COS_BUCKET/backups/$APP_NAME/"
    
    if [ $? -eq 0 ]; then
        log "✅ 腾讯云COS上传完成"
    else
        log "❌ 腾讯云COS上传失败"
    fi
}

# 上传到七牛云
upload_to_qiniu() {
    local backup_dir="$1"
    
    if [ -z "$QINIU_ACCESS_KEY" ]; then
        log "⚠️  七牛云配置未设置，跳过上传"
        return
    fi
    
    log "☁️  开始上传到七牛云..."
    
    # 检查qshell工具
    if ! command -v qshell &> /dev/null; then
        log "⚠️  qshell未安装，跳过七牛云上传"
        return
    fi
    
    # 配置qshell
    qshell account "$QINIU_ACCESS_KEY" "$QINIU_SECRET_KEY" "backup-account"
    
    # 上传备份文件
    find "$backup_dir" -type f | while read file; do
        relative_path=${file#$backup_dir/}
        qshell fput "$QINIU_BUCKET" "backups/$APP_NAME/$DATE/$relative_path" "$file"
    done
    
    log "✅ 七牛云上传完成"
}

# =============================================================================
# 清理函数
# =============================================================================

# 清理本地旧备份
cleanup_local() {
    log "🧹 清理本地旧备份..."
    
    find "$BACKUP_ROOT/$APP_NAME" -type d -name "20*" -mtime +$LOCAL_RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null
    
    log "✅ 本地清理完成"
}

# =============================================================================
# 主函数
# =============================================================================

main() {
    log "🚀 开始执行 $APP_NAME 异地备份任务"
    
    # 检查必要的工具
    check_command "sqlite3"
    check_command "tar"
    check_command "gzip"
    
    # 创建备份目录
    local backup_dir
    backup_dir=$(create_backup_dirs)
    
    # 执行备份
    backup_database "$backup_dir"
    backup_configs "$backup_dir"
    backup_logs "$backup_dir"
    backup_frontend "$backup_dir"
    
    # 上传到云存储
    upload_to_aliyun "$backup_dir"
    upload_to_tencent "$backup_dir"
    upload_to_qiniu "$backup_dir"
    
    # 清理旧备份
    cleanup_local
    
    # 生成备份报告
    local backup_size=$(du -sh "$backup_dir" | cut -f1)
    log "📊 备份完成！总大小: $backup_size"
    log "📁 备份位置: $backup_dir"
    
    # 发送通知（可选）
    if command -v curl &> /dev/null && [ -n "$WECHAT_WEBHOOK_URL" ]; then
        curl -X POST "$WECHAT_WEBHOOK_URL" \
             -H 'Content-Type: application/json' \
             -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"✅ $APP_NAME 备份完成\\n时间: $(date)\\n大小: $backup_size\"}}"
    fi
    
    log "🎉 备份任务执行完成"
}

# 执行主函数
main "$@"
