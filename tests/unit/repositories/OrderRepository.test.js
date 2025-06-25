/**
 * OrderRepository单元测试
 * 测试订单数据访问层的所有功能
 */

const OrderRepository = require('../../../src/repositories/OrderRepository');

// 模拟数据库连接
const mockDb = {
  raw: jest.fn(),
  transaction: jest.fn()
};

// 模拟查询构建器
const mockQuery = {
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  whereBetween: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
  first: jest.fn(),
  then: jest.fn(),
  catch: jest.fn()
};

// 模拟BaseRepository
jest.mock('../../../src/repositories/BaseRepository', () => {
  return class MockBaseRepository {
    constructor(tableName, primaryKey) {
      this.tableName = tableName;
      this.primaryKey = primaryKey;
      this.db = mockDb;
    }

    query(trx = null) {
      return mockQuery;
    }

    async findMany(conditions, options = {}, trx = null) {
      return [];
    }

    async findOne(conditions, trx = null) {
      return null;
    }

    async findById(id, trx = null) {
      return null;
    }

    async create(data, trx = null) {
      return { id: 'test-id', ...data };
    }

    async updateById(id, data, trx = null) {
      return { id, ...data };
    }

    async deleteById(id, trx = null) {
      return true;
    }

    async count(conditions = {}, trx = null) {
      return 0;
    }

    async transactionWithRetry(callback, maxRetries = 3) {
      return await callback();
    }
  };
});

jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('OrderRepository', () => {
  let orderRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    orderRepository = new OrderRepository();
    
    // 重置模拟查询构建器
    Object.keys(mockQuery).forEach(key => {
      if (typeof mockQuery[key] === 'function' && key !== 'first') {
        mockQuery[key].mockReturnThis();
      }
    });
  });

  describe('constructor', () => {
    it('应该正确初始化', () => {
      expect(orderRepository.tableName).toBe('orders');
      expect(orderRepository.primaryKey).toBe('id');
    });
  });

  describe('findByUserId', () => {
    const userId = 'test-user-id';

    it('应该成功根据用户ID查找订单', async () => {
      const mockOrders = [
        { id: 'order-1', userId, status: 'active' },
        { id: 'order-2', userId, status: 'completed' }
      ];

      orderRepository.findMany = jest.fn().mockResolvedValue(mockOrders);

      const result = await orderRepository.findByUserId(userId);

      expect(result).toEqual(mockOrders);
      expect(orderRepository.findMany).toHaveBeenCalledWith(
        { userId },
        {
          orderBy: [{ column: 'createdAt', direction: 'desc' }],
          limit: null,
          offset: null
        },
        null
      );
    });

    it('应该支持状态过滤', async () => {
      const options = { status: 'active' };
      orderRepository.findMany = jest.fn().mockResolvedValue([]);

      await orderRepository.findByUserId(userId, options);

      expect(orderRepository.findMany).toHaveBeenCalledWith(
        { userId, status: 'active' },
        expect.objectContaining({
          orderBy: [{ column: 'createdAt', direction: 'desc' }]
        }),
        null
      );
    });

    it('应该支持分页参数', async () => {
      const options = { limit: 10, offset: 20 };
      orderRepository.findMany = jest.fn().mockResolvedValue([]);

      await orderRepository.findByUserId(userId, options);

      expect(orderRepository.findMany).toHaveBeenCalledWith(
        { userId },
        expect.objectContaining({
          limit: 10,
          offset: 20
        }),
        null
      );
    });

    it('应该支持自定义排序', async () => {
      const options = { orderBy: [{ column: 'status', direction: 'asc' }] };
      orderRepository.findMany = jest.fn().mockResolvedValue([]);

      await orderRepository.findByUserId(userId, options);

      expect(orderRepository.findMany).toHaveBeenCalledWith(
        { userId },
        expect.objectContaining({
          orderBy: [{ column: 'status', direction: 'asc' }]
        }),
        null
      );
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      orderRepository.findMany = jest.fn().mockRejectedValue(error);

      await expect(
        orderRepository.findByUserId(userId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('findByStatus', () => {
    const status = 'active';

    it('应该成功根据状态查找订单', async () => {
      const mockOrders = [
        { id: 'order-1', status: 'active' },
        { id: 'order-2', status: 'active' }
      ];

      orderRepository.findMany = jest.fn().mockResolvedValue(mockOrders);

      const result = await orderRepository.findByStatus(status);

      expect(result).toEqual(mockOrders);
      expect(orderRepository.findMany).toHaveBeenCalledWith(
        { status },
        {
          orderBy: [{ column: 'createdAt', direction: 'desc' }],
          limit: null,
          offset: null
        },
        null
      );
    });

    it('应该支持用户ID过滤', async () => {
      const options = { userId: 'test-user-id' };
      orderRepository.findMany = jest.fn().mockResolvedValue([]);

      await orderRepository.findByStatus(status, options);

      expect(orderRepository.findMany).toHaveBeenCalledWith(
        { status, userId: 'test-user-id' },
        expect.objectContaining({
          orderBy: [{ column: 'createdAt', direction: 'desc' }]
        }),
        null
      );
    });
  });

  describe('findByDateRange', () => {
    const startDate = '2025-01-01';
    const endDate = '2025-12-31';

    it('应该成功根据日期范围查找订单', async () => {
      const mockOrders = [
        { id: 'order-1', createdAt: '2025-06-01' },
        { id: 'order-2', createdAt: '2025-06-15' }
      ];

      mockQuery.then.mockResolvedValue(mockOrders);

      const result = await orderRepository.findByDateRange(startDate, endDate);

      expect(result).toEqual(mockOrders);
      expect(mockQuery.whereBetween).toHaveBeenCalledWith('createdAt', [startDate, endDate]);
    });

    it('应该支持用户ID过滤', async () => {
      const options = { userId: 'test-user-id' };
      mockQuery.then.mockResolvedValue([]);

      await orderRepository.findByDateRange(startDate, endDate, options);

      expect(mockQuery.where).toHaveBeenCalledWith('userId', 'test-user-id');
    });

    it('应该支持状态过滤', async () => {
      const options = { status: 'active' };
      mockQuery.then.mockResolvedValue([]);

      await orderRepository.findByDateRange(startDate, endDate, options);

      expect(mockQuery.where).toHaveBeenCalledWith('status', 'active');
    });

    it('应该支持排序', async () => {
      const options = { orderBy: [{ column: 'status', direction: 'asc' }] };
      mockQuery.then.mockResolvedValue([]);

      await orderRepository.findByDateRange(startDate, endDate, options);

      expect(mockQuery.orderBy).toHaveBeenCalledWith('status', 'asc');
    });

    it('应该支持分页', async () => {
      const options = { limit: 10, offset: 20 };
      mockQuery.then.mockResolvedValue([]);

      await orderRepository.findByDateRange(startDate, endDate, options);

      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.offset).toHaveBeenCalledWith(20);
    });
  });

  describe('getActiveOrdersByUser', () => {
    const userId = 'test-user-id';

    it('应该成功获取用户的活跃订单', async () => {
      const mockOrders = [
        { id: 'order-1', userId, status: 'active' }
      ];

      orderRepository.findByUserId = jest.fn().mockResolvedValue(mockOrders);

      const result = await orderRepository.getActiveOrdersByUser(userId);

      expect(result).toEqual(mockOrders);
      expect(orderRepository.findByUserId).toHaveBeenCalledWith(
        userId,
        {
          status: 'active',
          orderBy: [{ column: 'createdAt', direction: 'desc' }]
        },
        null
      );
    });
  });

  describe('getPendingOrders', () => {
    it('应该成功获取待选择供应商的订单', async () => {
      const mockOrders = [
        { id: 'order-1', status: 'active', selectedProvider: null }
      ];

      mockQuery.then.mockResolvedValue(mockOrders);

      const result = await orderRepository.getPendingOrders();

      expect(result).toEqual(mockOrders);
      expect(mockQuery.where).toHaveBeenCalledWith('status', 'active');
      expect(mockQuery.whereNull).toHaveBeenCalledWith('selectedProvider');
      expect(mockQuery.orderBy).toHaveBeenCalledWith('createdAt', 'asc');
    });

    it('应该支持分页参数', async () => {
      const options = { limit: 10, offset: 20 };
      mockQuery.then.mockResolvedValue([]);

      await orderRepository.getPendingOrders(options);

      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.offset).toHaveBeenCalledWith(20);
    });
  });

  describe('selectProvider', () => {
    const orderId = 'test-order-id';
    const provider = 'Test Provider';
    const price = 100.50;

    it('应该成功选择供应商', async () => {
      const mockOrder = { id: orderId, selectedProvider: provider, selectedPrice: price };
      orderRepository.updateById = jest.fn().mockResolvedValue(mockOrder);

      const result = await orderRepository.selectProvider(orderId, provider, price);

      expect(result).toEqual(mockOrder);
      expect(orderRepository.updateById).toHaveBeenCalledWith(
        orderId,
        {
          selectedProvider: provider,
          selectedPrice: price,
          status: 'quoted'
        },
        null
      );
    });

    it('应该支持事务', async () => {
      const mockTrx = {};
      orderRepository.updateById = jest.fn().mockResolvedValue({});

      await orderRepository.selectProvider(orderId, provider, price, mockTrx);

      expect(orderRepository.updateById).toHaveBeenCalledWith(
        orderId,
        expect.any(Object),
        mockTrx
      );
    });
  });

  describe('getOrderStats', () => {
    it('应该成功获取订单统计信息', async () => {
      const mockStats = {
        total: '10',
        active: '5',
        completed: '3',
        cancelled: '2'
      };

      mockQuery.first.mockResolvedValue(mockStats);

      const result = await orderRepository.getOrderStats();

      expect(result).toEqual({
        total: 10,
        active: 5,
        completed: 3,
        cancelled: 2
      });
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.first).toHaveBeenCalled();
    });

    it('应该支持过滤条件', async () => {
      const filters = { userId: 'test-user-id', status: 'active' };
      mockQuery.first.mockResolvedValue({
        total: '5',
        active: '5',
        completed: '0',
        cancelled: '0'
      });

      await orderRepository.getOrderStats(filters);

      expect(mockQuery.where).toHaveBeenCalledWith('userId', 'test-user-id');
    });

    it('应该支持日期范围过滤', async () => {
      const filters = { startDate: '2025-01-01', endDate: '2025-12-31' };
      mockQuery.first.mockResolvedValue({
        total: '8',
        active: '4',
        completed: '3',
        cancelled: '1'
      });

      await orderRepository.getOrderStats(filters);

      expect(mockQuery.whereBetween).toHaveBeenCalledWith('createdAt', ['2025-01-01', '2025-12-31']);
    });
  });

  describe('searchOrders', () => {
    const searchTerm = 'test';

    it('应该成功搜索订单', async () => {
      const mockOrders = [
        { id: 'order-1', warehouse: 'test warehouse' },
        { id: 'order-2', goods: 'test goods' }
      ];

      mockQuery.then.mockResolvedValue(mockOrders);

      const result = await orderRepository.searchOrders(searchTerm);

      expect(result).toEqual(mockOrders);
      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockQuery.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
      expect(mockQuery.offset).toHaveBeenCalledWith(0);
    });

    it('应该支持用户ID过滤', async () => {
      const options = { userId: 'test-user-id' };
      mockQuery.then.mockResolvedValue([]);

      await orderRepository.searchOrders(searchTerm, options);

      expect(mockQuery.where).toHaveBeenCalledWith('userId', 'test-user-id');
    });

    it('应该支持状态过滤', async () => {
      const options = { status: 'active' };
      mockQuery.then.mockResolvedValue([]);

      await orderRepository.searchOrders(searchTerm, options);

      expect(mockQuery.where).toHaveBeenCalledWith('status', 'active');
    });

    it('应该支持自定义分页', async () => {
      const options = { limit: 20, offset: 40 };
      mockQuery.then.mockResolvedValue([]);

      await orderRepository.searchOrders(searchTerm, options);

      expect(mockQuery.limit).toHaveBeenCalledWith(20);
      expect(mockQuery.offset).toHaveBeenCalledWith(40);
    });
  });

  describe('checkUserAccess', () => {
    const orderId = 'test-order-id';
    const userId = 'test-user-id';

    it('管理员应该能访问所有订单', async () => {
      const result = await orderRepository.checkUserAccess(orderId, userId, 'admin');

      expect(result).toBe(true);
    });

    it('普通用户应该能访问自己的订单', async () => {
      const mockOrder = { id: orderId, userId };
      orderRepository.findById = jest.fn().mockResolvedValue(mockOrder);

      const result = await orderRepository.checkUserAccess(orderId, userId, 'user');

      expect(result).toBe(true);
      expect(orderRepository.findById).toHaveBeenCalledWith(orderId, null);
    });

    it('普通用户不应该能访问他人的订单', async () => {
      const mockOrder = { id: orderId, userId: 'other-user-id' };
      orderRepository.findById = jest.fn().mockResolvedValue(mockOrder);

      const result = await orderRepository.checkUserAccess(orderId, userId, 'user');

      expect(result).toBe(false);
    });

    it('订单不存在时应该返回false', async () => {
      orderRepository.findById = jest.fn().mockResolvedValue(null);

      const result = await orderRepository.checkUserAccess(orderId, userId, 'user');

      expect(result).toBe(false);
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      orderRepository.findById = jest.fn().mockRejectedValue(error);

      await expect(
        orderRepository.checkUserAccess(orderId, userId, 'user')
      ).rejects.toThrow('Database error');
    });
  });
});
