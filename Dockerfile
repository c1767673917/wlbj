# 物流报价系统 Docker 镜像
# 基于 Node.js 18 Alpine 构建的生产环境镜像

# 构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev

# 复制 package 文件
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# 安装后端依赖
RUN npm ci --only=production

# 安装前端依赖并构建
COPY frontend/ ./frontend/
RUN cd frontend && npm ci && npm run build

# 生产阶段
FROM node:18-alpine AS production

# 创建应用用户
RUN addgroup -g 1001 -S wlbj && \
    adduser -S wlbj -u 1001 -G wlbj

# 安装运行时依赖
RUN apk add --no-cache \
    sqlite \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# 设置工作目录
WORKDIR /app

# 复制应用文件
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --chown=wlbj:wlbj . .

# 创建必要的目录
RUN mkdir -p logs data && \
    chown -R wlbj:wlbj /app

# 初始化数据库（确保Linux兼容性）
RUN if [ -f data/logistics.db ]; then \
        echo "检测到现有数据库，检查兼容性..." && \
        sqlite3 data/logistics.db "PRAGMA integrity_check;" && \
        echo "数据库兼容性检查通过"; \
    else \
        echo "初始化新数据库..." && \
        su wlbj -c "cd /app && node -e \"require('./db/database')\"" && \
        echo "数据库初始化完成"; \
    fi

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 切换到应用用户
USER wlbj

# 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "app.js"]
