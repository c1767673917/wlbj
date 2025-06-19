/**
 * 全局错误处理中间件
 *
 * 提供统一的错误处理机制，包括异步路由错误包装器、
 * 全局错误处理中间件和未捕获异常处理
 */

const logger = require('../config/logger');
const config = require('../config/env');

/**
 * 异步路由错误处理包装器
 * 自动捕获async函数中的未处理异常并传递给错误处理中间件
 *
 * @param {Function} fn - 异步路由处理函数
 * @returns {Function} - 包装后的路由处理函数
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 全局错误处理中间件
 * 处理所有未被路由捕获的错误
 *
 * @param {Error} err - 错误对象
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - Express next函数
 */
function globalErrorHandler(err, req, res, next) {
  // 记录详细的错误信息
  logger.error('未捕获的错误:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
    errorType: err.constructor.name,
  });

  // 确定错误状态码
  let statusCode = err.status || err.statusCode || 500;

  // 处理特定类型的错误
  if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.name === 'UnauthorizedError' || err.message.includes('unauthorized')) {
    statusCode = 401;
  } else if (err.name === 'ForbiddenError' || err.message.includes('forbidden')) {
    statusCode = 403;
  } else if (err.name === 'NotFoundError' || err.message.includes('not found')) {
    statusCode = 404;
  }

  // 构建错误响应
  const isDevelopment = !config.isProduction();
  const errorResponse = {
    error: isDevelopment ? err.message : getProductionErrorMessage(statusCode),
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  };

  // 在开发环境中包含更多调试信息
  if (isDevelopment) {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details || null;
  }

  // 发送错误响应
  res.status(statusCode).json(errorResponse);
}

/**
 * 获取生产环境友好的错误消息
 *
 * @param {number} statusCode - HTTP状态码
 * @returns {string} - 用户友好的错误消息
 */
function getProductionErrorMessage(statusCode) {
  switch (statusCode) {
    case 400:
      return '请求参数错误';
    case 401:
      return '身份验证失败，请重新登录';
    case 403:
      return '权限不足，无法访问此资源';
    case 404:
      return '请求的资源不存在';
    case 429:
      return '请求过于频繁，请稍后重试';
    case 500:
    default:
      return '服务器内部错误，请稍后重试';
  }
}

/**
 * 404错误处理中间件
 * 处理未匹配到任何路由的请求
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`路由 ${req.originalUrl} 不存在`);
  error.status = 404;
  next(error);
}

/**
 * 初始化全局错误处理
 * 设置未捕获异常和Promise拒绝的处理器
 */
function initializeErrorHandling() {
  // 处理未捕获的Promise拒绝
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝:', {
      reason: reason,
      promise: promise,
      stack: reason?.stack,
      timestamp: new Date().toISOString(),
    });

    // 在生产环境中，记录错误但不退出进程
    // 在开发环境中，可以选择退出进程以便调试
    if (!config.isProduction()) {
      console.error('未处理的Promise拒绝，进程将在5秒后退出...');
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    }
  });

  // 处理未捕获的异常
  process.on('uncaughtException', error => {
    logger.error('未捕获的异常:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // 未捕获的异常通常表示严重问题，应该退出进程
    console.error('未捕获的异常，进程将退出...');
    process.exit(1);
  });

  // 处理进程退出信号
  process.on('SIGTERM', () => {
    logger.info('收到SIGTERM信号，正在优雅关闭...');
    // 这里可以添加清理逻辑
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('收到SIGINT信号，正在优雅关闭...');
    // 这里可以添加清理逻辑
    process.exit(0);
  });
}

/**
 * 创建带有重试机制的异步处理器
 *
 * @param {Function} fn - 异步函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} retryDelay - 重试延迟（毫秒）
 * @returns {Function} - 包装后的函数
 */
function asyncHandlerWithRetry(fn, maxRetries = 3, retryDelay = 1000) {
  return asyncHandler(async (req, res, next) => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn(req, res, next);
      } catch (error) {
        lastError = error;

        // 如果是客户端错误（4xx），不重试
        if (error.status && error.status >= 400 && error.status < 500) {
          throw error;
        }

        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          logger.warn(`操作失败，第${attempt}次重试...`, {
            error: error.message,
            url: req.originalUrl,
            attempt: attempt,
            maxRetries: maxRetries,
          });

          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }

    // 所有重试都失败，抛出最后一个错误
    throw lastError;
  });
}

module.exports = {
  asyncHandler,
  asyncHandlerWithRetry,
  globalErrorHandler,
  notFoundHandler,
  initializeErrorHandling,
};
