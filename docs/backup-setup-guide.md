# 物流报价系统备份模块部署指南

## 📋 概述

本指南将帮助您在物流报价系统中部署和配置七牛云备份模块，实现自动化数据备份和管理。

## 🎯 功能特性

- **管理后台集成**: 在管理员后台直接配置七牛云参数
- **自动化备份**: 支持定时自动备份，可配置备份频率
- **手动备份**: 支持一键手动执行备份
- **连接测试**: 配置后可测试七牛云连接状态
- **备份监控**: 查看备份状态、历史记录和备份大小
- **企业微信通知**: 备份成功/失败自动通知

## 🚀 快速部署

### 1. 安装七牛云工具

```bash
# 进入项目目录
cd /path/to/your/wlbj

# 安装七牛云工具
chmod +x install-qiniu-tools.sh
./install-qiniu-tools.sh
```

### 2. 设置定时备份任务

```bash
# 设置定时备份（需要sudo权限）
chmod +x scripts/setup-backup-cron.sh
sudo ./scripts/setup-backup-cron.sh
```

### 3. 重启应用

```bash
# 如果使用PM2
pm2 restart wlbj-logistics

# 或者直接重启
npm start
```

## ⚙️ 配置说明

### 1. 七牛云配置

登录管理后台 → 备份管理 → 备份配置，填写以下信息：

#### 必填参数
- **AccessKey**: 七牛云访问密钥
- **SecretKey**: 七牛云私钥
- **存储空间名称**: 七牛云存储空间名称
- **存储区域**: 选择对应的存储区域

#### 可选参数
- **备份频率**: 每小时/每天/每周
- **保留天数**: 云端备份保留天数（1-365天）
- **自动备份**: 是否启用自动备份
- **企业微信Webhook**: 备份通知地址
- **启用通知**: 是否启用备份通知

### 2. 七牛云存储空间设置

1. **创建存储空间**:
   - 登录七牛云控制台
   - 对象存储 → 空间管理 → 新建空间
   - 选择合适的存储区域
   - 设置访问权限为"私有"

2. **获取访问密钥**:
   - 个人中心 → 密钥管理
   - 复制AccessKey和SecretKey

3. **设置生命周期规则**（可选）:
   - 空间设置 → 生命周期
   - 设置自动删除过期文件

## 🔧 使用指南

### 1. 管理后台操作

#### 配置备份参数
1. 访问 `/admin` 进入管理后台
2. 点击"备份管理"标签
3. 在"备份配置"中填写七牛云参数
4. 点击"保存配置"

#### 测试连接
1. 配置完成后点击"测试连接"
2. 确认连接成功后再启用自动备份

#### 手动备份
1. 点击"立即备份"按钮
2. 系统将在后台执行备份任务
3. 在"备份状态"中查看执行结果

#### 查看备份状态
1. 切换到"备份状态"标签
2. 查看最后备份时间、状态和大小
3. 切换到"备份历史"查看历史记录

### 2. 命令行操作

#### 手动执行备份
```bash
# 切换到backup用户
sudo -u backup /usr/local/bin/backup-wrapper.sh
```

#### 查看备份日志
```bash
# 实时查看日志
sudo tail -f /var/log/backup/wlbj-backup.log

# 查看最近的日志
sudo tail -100 /var/log/backup/wlbj-backup.log
```

#### 查看定时任务
```bash
# 查看backup用户的定时任务
sudo -u backup crontab -l
```

#### 修改备份频率
```bash
# 编辑定时任务
sudo -u backup crontab -e

# 示例：
# 每小时执行: 0 * * * * /usr/local/bin/backup-wrapper.sh
# 每天2点执行: 0 2 * * * /usr/local/bin/backup-wrapper.sh
# 每周日2点执行: 0 2 * * 0 /usr/local/bin/backup-wrapper.sh
```

## 📊 备份内容

系统会自动备份以下内容：

1. **数据库文件**:
   - `data/logistics.db` - SQLite数据库
   - 使用SQLite备份API确保数据一致性
   - 自动压缩减少存储空间

2. **配置文件**:
   - `.env` - 环境变量配置
   - `auth_config.json` - 认证配置
   - `ip_whitelist.json` - IP白名单
   - `package.json` - 项目配置

3. **日志文件**:
   - `logs/app.log` - 应用日志
   - `logs/error.log` - 错误日志
   - 压缩后上传

4. **前端构建文件**:
   - `frontend/dist/` - 生产环境前端文件

## 🔍 监控与告警

### 1. 备份状态监控

- **成功率监控**: 通过管理后台查看备份成功率
- **大小监控**: 监控备份文件大小变化
- **时效性监控**: 检查备份是否按时执行

### 2. 企业微信通知

配置企业微信Webhook后，系统会自动发送：
- 备份成功通知（包含备份大小和时间）
- 备份失败告警（包含错误信息）

### 3. 日志监控

```bash
# 监控备份日志中的错误
sudo grep -i error /var/log/backup/wlbj-backup.log

# 监控最近的备份执行情况
sudo grep "备份任务" /var/log/backup/wlbj-backup.log | tail -10
```

## 🛠️ 故障排查

### 1. 常见问题

#### 备份执行失败
```bash
# 检查七牛云配置
node /usr/local/bin/get-backup-config.js

# 检查qshell工具
qshell version

# 手动测试上传
qshell account your-ak your-sk test
qshell buckets
```

#### 定时任务不执行
```bash
# 检查cron服务状态
sudo systemctl status cron

# 检查定时任务配置
sudo -u backup crontab -l

# 查看cron日志
sudo grep backup /var/log/syslog
```

#### 权限问题
```bash
# 检查备份目录权限
ls -la /var/lib/backup/

# 检查日志目录权限
ls -la /var/log/backup/

# 修复权限
sudo chown -R backup:backup /var/lib/backup/
sudo chown -R backup:backup /var/log/backup/
```

### 2. 调试模式

```bash
# 启用详细日志
export DEBUG=1
sudo -u backup /usr/local/bin/backup-wrapper.sh

# 测试模式（不实际上传）
export TEST_MODE=1
sudo -u backup /usr/local/bin/backup-wrapper.sh
```

## 📈 性能优化

### 1. 备份优化

- **压缩级别**: 默认使用gzip压缩，平衡压缩率和速度
- **增量备份**: 考虑实现增量备份减少传输量
- **并发上传**: 支持多文件并发上传

### 2. 存储优化

- **生命周期管理**: 设置七牛云生命周期规则自动清理过期文件
- **存储类型**: 根据访问频率选择合适的存储类型
- **CDN加速**: 启用CDN加速下载恢复

## 🔒 安全建议

1. **密钥安全**:
   - 定期轮换AccessKey和SecretKey
   - 使用最小权限原则配置七牛云权限
   - 不要在代码中硬编码密钥

2. **网络安全**:
   - 使用HTTPS传输
   - 配置防火墙规则
   - 启用访问日志审计

3. **数据安全**:
   - 启用传输加密
   - 考虑启用存储加密
   - 定期验证备份完整性

## 📞 技术支持

如遇到问题，请：

1. 查看备份日志：`/var/log/backup/wlbj-backup.log`
2. 检查应用日志：`logs/error.log`
3. 参考七牛云官方文档
4. 联系技术支持

---

**注意**: 请确保在生产环境部署前进行充分测试，建议先在测试环境验证备份和恢复流程。
