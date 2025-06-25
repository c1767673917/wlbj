/**
 * 改进的分布式锁管理器
 * 解决原系统中锁机制的潜在问题
 * 增加锁超时处理、死锁检测和错误恢复机制
 */

const { logger } = require('../config/logger');

class LockManager {
  constructor() {
    this.locks = new Map();
    this.lockTimeout = 30000; // 默认锁超时时间30秒
    this.cleanupInterval = 10000; // 清理间隔10秒
    this.stats = {
      locksAcquired: 0,
      locksReleased: 0,
      lockConflicts: 0,
      lockTimeouts: 0,
      deadlocksDetected: 0
    };

    // 启动定期清理过期锁
    this.startCleanupTimer();
  }

  /**
   * 获取锁
   * @param {string} key - 锁的键
   * @param {number} timeout - 锁超时时间（毫秒）
   * @param {number} maxWait - 最大等待时间（毫秒）
   * @returns {Promise<string|null>} 锁ID或null
   */
  async acquireLock(key, timeout = this.lockTimeout, maxWait = 5000) {
    const startTime = Date.now();
    const lockId = this.generateLockId();
    let attempt = 0;

    while (Date.now() - startTime < maxWait) {
      attempt++;
      
      if (this.tryAcquireLock(key, lockId, timeout)) {
        this.stats.locksAcquired++;
        logger.debug('获取锁成功', { 
          key, 
          lockId, 
          timeout, 
          attempt,
          waitTime: Date.now() - startTime 
        });
        return lockId;
      }

      // 检查是否存在死锁
      if (this.detectDeadlock(key, lockId)) {
        this.stats.deadlocksDetected++;
        logger.warn('检测到潜在死锁', { key, lockId, attempt });
        break;
      }

      // 指数退避等待
      const delay = Math.min(50 * Math.pow(2, Math.min(attempt - 1, 5)), 1000);
      await this.sleep(delay + Math.random() * 50);
    }

    this.stats.lockConflicts++;
    logger.warn('获取锁超时', { 
      key, 
      maxWait, 
      attempts: attempt,
      totalWaitTime: Date.now() - startTime 
    });
    return null;
  }

  /**
   * 尝试获取锁（非阻塞）
   * @param {string} key - 锁的键
   * @param {string} lockId - 锁ID
   * @param {number} timeout - 锁超时时间
   * @returns {boolean} 是否成功获取锁
   */
  tryAcquireLock(key, lockId, timeout) {
    const now = Date.now();
    const existingLock = this.locks.get(key);

    // 检查是否已有锁且未过期
    if (existingLock && now < existingLock.expiresAt) {
      return false;
    }

    // 设置新锁
    this.locks.set(key, {
      lockId,
      acquiredAt: now,
      expiresAt: now + timeout,
      owner: this.getCallerId(),
      renewCount: 0
    });

    return true;
  }

  /**
   * 释放锁
   * @param {string} key - 锁的键
   * @param {string} lockId - 锁ID
   * @returns {boolean} 是否成功释放
   */
  releaseLock(key, lockId) {
    const existingLock = this.locks.get(key);
    
    if (!existingLock) {
      logger.warn('尝试释放不存在的锁', { key, lockId });
      return false;
    }

    if (existingLock.lockId !== lockId) {
      logger.warn('尝试释放他人持有的锁', { 
        key, 
        requestedLockId: lockId, 
        actualLockId: existingLock.lockId 
      });
      return false;
    }

    this.locks.delete(key);
    this.stats.locksReleased++;
    
    logger.debug('锁释放成功', { 
      key, 
      lockId, 
      holdTime: Date.now() - existingLock.acquiredAt 
    });
    
    return true;
  }

  /**
   * 续期锁
   * @param {string} key - 锁的键
   * @param {string} lockId - 锁ID
   * @param {number} additionalTime - 额外时间（毫秒）
   * @returns {boolean} 是否成功续期
   */
  renewLock(key, lockId, additionalTime = 30000) {
    const existingLock = this.locks.get(key);
    
    if (!existingLock || existingLock.lockId !== lockId) {
      return false;
    }

    existingLock.expiresAt = Math.max(existingLock.expiresAt, Date.now()) + additionalTime;
    existingLock.renewCount++;
    
    logger.debug('锁续期成功', { key, lockId, additionalTime, renewCount: existingLock.renewCount });
    return true;
  }

  /**
   * 使用锁执行函数
   * @param {string} key - 锁的键
   * @param {Function} fn - 要执行的函数
   * @param {Object} options - 选项
   * @returns {Promise<any>} 函数执行结果
   */
  async withLock(key, fn, options = {}) {
    const {
      timeout = this.lockTimeout,
      maxWait = 5000,
      retries = 3,
      autoRenew = false,
      renewInterval = 15000
    } = options;

    let lastError;
    let renewTimer;

    for (let attempt = 1; attempt <= retries; attempt++) {
      const lockId = await this.acquireLock(key, timeout, maxWait);

      if (!lockId) {
        lastError = new Error(`获取锁失败: ${key} (尝试 ${attempt}/${retries})`);
        if (attempt < retries) {
          await this.sleep(100 * attempt);
          continue;
        }
        throw lastError;
      }

      try {
        // 自动续期 - 使用async/await重构
        if (autoRenew) {
          renewTimer = setInterval(async () => {
            try {
              await this.renewLock(key, lockId, renewInterval);
            } catch (error) {
              logger.error('锁续期失败', { key, lockId, error: error.message });
            }
          }, renewInterval / 2);
        }

        const result = await fn();
        return result;
      } catch (error) {
        lastError = error;
        logger.error('锁保护的函数执行失败', {
          key,
          lockId,
          attempt,
          error: error.message,
        });

        if (attempt < retries) {
          await this.sleep(100 * attempt);
          continue;
        }
        throw error;
      } finally {
        if (renewTimer) {
          clearInterval(renewTimer);
        }
        this.releaseLock(key, lockId);
      }
    }

    throw lastError;
  }

  /**
   * 检测死锁
   * @param {string} key - 锁的键
   * @param {string} lockId - 锁ID
   * @returns {boolean} 是否检测到死锁
   */
  detectDeadlock(key, lockId) {
    // 简单的死锁检测：如果同一个调用者尝试获取已持有的锁
    const existingLock = this.locks.get(key);
    if (!existingLock) {
      return false;
    }

    const currentCaller = this.getCallerId();
    return existingLock.owner === currentCaller;
  }

  /**
   * 清理过期锁
   */
  cleanupExpiredLocks() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, lock] of this.locks.entries()) {
      if (now >= lock.expiresAt) {
        this.locks.delete(key);
        cleanedCount++;
        this.stats.lockTimeouts++;
        
        logger.debug('清理过期锁', { 
          key, 
          lockId: lock.lockId, 
          expiredFor: now - lock.expiresAt 
        });
      }
    }

    if (cleanedCount > 0) {
      logger.info('清理过期锁完成', { cleanedCount, remainingLocks: this.locks.size });
    }
  }

  /**
   * 启动清理定时器
   */
  startCleanupTimer() {
    setInterval(async () => {
      try {
        await this.cleanupExpiredLocks();
      } catch (error) {
        logger.error('清理过期锁时发生错误', { error: error.message });
      }
    }, this.cleanupInterval);
  }

  /**
   * 生成锁ID
   * @returns {string} 锁ID
   */
  generateLockId() {
    return `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取调用者ID（简化版本）
   * @returns {string} 调用者ID
   */
  getCallerId() {
    const stack = new Error().stack;
    const caller = stack.split('\n')[3] || 'unknown';
    return caller.trim();
  }

  /**
   * 睡眠函数
   * @param {number} ms - 毫秒数
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取锁统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      activeLocks: this.locks.size,
      lockDetails: Array.from(this.locks.entries()).map(([key, lock]) => ({
        key,
        lockId: lock.lockId,
        acquiredAt: new Date(lock.acquiredAt).toISOString(),
        expiresAt: new Date(lock.expiresAt).toISOString(),
        renewCount: lock.renewCount
      }))
    };
  }

  /**
   * 强制释放所有锁（紧急情况使用）
   */
  forceReleaseAllLocks() {
    const count = this.locks.size;
    this.locks.clear();
    logger.warn('强制释放所有锁', { releasedCount: count });
    return count;
  }
}

// 常用的锁键前缀
const LOCK_KEYS = {
  ORDER_ID_GENERATION: 'order_id_gen',
  ORDER_UPDATE: orderId => `order_update_${orderId}`,
  QUOTE_UPDATE: (orderId, provider) => `quote_update_${orderId}_${provider}`,
  CACHE_INVALIDATION: key => `cache_inv_${key}`,
  PROVIDER_SELECTION: orderId => `provider_sel_${orderId}`,
  SEQUENCE_UPDATE: date => `seq_update_${date}`,
};

// 创建全局锁管理器实例
const lockManager = new LockManager();

module.exports = {
  LockManager,
  lockManager,
  LOCK_KEYS,
};
