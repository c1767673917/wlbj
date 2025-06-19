/**
 * 智能缓存管理器
 * 提供多层缓存、自动过期、性能监控等功能
 */

const NodeCache = require('node-cache');
const LRU = require('lru-cache');
const logger = require('../../config/logger');

class SmartCacheManager {
  constructor(options = {}) {
    // L1缓存：内存缓存（最快）
    this.l1Cache = new NodeCache({
      stdTTL: options.l1TTL || 300, // 5分钟
      checkperiod: options.l1CheckPeriod || 60, // 1分钟检查一次
      useClones: false,
      deleteOnExpire: true,
      maxKeys: options.l1MaxKeys || 1000,
    });

    // L2缓存：LRU缓存（中等速度，更大容量）
    this.l2Cache = new LRU({
      max: options.l2MaxItems || 5000,
      ttl: options.l2TTL || 1800000, // 30分钟
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    // 缓存统计
    this.stats = {
      l1: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      l2: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      total: { hits: 0, misses: 0, sets: 0, deletes: 0 },
    };

    // 性能监控
    this.performanceMetrics = {
      avgGetTime: 0,
      avgSetTime: 0,
      totalOperations: 0,
    };

    this.setupEventListeners();
  }

  setupEventListeners() {
    // L1缓存事件监听
    this.l1Cache.on('set', (key, value) => {
      this.stats.l1.sets++;
      this.stats.total.sets++;
    });

    this.l1Cache.on('del', (key, value) => {
      this.stats.l1.deletes++;
      this.stats.total.deletes++;
    });

    this.l1Cache.on('expired', (key, value) => {
      logger.debug('L1缓存过期', { key });
    });
  }

  /**
   * 获取缓存值
   * @param {string} key - 缓存键
   * @returns {*} 缓存值或undefined
   */
  async get(key) {
    const startTime = Date.now();

    try {
      // 先尝试L1缓存
      let value = this.l1Cache.get(key);
      if (value !== undefined) {
        this.stats.l1.hits++;
        this.stats.total.hits++;
        this.updatePerformanceMetrics('get', startTime);
        return value;
      }

      // 再尝试L2缓存
      value = this.l2Cache.get(key);
      if (value !== undefined) {
        this.stats.l2.hits++;
        this.stats.total.hits++;

        // 将L2缓存的值提升到L1缓存
        this.l1Cache.set(key, value);

        this.updatePerformanceMetrics('get', startTime);
        return value;
      }

      // 缓存未命中
      this.stats.l1.misses++;
      this.stats.l2.misses++;
      this.stats.total.misses++;

      this.updatePerformanceMetrics('get', startTime);
      return undefined;
    } catch (error) {
      logger.error('缓存获取失败', { key, error: error.message });
      return undefined;
    }
  }

  /**
   * 设置缓存值
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   * @param {number} ttl - 过期时间（秒）
   */
  async set(key, value, ttl) {
    const startTime = Date.now();

    try {
      // 同时设置L1和L2缓存
      this.l1Cache.set(key, value, ttl);
      this.l2Cache.set(key, value, { ttl: (ttl || 1800) * 1000 });

      this.updatePerformanceMetrics('set', startTime);
      return true;
    } catch (error) {
      logger.error('缓存设置失败', { key, error: error.message });
      return false;
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  async del(key) {
    try {
      this.l1Cache.del(key);
      this.l2Cache.delete(key);
      return true;
    } catch (error) {
      logger.error('缓存删除失败', { key, error: error.message });
      return false;
    }
  }

  /**
   * 清空所有缓存
   */
  async flush() {
    try {
      this.l1Cache.flushAll();
      this.l2Cache.clear();
      logger.info('所有缓存已清空');
      return true;
    } catch (error) {
      logger.error('缓存清空失败', { error: error.message });
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const l1Keys = this.l1Cache.keys();
    const l2Size = this.l2Cache.size;

    return {
      ...this.stats,
      l1KeyCount: l1Keys.length,
      l2KeyCount: l2Size,
      hitRate: this.stats.total.hits / (this.stats.total.hits + this.stats.total.misses) || 0,
      performance: this.performanceMetrics,
    };
  }

  /**
   * 更新性能指标
   */
  updatePerformanceMetrics(operation, startTime) {
    const duration = Date.now() - startTime;
    this.performanceMetrics.totalOperations++;

    if (operation === 'get') {
      this.performanceMetrics.avgGetTime = (this.performanceMetrics.avgGetTime + duration) / 2;
    } else if (operation === 'set') {
      this.performanceMetrics.avgSetTime = (this.performanceMetrics.avgSetTime + duration) / 2;
    }
  }

  /**
   * 缓存预热
   */
  async warmUp(dataLoader) {
    logger.info('开始缓存预热...');

    try {
      // 预加载常用数据
      const providers = await dataLoader.getActiveProviders();
      await this.set('active_providers', providers, 3600); // 1小时

      const recentOrders = await dataLoader.getRecentOrders(50);
      await this.set('recent_orders', recentOrders, 1800); // 30分钟

      logger.info('缓存预热完成', {
        providers: providers.length,
        orders: recentOrders.length,
      });
    } catch (error) {
      logger.error('缓存预热失败', { error: error.message });
    }
  }
}

module.exports = SmartCacheManager;
