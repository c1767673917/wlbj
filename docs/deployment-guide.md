# WLBJ物流报价系统 - 部署指南

## 概述

本文档描述了重构后的WLBJ物流报价系统的部署流程。系统采用分层架构设计，支持多种部署方式。

## 系统要求

### 基础环境

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **内存**: 最少 512MB，推荐 2GB+
- **磁盘**: 最少 1GB 可用空间

### 可选组件

- **Docker**: >= 20.10.0（容器化部署）
- **PostgreSQL**: >= 12.0（生产环境推荐）
- **Redis**: >= 6.0（缓存，可选）
- **Nginx**: >= 1.18（反向代理）

## 环境配置

### 1. 环境变量配置

系统支持三种环境：`development`、`production`、`test`

#### 生产环境配置

```bash
# 复制配置模板
cp .env.production.example .env.production

# 编辑配置文件
vim .env.production
```

**必需配置项：**

```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=your_secure_jwt_secret_here
```

**数据库配置（SQLite）：**

```bash
DB_CLIENT=sqlite3
DB_FILENAME=./data/logistics.db
```

**数据库配置（PostgreSQL）：**

```bash
DB_CLIENT=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wlbj
DB_USER=wlbj_user
DB_PASSWORD=your_secure_password
```

### 2. 安全配置

**JWT配置：**

```bash
JWT_SECRET=your_very_secure_random_string_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

**限流配置：**

```bash
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50
```

## 部署方式

### 方式一：直接部署

#### 1. 准备环境

```bash
# 克隆代码
git clone <repository-url>
cd wlbj-refactored

# 安装依赖
npm ci --only=production

# 配置环境变量
cp .env.production.example .env.production
# 编辑 .env.production 文件
```

#### 2. 初始化数据库

```bash
# 运行数据库迁移
npm run migrate:latest

# 可选：运行种子数据（仅开发环境）
npm run seed:run
```

#### 3. 启动应用

```bash
# 使用npm启动
npm start

# 或使用自定义启动脚本
./scripts/start.sh production
```

### 方式二：Docker部署

#### 1. 单容器部署

```bash
# 构建镜像
docker build -t wlbj:latest --target runner .

# 运行容器
docker run -d \
  --name wlbj-app \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your_jwt_secret \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  wlbj:latest
```

#### 2. Docker Compose部署

```bash
# 生产环境
docker-compose up -d

# 开发环境
docker-compose -f docker-compose.dev.yml up -d
```

### 方式三：蓝绿部署

使用提供的部署脚本进行零停机部署：

```bash
# 蓝绿部署
./scripts/deploy.sh production blue-green v3.0.0

# 滚动部署
./scripts/deploy.sh production rolling v3.0.0
```

## 健康检查

### 应用健康检查

```bash
curl http://localhost:3000/health
```

**正常响应：**

```json
{
  "success": true,
  "message": "Service is healthy",
  "timestamp": "2025-06-26T00:00:00.000Z",
  "version": "3.0.0",
  "environment": "production"
}
```

### 生产环境验证

```bash
# 运行完整验证
./scripts/validate-production.sh
```

## 监控和日志

### 日志配置

- **日志级别**: `info`（生产环境）
- **日志文件**: `./logs/app.log`
- **错误日志**: `./logs/error.log`

### 监控端点

- **健康检查**: `GET /health`
- **指标监控**: `GET :9090/metrics`（如果启用）

## 性能优化

### Node.js优化

```bash
# 设置内存限制
NODE_OPTIONS="--max-old-space-size=2048"

# 启用集群模式（可选）
CLUSTER_WORKERS=auto
```

### 数据库优化

- 使用PostgreSQL替代SQLite（生产环境）
- 配置连接池
- 定期备份数据

### 缓存配置

```bash
# Redis缓存（可选）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

## 安全配置

### HTTPS配置

```bash
# SSL证书路径
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

### 防火墙配置

```bash
# 开放必要端口
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp  # 仅内网访问
```

### IP白名单

```bash
# 限制管理接口访问
ALLOWED_IPS=127.0.0.1,10.0.0.0/8,192.168.0.0/16
```

## 备份和恢复

### 自动备份

```bash
# 启用自动备份
BACKUP_ENABLED=true
BACKUP_INTERVAL=86400000  # 24小时
BACKUP_RETENTION_DAYS=30
```

### 手动备份

```bash
# SQLite备份
cp data/logistics.db backups/logistics_$(date +%Y%m%d_%H%M%S).db

# PostgreSQL备份
pg_dump -U wlbj_user -d wlbj > backups/wlbj_$(date +%Y%m%d_%H%M%S).sql
```

## 故障排除

### 常见问题

1. **应用无法启动**
   - 检查环境变量配置
   - 验证数据库连接
   - 查看日志文件

2. **数据库连接失败**
   - 检查数据库服务状态
   - 验证连接参数
   - 检查网络连通性

3. **性能问题**
   - 检查内存使用
   - 分析慢查询
   - 优化数据库索引

### 日志分析

```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log

# 搜索特定错误
grep "ERROR" logs/app.log
```

## 版本升级

### 升级流程

1. 备份当前版本
2. 停止应用服务
3. 更新代码
4. 运行数据库迁移
5. 启动新版本
6. 验证功能正常

### 回滚流程

```bash
# 使用回滚脚本
./scripts/rollback.sh

# 手动回滚
git checkout previous-version
npm ci --only=production
npm run migrate:rollback
npm start
```

## 环境配置详细说明

### 配置文件优先级

1. 环境变量（最高优先级）
2. `.env.{NODE_ENV}` 文件
3. `.env` 文件
4. 默认配置（最低优先级）

### 配置验证

```bash
# 验证配置是否正确
node -e "require('./src/config/env'); console.log('配置验证通过')"
```

### 配置模板说明

- `.env.production.example` - 生产环境配置模板
- `.env.development.example` - 开发环境配置模板
- `.env.test.example` - 测试环境配置模板

## 联系支持

如遇到部署问题，请联系技术支持团队或查看项目文档。
