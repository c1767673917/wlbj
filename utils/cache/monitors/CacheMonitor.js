/**
 * 缓存性能监控器
 */

const logger = require('../../../config/logger');

class CacheMonitor {
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
    this.monitoringInterval = null;
    this.alertThresholds = {
      hitRate: 0.7, // 命中率低于70%时告警
      avgResponseTime: 100, // 平均响应时间超过100ms时告警
      memoryUsage: 0.8, // 内存使用率超过80%时告警
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
        threshold: this.alertThresholds.hitRate,
      });
    }

    // 检查响应时间
    if (stats.performance.avgGetTime > this.alertThresholds.avgResponseTime) {
      logger.warn('缓存响应时间过长', {
        avgGetTime: stats.performance.avgGetTime,
        threshold: this.alertThresholds.avgResponseTime,
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
      recommendations: this.generateRecommendations(stats),
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

module.exports = CacheMonitor;
