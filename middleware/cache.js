/**
 * 缓存中间件
 * 为Express路由提供自动缓存功能
 */

const { cacheIntegration } = require('../utils/cache/CacheIntegration');
const logger = require('../config/logger');

/**
 * 创建缓存中间件
 * @param {Object} options - 缓存选项
 * @param {number} options.ttl - 缓存时间（秒）
 * @param {string|function} options.keyGenerator - 缓存键生成器
 * @param {function} options.condition - 缓存条件判断函数
 * @param {boolean} options.skipOnError - 错误时是否跳过缓存
 */
function createCacheMiddleware(options = {}) {
  const {
    ttl = 300,
    keyGenerator = defaultKeyGenerator,
    condition = () => true,
    skipOnError = true,
  } = options;

  return async (req, res, next) => {
    try {
      // 检查是否满足缓存条件
      if (!condition(req)) {
        return next();
      }

      // 生成缓存键
      const cacheKey = typeof keyGenerator === 'function' ? keyGenerator(req) : keyGenerator;

      // 尝试从缓存获取数据
      const cachedData = await cacheIntegration.cacheManager.get(cacheKey);

      if (cachedData !== undefined) {
        logger.debug('缓存命中', { key: cacheKey, path: req.path });

        // 设置缓存头
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);

        return res.json(cachedData);
      }

      // 缓存未命中，继续执行
      logger.debug('缓存未命中', { key: cacheKey, path: req.path });
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // 拦截响应以缓存数据
      const originalJson = res.json;
      res.json = function (data) {
        // 只缓存成功的响应
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheIntegration.cacheManager
            .set(cacheKey, data, ttl)
            .then(() => {
              logger.debug('数据已缓存', { key: cacheKey, ttl });
            })
            .catch(error => {
              logger.error('缓存设置失败', { key: cacheKey, error: error.message });
            });
        }

        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('缓存中间件错误', { error: error.message, path: req.path });

      if (skipOnError) {
        next();
      } else {
        next(error);
      }
    }
  };
}

/**
 * 默认缓存键生成器
 */
function defaultKeyGenerator(req) {
  const method = req.method;
  const path = req.path;
  const query = JSON.stringify(req.query);
  const userId = req.user ? req.user.id : 'anonymous';

  return `route:${method}:${path}:${userId}:${Buffer.from(query).toString('base64')}`;
}

/**
 * 用户相关数据缓存中间件
 */
function userCacheMiddleware(ttl = 1800) {
  return createCacheMiddleware({
    ttl,
    keyGenerator: req => {
      const userId = req.user ? req.user.id : req.params.userId || req.params.id;
      return `user:${userId}:${req.path}`;
    },
    condition: req => req.method === 'GET' && (req.user || req.params.userId),
  });
}

/**
 * 订单相关数据缓存中间件
 */
function orderCacheMiddleware(ttl = 600) {
  return createCacheMiddleware({
    ttl,
    keyGenerator: req => {
      const orderId = req.params.orderId || req.params.id;
      const userId = req.user ? req.user.id : 'anonymous';
      return `order:${orderId}:${userId}:${req.path}`;
    },
    condition: req => req.method === 'GET' && req.params.orderId,
  });
}

/**
 * 供应商相关数据缓存中间件
 */
function providerCacheMiddleware(ttl = 3600) {
  return createCacheMiddleware({
    ttl,
    keyGenerator: req => {
      const providerId = req.params.providerId || req.params.id;
      return `provider:${providerId}:${req.path}`;
    },
    condition: req => req.method === 'GET',
  });
}

/**
 * 报价相关数据缓存中间件
 */
function quoteCacheMiddleware(ttl = 300) {
  return createCacheMiddleware({
    ttl,
    keyGenerator: req => {
      const quoteParams = {
        from: req.body.from || req.query.from,
        to: req.body.to || req.query.to,
        weight: req.body.weight || req.query.weight,
        type: req.body.type || req.query.type,
      };
      const paramsHash = Buffer.from(JSON.stringify(quoteParams)).toString('base64');
      return `quote:${paramsHash}`;
    },
    condition: req => req.path.includes('/quote'),
  });
}

/**
 * 统计数据缓存中间件
 */
function statsCacheMiddleware(ttl = 900) {
  return createCacheMiddleware({
    ttl,
    keyGenerator: req => {
      const timeRange = req.query.timeRange || 'day';
      const userId = req.user ? req.user.id : 'all';
      return `stats:${timeRange}:${userId}:${req.path}`;
    },
    condition: req => req.method === 'GET' && req.path.includes('/stats'),
  });
}

/**
 * 缓存失效中间件
 * 在数据更新时自动清除相关缓存
 */
function cacheInvalidationMiddleware(patterns = []) {
  return async (req, res, next) => {
    // 只在非GET请求时执行缓存失效
    if (req.method === 'GET') {
      return next();
    }

    const originalJson = res.json;
    res.json = async function (data) {
      // 只在成功响应时清除缓存
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // 根据路径模式清除相关缓存
          for (const pattern of patterns) {
            if (typeof pattern === 'function') {
              await pattern(req, res);
            } else if (typeof pattern === 'string') {
              // 简单的模式匹配缓存清除
              if (req.path.includes(pattern)) {
                logger.debug('清除缓存模式', { pattern, path: req.path });
                // 这里可以实现更复杂的缓存清除逻辑
              }
            }
          }
        } catch (error) {
          logger.error('缓存失效失败', { error: error.message });
        }
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * 缓存统计中间件
 * 收集缓存使用统计信息
 */
function cacheStatsMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();

    const originalJson = res.json;
    res.json = function (data) {
      const duration = Date.now() - startTime;
      const cacheStatus = res.get('X-Cache') || 'BYPASS';

      // 记录缓存统计
      logger.debug('请求缓存统计', {
        path: req.path,
        method: req.method,
        cacheStatus,
        duration,
        statusCode: res.statusCode,
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

module.exports = {
  createCacheMiddleware,
  userCacheMiddleware,
  orderCacheMiddleware,
  providerCacheMiddleware,
  quoteCacheMiddleware,
  statsCacheMiddleware,
  cacheInvalidationMiddleware,
  cacheStatsMiddleware,
};
