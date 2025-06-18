# 部署最佳实践指南

## 🚀 部署前检查清单

### 1. 环境配置检查

#### 必需的环境变量
```bash
# 复制环境变量模板
cp env.example .env

# 编辑环境变量
nano .env
```

**关键配置项**：
- `NODE_ENV=production` - 设置生产环境
- `JWT_SECRET` - 修改为强随机字符串（至少32位）
- `APP_PASSWORD` - 设置管理员密码（强密码）
- `TRUST_PROXY` - 根据部署环境配置代理信任

#### Trust Proxy 配置指南

| 部署场景 | 推荐配置 | 说明 |
|---------|---------|------|
| 直接部署（无代理） | `TRUST_PROXY=false` | 不信任任何代理 |
| Nginx/Apache 单层代理 | `TRUST_PROXY=1` | 信任第一层代理 |
| 云服务负载均衡器 | `TRUST_PROXY=loopback` | 仅信任本地代理 |
| 多层代理 | `TRUST_PROXY=127.0.0.1,::1` | 指定可信代理IP |

### 2. 前端构建检查

```bash
# 构建前端
cd frontend
npm install
npm run build

# 验证构建结果
cd ..
node scripts/verify-frontend-build.js
```

### 3. 数据库检查

```bash
# 检查数据库文件
ls -la data/logistics.db

# 测试数据库连接
node -e "
const db = require('./db/database');
console.log('数据库连接测试成功');
"
```

### 4. 依赖安装检查

```bash
# 安装生产依赖
npm install --production

# 检查关键依赖
npm list express sqlite3 express-rate-limit helmet
```

## 🔧 常见部署问题解决方案

### 问题1: 前端路由返回500错误

**原因**: 静态文件服务配置问题或前端构建失败

**解决方案**:
```bash
# 重新构建前端
cd frontend && npm run build

# 检查构建文件
ls -la dist/

# 验证 index.html 内容
cat dist/index.html
```

### 问题2: Rate Limiting 在代理环境下失效

**原因**: Trust proxy 配置不正确

**解决方案**:
```bash
# 检查当前配置
echo $TRUST_PROXY

# 根据部署环境设置
# Nginx 代理:
export TRUST_PROXY=1

# 多层代理:
export TRUST_PROXY="127.0.0.1,::1,10.0.0.1"
```

### 问题3: SQLite3 模块加载失败

**原因**: Node.js 版本不兼容或 native 模块未正确编译

**解决方案**:
```bash
# 检查 Node.js 版本
node --version

# 重新安装 SQLite3
npm uninstall sqlite3
npm install sqlite3

# 如果仍有问题，从源码编译
npm install sqlite3 --build-from-source
```

## 🛡️ 安全配置建议

### 1. 环境变量安全

```bash
# 生成强随机 JWT Secret
openssl rand -hex 32

# 生成强管理员密码
openssl rand -base64 24
```

### 2. 文件权限设置

```bash
# 设置适当的文件权限
chmod 600 .env
chmod 644 data/logistics.db
chmod -R 755 frontend/dist
```

### 3. 防火墙配置

```bash
# 仅开放必要端口
ufw allow 3000/tcp
ufw enable
```

## 📊 性能优化建议

### 1. 启用 Gzip 压缩

在 Nginx 配置中添加：
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

### 2. 静态文件缓存

```nginx
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. 数据库优化

SQLite 已启用以下优化：
- WAL 模式（提升并发性能）
- 2MB 缓存大小
- 内存临时存储

## 🔍 监控和日志

### 1. 日志配置

日志文件位置：
- 应用日志: `logs/app.log`
- 错误日志: `logs/error.log`

### 2. 健康检查

创建健康检查端点：
```bash
curl http://localhost:3000/api/health
```

### 3. 性能监控

监控关键指标：
- 响应时间
- 数据库查询性能
- 内存使用
- CPU 使用率

## 🚀 部署脚本

### 自动化部署检查

```bash
# 运行完整的部署前检查
node scripts/pre-deployment-check.js
```

### 生产环境启动

```bash
# 使用 PM2 管理进程
npm install -g pm2
pm2 start app.js --name "logistics-system" --env production

# 或直接启动
NODE_ENV=production node app.js
```

## 📋 部署检查清单

- [ ] 环境变量已正确配置
- [ ] JWT_SECRET 已修改为强随机值
- [ ] APP_PASSWORD 已设置为强密码
- [ ] TRUST_PROXY 根据部署环境正确配置
- [ ] 前端已成功构建
- [ ] 数据库文件存在且可访问
- [ ] 所有依赖已正确安装
- [ ] 日志目录已创建
- [ ] 文件权限已正确设置
- [ ] 防火墙已配置
- [ ] 健康检查通过
- [ ] 性能监控已设置

## 🆘 故障排除

### 查看日志
```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log
```

### 常用调试命令
```bash
# 检查端口占用
netstat -tlnp | grep 3000

# 检查进程状态
ps aux | grep node

# 检查系统资源
top
df -h
```
