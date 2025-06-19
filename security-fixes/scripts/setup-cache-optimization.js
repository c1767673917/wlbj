#!/usr/bin/env node

/**
 * P2级缓存策略优化脚本
 *
 * 功能：
 * 1. 安装缓存相关依赖
 * 2. 创建智能缓存策略
 * 3. 实现缓存性能监控
 * 4. 设置缓存统计和分析
 * 5. 配置缓存清理策略
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CacheOptimizationSetup {
  constructor() {
    this.projectRoot = path.join(__dirname, '../..');
    this.cacheDir = path.join(this.projectRoot, 'utils/cache');
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix =
      type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  // 安装缓存优化依赖
  async installCacheDependencies() {
    this.log('安装缓存优化相关依赖...');

    const cacheDependencies = ['node-cache@^5.1.2', 'lru-cache@^10.0.0', 'memory-cache@^0.2.0'];

    try {
      this.log('正在安装缓存依赖...');
      const installCommand = `npm install ${cacheDependencies.join(' ')}`;
      execSync(installCommand, {
        cwd: this.projectRoot,
        stdio: 'inherit',
      });

      this.log('✅ 缓存依赖安装完成', 'success');
      return true;
    } catch (error) {
      this.log(`缓存依赖安装失败: ${error.message}`, 'error');
      return false;
    }
  }

  // 创建缓存目录结构
  createCacheDirectories() {
    this.log('创建缓存目录结构...');

    const directories = [
      'utils/cache',
      'utils/cache/strategies',
      'utils/cache/monitors',
      'utils/cache/stats',
    ];

    directories.forEach(dir => {
      const fullPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        this.log(`创建目录: ${dir}`);
      }
    });

    this.log('✅ 缓存目录结构创建完成', 'success');
    return true;
  }

  // 创建智能缓存管理器
  createSmartCacheManager() {
    this.log('创建智能缓存管理器...');

    const cacheManagerContent = `/**
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
      maxKeys: options.l1MaxKeys || 1000
    });

    // L2缓存：LRU缓存（中等速度，更大容量）
    this.l2Cache = new LRU({
      max: options.l2MaxItems || 5000,
      ttl: options.l2TTL || 1800000, // 30分钟
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });

    // 缓存统计
    this.stats = {
      l1: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      l2: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      total: { hits: 0, misses: 0, sets: 0, deletes: 0 }
    };

    // 性能监控
    this.performanceMetrics = {
      avgGetTime: 0,
      avgSetTime: 0,
      totalOperations: 0
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
      performance: this.performanceMetrics
    };
  }

  /**
   * 更新性能指标
   */
  updatePerformanceMetrics(operation, startTime) {
    const duration = Date.now() - startTime;
    this.performanceMetrics.totalOperations++;

    if (operation === 'get') {
      this.performanceMetrics.avgGetTime = 
        (this.performanceMetrics.avgGetTime + duration) / 2;
    } else if (operation === 'set') {
      this.performanceMetrics.avgSetTime = 
        (this.performanceMetrics.avgSetTime + duration) / 2;
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
        orders: recentOrders.length 
      });
    } catch (error) {
      logger.error('缓存预热失败', { error: error.message });
    }
  }
}

module.exports = SmartCacheManager;`;

    const managerPath = path.join(this.cacheDir, 'SmartCacheManager.js');
    fs.writeFileSync(managerPath, cacheManagerContent);

    this.log('✅ 智能缓存管理器创建完成', 'success');
    return true;
  }

  // 创建缓存监控器
  createCacheMonitor() {
    this.log('创建缓存监控器...');

    const monitorContent = `/**
 * 缓存性能监控器
 */

const logger = require('../../config/logger');

class CacheMonitor {
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
    this.monitoringInterval = null;
    this.alertThresholds = {
      hitRate: 0.7, // 命中率低于70%时告警
      avgResponseTime: 100, // 平均响应时间超过100ms时告警
      memoryUsage: 0.8 // 内存使用率超过80%时告警
    };
  }

  /**
   * 开始监控
   */
  startMonitoring(intervalMs = 60000) {
    this.monitoringInterval = setInterval(() => {
      this.checkPerformance();
    }, intervalMs);

    logger.info('缓存监控已启动', { interval: intervalMs });
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('缓存监控已停止');
    }
  }

  /**
   * 检查缓存性能
   */
  checkPerformance() {
    const stats = this.cacheManager.getStats();
    
    // 检查命中率
    if (stats.hitRate < this.alertThresholds.hitRate) {
      logger.warn('缓存命中率过低', { 
        hitRate: stats.hitRate,
        threshold: this.alertThresholds.hitRate 
      });
    }

    // 检查响应时间
    if (stats.performance.avgGetTime > this.alertThresholds.avgResponseTime) {
      logger.warn('缓存响应时间过长', { 
        avgGetTime: stats.performance.avgGetTime,
        threshold: this.alertThresholds.avgResponseTime 
      });
    }

    // 记录性能指标
    logger.debug('缓存性能指标', stats);
  }

  /**
   * 生成性能报告
   */
  generateReport() {
    const stats = this.cacheManager.getStats();
    
    return {
      timestamp: new Date().toISOString(),
      cacheStats: stats,
      recommendations: this.generateRecommendations(stats)
    };
  }

  /**
   * 生成优化建议
   */
  generateRecommendations(stats) {
    const recommendations = [];

    if (stats.hitRate < 0.8) {
      recommendations.push('考虑增加缓存TTL或预热更多数据');
    }

    if (stats.performance.avgGetTime > 50) {
      recommendations.push('考虑优化缓存键结构或减少缓存大小');
    }

    if (stats.l1KeyCount > 800) {
      recommendations.push('L1缓存接近容量上限，考虑增加容量或调整策略');
    }

    return recommendations;
  }
}

module.exports = CacheMonitor;`;

    const monitorPath = path.join(this.cacheDir, 'monitors/CacheMonitor.js');
    fs.writeFileSync(monitorPath, monitorContent);

    this.log('✅ 缓存监控器创建完成', 'success');
    return true;
  }

  // 主执行方法
  async run() {
    this.log('🚀 开始缓存策略优化...');

    try {
      // 安装缓存依赖
      if (!(await this.installCacheDependencies())) {
        throw new Error('缓存依赖安装失败');
      }

      // 创建目录和组件
      this.createCacheDirectories();
      this.createSmartCacheManager();
      this.createCacheMonitor();

      const duration = Date.now() - this.startTime;
      this.log(`🎉 缓存策略优化完成！用时: ${Math.round(duration / 1000)}秒`, 'success');

      this.log('');
      this.log('📋 下一步操作：');
      this.log('1. 在应用中引入SmartCacheManager');
      this.log('2. 配置缓存监控器');
      this.log('3. 设置缓存预热策略');
      this.log('4. 监控缓存性能指标');

      return true;
    } catch (error) {
      this.log(`缓存策略优化失败: ${error.message}`, 'error');
      return false;
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const setup = new CacheOptimizationSetup();
  setup.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = CacheOptimizationSetup;
