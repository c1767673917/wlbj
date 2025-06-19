const Redis = require('ioredis');
const logger = require('../config/logger');
const { SimpleCache } = require('./cache'); // 引入现有的内存缓存

// Redis配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  keyPrefix: 'wlbj:',
  retryStrategy: times => {
    // 如果重试次数超过3次，就停止重试
    if (times > 3) {
      return null;
    }
    const delay = Math.min(times * 1000, 5000);
    return delay;
  },
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  connectTimeout: 5000,
  lazyConnect: true,
};

// 创建Redis客户端
let redis = null;
let redisAvailable = false;
let redisConnectionAttempted = false;

// 只有在明确配置了Redis的情况下才尝试连接
const shouldUseRedis = process.env.REDIS_HOST || process.env.REDIS_ENABLED === 'true';

if (shouldUseRedis) {
  try {
    redis = new Redis(redisConfig);
    redisConnectionAttempted = true;

    redis.on('connect', () => {
      logger.info('Redis连接成功');
      redisAvailable = true;
    });

    redis.on('error', err => {
      if (!redisAvailable) {
        logger.warn('Redis服务不可用，将使用内存缓存');
      }
      redisAvailable = false;
    });

    redis.on('close', () => {
      redisAvailable = false;
    });
  } catch (error) {
    logger.warn('Redis初始化失败，将使用内存缓存:', error.message);
    redisAvailable = false;
  }
} else {
  logger.info('未配置Redis，使用内存缓存');
}

// 创建本地内存缓存实例（作为L1缓存）
const memoryCache = new SimpleCache();

/**
 * 多级缓存类
 * L1: 内存缓存（快速，容量小）
 * L2: Redis缓存（较快，容量大，支持分布式）
 */
class MultiLevelCache {
  constructor() {
    this.defaultTTL = 300; // 默认5分钟
    this.l1TTL = 60; // L1缓存默认1分钟
  }

  /**
   * 生成缓存键
   */
  generateKey(namespace, ...parts) {
    return `${namespace}:${parts.join(':')}`;
  }

  /**
   * 从缓存获取数据（先L1后L2）
   */
  async get(key) {
    try {
      // 先从L1内存缓存获取
      const l1Value = memoryCache.get(key);
      if (l1Value !== undefined) {
        logger.debug('L1缓存命中', { key });
        return l1Value;
      }

      // 如果Redis可用，从L2获取
      if (redisAvailable && redis) {
        const l2Value = await redis.get(key);
        if (l2Value !== null) {
          logger.debug('L2缓存命中', { key });
          const parsedValue = JSON.parse(l2Value);

          // 将数据写回L1缓存
          memoryCache.set(key, parsedValue, this.l1TTL);

          return parsedValue;
        }
      }

      logger.debug('缓存未命中', { key });
      return null;
    } catch (error) {
      logger.error('缓存读取错误', { key, error: error.message });
      return null;
    }
  }

  /**
   * 设置缓存数据（同时写入L1和L2）
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      // 写入L1内存缓存
      memoryCache.set(key, value, Math.min(ttl, this.l1TTL));

      // 如果Redis可用，写入L2
      if (redisAvailable && redis) {
        await redis.setex(key, ttl, JSON.stringify(value));
        logger.debug('数据写入L2缓存', { key, ttl });
      }

      return true;
    } catch (error) {
      logger.error('缓存写入错误', { key, error: error.message });
      return false;
    }
  }

  /**
   * 删除缓存数据
   */
  async delete(key) {
    try {
      // 从L1删除
      memoryCache.delete(key);

      // 从L2删除
      if (redisAvailable && redis) {
        await redis.del(key);
      }

      logger.debug('缓存数据已删除', { key });
      return true;
    } catch (error) {
      logger.error('缓存删除错误', { key, error: error.message });
      return false;
    }
  }

  /**
   * 批量删除匹配模式的键
   */
  async deletePattern(pattern) {
    try {
      // 清理L1缓存
      memoryCache.clear();

      // 清理L2缓存
      if (redisAvailable && redis) {
        const keys = await redis.keys(`${redisConfig.keyPrefix}${pattern}`);
        if (keys.length > 0) {
          // 移除前缀后再删除
          const keysWithoutPrefix = keys.map(k => k.replace(redisConfig.keyPrefix, ''));
          await redis.del(...keysWithoutPrefix);
          logger.info('批量删除缓存', { pattern, count: keys.length });
        }
      }

      return true;
    } catch (error) {
      logger.error('批量删除缓存错误', { pattern, error: error.message });
      return false;
    }
  }

  /**
   * 缓存预热
   */
  async warmUp(dataLoader) {
    try {
      logger.info('开始缓存预热');

      // 预热常用数据
      const warmUpTasks = [];

      // 预热活跃订单列表
      warmUpTasks.push(
        dataLoader.loadActiveOrders().then(orders => {
          const key = this.generateKey('orders', 'active', 'list');
          return this.set(key, orders, 600); // 10分钟
        })
      );

      // 预热供应商列表
      warmUpTasks.push(
        dataLoader.loadProviders().then(providers => {
          const key = this.generateKey('providers', 'list');
          return this.set(key, providers, 3600); // 1小时
        })
      );

      // 预热最近的报价数据
      warmUpTasks.push(
        dataLoader.loadRecentQuotes().then(quotes => {
          const key = this.generateKey('quotes', 'recent');
          return this.set(key, quotes, 300); // 5分钟
        })
      );

      await Promise.all(warmUpTasks);

      logger.info('缓存预热完成');
      return true;
    } catch (error) {
      logger.error('缓存预热失败', { error: error.message });
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats() {
    const stats = {
      l1: {
        size: memoryCache.size(),
        maxSize: memoryCache.maxSize,
      },
      l2: {
        available: redisAvailable,
        info: null,
      },
    };

    if (redisAvailable && redis) {
      try {
        const info = await redis.info('memory');
        stats.l2.info = info;
      } catch (error) {
        logger.error('获取Redis信息失败', { error: error.message });
      }
    }

    return stats;
  }

  /**
   * 使用缓存装饰器包装函数
   */
  wrap(fn, keyGenerator, ttl = this.defaultTTL) {
    return async (...args) => {
      const key = typeof keyGenerator === 'function' ? keyGenerator(...args) : keyGenerator;

      // 尝试从缓存获取
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // 执行原函数
      const result = await fn(...args);

      // 将结果写入缓存
      await this.set(key, result, ttl);

      return result;
    };
  }
}

// 创建缓存实例
const cache = new MultiLevelCache();

// 缓存键生成辅助函数
const cacheKeys = {
  // 订单相关
  ordersList: (status, page = 1, limit = 10) =>
    cache.generateKey('orders', status, `page:${page}`, `limit:${limit}`),
  orderDetail: orderId => cache.generateKey('orders', orderId),
  orderQuotes: orderId => cache.generateKey('orders', orderId, 'quotes'),

  // 供应商相关
  providersList: () => cache.generateKey('providers', 'list'),
  providerDetail: providerId => cache.generateKey('providers', providerId),
  providerOrders: (providerId, page = 1) =>
    cache.generateKey('providers', providerId, 'orders', `page:${page}`),

  // 报价相关
  lowestQuotes: orderIds => cache.generateKey('quotes', 'lowest', orderIds.join('-')),
  quotesByOrder: orderId => cache.generateKey('quotes', 'by-order', orderId),

  // 统计相关
  dailyStats: date => cache.generateKey('stats', 'daily', date),
  providerStats: providerId => cache.generateKey('stats', 'provider', providerId),
};

// 缓存失效策略
const cacheInvalidation = {
  // 订单创建后，清理相关缓存
  onOrderCreated: async () => {
    await cache.deletePattern('orders:active:*');
    await cache.deletePattern('stats:daily:*');
  },

  // 订单更新后，清理相关缓存
  onOrderUpdated: async orderId => {
    await cache.delete(cacheKeys.orderDetail(orderId));
    await cache.delete(cacheKeys.orderQuotes(orderId));
    await cache.deletePattern('orders:active:*');
    await cache.deletePattern('orders:closed:*');
  },

  // 报价创建后，清理相关缓存
  onQuoteCreated: async (orderId, providerId) => {
    await cache.delete(cacheKeys.orderQuotes(orderId));
    await cache.delete(cacheKeys.quotesByOrder(orderId));
    await cache.deletePattern(`quotes:lowest:*${orderId}*`);
    await cache.deletePattern(`providers:${providerId}:*`);
  },

  // 供应商更新后，清理相关缓存
  onProviderUpdated: async providerId => {
    await cache.delete(cacheKeys.providerDetail(providerId));
    await cache.delete(cacheKeys.providersList());
  },
};

// 导出
module.exports = {
  cache,
  cacheKeys,
  cacheInvalidation,
  redisAvailable: () => redisAvailable,
};
