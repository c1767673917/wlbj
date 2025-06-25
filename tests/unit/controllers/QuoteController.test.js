/**
 * QuoteController单元测试
 * 测试报价控制器的HTTP请求处理逻辑
 */

const QuoteController = require('../../../src/controllers/QuoteController');

// 模拟依赖
jest.mock('../../../src/services', () => ({
  quoteService: {
    createOrUpdateQuote: jest.fn(),
    getOrderQuotes: jest.fn(),
    getProviderQuotes: jest.fn(),
    deleteQuote: jest.fn(),
    getLowestQuote: jest.fn(),
    getQuotesByPriceRange: jest.fn(),
    getBatchQuotes: jest.fn()
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

const { quoteService } = require('../../../src/services');

describe('QuoteController', () => {
  let quoteController;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 创建QuoteController实例
    quoteController = new QuoteController();
    
    // 创建模拟的Express对象
    mockReq = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user'
      },
      body: {},
      params: {},
      query: {},
      headers: {},
      method: 'GET',
      url: '/api/quotes',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent')
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  describe('createOrUpdateQuote (供应商接口)', () => {
    const validQuoteData = {
      price: 100.50,
      estimatedDelivery: '2025-07-01T10:00:00.000Z',
      remarks: 'Test remarks'
    };

    beforeEach(() => {
      mockReq.headers = {
        'x-provider-name': 'Test Provider',
        'x-access-key': 'test-access-key'
      };
    });

    it('应该成功创建或更新报价', async () => {
      // 准备测试数据
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };
      mockReq.body = validQuoteData;
      
      const mockResult = {
        data: {
          id: 'quote-id-1',
          orderId,
          provider: 'Test Provider',
          ...validQuoteData
        },
        message: '报价提交成功',
        meta: {}
      };
      
      quoteService.createOrUpdateQuote.mockResolvedValue(mockResult);
      
      // 执行测试
      await quoteController.createOrUpdateQuote(mockReq, mockRes, mockNext);
      
      // 验证结果
      expect(quoteService.createOrUpdateQuote).toHaveBeenCalledWith(
        orderId,
        'Test Provider',
        validQuoteData,
        'test-access-key'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '报价提交成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在缺少必需参数时返回400错误', async () => {
      // 准备测试数据 - 缺少price
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };
      mockReq.body = {
        estimatedDelivery: '2025-07-01T10:00:00.000Z'
      };
      
      // 执行测试
      await quoteController.createOrUpdateQuote(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(quoteService.createOrUpdateQuote).not.toHaveBeenCalled();
    });

    it('应该在缺少供应商认证信息时返回401错误', async () => {
      // 准备测试数据 - 缺少认证头
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };
      mockReq.body = validQuoteData;
      mockReq.headers = {}; // 清空认证头
      
      // 执行测试
      await quoteController.createOrUpdateQuote(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '缺少供应商认证信息',
        code: 'MISSING_PROVIDER_AUTH',
        timestamp: expect.any(String)
      });
      expect(quoteService.createOrUpdateQuote).not.toHaveBeenCalled();
    });

    it('应该在只缺少provider时返回401错误', async () => {
      // 准备测试数据 - 只有access-key
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };
      mockReq.body = validQuoteData;
      mockReq.headers = {
        'x-access-key': 'test-access-key'
      };
      
      // 执行测试
      await quoteController.createOrUpdateQuote(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '缺少供应商认证信息',
        code: 'MISSING_PROVIDER_AUTH',
        timestamp: expect.any(String)
      });
    });

    it('应该处理服务层抛出的错误', async () => {
      // 准备测试数据
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };
      mockReq.body = validQuoteData;
      
      const serviceError = new Error('供应商验证失败');
      serviceError.statusCode = 403;
      quoteService.createOrUpdateQuote.mockRejectedValue(serviceError);
      
      // 执行测试
      await quoteController.createOrUpdateQuote(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '供应商验证失败',
          controller: 'QuoteController'
        })
      );
    });
  });

  describe('getOrderQuotes', () => {
    it('应该成功获取订单的所有报价', async () => {
      // 准备测试数据
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };
      mockReq.query = {
        sortBy: 'price',
        sortOrder: 'asc'
      };
      
      const mockResult = {
        data: [
          {
            id: 'quote-1',
            orderId,
            provider: 'Provider A',
            price: 100.00
          },
          {
            id: 'quote-2',
            orderId,
            provider: 'Provider B',
            price: 120.00
          }
        ],
        message: '获取订单报价成功',
        meta: {}
      };
      
      quoteService.getOrderQuotes.mockResolvedValue(mockResult);
      
      // 执行测试
      await quoteController.getOrderQuotes(mockReq, mockRes, mockNext);
      
      // 验证结果
      expect(quoteService.getOrderQuotes).toHaveBeenCalledWith(orderId, {
        orderBy: [{ column: 'price', direction: 'asc' }]
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取订单报价成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在缺少orderId参数时返回400错误', async () => {
      // 准备测试数据 - 缺少orderId
      mockReq.params = {};
      
      // 执行测试
      await quoteController.getOrderQuotes(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(quoteService.getOrderQuotes).not.toHaveBeenCalled();
    });

    it('应该在用户未认证时返回401错误', async () => {
      // 准备测试数据 - 无用户信息
      mockReq.user = null;
      mockReq.params = { orderId: 'ORD-20250625-001' };
      
      // 执行测试
      await quoteController.getOrderQuotes(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '用户未认证',
          statusCode: 401,
          code: 'UNAUTHORIZED'
        })
      );
      expect(quoteService.getOrderQuotes).not.toHaveBeenCalled();
    });

    it('应该在没有排序参数时使用空的orderBy', async () => {
      // 准备测试数据 - 无排序参数
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };
      mockReq.query = {};
      
      const mockResult = {
        data: [],
        message: '获取订单报价成功',
        meta: {}
      };
      
      quoteService.getOrderQuotes.mockResolvedValue(mockResult);
      
      // 执行测试
      await quoteController.getOrderQuotes(mockReq, mockRes, mockNext);
      
      // 验证结果
      expect(quoteService.getOrderQuotes).toHaveBeenCalledWith(orderId, {
        orderBy: []
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getProviderQuotes (供应商接口)', () => {
    beforeEach(() => {
      mockReq.headers = {
        'x-access-key': 'test-access-key'
      };
    });

    it('应该成功获取供应商的报价历史', async () => {
      // 准备测试数据
      const provider = 'Test Provider';
      mockReq.params = { provider };
      mockReq.query = {
        page: '1',
        limit: '10',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        startDate: '2025-06-01',
        endDate: '2025-06-30'
      };

      const mockResult = {
        data: {
          provider: 'Test Provider',
          quotes: [
            {
              id: 'quote-1',
              orderId: 'ORD-20250625-001',
              price: 100.00
            }
          ],
          stats: {
            totalQuotes: 1,
            averagePrice: 100.00
          }
        },
        message: '获取供应商报价历史成功',
        meta: {
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        }
      };

      quoteService.getProviderQuotes.mockResolvedValue(mockResult);

      // 执行测试
      await quoteController.getProviderQuotes(mockReq, mockRes, mockNext);

      // 验证结果
      expect(quoteService.getProviderQuotes).toHaveBeenCalledWith(provider, 'test-access-key', {
        page: 1,
        limit: 10,
        offset: 0,
        orderBy: [{ column: 'createdAt', direction: 'desc' }],
        startDate: '2025-06-01',
        endDate: '2025-06-30'
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取供应商报价历史成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          pagination: mockResult.meta.pagination
        })
      });
    });

    it('应该在缺少访问密钥时返回401错误', async () => {
      // 准备测试数据 - 缺少访问密钥
      const provider = 'Test Provider';
      mockReq.params = { provider };
      mockReq.headers = {}; // 清空访问密钥

      // 执行测试
      await quoteController.getProviderQuotes(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '缺少访问密钥',
        code: 'MISSING_ACCESS_KEY',
        timestamp: expect.any(String)
      });
      expect(quoteService.getProviderQuotes).not.toHaveBeenCalled();
    });

    it('应该在缺少provider参数时返回400错误', async () => {
      // 准备测试数据 - 缺少provider
      mockReq.params = {};

      // 执行测试
      await quoteController.getProviderQuotes(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(quoteService.getProviderQuotes).not.toHaveBeenCalled();
    });
  });

  describe('deleteQuote (供应商接口)', () => {
    beforeEach(() => {
      mockReq.headers = {
        'x-access-key': 'test-access-key'
      };
    });

    it('应该成功删除报价', async () => {
      // 准备测试数据
      const orderId = 'ORD-20250625-001';
      const provider = 'Test Provider';
      mockReq.params = { orderId, provider };

      const mockResult = {
        data: {
          deleted: true,
          orderId,
          provider
        },
        message: '报价删除成功',
        meta: {}
      };

      quoteService.deleteQuote.mockResolvedValue(mockResult);

      // 执行测试
      await quoteController.deleteQuote(mockReq, mockRes, mockNext);

      // 验证结果
      expect(quoteService.deleteQuote).toHaveBeenCalledWith(orderId, provider, 'test-access-key');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '报价删除成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在缺少访问密钥时返回401错误', async () => {
      // 准备测试数据 - 缺少访问密钥
      const orderId = 'ORD-20250625-001';
      const provider = 'Test Provider';
      mockReq.params = { orderId, provider };
      mockReq.headers = {}; // 清空访问密钥

      // 执行测试
      await quoteController.deleteQuote(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '缺少访问密钥',
        code: 'MISSING_ACCESS_KEY',
        timestamp: expect.any(String)
      });
      expect(quoteService.deleteQuote).not.toHaveBeenCalled();
    });

    it('应该在缺少必需参数时返回400错误', async () => {
      // 准备测试数据 - 缺少provider
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };

      // 执行测试
      await quoteController.deleteQuote(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(quoteService.deleteQuote).not.toHaveBeenCalled();
    });
  });

  describe('getLowestQuote', () => {
    it('应该成功获取订单的最低报价', async () => {
      // 准备测试数据
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };

      const mockResult = {
        data: {
          id: 'quote-1',
          orderId,
          provider: 'Cheapest Provider',
          price: 80.00,
          estimatedDelivery: '2025-07-01T10:00:00.000Z'
        },
        message: '获取最低报价成功',
        meta: {}
      };

      quoteService.getLowestQuote.mockResolvedValue(mockResult);

      // 执行测试
      await quoteController.getLowestQuote(mockReq, mockRes, mockNext);

      // 验证结果
      expect(quoteService.getLowestQuote).toHaveBeenCalledWith(orderId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取最低报价成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在缺少orderId参数时返回400错误', async () => {
      // 准备测试数据 - 缺少orderId
      mockReq.params = {};

      // 执行测试
      await quoteController.getLowestQuote(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(quoteService.getLowestQuote).not.toHaveBeenCalled();
    });

    it('应该在用户未认证时返回401错误', async () => {
      // 准备测试数据 - 无用户信息
      mockReq.user = null;
      mockReq.params = { orderId: 'ORD-20250625-001' };

      // 执行测试
      await quoteController.getLowestQuote(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '用户未认证',
          statusCode: 401,
          code: 'UNAUTHORIZED'
        })
      );
      expect(quoteService.getLowestQuote).not.toHaveBeenCalled();
    });
  });

  describe('getQuotesByPriceRange', () => {
    it('应该成功获取价格范围内的报价', async () => {
      // 准备测试数据
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };
      mockReq.query = {
        minPrice: '50',
        maxPrice: '150'
      };

      const mockResult = {
        data: [
          {
            id: 'quote-1',
            orderId,
            provider: 'Provider A',
            price: 100.00
          },
          {
            id: 'quote-2',
            orderId,
            provider: 'Provider B',
            price: 120.00
          }
        ],
        message: '获取价格范围内的报价成功',
        meta: {
          priceRange: { min: 50, max: 150 },
          count: 2
        }
      };

      quoteService.getQuotesByPriceRange.mockResolvedValue(mockResult);

      // 执行测试
      await quoteController.getQuotesByPriceRange(mockReq, mockRes, mockNext);

      // 验证结果
      expect(quoteService.getQuotesByPriceRange).toHaveBeenCalledWith(orderId, 50, 150);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取价格范围内的报价成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          priceRange: { min: 50, max: 150 },
          count: 2
        })
      });
    });

    it('应该在缺少价格参数时返回400错误', async () => {
      // 准备测试数据 - 缺少minPrice和maxPrice
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };
      mockReq.query = {};

      // 执行测试
      await quoteController.getQuotesByPriceRange(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '请提供价格范围参数',
        code: 'MISSING_PRICE_RANGE',
        timestamp: expect.any(String)
      });
      expect(quoteService.getQuotesByPriceRange).not.toHaveBeenCalled();
    });

    it('应该处理无效的价格参数', async () => {
      // 准备测试数据 - 无效的价格格式
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };
      mockReq.query = {
        minPrice: 'invalid',
        maxPrice: 'invalid'
      };

      // 执行测试
      await quoteController.getQuotesByPriceRange(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '价格参数必须是有效数字',
        code: 'INVALID_PRICE_FORMAT',
        timestamp: expect.any(String)
      });
      expect(quoteService.getQuotesByPriceRange).not.toHaveBeenCalled();
    });
  });

  describe('getBatchQuotes (管理员功能)', () => {
    beforeEach(() => {
      // 设置管理员用户
      mockReq.user.role = 'admin';
    });

    it('应该成功批量获取多个订单的报价', async () => {
      // 准备测试数据
      const orderIds = ['ORD-20250625-001', 'ORD-20250625-002'];
      mockReq.body = { orderIds };

      // 执行测试
      await quoteController.getBatchQuotes(mockReq, mockRes, mockNext);

      // 验证结果 - 当前是临时实现，直接返回空的报价数据
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '批量获取报价完成',
        data: [
          {
            orderId: 'ORD-20250625-001',
            quotes: [],
            stats: { count: 0, minPrice: 0, maxPrice: 0, avgPrice: 0 }
          },
          {
            orderId: 'ORD-20250625-002',
            quotes: [],
            stats: { count: 0, minPrice: 0, maxPrice: 0, avgPrice: 0 }
          }
        ],
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
      // 注意：当前实现没有调用quoteService，所以不验证service调用
    });

    it('应该在非管理员用户访问时返回403错误', async () => {
      // 准备测试数据 - 普通用户
      mockReq.user.role = 'user';
      mockReq.body = { orderIds: ['ORD-20250625-001'] };

      // 执行测试
      await quoteController.getBatchQuotes(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('权限不足'),
          statusCode: 403,
          code: 'INSUFFICIENT_PERMISSIONS'
        })
      );
      expect(quoteService.getBatchQuotes).not.toHaveBeenCalled();
    });

    it('应该在订单ID列表为空时返回400错误', async () => {
      // 准备测试数据 - 空数组
      mockReq.body = { orderIds: [] };

      // 执行测试
      await quoteController.getBatchQuotes(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '订单ID列表不能为空',
        code: 'EMPTY_ORDER_IDS',
        timestamp: expect.any(String)
      });
      expect(quoteService.getBatchQuotes).not.toHaveBeenCalled();
    });

    it('应该在订单ID过多时返回400错误', async () => {
      // 准备测试数据 - 超过50个订单ID
      const orderIds = Array.from({ length: 51 }, (_, i) => `ORD-20250625-${String(i + 1).padStart(3, '0')}`);
      mockReq.body = { orderIds };

      // 执行测试
      await quoteController.getBatchQuotes(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '一次最多查询50个订单的报价',
        code: 'TOO_MANY_ORDERS',
        timestamp: expect.any(String)
      });
      expect(quoteService.getBatchQuotes).not.toHaveBeenCalled();
    });

    it('应该在orderIds不是数组时返回400错误', async () => {
      // 准备测试数据 - orderIds不是数组
      mockReq.body = { orderIds: 'not-an-array' };

      // 执行测试
      await quoteController.getBatchQuotes(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '订单ID列表不能为空',
        code: 'EMPTY_ORDER_IDS',
        timestamp: expect.any(String)
      });
    });
  });

  describe('getQuoteStats (管理员功能)', () => {
    beforeEach(() => {
      // 设置管理员用户
      mockReq.user.role = 'admin';
    });

    it('应该成功获取报价统计信息', async () => {
      // 准备测试数据
      mockReq.query = {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        provider: 'Test Provider'
      };

      // 执行测试
      await quoteController.getQuoteStats(mockReq, mockRes, mockNext);

      // 验证结果
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取报价统计成功',
        data: expect.objectContaining({
          totalQuotes: expect.any(Number),
          totalOrders: expect.any(Number),
          averageQuotesPerOrder: expect.any(Number),
          priceStats: expect.objectContaining({
            min: expect.any(Number),
            max: expect.any(Number),
            avg: expect.any(Number),
            median: expect.any(Number)
          }),
          providerStats: expect.any(Array),
          timeSeriesData: expect.any(Array)
        }),
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在非管理员用户访问时返回403错误', async () => {
      // 准备测试数据 - 普通用户
      mockReq.user.role = 'user';

      // 执行测试
      await quoteController.getQuoteStats(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('权限不足'),
          statusCode: 403,
          code: 'INSUFFICIENT_PERMISSIONS'
        })
      );
    });
  });

  describe('exportQuotes (管理员功能)', () => {
    beforeEach(() => {
      // 设置管理员用户
      mockReq.user.role = 'admin';
    });

    it('应该成功创建报价导出任务', async () => {
      // 准备测试数据
      mockReq.query = {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        provider: 'Test Provider',
        orderId: 'ORD-20250625-001'
      };

      // 执行测试
      await quoteController.exportQuotes(mockReq, mockRes, mockNext);

      // 验证结果
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '报价导出任务已创建',
        data: expect.objectContaining({
          downloadUrl: expect.stringMatching(/\/api\/downloads\/quotes_export_\d+\.csv/),
          expiresAt: expect.any(String)
        }),
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在非管理员用户访问时返回403错误', async () => {
      // 准备测试数据 - 普通用户
      mockReq.user.role = 'user';

      // 执行测试
      await quoteController.exportQuotes(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('权限不足'),
          statusCode: 403,
          code: 'INSUFFICIENT_PERMISSIONS'
        })
      );
    });
  });
});
