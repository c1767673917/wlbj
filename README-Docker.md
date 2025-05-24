# 物流报价平台 - Docker 部署指南

本文档介绍如何使用 Docker 部署物流报价平台。Docker 版本提供了更简单的部署方式，包含完整的容器化环境和自动化部署脚本。

## 🐳 Docker 版本特性

### 容器化优势
- **一键部署**: 使用 `docker-deploy.sh` 脚本一键完成部署
- **环境隔离**: 完全隔离的运行环境，避免依赖冲突
- **数据持久化**: 数据库、日志、配置文件自动持久化
- **健康检查**: 内置应用健康检查机制
- **安全加固**: 非root用户运行，最小权限原则

### 可选组件
- **Nginx 反向代理**: 可选的高性能反向代理和负载均衡
- **SSL/HTTPS 支持**: 预配置的 HTTPS 支持（需要证书）
- **日志管理**: 结构化日志输出和轮替

## 📋 系统要求

### 必需软件
- **Docker**: 版本 20.10+ 
- **Docker Compose**: 版本 2.0+ 或 docker-compose 1.29+
- **操作系统**: Linux, macOS, Windows (WSL2)

### 硬件要求
- **内存**: 最低 512MB，推荐 1GB+
- **存储**: 最低 2GB 可用空间
- **CPU**: 1核心以上

## 🚀 快速开始

### 1. 获取代码
```bash
git clone https://github.com/c1767673917/wlbj.git
cd wlbj
git checkout docker-version
```

### 2. 配置环境变量
```bash
# 复制环境变量示例文件
cp .env.docker.example .env

# 编辑环境变量文件
nano .env
```

**重要**: 请设置正确的 `SILICONFLOW_API_KEY`，否则 AI 功能将不可用。

### 3. 一键部署
```bash
# 使用部署脚本（推荐）
./docker-deploy.sh

# 或手动部署
docker-compose up -d
```

### 4. 访问应用
- **应用主页**: http://localhost:3000
- **用户端**: http://localhost:3000/user
- **供应商端**: 通过用户端生成的专属链接访问

## 📁 Docker 文件结构

```
wlbj/
├── Dockerfile                 # 主应用容器配置
├── docker-compose.yml         # 多容器编排配置
├── .dockerignore             # Docker 构建忽略文件
├── docker-entrypoint.sh      # 容器启动脚本
├── docker-deploy.sh          # 一键部署脚本
├── .env.docker.example       # 环境变量示例
├── README-Docker.md          # Docker 部署文档
└── docker/                   # Docker 配置目录
    └── nginx/                # Nginx 配置
        ├── nginx.conf        # 主配置文件
        └── conf.d/
            └── wlbj.conf     # 站点配置
```

## ⚙️ 配置说明

### 环境变量配置 (.env)
```env
# SiliconFlow AI API配置
SILICONFLOW_API_KEY=your_api_key_here
SILICONFLOW_API_URL=https://api.siliconflow.cn/v1/chat/completions

# 应用配置
NODE_ENV=production
PORT=3000

# 数据库配置
DB_PATH=/app/data/logistics.db

# 日志配置
LOG_LEVEL=info
LOG_DIR=/app/logs
```

### 用户认证配置
首次启动后，系统会自动创建默认配置文件：
```bash
# 查看默认密码配置
docker-compose exec wlbj-app cat /app/config-persistent/auth_config.json

# 修改用户密码
docker-compose exec wlbj-app sh -c 'echo "{\"password\": \"your_new_password\"}" > /app/config-persistent/auth_config.json'
```

## 🔧 管理命令

### 使用部署脚本（推荐）
```bash
# 部署服务
./docker-deploy.sh deploy

# 停止服务
./docker-deploy.sh stop

# 重启服务
./docker-deploy.sh restart

# 查看日志
./docker-deploy.sh logs

# 查看状态
./docker-deploy.sh status

# 清理所有数据（危险操作）
./docker-deploy.sh clean
```

### 使用 Docker Compose
```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f

# 查看状态
docker-compose ps

# 重启特定服务
docker-compose restart wlbj-app

# 进入容器
docker-compose exec wlbj-app sh
```

## 📊 数据持久化

### 数据卷说明
- **wlbj-data**: 数据库文件存储
- **wlbj-logs**: 应用日志存储  
- **wlbj-config**: 配置文件存储
- **wlbj-nginx-logs**: Nginx 日志存储（如果启用）

### 备份数据
```bash
# 备份数据库
docker-compose exec wlbj-app cp /app/data/logistics.db /tmp/
docker cp $(docker-compose ps -q wlbj-app):/tmp/logistics.db ./backup-$(date +%Y%m%d).db

# 备份配置
docker-compose exec wlbj-app tar -czf /tmp/config-backup.tar.gz -C /app/config-persistent .
docker cp $(docker-compose ps -q wlbj-app):/tmp/config-backup.tar.gz ./config-backup-$(date +%Y%m%d).tar.gz
```

### 恢复数据
```bash
# 恢复数据库
docker cp ./backup-20240101.db $(docker-compose ps -q wlbj-app):/app/data/logistics.db
docker-compose restart wlbj-app
```

## 🌐 Nginx 反向代理（可选）

### 启用 Nginx
```bash
# 使用 Nginx 配置启动
docker-compose --profile with-nginx up -d
```

### 配置 HTTPS
1. 将 SSL 证书放置在 `docker/nginx/ssl/` 目录
2. 修改 `docker/nginx/conf.d/wlbj.conf` 中的 HTTPS 配置
3. 重启 Nginx 服务

## 🔍 故障排除

### 常见问题

#### 1. 容器启动失败
```bash
# 查看详细日志
docker-compose logs wlbj-app

# 检查容器状态
docker-compose ps
```

#### 2. 端口冲突
```bash
# 修改 docker-compose.yml 中的端口映射
ports:
  - "3001:3000"  # 改为其他端口
```

#### 3. 权限问题
```bash
# 检查数据卷权限
docker-compose exec wlbj-app ls -la /app/data
```

#### 4. API 密钥问题
```bash
# 检查环境变量
docker-compose exec wlbj-app env | grep SILICONFLOW
```

### 日志查看
```bash
# 应用日志
docker-compose logs -f wlbj-app

# Nginx 日志（如果启用）
docker-compose logs -f nginx

# 系统日志
docker-compose exec wlbj-app tail -f /app/logs/app.log
```

## 🔒 安全建议

### 生产环境部署
1. **修改默认密码**: 立即修改 `auth_config.json` 中的默认密码
2. **使用 HTTPS**: 配置 SSL 证书启用 HTTPS
3. **防火墙配置**: 仅开放必要端口（80, 443）
4. **定期备份**: 设置自动备份计划
5. **监控日志**: 监控异常访问和错误日志

### 网络安全
```bash
# 限制网络访问（示例）
docker-compose exec wlbj-app iptables -A INPUT -p tcp --dport 3000 -s 192.168.1.0/24 -j ACCEPT
```

## 📈 性能优化

### 资源限制
在 `docker-compose.yml` 中添加资源限制：
```yaml
services:
  wlbj-app:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

### 缓存优化
- 启用 Nginx 静态文件缓存
- 配置适当的缓存头
- 使用 gzip 压缩

## 🆙 更新升级

### 更新应用
```bash
# 拉取最新代码
git pull origin docker-version

# 重新构建和部署
docker-compose build --no-cache
docker-compose up -d
```

### 版本回滚
```bash
# 回滚到指定版本
git checkout <previous-commit>
docker-compose build
docker-compose up -d
```

## 📞 技术支持

如遇到问题，请按以下顺序排查：

1. 检查 [故障排除](#-故障排除) 部分
2. 查看应用日志：`docker-compose logs -f`
3. 检查系统资源：`docker stats`
4. 验证配置文件：检查 `.env` 和配置文件语法

---

**版本**: Docker v1.0.0  
**状态**: 生产就绪  
**最后更新**: 2025年5月
