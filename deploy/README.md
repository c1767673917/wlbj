# 🐧 Linux生产环境部署指南

本指南提供了物流报价系统在Linux生产环境中的完整部署方案。

## 📋 部署概览

### 架构图

```
Internet
    ↓
[Nginx反向代理] (80/443端口)
    ├── SSL终端 (Let's Encrypt)
    ├── 静态文件服务
    ├── 负载均衡
    └── 安全防护
    ↓
[Node.js应用] (3000端口)
    ├── Express服务器
    ├── JWT认证
    ├── API路由
    └── 业务逻辑
    ↓
[数据层]
    ├── SQLite数据库 (主数据)
    ├── Redis缓存 (可选)
    └── 文件存储 (日志、备份)
    ↓
[监控层]
    ├── PM2进程管理
    ├── 系统监控
    ├── 日志管理
    └── 自动备份
```

## 🚀 快速部署

### 一键部署 (推荐)

```bash
# 克隆项目
git clone https://github.com/c1767673917/wlbj.git
cd wlbj

# 执行一键部署
sudo ./deploy/deploy-production.sh
```

### 分步骤部署

```bash
# 1. 安装系统依赖
sudo ./deploy/install-dependencies.sh

# 2. 配置应用环境
./deploy/setup-application.sh

# 3. 配置Nginx
sudo ./deploy/setup-nginx.sh

# 4. 配置SSL证书
sudo ./deploy/setup-ssl.sh

# 5. 启动服务
./deploy/start-services.sh
```

## 🔧 系统要求

### 最低配置
- **CPU**: 1核心 (1 vCPU)
- **内存**: 1GB RAM
- **存储**: 10GB SSD
- **网络**: 1Mbps带宽
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+

### 推荐配置
- **CPU**: 2核心 (2 vCPU)
- **内存**: 2GB RAM
- **存储**: 20GB SSD
- **网络**: 10Mbps带宽
- **操作系统**: Ubuntu 22.04 LTS

### 支持的操作系统
- Ubuntu 20.04 LTS / 22.04 LTS
- CentOS 8+ / Rocky Linux 8+
- Debian 11+ (Bullseye)
- Amazon Linux 2
- RHEL 8+

## 📦 部署组件

### 核心服务
- **Node.js 18+**: 应用运行时
- **PM2**: 进程管理器
- **Nginx**: 反向代理服务器
- **SQLite**: 数据库
- **Redis**: 缓存服务 (可选)

### 安全组件
- **UFW/Firewalld**: 防火墙
- **Let's Encrypt**: SSL证书
- **Fail2ban**: 入侵防护
- **Logrotate**: 日志轮替

### 监控组件
- **PM2 Monitoring**: 进程监控
- **Nginx Status**: 服务器状态
- **Custom Scripts**: 自定义监控脚本

## 🔐 安全配置

### 防火墙规则
```bash
# 仅开放必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### SSL/TLS配置
- **协议**: TLS 1.2+
- **加密套件**: 现代化加密套件
- **HSTS**: 启用HTTP严格传输安全
- **证书**: Let's Encrypt自动续期

### 访问控制
- **速率限制**: API请求频率限制
- **IP白名单**: 管理员IP白名单
- **JWT认证**: 用户身份验证
- **CORS**: 跨域请求控制

## 📊 监控与维护

### 健康检查
- **应用状态**: HTTP健康检查端点
- **数据库连接**: SQLite连接测试
- **磁盘空间**: 存储空间监控
- **内存使用**: 内存泄漏检测

### 日志管理
- **应用日志**: `/var/log/wlbj/app.log`
- **错误日志**: `/var/log/wlbj/error.log`
- **访问日志**: `/var/log/nginx/access.log`
- **系统日志**: `/var/log/syslog`

### 备份策略
- **数据库备份**: 每日自动备份
- **配置备份**: 配置文件备份
- **代码备份**: Git仓库同步
- **保留策略**: 30天备份保留

## 🔄 更新与部署

### 零停机更新
```bash
# 拉取最新代码
git pull origin main

# 构建前端
cd frontend && npm run build && cd ..

# 重启应用 (零停机)
pm2 reload wlbj-app
```

### 回滚机制
```bash
# 回滚到上一个版本
./deploy/rollback.sh

# 回滚到指定版本
./deploy/rollback.sh v1.2.0
```

## 🚨 故障排除

### 常见问题

1. **端口占用**
   ```bash
   sudo netstat -tlnp | grep :3000
   sudo kill -9 <PID>
   ```

2. **权限问题**
   ```bash
   sudo chown -R wlbj:wlbj /opt/wlbj
   sudo chmod +x deploy/*.sh
   ```

3. **数据库锁定**
   ```bash
   sudo systemctl restart wlbj
   ```

4. **SSL证书问题**
   ```bash
   sudo certbot renew --dry-run
   ```

### 日志查看
```bash
# 应用日志
pm2 logs wlbj-app

# Nginx日志
sudo tail -f /var/log/nginx/error.log

# 系统日志
sudo journalctl -u wlbj -f
```

## 📞 技术支持

如遇到部署问题，请：

1. 查看部署日志: `tail -f /var/log/wlbj/deploy.log`
2. 运行诊断脚本: `./deploy/diagnose.sh`
3. 检查系统状态: `./deploy/status.sh`
4. 查看错误日志: `pm2 logs wlbj-app --err`

## 🐳 Docker部署方案

### Docker Compose部署 (推荐)

```bash
# 1. 准备环境文件
cp deploy/env.production.example .env
# 编辑 .env 文件配置必要参数

# 2. 启动服务
docker-compose up -d

# 3. 查看状态
docker-compose ps
docker-compose logs -f wlbj-app
```

### 单独Docker部署

```bash
# 构建镜像
docker build -t wlbj:latest .

# 运行容器
docker run -d \
  --name wlbj-app \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  wlbj:latest
```

## 📋 部署检查清单

### 部署前检查
- [ ] 服务器满足最低配置要求
- [ ] 域名DNS解析已配置
- [ ] 防火墙端口已开放 (80, 443, 22)
- [ ] SSL证书已准备 (或使用Let's Encrypt)

### 部署后验证
- [ ] 应用HTTP响应正常
- [ ] 前端页面加载正常
- [ ] API接口功能正常
- [ ] 数据库连接正常
- [ ] 日志记录正常
- [ ] SSL证书有效
- [ ] 监控告警配置

### 安全检查
- [ ] 环境变量文件权限 (600)
- [ ] 数据库文件权限正确
- [ ] 防火墙规则配置
- [ ] SSH密钥认证
- [ ] 定期安全更新

## 🔧 维护命令

```bash
# 查看系统状态
./deploy/status.sh

# 监控系统
./deploy/monitor.sh -d

# 备份数据
./deploy/backup.sh

# 更新应用
./deploy/update.sh

# 查看日志
pm2 logs wlbj-app
tail -f /var/log/nginx/error.log
```

## 📊 性能优化建议

### 系统级优化
- 启用BBR拥塞控制算法
- 调整内核参数优化网络性能
- 配置SSD磁盘优化参数
- 启用内存压缩

### 应用级优化
- 启用Redis缓存
- 配置CDN加速静态资源
- 启用Gzip压缩
- 优化数据库查询

### 监控告警
- 配置系统资源监控
- 设置应用性能监控
- 配置日志告警
- 设置SSL证书到期提醒

---

**部署完成后，请访问您的域名验证系统是否正常运行！** 🎉

**技术支持**: 如遇问题请运行 `./deploy/status.sh` 获取系统状态信息
