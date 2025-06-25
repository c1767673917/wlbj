/**
 * 中间件入口文件
 * 统一导出所有中间件模块
 */

const auth = require('./auth');
const validation = require('./validation');
const security = require('./security');
const { globalErrorHandler, asyncHandler, initializeErrorHandling, asyncHandlerWithRetry, createBusinessError } = require('./errorHandler');

module.exports = {
  // 认证相关中间件
  auth,
  
  // 输入验证中间件
  validation,
  
  // 安全相关中间件
  security,
  
  // 错误处理中间件
  errorHandler: globalErrorHandler,
  asyncHandler,
  initializeErrorHandling,
  asyncHandlerWithRetry,
  createBusinessError
};
