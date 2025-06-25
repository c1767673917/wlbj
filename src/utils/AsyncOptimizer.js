/**
 * 异步操作性能优化工具类
 * 提供并发控制、批量处理、缓存等性能优化功能
 */

const { logger } = require('../config/logger');

class AsyncOptimizer {
  /**
   * 并发执行任务，限制并发数量
   * @param {Array} tasks - 任务数组（函数）
   * @param {number} maxConcurrency - 最大并发数
   * @returns {Promise<Array>} 执行结果数组
   */
  static async executeConcurrently(tasks, maxConcurrency = 5) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return [];
    }

    const results = [];
    const executing = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      const promise = (async () => {
        try {
          const startTime = Date.now();
          const result = await task();
          const duration = Date.now() - startTime;
          
          logger.debug('并发任务完成', { 
            taskIndex: i, 
            duration: `${duration}ms`,
            success: true 
          });
          
          return { success: true, result, index: i };
        } catch (error) {
          logger.error('并发任务失败', { 
            taskIndex: i, 
            error: error.message 
          });
          
          return { success: false, error, index: i };
        }
      })();

      results.push(promise);
      executing.push(promise);

      // 当达到最大并发数时，等待一个任务完成
      if (executing.length >= maxConcurrency) {
        const completed = await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === completed), 1);
      }
    }

    // 等待所有任务完成
    const allResults = await Promise.all(results);
    
    // 按原始顺序排序结果
    return allResults.sort((a, b) => a.index - b.index);
  }

  /**
   * 批量执行任务，支持失败重试
   * @param {Array} tasks - 任务数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 批量执行结果
   */
  static async executeBatch(tasks, options = {}) {
    const {
      maxConcurrency = 5,
      retryAttempts = 3,
      retryDelay = 1000,
      failFast = false,
      timeout = 30000
    } = options;

    const startTime = Date.now();
    const results = [];
    const errors = [];

    try {
      // 为每个任务添加超时和重试机制
      const wrappedTasks = tasks.map((task, index) => async () => {
        let lastError;
        
        for (let attempt = 1; attempt <= retryAttempts; attempt++) {
          try {
            // 添加超时控制
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('任务执行超时')), timeout);
            });
            
            const result = await Promise.race([task(), timeoutPromise]);
            
            if (attempt > 1) {
              logger.info('任务重试成功', { taskIndex: index, attempt });
            }
            
            return result;
          } catch (error) {
            lastError = error;
            
            if (attempt < retryAttempts) {
              const delay = retryDelay * Math.pow(2, attempt - 1); // 指数退避
              logger.warn('任务失败，准备重试', { 
                taskIndex: index, 
                attempt, 
                delay,
                error: error.message 
              });
              
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        throw lastError;
      });

      // 执行并发任务
      const taskResults = await this.executeConcurrently(wrappedTasks, maxConcurrency);
      
      // 分离成功和失败的结果
      for (const taskResult of taskResults) {
        if (taskResult.success) {
          results.push(taskResult.result);
        } else {
          errors.push({
            index: taskResult.index,
            error: taskResult.error.message
          });
          
          // 如果启用快速失败，遇到错误立即抛出
          if (failFast) {
            throw taskResult.error;
          }
        }
      }

      const duration = Date.now() - startTime;
      
      logger.info('批量任务执行完成', {
        totalTasks: tasks.length,
        successCount: results.length,
        errorCount: errors.length,
        duration: `${duration}ms`,
        maxConcurrency
      });

      return {
        success: true,
        results,
        errors,
        stats: {
          total: tasks.length,
          successful: results.length,
          failed: errors.length,
          duration
        }
      };
    } catch (error) {
      logger.error('批量任务执行失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 并发执行多个不同的异步操作
   * @param {Object} operations - 操作对象 {key: asyncFunction}
   * @returns {Promise<Object>} 结果对象 {key: result}
   */
  static async executeParallel(operations) {
    if (!operations || typeof operations !== 'object') {
      return {};
    }

    const keys = Object.keys(operations);
    if (keys.length === 0) {
      return {};
    }

    try {
      const startTime = Date.now();
      
      // 并发执行所有操作
      const promises = keys.map(async (key) => {
        try {
          const result = await operations[key]();
          return { key, success: true, result };
        } catch (error) {
          logger.error('并行操作失败', { key, error: error.message });
          return { key, success: false, error };
        }
      });

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      // 构建结果对象
      const resultObj = {};
      const errors = [];
      
      for (const result of results) {
        if (result.success) {
          resultObj[result.key] = result.result;
        } else {
          errors.push({ key: result.key, error: result.error.message });
        }
      }

      logger.debug('并行操作完成', {
        operationCount: keys.length,
        successCount: Object.keys(resultObj).length,
        errorCount: errors.length,
        duration: `${duration}ms`
      });

      return { data: resultObj, errors };
    } catch (error) {
      logger.error('并行操作执行失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 缓存异步操作结果
   * @param {string} key - 缓存键
   * @param {Function} operation - 异步操作
   * @param {number} ttl - 缓存时间（毫秒）
   * @returns {Promise<any>} 操作结果
   */
  static async withCache(key, operation, ttl = 300000) { // 默认5分钟
    const cache = this.getCache();
    
    // 检查缓存
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      logger.debug('使用缓存结果', { key });
      return cached.data;
    }

    try {
      // 执行操作
      const result = await operation();
      
      // 存储到缓存
      cache.set(key, {
        data: result,
        timestamp: Date.now()
      });
      
      logger.debug('缓存操作结果', { key });
      return result;
    } catch (error) {
      logger.error('缓存操作失败', { key, error: error.message });
      throw error;
    }
  }

  /**
   * 获取简单的内存缓存实例
   * @returns {Map} 缓存实例
   */
  static getCache() {
    if (!this._cache) {
      this._cache = new Map();
      
      // 定期清理过期缓存
      setInterval(() => {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, value] of this._cache.entries()) {
          if (now - value.timestamp > 600000) { // 10分钟后清理
            this._cache.delete(key);
            cleanedCount++;
          }
        }
        
        if (cleanedCount > 0) {
          logger.debug('清理过期缓存', { cleanedCount });
        }
      }, 300000); // 每5分钟清理一次
    }
    
    return this._cache;
  }

  /**
   * 清空缓存
   */
  static clearCache() {
    if (this._cache) {
      this._cache.clear();
      logger.info('缓存已清空');
    }
  }
}

module.exports = AsyncOptimizer;
