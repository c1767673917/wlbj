/**
 * 基础Service类
 * 提供通用的业务逻辑方法和错误处理
 */

const { logger } = require('../config/logger');

class BaseService {
  constructor(name) {
    this.serviceName = name;
  }

  /**
   * 记录业务操作日志
   * @param {string} action - 操作名称
   * @param {Object} data - 操作数据
   * @param {string} level - 日志级别
   */
  logOperation(action, data = {}, level = 'info') {
    const logData = {
      service: this.serviceName,
      action,
      ...data,
      timestamp: new Date().toISOString()
    };

    logger[level](`${this.serviceName} - ${action}`, logData);
  }

  /**
   * 记录错误日志
   * @param {string} action - 操作名称
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   */
  logError(action, error, context = {}) {
    this.logOperation(action, {
      error: error.message,
      stack: error.stack,
      ...context
    }, 'error');
  }

  /**
   * 验证必需参数
   * @param {Object} params - 参数对象
   * @param {Array} requiredFields - 必需字段数组
   * @throws {Error} 参数验证失败时抛出错误
   */
  validateRequiredParams(params, requiredFields) {
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (params[field] === undefined || params[field] === null || params[field] === '') {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new Error(`缺少必需参数: ${missingFields.join(', ')}`);
    }
  }

  /**
   * 验证参数类型
   * @param {Object} params - 参数对象
   * @param {Object} typeMap - 类型映射 {field: 'string'|'number'|'boolean'|'object'|'array'}
   * @throws {Error} 类型验证失败时抛出错误
   */
  validateParamTypes(params, typeMap) {
    const typeErrors = [];

    for (const [field, expectedType] of Object.entries(typeMap)) {
      if (params[field] !== undefined) {
        const actualType = Array.isArray(params[field]) ? 'array' : typeof params[field];
        
        if (actualType !== expectedType) {
          typeErrors.push(`${field} 应该是 ${expectedType} 类型，实际是 ${actualType}`);
        }
      }
    }

    if (typeErrors.length > 0) {
      throw new Error(`参数类型错误: ${typeErrors.join('; ')}`);
    }
  }

  /**
   * 创建业务错误 - 使用统一的错误创建方法
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @param {number} statusCode - HTTP状态码
   * @returns {Error} 业务错误对象
   */
  createBusinessError(message, code = 'BUSINESS_ERROR', statusCode = 400) {
    const { createBusinessError } = require('../middleware/errorHandler');
    const error = createBusinessError(message, code, statusCode);
    error.service = this.serviceName; // 添加服务上下文
    return error;
  }

  /**
   * 处理异步操作
   * @param {Function} operation - 异步操作函数
   * @param {string} operationName - 操作名称
   * @param {Object} context - 上下文信息
   * @returns {Promise<any>} 操作结果
   */
  async handleAsyncOperation(operation, operationName, context = {}) {
    try {
      this.logOperation(`${operationName}_start`, context, 'debug');
      
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.logOperation(`${operationName}_success`, {
        ...context,
        duration: `${duration}ms`
      }, 'debug');
      
      return result;
    } catch (error) {
      this.logError(`${operationName}_failed`, error, context);
      throw error;
    }
  }

  /**
   * 分页参数验证和标准化
   * @param {Object} params - 分页参数
   * @returns {Object} 标准化的分页参数
   */
  normalizePaginationParams(params = {}) {
    const {
      page = 1,
      limit = 20,
      offset = null
    } = params;

    // 验证参数
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      throw this.createBusinessError('页码必须是大于0的整数');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw this.createBusinessError('每页数量必须是1-100之间的整数');
    }

    return {
      page: pageNum,
      limit: limitNum,
      offset: offset !== null ? parseInt(offset, 10) : (pageNum - 1) * limitNum
    };
  }

  /**
   * 排序参数验证和标准化
   * @param {string|Object|Array} orderBy - 排序参数
   * @param {Array} allowedFields - 允许排序的字段
   * @returns {Array} 标准化的排序参数
   */
  normalizeOrderByParams(orderBy, allowedFields = []) {
    if (!orderBy) {
      return [];
    }

    let orderByArray = [];

    if (typeof orderBy === 'string') {
      // 支持 "field" 或 "field:desc" 格式
      const [field, direction = 'asc'] = orderBy.split(':');
      orderByArray = [{ column: field, direction }];
    } else if (Array.isArray(orderBy)) {
      orderByArray = orderBy;
    } else if (typeof orderBy === 'object') {
      orderByArray = [orderBy];
    }

    // 验证字段和方向
    const validDirections = ['asc', 'desc'];
    const validatedOrderBy = [];

    for (const order of orderByArray) {
      if (typeof order === 'string') {
        const [field, direction = 'asc'] = order.split(':');
        validatedOrderBy.push({ column: field, direction });
      } else if (order.column) {
        validatedOrderBy.push({
          column: order.column,
          direction: order.direction || 'asc'
        });
      }
    }

    // 检查字段是否允许
    if (allowedFields.length > 0) {
      for (const order of validatedOrderBy) {
        if (!allowedFields.includes(order.column)) {
          throw this.createBusinessError(`不允许按字段 '${order.column}' 排序`);
        }
        
        if (!validDirections.includes(order.direction.toLowerCase())) {
          throw this.createBusinessError(`排序方向必须是 'asc' 或 'desc'`);
        }
        
        order.direction = order.direction.toLowerCase();
      }
    }

    return validatedOrderBy;
  }

  /**
   * 构建标准响应格式
   * @param {any} data - 响应数据
   * @param {string} message - 响应消息
   * @param {Object} meta - 元数据（如分页信息）
   * @returns {Object} 标准响应对象
   */
  buildResponse(data, message = 'success', meta = {}) {
    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * 构建分页响应
   * @param {Array} items - 数据项
   * @param {number} total - 总数
   * @param {Object} pagination - 分页参数
   * @returns {Object} 分页响应对象
   */
  buildPaginatedResponse(items, total, pagination) {
    const { page, limit } = pagination;
    const totalPages = Math.ceil(total / limit);

    return this.buildResponse(items, 'success', {
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
   * 构建错误响应
   * @param {Error} error - 错误对象
   * @returns {Object} 错误响应对象
   */
  buildErrorResponse(error) {
    return {
      success: false,
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    };
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
   * 延迟执行
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重试机制
   * @param {Function} operation - 要重试的操作
   * @param {number} maxRetries - 最大重试次数
   * @param {number} baseDelay - 基础延迟时间（毫秒）
   * @returns {Promise<any>} 操作结果
   */
  async retry(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          break;
        }

        // 指数退避
        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.logOperation('retry_attempt', {
          attempt,
          maxRetries,
          delay,
          error: error.message
        }, 'warn');

        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * 并发执行多个操作
   * @param {Object} operations - 操作对象 {key: asyncFunction}
   * @param {string} operationName - 操作名称
   * @returns {Promise<Object>} 并发执行结果
   */
  async executeParallel(operations, operationName = 'parallel_operations') {
    const AsyncOptimizer = require('../utils/AsyncOptimizer');

    return await this.handleAsyncOperation(async () => {
      const result = await AsyncOptimizer.executeParallel(operations);

      this.logOperation(`${operationName}_parallel_complete`, {
        operationCount: Object.keys(operations).length,
        successCount: Object.keys(result.data).length,
        errorCount: result.errors.length
      });

      return result;
    }, operationName);
  }

  /**
   * 批量执行任务
   * @param {Array} tasks - 任务数组
   * @param {Object} options - 执行选项
   * @param {string} operationName - 操作名称
   * @returns {Promise<Object>} 批量执行结果
   */
  async executeBatch(tasks, options = {}, operationName = 'batch_operations') {
    const AsyncOptimizer = require('../utils/AsyncOptimizer');

    return await this.handleAsyncOperation(async () => {
      const result = await AsyncOptimizer.executeBatch(tasks, options);

      this.logOperation(`${operationName}_batch_complete`, {
        totalTasks: tasks.length,
        successCount: result.stats.successful,
        errorCount: result.stats.failed,
        duration: result.stats.duration
      });

      return result;
    }, operationName);
  }
}

module.exports = BaseService;
