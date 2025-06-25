/**
 * QuoteService单元测试
 * 测试报价业务逻辑服务的所有功能
 */

const QuoteService = require('../../../src/services/QuoteService');

// 模拟依赖
jest.mock('../../../src/repositories', () => ({
  quoteRepo: global.testUtils.createMockRepository(),
  orderRepo: global.testUtils.createMockRepository(),
  providerRepo: global.testUtils.createMockRepository()
}));

jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const { quoteRepo, orderRepo, providerRepo } = require('../../../src/repositories');

describe('QuoteService', () => {
  let quoteService;

  beforeEach(() => {
    jest.clearAllMocks();
    quoteService = new QuoteService();
  });

  describe('createOrUpdateQuote', () => {
    const orderId = 'ORD-20250625-001';
    const provider = 'Test Provider';
    const accessKey = 'test-access-key';
    const validQuoteData = {
      price: 100.50,
      estimatedDelivery: new Date(Date.now() + 86400000).toISOString(),
      remarks: 'Test remarks'
    };

    it('应该成功创建或更新报价', async () => {
      const mockOrder = global.testUtils.createMockOrder();
      const mockProvider = { name: provider, accessKey };
      const mockQuote = global.testUtils.createMockQuote();

      orderRepo.findById.mockResolvedValue(mockOrder);
      providerRepo.validateAccess.mockResolvedValue(mockProvider);
      quoteRepo.upsertQuote.mockResolvedValue(mockQuote);

      const result = await quoteService.createOrUpdateQuote(orderId, provider, validQuoteData, accessKey);

      expect(result.success).toBe(true);
      expect(result.message).toBe('报价提交成功');
      expect(result.data).toEqual(mockQuote);
      
      expect(orderRepo.findById).toHaveBeenCalledWith(orderId);
      expect(providerRepo.validateAccess).toHaveBeenCalledWith(accessKey);
      expect(quoteRepo.upsertQuote).toHaveBeenCalledWith(
        orderId,
        provider,
        expect.objectContaining({
          price: 100.50,
          estimatedDelivery: validQuoteData.estimatedDelivery,
          remarks: 'Test remarks'
        })
      );
    });

    it('应该验证必需参数', async () => {
      // 测试缺少orderId
      await expect(
        quoteService.createOrUpdateQuote(null, provider, validQuoteData, accessKey)
      ).rejects.toThrow('缺少必需参数: orderId');

      // 测试缺少provider
      await expect(
        quoteService.createOrUpdateQuote(orderId, null, validQuoteData, accessKey)
      ).rejects.toThrow('缺少必需参数: provider');

      // 测试缺少accessKey
      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, validQuoteData, null)
      ).rejects.toThrow('缺少必需参数: accessKey');

      // 测试缺少price
      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, { estimatedDelivery: validQuoteData.estimatedDelivery }, accessKey)
      ).rejects.toThrow('缺少必需参数: price');

      // 测试缺少estimatedDelivery
      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, { price: 100 }, accessKey)
      ).rejects.toThrow('缺少必需参数: estimatedDelivery');
    });

    it('应该验证参数类型', async () => {
      // 测试price类型错误
      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, { 
          price: 'invalid', 
          estimatedDelivery: validQuoteData.estimatedDelivery 
        }, accessKey)
      ).rejects.toThrow('参数类型错误');

      // 测试estimatedDelivery类型错误
      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, { 
          price: 100, 
          estimatedDelivery: 123 
        }, accessKey)
      ).rejects.toThrow('参数类型错误');
    });

    it('应该验证订单存在性', async () => {
      orderRepo.findById.mockResolvedValue(null);

      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, validQuoteData, accessKey)
      ).rejects.toThrow('订单不存在');
    });

    it('应该验证供应商访问权限', async () => {
      const mockOrder = global.testUtils.createMockOrder();
      orderRepo.findById.mockResolvedValue(mockOrder);
      providerRepo.validateAccess.mockResolvedValue(null);

      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, validQuoteData, accessKey)
      ).rejects.toThrow('无效的访问密钥');
    });

    it('应该验证供应商名称匹配', async () => {
      const mockOrder = global.testUtils.createMockOrder();
      const mockProvider = { name: 'Different Provider', accessKey };

      orderRepo.findById.mockResolvedValue(mockOrder);
      providerRepo.validateAccess.mockResolvedValue(mockProvider);

      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, validQuoteData, accessKey)
      ).rejects.toThrow('供应商名称与访问密钥不匹配');
    });

    it('应该验证价格范围', async () => {
      const mockOrder = global.testUtils.createMockOrder();
      const mockProvider = { name: provider, accessKey };
      
      orderRepo.findById.mockResolvedValue(mockOrder);
      providerRepo.validateAccess.mockResolvedValue(mockProvider);

      // 测试价格过低
      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, {
          ...validQuoteData,
          price: 0
        }, accessKey)
      ).rejects.toThrow('报价金额必须大于0');

      // 测试价格过高
      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, {
          ...validQuoteData,
          price: 1000000
        }, accessKey)
      ).rejects.toThrow('报价金额不能超过999999.99');
    });

    it('应该验证预计送达时间', async () => {
      const mockOrder = global.testUtils.createMockOrder();
      const mockProvider = { name: provider, accessKey };
      
      orderRepo.findById.mockResolvedValue(mockOrder);
      providerRepo.validateAccess.mockResolvedValue(mockProvider);

      // 测试无效日期格式
      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, { 
          ...validQuoteData, 
          estimatedDelivery: 'invalid-date' 
        }, accessKey)
      ).rejects.toThrow('预计送达时间格式无效');

      // 测试过去时间
      await expect(
        quoteService.createOrUpdateQuote(orderId, provider, { 
          ...validQuoteData, 
          estimatedDelivery: new Date(Date.now() - 86400000).toISOString() 
        }, accessKey)
      ).rejects.toThrow('预计送达时间必须是未来时间');
    });

    it('应该清理和标准化数据', async () => {
      const mockOrder = global.testUtils.createMockOrder();
      const mockProvider = { name: provider, accessKey };
      const mockQuote = global.testUtils.createMockQuote();
      
      orderRepo.findById.mockResolvedValue(mockOrder);
      providerRepo.validateAccess.mockResolvedValue(mockProvider);
      quoteRepo.upsertQuote.mockResolvedValue(mockQuote);

      const quoteDataWithSpaces = {
        price: 100.555, // 应该被四舍五入到两位小数
        estimatedDelivery: validQuoteData.estimatedDelivery,
        remarks: '  Test remarks with spaces  ' // 应该被trim
      };

      await quoteService.createOrUpdateQuote(orderId, provider, quoteDataWithSpaces, accessKey);

      expect(quoteRepo.upsertQuote).toHaveBeenCalledWith(
        orderId,
        provider,
        expect.objectContaining({
          price: 100.56, // 四舍五入到两位小数
          remarks: 'Test remarks with spaces' // 去除前后空格
        })
      );
    });
  });

  describe('getOrderQuotes', () => {
    const orderId = 'ORD-20250625-001';

    it('应该成功获取订单的所有报价', async () => {
      const mockOrder = global.testUtils.createMockOrder();
      const mockQuotes = [
        global.testUtils.createMockQuote(),
        global.testUtils.createMockQuote({ id: 'quote-2', provider: 'Provider 2', price: 120.00 })
      ];
      const mockStats = {
        count: 2,
        minPrice: 100.00,
        maxPrice: 120.00,
        avgPrice: 110.00
      };

      orderRepo.findById.mockResolvedValue(mockOrder);
      quoteRepo.findByOrderId.mockResolvedValue(mockQuotes);
      quoteRepo.getQuoteStats.mockResolvedValue(mockStats);

      const result = await quoteService.getOrderQuotes(orderId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('获取报价列表成功');
      expect(result.data.order).toEqual(expect.objectContaining({
        id: mockOrder.id,
        warehouse: mockOrder.warehouse,
        goods: mockOrder.goods,
        deliveryAddress: mockOrder.deliveryAddress,
        status: mockOrder.status
      }));
      expect(result.data.quotes).toEqual(mockQuotes);
      expect(result.data.stats).toEqual(mockStats);
      
      expect(orderRepo.findById).toHaveBeenCalledWith(orderId);
      expect(quoteRepo.findByOrderId).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          orderBy: [{ column: 'price', direction: 'asc' }]
        })
      );
      expect(quoteRepo.getQuoteStats).toHaveBeenCalledWith(orderId);
    });

    it('应该验证必需的orderId参数', async () => {
      await expect(
        quoteService.getOrderQuotes(null)
      ).rejects.toThrow('缺少必需参数: orderId');
    });

    it('应该验证订单存在性', async () => {
      orderRepo.findById.mockResolvedValue(null);

      await expect(
        quoteService.getOrderQuotes(orderId)
      ).rejects.toThrow('订单不存在');
    });

    it('应该支持排序参数', async () => {
      const mockOrder = global.testUtils.createMockOrder();
      const options = { 
        orderBy: [{ column: 'estimatedDelivery', direction: 'asc' }] 
      };

      orderRepo.findById.mockResolvedValue(mockOrder);
      quoteRepo.findByOrderId.mockResolvedValue([]);
      quoteRepo.getQuoteStats.mockResolvedValue({});

      await quoteService.getOrderQuotes(orderId, options);

      expect(quoteRepo.findByOrderId).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          orderBy: [{ column: 'estimatedDelivery', direction: 'asc' }]
        })
      );
    });
  });
});
