# 🐳 物流报价平台 - Docker 快速开始

## 一分钟部署指南

### 1️⃣ 克隆项目
```bash
git clone https://github.com/c1767673917/wlbj.git
cd wlbj
git checkout docker-version
```

### 2️⃣ 配置环境
```bash
# 复制环境变量文件
cp .env.docker.example .env

# 编辑API密钥（必需）
nano .env
# 设置 SILICONFLOW_API_KEY=your_actual_api_key
```

### 3️⃣ 一键部署
```bash
# 给脚本执行权限并运行
chmod +x docker-deploy.sh
./docker-deploy.sh
```

### 4️⃣ 访问应用
- 🏠 主页: http://localhost:3000
- 👤 用户端: http://localhost:3000/user
- 🔑 默认密码: `changeme_please_ASAP_!`

## 🎯 核心命令

```bash
# 查看状态
./docker-deploy.sh status

# 查看日志
./docker-deploy.sh logs

# 停止服务
./docker-deploy.sh stop

# 重启服务
./docker-deploy.sh restart
```

## ⚡ 快速配置

### 修改用户密码
```bash
# 进入容器修改密码
docker-compose exec wlbj-app sh -c 'echo "{\"password\": \"your_secure_password\"}" > /app/config-persistent/auth_config.json'

# 重启应用
docker-compose restart wlbj-app
```

### 启用Nginx反向代理
```bash
# 使用Nginx配置启动
docker-compose --profile with-nginx up -d
```

## 🔧 故障排除

### 端口被占用
```bash
# 修改端口（编辑 docker-compose.yml）
ports:
  - "3001:3000"  # 改为3001端口
```

### 查看详细日志
```bash
# 应用日志
docker-compose logs -f wlbj-app

# 所有服务日志
docker-compose logs -f
```

### 重置所有数据
```bash
# ⚠️ 危险操作：删除所有数据
./docker-deploy.sh clean
```

## 📋 系统要求

- ✅ Docker 20.10+
- ✅ Docker Compose 2.0+
- ✅ 1GB+ 内存
- ✅ 2GB+ 存储空间

## 🆘 需要帮助？

1. 📖 查看完整文档: [README-Docker.md](README-Docker.md)
2. 🐛 检查日志: `./docker-deploy.sh logs`
3. 🔄 重启服务: `./docker-deploy.sh restart`

---
**快速开始完成！** 🎉
