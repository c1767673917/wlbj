// 简单的内存缓存实现
class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  // 设置缓存
  set(key, value, ttl = 300) { // 默认5分钟
    // 清除旧的定时器
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // 设置缓存值
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl * 1000 // 转换为毫秒
    });

    // 设置过期定时器
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl * 1000);

    this.timers.set(key, timer);
    return true;
  }

  // 获取缓存
  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  // 删除缓存
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.cache.delete(key);
  }

  // 清空所有缓存
  clear() {
    // 清除所有定时器
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cache.clear();
  }

  // 获取缓存统计信息
  stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 创建全局缓存实例
const cache = new SimpleCache();

// 缓存管理器
class CacheManager {
  // 通用缓存方法
  static get(key) {
    return cache.get(key);
  }

  static set(key, value, ttl = 300) {
    return cache.set(key, value, ttl);
  }

  static delete(key) {
    return cache.delete(key);
  }

  static clear() {
    return cache.clear();
  }

  // 订单相关缓存
  static getOrdersCache(status, page, pageSize, search = '') {
    const key = `orders_${status}_${page}_${pageSize}_${search}`;
    return this.get(key);
  }

  static setOrdersCache(status, page, pageSize, data, search = '') {
    const key = `orders_${status}_${page}_${pageSize}_${search}`;
    return this.set(key, data, 180); // 3分钟缓存
  }

  static clearOrdersCache() {
    const keys = cache.stats().keys;
    keys.forEach(key => {
      if (key.startsWith('orders_')) {
        this.delete(key);
      }
    });
  }

  // 报价相关缓存
  static getQuotesCache(orderId) {
    return this.get(`quotes_${orderId}`);
  }

  static setQuotesCache(orderId, quotes) {
    return this.set(`quotes_${orderId}`, quotes, 120); // 2分钟缓存
  }

  static clearQuotesCache(orderId = null) {
    if (orderId) {
      this.delete(`quotes_${orderId}`);
    } else {
      const keys = cache.stats().keys;
      keys.forEach(key => {
        if (key.startsWith('quotes_')) {
          this.delete(key);
        }
      });
    }
  }

  // 最低报价缓存
  static getLowestQuoteCache(orderId) {
    return this.get(`lowest_quote_${orderId}`);
  }

  static setLowestQuoteCache(orderId, lowestQuote) {
    return this.set(`lowest_quote_${orderId}`, lowestQuote, 300); // 5分钟缓存
  }

  static clearLowestQuoteCache(orderId = null) {
    if (orderId) {
      this.delete(`lowest_quote_${orderId}`);
    } else {
      const keys = cache.stats().keys;
      keys.forEach(key => {
        if (key.startsWith('lowest_quote_')) {
          this.delete(key);
        }
      });
    }
  }

  // 供应商相关缓存
  static getProviderCache(accessKey) {
    return this.get(`provider_${accessKey}`);
  }

  static setProviderCache(accessKey, provider) {
    return this.set(`provider_${accessKey}`, provider, 600); // 10分钟缓存
  }

  static clearProviderCache() {
    const keys = cache.stats().keys;
    keys.forEach(key => {
      if (key.startsWith('provider_')) {
        this.delete(key);
      }
    });
  }

  // 缓存失效策略
  static invalidateOrderRelatedCache(orderId = null) {
    // 当订单发生变化时，清除相关缓存
    this.clearOrdersCache();
    if (orderId) {
      this.clearQuotesCache(orderId);
      this.clearLowestQuoteCache(orderId);
    } else {
      this.clearQuotesCache();
      this.clearLowestQuoteCache();
    }
  }

  static invalidateQuoteRelatedCache(orderId) {
    // 当报价发生变化时，清除相关缓存
    this.clearQuotesCache(orderId);
    this.clearLowestQuoteCache(orderId);
    this.clearOrdersCache(); // 因为订单列表显示最低报价
  }

  // 获取缓存统计
  static getStats() {
    return cache.stats();
  }
}

module.exports = CacheManager;
