/**
 * QuoteRepository单元测试
 * 测试报价数据访问层的所有功能
 */

const QuoteRepository = require('../../../src/repositories/QuoteRepository');

// 模拟数据库连接
const mockDb = {
  raw: jest.fn(),
  transaction: jest.fn()
};

// 模拟查询构建器
const mockQuery = {
  where: jest.fn().mockReturnThis(),
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

describe('QuoteRepository', () => {
  let quoteRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    quoteRepository = new QuoteRepository();
    
    // 重置模拟查询构建器
    Object.keys(mockQuery).forEach(key => {
      if (typeof mockQuery[key] === 'function' && key !== 'first') {
        mockQuery[key].mockReturnThis();
      }
    });
  });

  describe('constructor', () => {
    it('应该正确初始化', () => {
      expect(quoteRepository.tableName).toBe('quotes');
      expect(quoteRepository.primaryKey).toBe('id');
    });
  });

  describe('findByOrderId', () => {
    const orderId = 'test-order-id';

    it('应该成功根据订单ID查找报价', async () => {
      const mockQuotes = [
        { id: 'quote-1', orderId, provider: 'Provider 1', price: 100 },
        { id: 'quote-2', orderId, provider: 'Provider 2', price: 120 }
      ];

      quoteRepository.findMany = jest.fn().mockResolvedValue(mockQuotes);

      const result = await quoteRepository.findByOrderId(orderId);

      expect(result).toEqual(mockQuotes);
      expect(quoteRepository.findMany).toHaveBeenCalledWith(
        { orderId },
        {
          orderBy: [{ column: 'price', direction: 'asc' }],
          limit: null,
          offset: null
        },
        null
      );
    });

    it('应该支持自定义排序', async () => {
      const options = { orderBy: [{ column: 'createdAt', direction: 'desc' }] };
      quoteRepository.findMany = jest.fn().mockResolvedValue([]);

      await quoteRepository.findByOrderId(orderId, options);

      expect(quoteRepository.findMany).toHaveBeenCalledWith(
        { orderId },
        expect.objectContaining({
          orderBy: [{ column: 'createdAt', direction: 'desc' }]
        }),
        null
      );
    });

    it('应该支持分页参数', async () => {
      const options = { limit: 10, offset: 20 };
      quoteRepository.findMany = jest.fn().mockResolvedValue([]);

      await quoteRepository.findByOrderId(orderId, options);

      expect(quoteRepository.findMany).toHaveBeenCalledWith(
        { orderId },
        expect.objectContaining({
          limit: 10,
          offset: 20
        }),
        null
      );
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      quoteRepository.findMany = jest.fn().mockRejectedValue(error);

      await expect(
        quoteRepository.findByOrderId(orderId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('findByProvider', () => {
    const provider = 'Test Provider';

    it('应该成功根据供应商查找报价', async () => {
      const mockQuotes = [
        { id: 'quote-1', provider, price: 100 },
        { id: 'quote-2', provider, price: 120 }
      ];

      quoteRepository.findMany = jest.fn().mockResolvedValue(mockQuotes);

      const result = await quoteRepository.findByProvider(provider);

      expect(result).toEqual(mockQuotes);
      expect(quoteRepository.findMany).toHaveBeenCalledWith(
        { provider },
        {
          orderBy: [{ column: 'createdAt', direction: 'desc' }],
          limit: null,
          offset: null
        },
        null
      );
    });

    it('应该支持日期范围查询', async () => {
      const options = {
        startDate: '2025-01-01',
        endDate: '2025-12-31'
      };
      const mockQuotes = [{ id: 'quote-1', provider }];

      mockQuery.then.mockResolvedValue(mockQuotes);

      const result = await quoteRepository.findByProvider(provider, options);

      expect(result).toEqual(mockQuotes);
      expect(mockQuery.where).toHaveBeenCalledWith('provider', provider);
      expect(mockQuery.whereBetween).toHaveBeenCalledWith('createdAt', ['2025-01-01', '2025-12-31']);
    });

    it('应该支持分页参数', async () => {
      const options = { limit: 10, offset: 20 };
      quoteRepository.findMany = jest.fn().mockResolvedValue([]);

      await quoteRepository.findByProvider(provider, options);

      expect(quoteRepository.findMany).toHaveBeenCalledWith(
        { provider },
        expect.objectContaining({
          limit: 10,
          offset: 20
        }),
        null
      );
    });
  });

  describe('findByOrderAndProvider', () => {
    const orderId = 'test-order-id';
    const provider = 'Test Provider';

    it('应该成功查找特定订单和供应商的报价', async () => {
      const mockQuote = { id: 'quote-1', orderId, provider, price: 100 };
      quoteRepository.findOne = jest.fn().mockResolvedValue(mockQuote);

      const result = await quoteRepository.findByOrderAndProvider(orderId, provider);

      expect(result).toEqual(mockQuote);
      expect(quoteRepository.findOne).toHaveBeenCalledWith(
        { orderId, provider },
        null
      );
    });

    it('应该在找不到报价时返回null', async () => {
      quoteRepository.findOne = jest.fn().mockResolvedValue(null);

      const result = await quoteRepository.findByOrderAndProvider(orderId, provider);

      expect(result).toBeNull();
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      quoteRepository.findOne = jest.fn().mockRejectedValue(error);

      await expect(
        quoteRepository.findByOrderAndProvider(orderId, provider)
      ).rejects.toThrow('Database error');
    });
  });

  describe('upsertQuote', () => {
    const orderId = 'test-order-id';
    const provider = 'Test Provider';
    const quoteData = {
      price: 100.50,
      estimatedDelivery: '2025-07-01',
      remarks: 'Test remarks'
    };

    it('应该创建新报价（当不存在时）', async () => {
      const expectedQuote = { id: 'new-quote-id', orderId, provider, ...quoteData };
      
      quoteRepository.findByOrderAndProvider = jest.fn().mockResolvedValue(null);
      quoteRepository.create = jest.fn().mockResolvedValue(expectedQuote);

      const result = await quoteRepository.upsertQuote(orderId, provider, quoteData);

      expect(result).toEqual(expectedQuote);
      expect(quoteRepository.findByOrderAndProvider).toHaveBeenCalledWith(orderId, provider, null);
      expect(quoteRepository.create).toHaveBeenCalledWith(
        { orderId, provider, ...quoteData },
        null
      );
    });

    it('应该更新现有报价（当存在时）', async () => {
      const existingQuote = { id: 'existing-quote-id', orderId, provider };
      const updatedQuote = { ...existingQuote, ...quoteData };
      
      quoteRepository.findByOrderAndProvider = jest.fn().mockResolvedValue(existingQuote);
      quoteRepository.updateById = jest.fn().mockResolvedValue(updatedQuote);

      const result = await quoteRepository.upsertQuote(orderId, provider, quoteData);

      expect(result).toEqual(updatedQuote);
      expect(quoteRepository.updateById).toHaveBeenCalledWith(
        'existing-quote-id',
        { orderId, provider, ...quoteData },
        null
      );
    });

    it('应该支持事务', async () => {
      const mockTrx = {};
      quoteRepository.findByOrderAndProvider = jest.fn().mockResolvedValue(null);
      quoteRepository.create = jest.fn().mockResolvedValue({});

      await quoteRepository.upsertQuote(orderId, provider, quoteData, mockTrx);

      expect(quoteRepository.findByOrderAndProvider).toHaveBeenCalledWith(orderId, provider, mockTrx);
      expect(quoteRepository.create).toHaveBeenCalledWith(
        expect.any(Object),
        mockTrx
      );
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      quoteRepository.findByOrderAndProvider = jest.fn().mockRejectedValue(error);

      await expect(
        quoteRepository.upsertQuote(orderId, provider, quoteData)
      ).rejects.toThrow('Database error');
    });
  });

  describe('getQuoteStats', () => {
    const orderId = 'test-order-id';

    it('应该成功获取订单的报价统计', async () => {
      const mockStats = {
        count: '3',
        minPrice: '100.00',
        maxPrice: '150.00',
        avgPrice: '125.00'
      };

      mockQuery.first.mockResolvedValue(mockStats);

      const result = await quoteRepository.getQuoteStats(orderId);

      expect(result).toEqual({
        count: 3,
        minPrice: 100.00,
        maxPrice: 150.00,
        avgPrice: 125.00
      });
      expect(mockQuery.where).toHaveBeenCalledWith('orderId', orderId);
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.first).toHaveBeenCalled();
    });

    it('应该处理空结果', async () => {
      const mockStats = {
        count: '0',
        minPrice: null,
        maxPrice: null,
        avgPrice: null
      };

      mockQuery.first.mockResolvedValue(mockStats);

      const result = await quoteRepository.getQuoteStats(orderId);

      expect(result).toEqual({
        count: 0,
        minPrice: 0,
        maxPrice: 0,
        avgPrice: 0
      });
    });

    it('应该支持事务', async () => {
      const mockTrx = {};
      mockQuery.first.mockResolvedValue({
        count: '1',
        minPrice: '100.00',
        maxPrice: '100.00',
        avgPrice: '100.00'
      });

      await quoteRepository.getQuoteStats(orderId, mockTrx);

      expect(quoteRepository.query).toHaveBeenCalledWith(mockTrx);
    });
  });

  describe('getProviderStats', () => {
    const provider = 'Test Provider';

    it('应该成功获取供应商的报价统计', async () => {
      const mockStats = {
        totalQuotes: '10',
        avgPrice: '125.50',
        minPrice: '80.00',
        maxPrice: '200.00'
      };

      mockQuery.first.mockResolvedValue(mockStats);

      const result = await quoteRepository.getProviderStats(provider);

      expect(result).toEqual({
        totalQuotes: 10,
        avgPrice: 125.50,
        minPrice: 80.00,
        maxPrice: 200.00
      });
      expect(mockQuery.where).toHaveBeenCalledWith('provider', provider);
    });

    it('应该支持日期范围过滤', async () => {
      const options = {
        startDate: '2025-01-01',
        endDate: '2025-12-31'
      };
      mockQuery.first.mockResolvedValue({
        totalQuotes: '5',
        avgPrice: '120.00',
        minPrice: '100.00',
        maxPrice: '150.00'
      });

      await quoteRepository.getProviderStats(provider, options);

      expect(mockQuery.whereBetween).toHaveBeenCalledWith('createdAt', ['2025-01-01', '2025-12-31']);
    });
  });

  describe('getTopProviders', () => {
    it('应该成功获取热门供应商', async () => {
      const mockProviders = [
        { provider: 'Provider A', quoteCount: '15' },
        { provider: 'Provider B', quoteCount: '12' },
        { provider: 'Provider C', quoteCount: '8' }
      ];

      mockQuery.then.mockResolvedValue(mockProviders);

      const result = await quoteRepository.getTopProviders();

      expect(result).toEqual([
        { provider: 'Provider A', quoteCount: 15 },
        { provider: 'Provider B', quoteCount: 12 },
        { provider: 'Provider C', quoteCount: 8 }
      ]);
      expect(mockQuery.select).toHaveBeenCalledWith('provider');
      expect(mockQuery.count).toHaveBeenCalledWith('* as quoteCount');
      expect(mockQuery.groupBy).toHaveBeenCalledWith('provider');
      expect(mockQuery.orderBy).toHaveBeenCalledWith('quoteCount', 'desc');
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('应该支持自定义限制数量', async () => {
      const options = { limit: 5 };
      mockQuery.then.mockResolvedValue([]);

      await quoteRepository.getTopProviders(options);

      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('应该支持日期范围过滤', async () => {
      const options = {
        startDate: '2025-01-01',
        endDate: '2025-12-31'
      };
      mockQuery.then.mockResolvedValue([]);

      await quoteRepository.getTopProviders(options);

      expect(mockQuery.whereBetween).toHaveBeenCalledWith('createdAt', ['2025-01-01', '2025-12-31']);
    });
  });

  describe('getRecentQuotes', () => {
    it('应该成功获取最近的报价', async () => {
      const mockQuotes = [
        { id: 'quote-1', provider: 'Provider A', createdAt: '2025-06-25' },
        { id: 'quote-2', provider: 'Provider B', createdAt: '2025-06-24' }
      ];

      mockQuery.then.mockResolvedValue(mockQuotes);

      const result = await quoteRepository.getRecentQuotes();

      expect(result).toEqual(mockQuotes);
      expect(mockQuery.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(mockQuery.limit).toHaveBeenCalledWith(20);
    });

    it('应该支持供应商过滤', async () => {
      const options = { provider: 'Test Provider' };
      mockQuery.then.mockResolvedValue([]);

      await quoteRepository.getRecentQuotes(options);

      expect(mockQuery.where).toHaveBeenCalledWith('provider', 'Test Provider');
    });

    it('应该支持订单ID过滤', async () => {
      const options = { orderId: 'test-order-id' };
      mockQuery.then.mockResolvedValue([]);

      await quoteRepository.getRecentQuotes(options);

      expect(mockQuery.where).toHaveBeenCalledWith('orderId', 'test-order-id');
    });

    it('应该支持自定义限制数量', async () => {
      const options = { limit: 10 };
      mockQuery.then.mockResolvedValue([]);

      await quoteRepository.getRecentQuotes(options);

      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('deleteQuotesByOrderId', () => {
    const orderId = 'test-order-id';

    it('应该成功删除订单的所有报价', async () => {
      const mockResult = { deletedCount: 3 };
      mockQuery.then.mockResolvedValue(mockResult);

      const result = await quoteRepository.deleteQuotesByOrderId(orderId);

      expect(result).toEqual(mockResult);
      expect(mockQuery.where).toHaveBeenCalledWith('orderId', orderId);
    });

    it('应该支持事务', async () => {
      const mockTrx = {};
      mockQuery.then.mockResolvedValue({ deletedCount: 1 });

      await quoteRepository.deleteQuotesByOrderId(orderId, mockTrx);

      expect(quoteRepository.query).toHaveBeenCalledWith(mockTrx);
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      mockQuery.then.mockRejectedValue(error);

      await expect(
        quoteRepository.deleteQuotesByOrderId(orderId)
      ).rejects.toThrow('Database error');
    });
  });
});
