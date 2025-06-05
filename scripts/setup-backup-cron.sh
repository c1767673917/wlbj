#!/bin/bash

# 物流报价系统 - 定时备份任务设置脚本

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$APP_DIR/scripts"

echo "🚀 设置物流报价系统定时备份任务..."

# 检查是否为root用户或有sudo权限
if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    echo "❌ 此脚本需要root权限或sudo权限来设置定时任务"
    exit 1
fi

# 检查必要文件
if [ ! -f "$SCRIPT_DIR/qiniu-backup.js" ]; then
    echo "❌ 备份脚本不存在: $SCRIPT_DIR/qiniu-backup.js"
    exit 1
fi

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，请先安装Node.js"
    exit 1
fi

# 检查qshell工具
if ! command -v qshell &> /dev/null; then
    echo "⚠️  qshell工具未安装，请先运行安装脚本"
    echo "   ./install-qiniu-tools.sh"
    exit 1
fi

# 创建备份用户（如果不存在）
if ! id "backup" &>/dev/null; then
    echo "👤 创建备份用户..."
    sudo useradd -r -s /bin/bash -d /var/lib/backup -m backup
    echo "✅ 备份用户创建成功"
else
    echo "✅ 备份用户已存在"
fi

# 创建备份目录
BACKUP_DIR="/var/lib/backup/wlbj-logistics"
if [ ! -d "$BACKUP_DIR" ]; then
    echo "📁 创建备份目录..."
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown backup:backup "$BACKUP_DIR"
    sudo chmod 750 "$BACKUP_DIR"
    echo "✅ 备份目录创建成功: $BACKUP_DIR"
fi

# 创建日志目录
LOG_DIR="/var/log/backup"
if [ ! -d "$LOG_DIR" ]; then
    echo "📝 创建日志目录..."
    sudo mkdir -p "$LOG_DIR"
    sudo chown backup:backup "$LOG_DIR"
    sudo chmod 750 "$LOG_DIR"
    echo "✅ 日志目录创建成功: $LOG_DIR"
fi

# 复制备份脚本到系统目录
SYSTEM_SCRIPT_DIR="/usr/local/bin"
echo "📋 复制备份脚本..."
sudo cp "$SCRIPT_DIR/qiniu-backup.js" "$SYSTEM_SCRIPT_DIR/"
sudo chmod +x "$SYSTEM_SCRIPT_DIR/qiniu-backup.js"
sudo chown backup:backup "$SYSTEM_SCRIPT_DIR/qiniu-backup.js"

# 创建备份配置获取脚本
cat > /tmp/get-backup-config.js << 'EOF'
#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'logistics.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

db.get('SELECT * FROM backup_config WHERE id = 1', (err, row) => {
  if (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
  
  if (!row || !row.qiniu_access_key || !row.qiniu_secret_key || !row.qiniu_bucket) {
    console.error('Backup configuration not found or incomplete');
    process.exit(1);
  }
  
  // 输出环境变量格式
  console.log(`QINIU_ACCESS_KEY="${row.qiniu_access_key}"`);
  console.log(`QINIU_SECRET_KEY="${row.qiniu_secret_key}"`);
  console.log(`QINIU_BUCKET="${row.qiniu_bucket}"`);
  console.log(`QINIU_ZONE="${row.qiniu_zone || 'z0'}"`);
  console.log(`WECHAT_WEBHOOK_URL="${row.wechat_webhook_url || ''}"`);
  
  db.close();
});
EOF

sudo mv /tmp/get-backup-config.js "$SYSTEM_SCRIPT_DIR/"
sudo chmod +x "$SYSTEM_SCRIPT_DIR/get-backup-config.js"
sudo chown backup:backup "$SYSTEM_SCRIPT_DIR/get-backup-config.js"

# 创建备份执行包装脚本
cat > /tmp/backup-wrapper.sh << EOF
#!/bin/bash

# 备份执行包装脚本
APP_DIR="$APP_DIR"
LOG_FILE="/var/log/backup/wlbj-backup.log"

# 记录开始时间
echo "\$(date): 开始执行备份任务" >> "\$LOG_FILE"

# 切换到应用目录
cd "\$APP_DIR"

# 获取备份配置
CONFIG_OUTPUT=\$(node /usr/local/bin/get-backup-config.js 2>&1)
if [ \$? -ne 0 ]; then
    echo "\$(date): 获取备份配置失败: \$CONFIG_OUTPUT" >> "\$LOG_FILE"
    exit 1
fi

# 导出环境变量
eval "\$CONFIG_OUTPUT"

# 执行备份
node /usr/local/bin/qiniu-backup.js >> "\$LOG_FILE" 2>&1
BACKUP_RESULT=\$?

# 记录结果
if [ \$BACKUP_RESULT -eq 0 ]; then
    echo "\$(date): 备份任务执行成功" >> "\$LOG_FILE"
else
    echo "\$(date): 备份任务执行失败，退出码: \$BACKUP_RESULT" >> "\$LOG_FILE"
fi

exit \$BACKUP_RESULT
EOF

sudo mv /tmp/backup-wrapper.sh "$SYSTEM_SCRIPT_DIR/"
sudo chmod +x "$SYSTEM_SCRIPT_DIR/backup-wrapper.sh"
sudo chown backup:backup "$SYSTEM_SCRIPT_DIR/backup-wrapper.sh"

# 设置定时任务
echo "⏰ 设置定时备份任务..."

# 创建临时crontab文件
TEMP_CRON=$(mktemp)

# 获取当前backup用户的crontab（如果存在）
sudo -u backup crontab -l 2>/dev/null > "$TEMP_CRON" || true

# 检查是否已存在备份任务
if grep -q "backup-wrapper.sh" "$TEMP_CRON"; then
    echo "⚠️  定时备份任务已存在，跳过设置"
else
    # 添加备份任务（每天凌晨2点执行）
    echo "# 物流报价系统自动备份任务" >> "$TEMP_CRON"
    echo "0 2 * * * /usr/local/bin/backup-wrapper.sh" >> "$TEMP_CRON"
    
    # 应用新的crontab
    sudo -u backup crontab "$TEMP_CRON"
    echo "✅ 定时备份任务设置成功（每天凌晨2点执行）"
fi

# 清理临时文件
rm -f "$TEMP_CRON"

# 创建日志轮转配置
echo "📋 设置日志轮转..."
cat > /tmp/wlbj-backup << 'EOF'
/var/log/backup/wlbj-backup.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 backup backup
    postrotate
        # 可以在这里添加日志轮转后的操作
    endscript
}
EOF

sudo mv /tmp/wlbj-backup /etc/logrotate.d/
sudo chmod 644 /etc/logrotate.d/wlbj-backup

echo "✅ 日志轮转配置完成"

# 测试备份配置
echo "🧪 测试备份配置..."
if sudo -u backup /usr/local/bin/backup-wrapper.sh --test 2>/dev/null; then
    echo "✅ 备份配置测试成功"
else
    echo "⚠️  备份配置测试失败，请检查七牛云配置"
fi

echo ""
echo "🎉 定时备份任务设置完成！"
echo ""
echo "📋 配置摘要："
echo "   • 备份用户: backup"
echo "   • 备份目录: $BACKUP_DIR"
echo "   • 日志文件: /var/log/backup/wlbj-backup.log"
echo "   • 执行时间: 每天凌晨2点"
echo "   • 日志保留: 30天"
echo ""
echo "🔧 管理命令："
echo "   • 查看定时任务: sudo -u backup crontab -l"
echo "   • 手动执行备份: sudo -u backup /usr/local/bin/backup-wrapper.sh"
echo "   • 查看备份日志: sudo tail -f /var/log/backup/wlbj-backup.log"
echo "   • 查看备份文件: sudo ls -la $BACKUP_DIR"
echo ""
echo "💡 提示："
echo "   • 请在管理后台配置七牛云参数后再执行备份"
echo "   • 建议定期检查备份日志确保备份正常执行"
echo "   • 可以通过管理后台手动执行备份进行测试"
