/**
 * 基础Controller类
 * 提供通用的请求处理和响应格式化方法
 */

const { logger } = require('../config/logger');

class BaseController {
  constructor(name) {
    this.controllerName = name;
  }

  /**
   * 处理异步请求
   * @param {Function} handler - 处理函数
   * @returns {Function} Express中间件函数
   */
  asyncHandler(handler) {
    return async (req, res, next) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        this.handleError(error, req, res, next);
      }
    };
  }

  /**
   * 统一错误处理 - 委托给全局错误处理中间件
   * @param {Error} error - 错误对象
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   * @param {Function} next - Express next函数
   */
  handleError(error, req, res, next) {
    // 添加控制器上下文信息
    error.controller = this.controllerName;

    // 记录控制器级别的错误日志
    logger.error(`${this.controllerName} 控制器错误`, {
      error: error.message,
      code: error.code,
      method: req.method,
      url: req.url,
      userId: req.user?.id
    });

    // 委托给全局错误处理中间件
    next(error);
  }

  /**
   * 发送成功响应
   * @param {Object} res - Express响应对象
   * @param {any} data - 响应数据
   * @param {string} message - 响应消息
   * @param {number} statusCode - HTTP状态码
   * @param {Object} meta - 元数据
   */
  sendSuccess(res, data, message = 'success', statusCode = 200, meta = {}) {
    const response = {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };

    res.status(statusCode).json(response);
  }

  /**
   * 发送分页响应
   * @param {Object} res - Express响应对象
   * @param {Array} items - 数据项
   * @param {number} total - 总数
   * @param {Object} pagination - 分页信息
   * @param {string} message - 响应消息
   */
  sendPaginatedResponse(res, items, total, pagination, message = 'success') {
    const { page, limit } = pagination;
    const totalPages = Math.ceil(total / limit);

    this.sendSuccess(res, items, message, 200, {
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  }

  /**
   * 发送错误响应
   * @param {Object} res - Express响应对象
   * @param {string} message - 错误消息
   * @param {number} statusCode - HTTP状态码
   * @param {string} code - 错误代码
   */
  sendError(res, message, statusCode = 400, code = 'BAD_REQUEST') {
    const response = {
      success: false,
      message,
      code,
      timestamp: new Date().toISOString()
    };

    res.status(statusCode).json(response);
  }

  /**
   * 验证必需参数
   * @param {Object} data - 数据对象
   * @param {Array} requiredFields - 必需字段数组
   * @throws {Error} 参数验证失败时抛出错误
   */
  validateRequiredParams(data, requiredFields) {
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      const error = new Error(`缺少必需参数: ${missingFields.join(', ')}`);
      error.statusCode = 400;
      error.code = 'MISSING_REQUIRED_PARAMS';
      throw error;
    }
  }

  /**
   * 获取用户信息
   * @param {Object} req - Express请求对象
   * @returns {Object} 用户信息
   */
  getCurrentUser(req) {
    if (!req.user) {
      const error = new Error('用户未认证');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }
    return req.user;
  }

  /**
   * 检查用户权限
   * @param {Object} req - Express请求对象
   * @param {string|Array} requiredRoles - 必需的角色
   * @throws {Error} 权限不足时抛出错误
   */
  checkUserRole(req, requiredRoles) {
    const user = this.getCurrentUser(req);
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    if (!roles.includes(user.role)) {
      const error = new Error('权限不足');
      error.statusCode = 403;
      error.code = 'INSUFFICIENT_PERMISSIONS';
      throw error;
    }
  }

  /**
   * 提取分页参数
   * @param {Object} req - Express请求对象
   * @returns {Object} 分页参数
   */
  extractPaginationParams(req) {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    // 验证分页参数
    if (page < 1) {
      const error = new Error('页码必须大于0');
      error.statusCode = 400;
      error.code = 'INVALID_PAGE';
      throw error;
    }

    if (limit < 1 || limit > 100) {
      const error = new Error('每页数量必须在1-100之间');
      error.statusCode = 400;
      error.code = 'INVALID_LIMIT';
      throw error;
    }

    return {
      page,
      limit,
      offset: (page - 1) * limit
    };
  }

  /**
   * 提取排序参数
   * @param {Object} req - Express请求对象
   * @param {Array} allowedFields - 允许排序的字段
   * @returns {Array} 排序参数
   */
  extractSortParams(req, allowedFields = []) {
    const sortBy = req.query.sortBy;
    const sortOrder = req.query.sortOrder || 'asc';

    if (!sortBy) {
      return [];
    }

    // 验证排序字段
    if (allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
      const error = new Error(`不允许按字段 '${sortBy}' 排序`);
      error.statusCode = 400;
      error.code = 'INVALID_SORT_FIELD';
      throw error;
    }

    // 验证排序方向
    if (!['asc', 'desc'].includes(sortOrder.toLowerCase())) {
      const error = new Error('排序方向必须是 asc 或 desc');
      error.statusCode = 400;
      error.code = 'INVALID_SORT_ORDER';
      throw error;
    }

    return [{
      column: sortBy,
      direction: sortOrder.toLowerCase()
    }];
  }

  /**
   * 提取过滤参数
   * @param {Object} req - Express请求对象
   * @param {Array} allowedFilters - 允许的过滤字段
   * @returns {Object} 过滤参数
   */
  extractFilterParams(req, allowedFilters = []) {
    const filters = {};

    for (const filter of allowedFilters) {
      if (req.query[filter] !== undefined) {
        filters[filter] = req.query[filter];
      }
    }

    return filters;
  }

  /**
   * 记录操作日志
   * @param {string} action - 操作名称
   * @param {Object} req - Express请求对象
   * @param {Object} data - 操作数据
   */
  logOperation(action, req, data = {}) {
    logger.info(`${this.controllerName} - ${action}`, {
      controller: this.controllerName,
      action,
      method: req.method,
      url: req.url,
      userId: req.user?.id,
      userRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 清理敏感数据
   * @param {Object} data - 数据对象
   * @param {Array} sensitiveFields - 敏感字段数组
   * @returns {Object} 清理后的数据对象
   */
  sanitizeData(data, sensitiveFields = ['password', 'accessKey', 'secret']) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item, sensitiveFields));
    }

    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (sanitized[field] !== undefined) {
        delete sanitized[field];
      }
    }

    return sanitized;
  }

  /**
   * 验证请求体
   * @param {Object} req - Express请求对象
   * @param {Array} requiredFields - 必需字段
   * @returns {Object} 验证后的请求体
   */
  validateRequestBody(req, requiredFields = []) {
    if (!req.body || typeof req.body !== 'object') {
      const error = new Error('请求体不能为空');
      error.statusCode = 400;
      error.code = 'EMPTY_REQUEST_BODY';
      throw error;
    }

    this.validateRequiredParams(req.body, requiredFields);
    return req.body;
  }

  /**
   * 验证路径参数
   * @param {Object} req - Express请求对象
   * @param {Array} requiredParams - 必需参数
   * @returns {Object} 验证后的路径参数
   */
  validatePathParams(req, requiredParams = []) {
    this.validateRequiredParams(req.params, requiredParams);
    return req.params;
  }
}

module.exports = BaseController;
