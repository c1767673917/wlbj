# 🚀 物流报价系统 - 快速部署指南

本指南帮助您在5分钟内完成物流报价系统的生产环境部署。

## 📋 准备工作

### 服务器要求
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **配置**: 最低1核1GB，推荐2核2GB
- **网络**: 公网IP，域名解析到服务器
- **权限**: root或sudo权限

### 域名准备
- 确保域名已解析到服务器IP
- 准备SSL证书或使用Let's Encrypt自动申请

## 🎯 一键部署 (推荐)

### 方法一：完全自动化部署

```bash
# 1. 下载项目
git clone https://github.com/c1767673917/wlbj.git
cd wlbj

# 2. 执行一键部署
sudo ./deploy/deploy-production.sh

# 3. 配置SSL证书 (可选)
sudo ./deploy/setup-ssl.sh
```

### 方法二：Docker部署

```bash
# 1. 安装Docker和Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. 下载项目
git clone https://github.com/c1767673917/wlbj.git
cd wlbj

# 3. 配置环境变量
cp deploy/env.production.example .env
nano .env  # 编辑必要配置

# 4. 启动服务
docker-compose up -d

# 5. 查看状态
docker-compose ps
```

## ⚙️ 必要配置

### 1. 环境变量配置

编辑 `.env` 文件，至少配置以下项目：

```bash
# 应用密码 (用户端登录)
APP_PASSWORD=your_secure_password_here

# JWT密钥 (32位以上随机字符串)
JWT_SECRET=your_jwt_secret_32_chars_minimum

# SiliconFlow API密钥 (AI功能)
SILICON_FLOW_API_KEY=your_api_key_here

# 域名配置
APP_DOMAIN=your-domain.com

# 管理员邮箱 (告警通知)
ADMIN_EMAIL=admin@your-domain.com
```

### 2. 生成强密码

```bash
# 生成JWT密钥
openssl rand -base64 32

# 生成应用密码
openssl rand -base64 16
```

## 🔍 部署验证

### 1. 检查服务状态

```bash
# 查看系统状态
./deploy/status.sh

# 查看应用日志
pm2 logs wlbj-app

# 检查Nginx状态
sudo systemctl status nginx
```

### 2. 功能测试

访问以下URL验证功能：

- **主页**: `https://your-domain.com`
- **用户端**: `https://your-domain.com/user`
- **API健康检查**: `https://your-domain.com/api/health`

### 3. 性能测试

```bash
# HTTP响应测试
curl -I https://your-domain.com

# API响应测试
curl https://your-domain.com/api/orders
```

## 🛠️ 常见问题解决

### 问题1: 端口占用

```bash
# 查看端口占用
sudo netstat -tlnp | grep :3000

# 杀死占用进程
sudo kill -9 <PID>
```

### 问题2: 权限问题

```bash
# 修复应用目录权限
sudo chown -R wlbj:wlbj /opt/wlbj
sudo chmod 600 /opt/wlbj/.env
```

### 问题3: SSL证书问题

```bash
# 重新申请证书
sudo certbot renew --force-renewal

# 检查证书状态
sudo certbot certificates
```

### 问题4: 数据库问题

```bash
# 检查数据库文件
ls -la /opt/wlbj/data/

# 重新初始化数据库
cd /opt/wlbj && node -e "require('./db/database')"
```

## 📊 监控与维护

### 设置监控

```bash
# 启动系统监控
./deploy/monitor.sh -d -i 60

# 设置自动备份
echo "0 2 * * * /opt/wlbj/deploy/backup.sh" | sudo crontab -
```

### 日常维护

```bash
# 查看系统状态
./deploy/status.sh

# 备份数据
./deploy/backup.sh

# 更新应用
./deploy/update.sh

# 查看日志
tail -f /opt/wlbj/logs/app.log
```

## 🔐 安全加固

### 1. 防火墙配置

```bash
# Ubuntu/Debian
sudo ufw enable
sudo ufw allow 22,80,443/tcp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-service={ssh,http,https}
sudo firewall-cmd --reload
```

### 2. SSH安全

```bash
# 禁用密码登录 (确保已配置密钥)
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

### 3. 自动更新

```bash
# Ubuntu/Debian
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades

# CentOS/RHEL
sudo yum install yum-cron
sudo systemctl enable --now yum-cron
```

## 📞 获取帮助

### 诊断信息收集

```bash
# 生成完整状态报告
./deploy/status.sh -r

# 查看最近错误日志
tail -50 /opt/wlbj/logs/error.log

# 检查系统资源
free -h && df -h && top -bn1 | head -20
```

### 联系支持

如果遇到问题，请提供以下信息：

1. 操作系统版本: `cat /etc/os-release`
2. 部署方式: 传统部署 / Docker部署
3. 错误日志: `./deploy/status.sh -r`
4. 系统状态: `./deploy/status.sh`

## 🎉 部署完成

恭喜！您的物流报价系统已成功部署。

### 下一步操作

1. **配置企业微信通知** (可选)
2. **设置定期备份策略**
3. **配置监控告警**
4. **优化性能参数**
5. **制定运维计划**

### 重要提醒

- 🔒 定期更换密码和密钥
- 📊 监控系统资源使用情况
- 🔄 保持系统和应用更新
- 💾 定期备份重要数据
- 🛡️ 关注安全漏洞公告

---

**🚛 祝您使用愉快！如有问题，请参考详细文档或联系技术支持。**
