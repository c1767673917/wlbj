/**
 * 订单ID生成服务单元测试
 */

const OrderIdService = require('../../../src/services/OrderIdService');
const { db, transactionManager } = require('../../../src/config/database');

// Mock数据库和事务管理器
jest.mock('../../../src/config/database', () => ({
  db: jest.fn(),
  transactionManager: {
    executeWithRetry: jest.fn(),
    executeTransaction: jest.fn()
  }
}));

jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('OrderIdService', () => {
  let orderIdService;
  let mockTrx;

  beforeEach(() => {
    orderIdService = new OrderIdService();
    mockTrx = {
      raw: jest.fn(),
      fn: { now: jest.fn() }
    };
    
    // 重置所有mock
    jest.clearAllMocks();
  });

  describe('generateOrderId', () => {
    it('应该生成正确格式的订单ID', async () => {
      // 模拟事务执行成功
      transactionManager.executeWithRetry.mockImplementation(async (callback) => {
        // 模拟获取序列号
        mockTrx.raw
          .mockResolvedValueOnce(undefined) // INSERT OR IGNORE
          .mockResolvedValueOnce([{ sequence: 1 }]); // UPDATE RETURNING
        
        return await callback(mockTrx);
      });

      const orderId = await orderIdService.generateOrderId();

      // 验证订单ID格式: RX + yymmdd + "-" + 3位数字
      expect(orderId).toMatch(/^RX\d{6}-\d{3}$/);
      expect(transactionManager.executeWithRetry).toHaveBeenCalledTimes(1);
    });

    it('应该在事务失败时抛出错误', async () => {
      const error = new Error('数据库错误');
      transactionManager.executeWithRetry.mockRejectedValue(error);

      await expect(orderIdService.generateOrderId()).rejects.toThrow('订单ID生成失败');
    });

    it('应该正确处理日期格式', async () => {
      // 固定日期用于测试
      const fixedDate = new Date('2025-06-25');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate);

      transactionManager.executeWithRetry.mockImplementation(async (callback) => {
        mockTrx.raw
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce([{ sequence: 5 }]);
        
        return await callback(mockTrx);
      });

      const orderId = await orderIdService.generateOrderId();
      
      // 应该包含正确的日期格式 250625 (yymmdd)
      expect(orderId).toBe('RX250625-005');
      
      // 恢复Date
      global.Date.mockRestore();
    });
  });

  describe('getNextSequence', () => {
    it('应该正确获取下一个序列号', async () => {
      const dateStr = '20250625';
      mockTrx.raw
        .mockResolvedValueOnce(undefined) // INSERT OR IGNORE
        .mockResolvedValueOnce([{ sequence: 3 }]); // UPDATE RETURNING

      const sequence = await orderIdService.getNextSequence(mockTrx, dateStr);

      expect(sequence).toBe(3);
      expect(mockTrx.raw).toHaveBeenCalledTimes(2);
    });

    it('应该在无法获取序列号时抛出错误', async () => {
      const dateStr = '20250625';
      mockTrx.raw
        .mockResolvedValueOnce(undefined) // INSERT OR IGNORE
        .mockResolvedValueOnce([]); // UPDATE RETURNING 返回空数组

      await expect(orderIdService.getNextSequence(mockTrx, dateStr))
        .rejects.toThrow('无法获取日期 20250625 的序列号');
    });
  });

  describe('formatDate', () => {
    it('应该正确格式化日期', () => {
      const date = new Date('2025-06-25');
      const formatted = orderIdService.formatDate(date);
      expect(formatted).toBe('20250625');
    });

    it('应该正确处理单位数的月份和日期', () => {
      const date = new Date('2025-01-05');
      const formatted = orderIdService.formatDate(date);
      expect(formatted).toBe('20250105');
    });
  });

  describe('getCurrentSequence', () => {
    it('应该返回指定日期的当前序列号', async () => {
      const mockResult = { sequence: 10 };
      db.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockResult)
      });

      const sequence = await orderIdService.getCurrentSequence('20250625');
      expect(sequence).toBe(10);
    });

    it('应该在没有记录时返回0', async () => {
      db.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      });

      const sequence = await orderIdService.getCurrentSequence('20250625');
      expect(sequence).toBe(0);
    });

    it('应该使用当前日期作为默认值', async () => {
      const fixedDate = new Date('2025-06-25');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate);

      db.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ sequence: 5 })
      });

      const sequence = await orderIdService.getCurrentSequence();
      expect(sequence).toBe(5);

      global.Date.mockRestore();
    });
  });

  describe('validateOrderId', () => {
    it('应该验证有效的订单ID', () => {
      expect(orderIdService.validateOrderId('RX250625-001')).toBe(true);
      expect(orderIdService.validateOrderId('RX991231-999')).toBe(true);
    });

    it('应该拒绝无效的订单ID', () => {
      expect(orderIdService.validateOrderId('RX25062-001')).toBe(false); // 日期太短
      expect(orderIdService.validateOrderId('RX250625-1')).toBe(false); // 序列号太短
      expect(orderIdService.validateOrderId('RX250625-1234')).toBe(false); // 序列号太长
      expect(orderIdService.validateOrderId('XX250625-001')).toBe(false); // 错误前缀
      expect(orderIdService.validateOrderId('RX250625001')).toBe(false); // 缺少分隔符
    });
  });

  describe('parseOrderId', () => {
    it('应该正确解析有效的订单ID', () => {
      const result = orderIdService.parseOrderId('RX250625-123');
      
      expect(result).toEqual({
        year: 2025,
        month: 6,
        day: 25,
        sequence: 123,
        date: new Date(2025, 5, 25) // 月份从0开始
      });
    });

    it('应该对无效订单ID返回null', () => {
      expect(orderIdService.parseOrderId('invalid-id')).toBeNull();
      expect(orderIdService.parseOrderId('RX25062-001')).toBeNull();
    });

    it('应该正确处理跨世纪的年份', () => {
      const result = orderIdService.parseOrderId('RX991231-001');
      expect(result.year).toBe(2099);
    });
  });

  describe('resetSequence', () => {
    it('应该成功重置序列号', async () => {
      transactionManager.executeTransaction.mockImplementation(async (callback) => {
        const mockTrx = {
          where: jest.fn().mockReturnThis(),
          update: jest.fn().mockResolvedValue(1),
          fn: { now: jest.fn() }
        };
        
        db.mockReturnValue(mockTrx);
        await callback(mockTrx);
      });

      await expect(orderIdService.resetSequence('20250625', 10))
        .resolves.not.toThrow();
      
      expect(transactionManager.executeTransaction).toHaveBeenCalledTimes(1);
    });

    it('应该在重置失败时抛出错误', async () => {
      const error = new Error('更新失败');
      transactionManager.executeTransaction.mockRejectedValue(error);

      await expect(orderIdService.resetSequence('20250625', 10))
        .rejects.toThrow();
    });
  });
});
