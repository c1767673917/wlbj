/**
 * 分布式锁管理器单元测试
 */

const { LockManager, LOCK_KEYS } = require('../../../src/utils/LockManager');

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('LockManager', () => {
  let lockManager;

  beforeEach(() => {
    lockManager = new LockManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // 清理所有锁
    lockManager.forceReleaseAllLocks();
  });

  describe('acquireLock', () => {
    it('应该成功获取锁', async () => {
      const lockId = await lockManager.acquireLock('test-key', 5000, 1000);
      
      expect(lockId).toBeTruthy();
      expect(typeof lockId).toBe('string');
      expect(lockManager.locks.has('test-key')).toBe(true);
    });

    it('应该在锁被占用时返回null', async () => {
      // 先获取锁
      const lockId1 = await lockManager.acquireLock('test-key', 5000, 100);
      expect(lockId1).toBeTruthy();

      // 尝试再次获取同一个锁
      const lockId2 = await lockManager.acquireLock('test-key', 5000, 100);
      expect(lockId2).toBeNull();
    });

    it('应该在锁过期后能够重新获取', async () => {
      // 获取一个短期锁
      const lockId1 = await lockManager.acquireLock('test-key', 100, 50);
      expect(lockId1).toBeTruthy();

      // 等待锁过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 应该能够重新获取锁
      const lockId2 = await lockManager.acquireLock('test-key', 5000, 1000);
      expect(lockId2).toBeTruthy();
      expect(lockId2).not.toBe(lockId1);
    });
  });

  describe('releaseLock', () => {
    it('应该成功释放锁', async () => {
      const lockId = await lockManager.acquireLock('test-key', 5000, 1000);
      expect(lockId).toBeTruthy();

      const released = lockManager.releaseLock('test-key', lockId);
      expect(released).toBe(true);
      expect(lockManager.locks.has('test-key')).toBe(false);
    });

    it('应该拒绝释放不存在的锁', () => {
      const released = lockManager.releaseLock('nonexistent-key', 'fake-id');
      expect(released).toBe(false);
    });

    it('应该拒绝释放他人持有的锁', async () => {
      const lockId = await lockManager.acquireLock('test-key', 5000, 1000);
      expect(lockId).toBeTruthy();

      const released = lockManager.releaseLock('test-key', 'wrong-id');
      expect(released).toBe(false);
      expect(lockManager.locks.has('test-key')).toBe(true);
    });
  });

  describe('renewLock', () => {
    it('应该成功续期锁', async () => {
      const lockId = await lockManager.acquireLock('test-key', 1000, 500);
      expect(lockId).toBeTruthy();

      const originalLock = lockManager.locks.get('test-key');
      const originalExpiry = originalLock.expiresAt;

      const renewed = lockManager.renewLock('test-key', lockId, 2000);
      expect(renewed).toBe(true);

      const renewedLock = lockManager.locks.get('test-key');
      expect(renewedLock.expiresAt).toBeGreaterThan(originalExpiry);
      expect(renewedLock.renewCount).toBe(1);
    });

    it('应该拒绝续期不存在的锁', () => {
      const renewed = lockManager.renewLock('nonexistent-key', 'fake-id', 1000);
      expect(renewed).toBe(false);
    });

    it('应该拒绝续期他人持有的锁', async () => {
      const lockId = await lockManager.acquireLock('test-key', 5000, 1000);
      expect(lockId).toBeTruthy();

      const renewed = lockManager.renewLock('test-key', 'wrong-id', 1000);
      expect(renewed).toBe(false);
    });
  });

  describe('withLock', () => {
    it('应该在锁保护下执行函数', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await lockManager.withLock('test-key', mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(lockManager.locks.has('test-key')).toBe(false); // 锁应该被释放
    });

    it('应该在函数抛出错误时释放锁', async () => {
      const error = new Error('test error');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      await expect(lockManager.withLock('test-key', mockFn)).rejects.toThrow('test error');
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(lockManager.locks.has('test-key')).toBe(false); // 锁应该被释放
    });

    it('应该支持重试机制', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('temporary error');
        }
        return 'success';
      });
      
      const result = await lockManager.withLock('test-key', mockFn, { retries: 3 });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('应该在重试次数用完后抛出最后的错误', async () => {
      const error = new Error('persistent error');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      await expect(lockManager.withLock('test-key', mockFn, { retries: 2 }))
        .rejects.toThrow('persistent error');
      
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('detectDeadlock', () => {
    it('应该检测到简单的死锁情况', () => {
      // 模拟已存在的锁
      const existingLockId = 'existing-lock-123';
      lockManager.locks.set('test-key', {
        lockId: existingLockId,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 5000,
        owner: 'same-caller',
        renewCount: 0
      });

      // Mock getCallerId 返回相同的调用者
      jest.spyOn(lockManager, 'getCallerId').mockReturnValue('same-caller');

      const hasDeadlock = lockManager.detectDeadlock('test-key', 'new-lock-456');
      expect(hasDeadlock).toBe(true);
    });

    it('应该在不同调用者时不检测为死锁', () => {
      // 模拟已存在的锁
      const existingLockId = 'existing-lock-123';
      lockManager.locks.set('test-key', {
        lockId: existingLockId,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 5000,
        owner: 'different-caller',
        renewCount: 0
      });

      // Mock getCallerId 返回不同的调用者
      jest.spyOn(lockManager, 'getCallerId').mockReturnValue('current-caller');

      const hasDeadlock = lockManager.detectDeadlock('test-key', 'new-lock-456');
      expect(hasDeadlock).toBe(false);
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('应该清理过期的锁', () => {
      // 添加一个过期的锁
      const expiredTime = Date.now() - 1000;
      lockManager.locks.set('expired-key', {
        lockId: 'expired-lock',
        acquiredAt: expiredTime - 5000,
        expiresAt: expiredTime,
        owner: 'test-owner',
        renewCount: 0
      });

      // 添加一个未过期的锁
      const futureTime = Date.now() + 5000;
      lockManager.locks.set('active-key', {
        lockId: 'active-lock',
        acquiredAt: Date.now(),
        expiresAt: futureTime,
        owner: 'test-owner',
        renewCount: 0
      });

      expect(lockManager.locks.size).toBe(2);

      lockManager.cleanupExpiredLocks();

      expect(lockManager.locks.size).toBe(1);
      expect(lockManager.locks.has('expired-key')).toBe(false);
      expect(lockManager.locks.has('active-key')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', async () => {
      // 获取一些锁
      await lockManager.acquireLock('key1', 5000, 1000);
      await lockManager.acquireLock('key2', 5000, 1000);

      const stats = lockManager.getStats();

      expect(stats.activeLocks).toBe(2);
      expect(stats.locksAcquired).toBe(2);
      expect(stats.lockDetails).toHaveLength(2);
      expect(stats.lockDetails[0]).toHaveProperty('key');
      expect(stats.lockDetails[0]).toHaveProperty('lockId');
      expect(stats.lockDetails[0]).toHaveProperty('acquiredAt');
      expect(stats.lockDetails[0]).toHaveProperty('expiresAt');
    });
  });

  describe('forceReleaseAllLocks', () => {
    it('应该强制释放所有锁', async () => {
      // 获取多个锁
      await lockManager.acquireLock('key1', 5000, 1000);
      await lockManager.acquireLock('key2', 5000, 1000);
      await lockManager.acquireLock('key3', 5000, 1000);

      expect(lockManager.locks.size).toBe(3);

      const releasedCount = lockManager.forceReleaseAllLocks();

      expect(releasedCount).toBe(3);
      expect(lockManager.locks.size).toBe(0);
    });
  });

  describe('LOCK_KEYS', () => {
    it('应该提供正确的锁键生成函数', () => {
      expect(LOCK_KEYS.ORDER_ID_GENERATION).toBe('order_id_gen');
      expect(LOCK_KEYS.ORDER_UPDATE('123')).toBe('order_update_123');
      expect(LOCK_KEYS.QUOTE_UPDATE('123', 'provider1')).toBe('quote_update_123_provider1');
      expect(LOCK_KEYS.CACHE_INVALIDATION('user_123')).toBe('cache_inv_user_123');
      expect(LOCK_KEYS.PROVIDER_SELECTION('456')).toBe('provider_sel_456');
      expect(LOCK_KEYS.SEQUENCE_UPDATE('20250625')).toBe('seq_update_20250625');
    });
  });
});
