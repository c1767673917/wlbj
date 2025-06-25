# 多阶段构建 - 生产环境优化的Node.js应用
FROM node:18-alpine AS base

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 依赖安装阶段
FROM base AS deps

# 复制package文件
COPY package*.json ./

# 安装所有依赖（包括开发依赖）
RUN npm ci --include=dev

# 构建阶段
FROM base AS builder

# 复制源代码和依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 运行构建脚本（如果有的话）
RUN npm run build 2>/dev/null || echo "No build script found"

# 清理开发依赖，只保留生产依赖
RUN npm ci --only=production && npm cache clean --force

# 生产运行阶段
FROM base AS runner

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 复制应用文件
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/database ./database
COPY --from=builder --chown=nodejs:nodejs /app/migrations ./migrations

# 创建日志目录
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs

# 切换到非root用户
USER nodejs

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# 暴露端口
EXPOSE $PORT

# 使用dumb-init作为PID 1，优雅处理信号
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["node", "src/app.js"]

# 开发环境镜像
FROM base AS development

# 设置环境变量
ENV NODE_ENV=development

# 复制package文件
COPY package*.json ./

# 安装所有依赖
RUN npm ci

# 复制源代码
COPY . .

# 切换到非root用户
USER nodejs

# 暴露端口和调试端口
EXPOSE 3000 9229

# 开发模式启动
CMD ["npm", "run", "dev"]

# 测试环境镜像
FROM development AS test

# 设置测试环境变量
ENV NODE_ENV=test

# 运行测试
CMD ["npm", "test"]
