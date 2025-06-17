# 物流报价平台 (wlbj)

[![版本](https://img.shields.io/badge/版本-v2.0.0-blue.svg)](https://github.com/c1767673917/wlbj)
[![技术栈](https://img.shields.io/badge/技术栈-React%2018%20%2B%20Node.js-green.svg)](#技术架构)
[![部署状态](https://img.shields.io/badge/部署状态-生产就绪-success.svg)](#部署指南)

## 📋 项目简介

物流报价平台(wlbj)是一个专业的B2B物流报价管理系统，为货主和物流供应商提供高效的报价对接平台。系统采用现代化的前后端分离架构，具备完整的订单管理、报价比较、供应商管理、智能通知等核心功能，支持多用户权限管理和企业级部署。

### 🎯 核心价值

- **提升效率**: 自动化订单分发和报价收集，减少人工沟通成本。
- **透明比价**: 实时报价对比，帮助货主选择最优物流方案。
- **智能通知**: 企业微信群机器人自动通知，确保信息及时传达。
- **数据洞察**: 完整的订单和报价数据记录，支持业务分析。

## 🚀 主要功能

### 👤 用户端 (货主)
- **订单管理**: 创建、编辑、状态管理订单。
- **报价比较**: 实时查看物流商报价，最低价高亮。
- **供应商管理**: 添加物流公司，生成专属访问链接。
- **企业微信通知**: 新订单自动通知到群。
- **数据导出**: 导出Excel格式的订单数据。

### 🚛 物流供应商端
- **专属访问**: 通过访问密钥直接登录，无需注册。
- **快速报价**: 提交价格和预计送达时间。
- **报价管理**: 查看和修改已提交的报价。

### 👨‍💼 管理员端
- **用户管理**: 创建和管理用户账户。
- **订单管理**: 查看所有用户订单和全局统计。
- **备份管理**: 支持手动和自动数据备份与恢复。

## 🏗️ 技术架构

- **前端**: React 18, TypeScript, Vite, Tailwind CSS
- **后端**: Node.js, Express.js, SQLite
- **认证**: JWT (JSON Web Token)
- **核心特性**: 前后端分离, 多用户权限, 智能通知, 数据备份, 性能优化

## ⚡ 快速开始

### 系统要求
- **Node.js**: 18+ (推荐 20.x)
- **npm**: 9.0+
- **Redis**: 6.0+ (必需，用于缓存和会话管理)
- **操作系统**: Windows, macOS, Linux

### 一键启动 (开发环境)

1.  **克隆项目**:
    ```bash
    git clone https://github.com/c1767673917/wlbj.git
    cd wlbj
    ```

2.  **一键启动**:
    ```bash
    chmod +x start-dev.sh
    ./start-dev.sh
    ```
    此脚本将自动安装前后端依赖并启动开发服务器。

3.  **访问应用**:
    - **前端主页**: `http://localhost:5173`
    - **用户端**: `http://localhost:5173/user`
    - **管理员端**: `http://localhost:5173/admin`
    - **供应商端**: `http://localhost:5173/provider/{accessKey}`

### 首次运行配置

在首次运行前，请完成以下配置：

1.  **环境变量**:
    复制环境变量文件，并根据需要修改。
    ```bash
    cp env.example .env
    nano .env
    ```
    **关键配置**:
    ```env
    NODE_ENV=development
    PORT=3000
    JWT_SECRET=your_very_long_and_secure_jwt_secret_here

    # Redis配置（必需）
    REDIS_HOST=localhost
    REDIS_PORT=6379

    # 管理员密码（强烈建议修改）
    APP_PASSWORD=your_secure_admin_password_here
    ```

2.  **用户认证**:
    创建 `auth_config.json` 文件，为用户端设置访问密码。
    ```bash
    nano auth_config.json
    ```
    **文件内容**:
    ```json
    {
      "password": "your_secure_password_here"
    }
    ```

## 📦 部署指南 (生产环境)

推荐使用 PM2 和 Nginx 进行生产环境部署。

1.  **环境准备**:
    确保服务器已安装 Node.js 20.x, PM2, Nginx 和 Redis。
    ```bash
    # 安装 Node.js 和 PM2
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    sudo npm install -g pm2

    # 安装 Nginx 和 Redis
    sudo apt install nginx redis-server -y

    # 启动并启用 Redis
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
    ```

2.  **部署代码**:
    ```bash
    sudo git clone https://github.com/c1767673917/wlbj.git /var/www/wlbj
    cd /var/www/wlbj

    # 安装依赖并构建前端
    npm install --production
    cd frontend
    npm install
    npm run build
    cd ..
    ```

3.  **配置与启动**:
    - 参考 **快速开始** 部分完成 `.env` 和 `auth_config.json` 的生产环境配置。
    - **重要**: 在生产环境中设置强密码：
      ```bash
      # 在 .env 文件中设置管理员密码
      echo "APP_PASSWORD=your_very_secure_password_here" >> .env
      ```
    - 使用 PM2 启动应用：
      ```bash
      pm2 start app.js --name wlbj-app
      pm2 save
      pm2 startup
      ```

4.  **配置 Nginx**:
    创建一个新的 Nginx 站点配置，将流量反向代理到 Node.js 应用。
    ```nginx
    server {
        listen 80;
        server_name your-domain.com;

        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
    ```
    **提示**: 别忘了使用 `sudo systemctl restart nginx` 重启 Nginx。为了安全，建议使用 Certbot 配置 SSL。

## ❓ 常见问题 (FAQ)

**Q: 如何配置企业微信机器人通知?**
**A:** 在【供应商管理】页面，为指定的物流公司添加企业微信的 Webhook URL 即可。新订单创建后，系统会自动将订单信息推送到该地址。

**Q: 忘记管理员密码怎么办？**
**A:** 系统暂未提供密码找回功能。如果忘记密码，需要手动在数据库 `users` 表中重置管理员账户的密码哈希值。建议妥善保管好初始密码。

**Q: 系统支持多少订单量？**
**A:** 当前的 SQLite 数据库适用于中小型应用（日订单量数百至数千）。如果业务量巨大，建议将数据库迁移至 PostgreSQL 以获得更好的性能和扩展性。

**Q: 如何备份和恢复数据？**
**A:** 系统内置了备份功能，管理员可以在后台手动创建全系统备份（数据库和配置文件）。恢复时，可使用 `restore-system.sh` 脚本进行一键恢复。

## 📞 技术支持

如果您在使用过程中遇到任何问题或有功能建议，欢迎通过以下方式联系我们：

- **GitHub Issues**: [https://github.com/c1767673917/wlbj/issues](https://github.com/c1767673917/wlbj/issues)
- **Email**: [c1767673917@163.com](mailto:c1767673917@163.com)
