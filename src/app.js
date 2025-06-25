/**
 * 物流报价对比系统 - 主应用文件
 * 重构版本 - 采用分层架构设计
 */

const express = require('express');
const cors = require('cors');
const { logger } = require('./config/logger');
const config = require('./config/env');
const { security, errorHandler, initializeErrorHandling } = require('./middleware');
const routes = require('./routes');

// 初始化全局错误处理
initializeErrorHandling();

// 创建Express应用
const app = express();

// 信任代理设置（用于获取真实IP）
app.set('trust proxy', true);

// 基础中间件
app.use(security.securityHeaders); // 安全头
app.use(cors()); // CORS支持
app.use(express.json({ limit: '10mb' })); // JSON解析
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL编码解析

// 请求日志中间件
app.use(security.requestLogger);

// 只在非测试环境启用限流
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/', security.apiRateLimit);
}

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Service is healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '3.0.0',
    environment: config.app.env
  });
});

// API路由
app.use('/api', routes);

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器 - 只在非测试环境自动启动
const PORT = config.app.port;
let server;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, config.app.host, () => {
    logger.info(`WLBJ服务器启动成功`, {
      port: PORT,
      host: config.app.host,
      environment: config.app.env,
      timestamp: new Date().toISOString()
    });
  });

  // 优雅关闭处理
  const gracefulShutdown = (signal) => {
    logger.info(`收到${signal}信号，开始优雅关闭服务器`);

    server.close(() => {
      logger.info('HTTP服务器已关闭');
      process.exit(0);
    });

    // 强制关闭超时
    setTimeout(() => {
      logger.error('强制关闭服务器');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// 提供服务器关闭方法
app.closeServer = () => {
  if (server) {
    return new Promise((resolve) => {
      server.close(() => {
        logger.info('服务器已关闭');
        resolve();
      });
    });
  }
  return Promise.resolve();
};

module.exports = app;
