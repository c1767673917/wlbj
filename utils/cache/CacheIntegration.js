/**
 * 缓存集成模块
 * 将智能缓存管理器集成到现有系统中
 */

const SmartCacheManager = require('./SmartCacheManager');
const CacheMonitor = require('./monitors/CacheMonitor');
const logger = require('../../config/logger');

class CacheIntegration {
  constructor() {
    // 初始化智能缓存管理器
    this.cacheManager = new SmartCacheManager({
      l1TTL: 300, // L1缓存5分钟
      l1CheckPeriod: 60, // 1分钟检查一次
      l1MaxKeys: 1000, // L1最大1000个键
      l2MaxItems: 5000, // L2最大5000个项目
      l2TTL: 1800000, // L2缓存30分钟
    });

    // 初始化缓存监控器
    this.monitor = new CacheMonitor(this.cacheManager);

    // 缓存策略配置
    this.strategies = {
      // 用户数据缓存策略
      user: {
        ttl: 1800, // 30分钟
        prefix: 'user:',
      },
      // 订单数据缓存策略
      order: {
        ttl: 600, // 10分钟
        prefix: 'order:',
      },
      // 供应商数据缓存策略
      provider: {
        ttl: 3600, // 1小时
        prefix: 'provider:',
      },
      // 报价数据缓存策略
      quote: {
        ttl: 300, // 5分钟
        prefix: 'quote:',
      },
      // 统计数据缓存策略
      stats: {
        ttl: 900, // 15分钟
        prefix: 'stats:',
      },
    };
  }

  /**
   * 初始化缓存系统
   */
  async initialize() {
    try {
      logger.info('初始化智能缓存系统...');

      // 启动缓存监控
      this.monitor.startMonitoring(60000); // 每分钟监控一次

      // 执行缓存预热
      await this.warmUpCache();

      logger.info('智能缓存系统初始化完成');
      return true;
    } catch (error) {
      logger.error('缓存系统初始化失败', { error: error.message });
      return false;
    }
  }

  /**
   * 缓存预热
   */
  async warmUpCache() {
    try {
      logger.info('开始缓存预热...');

      // 这里可以预加载一些常用数据
      // 由于我们没有实际的数据加载器，这里只是示例
      const commonData = {
        system_config: { version: '2.0.0', maintenance: false },
        active_features: ['quotes', 'orders', 'providers'],
        cache_stats: { initialized: true, timestamp: Date.now() },
      };

      for (const [key, value] of Object.entries(commonData)) {
        await this.cacheManager.set(`system:${key}`, value, 3600);
      }

      logger.info('缓存预热完成', { items: Object.keys(commonData).length });
    } catch (error) {
      logger.error('缓存预热失败', { error: error.message });
    }
  }

  /**
   * 获取用户缓存
   */
  async getUserCache(userId) {
    const key = `${this.strategies.user.prefix}${userId}`;
    return await this.cacheManager.get(key);
  }

  /**
   * 设置用户缓存
   */
  async setUserCache(userId, userData) {
    const key = `${this.strategies.user.prefix}${userId}`;
    return await this.cacheManager.set(key, userData, this.strategies.user.ttl);
  }

  /**
   * 获取订单缓存
   */
  async getOrderCache(orderId) {
    const key = `${this.strategies.order.prefix}${orderId}`;
    return await this.cacheManager.get(key);
  }

  /**
   * 设置订单缓存
   */
  async setOrderCache(orderId, orderData) {
    const key = `${this.strategies.order.prefix}${orderId}`;
    return await this.cacheManager.set(key, orderData, this.strategies.order.ttl);
  }

  /**
   * 获取供应商缓存
   */
  async getProviderCache(providerId) {
    const key = `${this.strategies.provider.prefix}${providerId}`;
    return await this.cacheManager.get(key);
  }

  /**
   * 设置供应商缓存
   */
  async setProviderCache(providerId, providerData) {
    const key = `${this.strategies.provider.prefix}${providerId}`;
    return await this.cacheManager.set(key, providerData, this.strategies.provider.ttl);
  }

  /**
   * 获取报价缓存
   */
  async getQuoteCache(quoteKey) {
    const key = `${this.strategies.quote.prefix}${quoteKey}`;
    return await this.cacheManager.get(key);
  }

  /**
   * 设置报价缓存
   */
  async setQuoteCache(quoteKey, quoteData) {
    const key = `${this.strategies.quote.prefix}${quoteKey}`;
    return await this.cacheManager.set(key, quoteData, this.strategies.quote.ttl);
  }

  /**
   * 获取统计数据缓存
   */
  async getStatsCache(statsKey) {
    const key = `${this.strategies.stats.prefix}${statsKey}`;
    return await this.cacheManager.get(key);
  }

  /**
   * 设置统计数据缓存
   */
  async setStatsCache(statsKey, statsData) {
    const key = `${this.strategies.stats.prefix}${statsKey}`;
    return await this.cacheManager.set(key, statsData, this.strategies.stats.ttl);
  }

  /**
   * 清除用户相关缓存
   */
  async clearUserCache(userId) {
    const key = `${this.strategies.user.prefix}${userId}`;
    return await this.cacheManager.del(key);
  }

  /**
   * 清除订单相关缓存
   */
  async clearOrderCache(orderId) {
    const key = `${this.strategies.order.prefix}${orderId}`;
    return await this.cacheManager.del(key);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return this.cacheManager.getStats();
  }

  /**
   * 生成缓存性能报告
   */
  generatePerformanceReport() {
    return this.monitor.generateReport();
  }

  /**
   * 清空所有缓存
   */
  async flushAllCache() {
    return await this.cacheManager.flush();
  }

  /**
   * 关闭缓存系统
   */
  async shutdown() {
    try {
      logger.info('关闭缓存系统...');

      // 停止监控
      this.monitor.stopMonitoring();

      // 清空缓存
      await this.cacheManager.flush();

      logger.info('缓存系统已关闭');
      return true;
    } catch (error) {
      logger.error('缓存系统关闭失败', { error: error.message });
      return false;
    }
  }

  /**
   * 缓存装饰器 - 用于自动缓存函数结果
   */
  cacheDecorator(cacheKey, ttl = 300) {
    return (target, propertyName, descriptor) => {
      const method = descriptor.value;

      descriptor.value = async function (...args) {
        const key = typeof cacheKey === 'function' ? cacheKey(...args) : cacheKey;

        // 尝试从缓存获取
        let result = await this.cacheManager.get(key);
        if (result !== undefined) {
          return result;
        }

        // 执行原方法
        result = await method.apply(this, args);

        // 缓存结果
        await this.cacheManager.set(key, result, ttl);

        return result;
      };

      return descriptor;
    };
  }
}

// 创建全局缓存实例
const cacheIntegration = new CacheIntegration();

module.exports = {
  CacheIntegration,
  cacheIntegration,
};
