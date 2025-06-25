/**
 * OrderService单元测试
 * 测试订单业务逻辑服务的所有功能
 */

const OrderService = require('../../../src/services/OrderService');

// 模拟依赖
jest.mock('../../../src/repositories', () => ({
  orderRepo: global.testUtils.createMockRepository(),
  quoteRepo: global.testUtils.createMockRepository()
}));

jest.mock('../../../src/services/OrderIdService');
jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const { orderRepo, quoteRepo } = require('../../../src/repositories');
const OrderIdService = require('../../../src/services/OrderIdService');

describe('OrderService', () => {
  let orderService;
  let mockOrderIdService;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 创建模拟的OrderIdService实例
    mockOrderIdService = {
      generateOrderId: jest.fn().mockResolvedValue('ORD-20250625-001')
    };
    OrderIdService.mockImplementation(() => mockOrderIdService);
    
    // 创建OrderService实例
    orderService = new OrderService();
  });

  describe('createOrder', () => {
    const validOrderData = {
      warehouse: 'Test Warehouse',
      goods: 'Test Goods Description',
      deliveryAddress: 'Test Delivery Address'
    };
    const userId = 'test-user-id';

    it('应该成功创建订单', async () => {
      // 准备模拟数据
      const expectedOrder = {
        id: 'ORD-20250625-001',
        ...validOrderData,
        userId,
        status: 'active',
        createdAt: expect.any(String)
      };

      // 设置模拟返回值
      orderRepo.transactionWithRetry.mockImplementation(async (callback) => {
        return await callback();
      });
      orderRepo.create.mockResolvedValue(expectedOrder);

      // 执行测试
      const result = await orderService.createOrder(validOrderData, userId);

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.message).toBe('订单创建成功');
      expect(result.data).toEqual(expectedOrder);
      
      // 验证调用
      expect(mockOrderIdService.generateOrderId).toHaveBeenCalledTimes(1);
      expect(orderRepo.transactionWithRetry).toHaveBeenCalledTimes(1);
      expect(orderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ORD-20250625-001',
          warehouse: 'Test Warehouse',
          goods: 'Test Goods Description',
          deliveryAddress: 'Test Delivery Address',
          userId,
          status: 'active'
        }),
        undefined
      );
    });

    it('应该验证必需参数', async () => {
      // 测试缺少warehouse
      await expect(
        orderService.createOrder({ goods: 'test', deliveryAddress: 'test' }, userId)
      ).rejects.toThrow('缺少必需参数: warehouse');

      // 测试缺少goods
      await expect(
        orderService.createOrder({ warehouse: 'test', deliveryAddress: 'test' }, userId)
      ).rejects.toThrow('缺少必需参数: goods');

      // 测试缺少deliveryAddress
      await expect(
        orderService.createOrder({ warehouse: 'test', goods: 'test' }, userId)
      ).rejects.toThrow('缺少必需参数: deliveryAddress');

      // 测试缺少userId
      await expect(
        orderService.createOrder(validOrderData, null)
      ).rejects.toThrow('缺少必需参数: userId');
    });

    it('应该验证参数类型', async () => {
      // 测试warehouse类型错误
      await expect(
        orderService.createOrder({ 
          warehouse: 123, 
          goods: 'test', 
          deliveryAddress: 'test' 
        }, userId)
      ).rejects.toThrow('参数类型错误');

      // 测试goods类型错误
      await expect(
        orderService.createOrder({ 
          warehouse: 'test', 
          goods: [], 
          deliveryAddress: 'test' 
        }, userId)
      ).rejects.toThrow('参数类型错误');
    });

    it('应该验证数据长度', async () => {
      // 测试warehouse长度过短
      await expect(
        orderService.createOrder({ 
          warehouse: 'a', 
          goods: 'test goods', 
          deliveryAddress: 'test address' 
        }, userId)
      ).rejects.toThrow('仓库名称长度必须在2-100字符之间');

      // 测试warehouse长度过长
      await expect(
        orderService.createOrder({ 
          warehouse: 'a'.repeat(101), 
          goods: 'test goods', 
          deliveryAddress: 'test address' 
        }, userId)
      ).rejects.toThrow('仓库名称长度必须在2-100字符之间');

      // 测试goods长度过短
      await expect(
        orderService.createOrder({ 
          warehouse: 'test warehouse', 
          goods: 'a', 
          deliveryAddress: 'test address' 
        }, userId)
      ).rejects.toThrow('货物描述长度必须在2-500字符之间');

      // 测试deliveryAddress长度过短
      await expect(
        orderService.createOrder({ 
          warehouse: 'test warehouse', 
          goods: 'test goods', 
          deliveryAddress: 'abc' 
        }, userId)
      ).rejects.toThrow('配送地址长度必须在5-200字符之间');
    });

    it('应该清理和标准化输入数据', async () => {
      const orderDataWithSpaces = {
        warehouse: '  Test Warehouse  ',
        goods: '  Test Goods  ',
        deliveryAddress: '  Test Address  '
      };

      orderRepo.transactionWithRetry.mockImplementation(async (callback) => {
        return await callback();
      });
      orderRepo.create.mockResolvedValue({
        id: 'ORD-20250625-001',
        warehouse: 'Test Warehouse',
        goods: 'Test Goods',
        deliveryAddress: 'Test Address',
        userId,
        status: 'active',
        createdAt: new Date().toISOString()
      });

      await orderService.createOrder(orderDataWithSpaces, userId);

      expect(orderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouse: 'Test Warehouse',
          goods: 'Test Goods',
          deliveryAddress: 'Test Address'
        }),
        undefined
      );
    });

    it('应该处理事务失败', async () => {
      const error = new Error('Transaction failed');
      orderRepo.transactionWithRetry.mockRejectedValue(error);

      await expect(
        orderService.createOrder(validOrderData, userId)
      ).rejects.toThrow('Transaction failed');
    });
  });

  describe('getUserOrders', () => {
    const userId = 'test-user-id';

    it('应该成功获取用户订单列表', async () => {
      const mockOrders = [
        global.testUtils.createMockOrder(),
        global.testUtils.createMockOrder({ id: 'ORD-20250625-002' })
      ];
      const mockTotal = 2;

      orderRepo.findByUserId.mockResolvedValue(mockOrders);
      orderRepo.count.mockResolvedValue(mockTotal);

      const result = await orderService.getUserOrders(userId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOrders);
      expect(result.meta.pagination.total).toBe(mockTotal);
      expect(orderRepo.findByUserId).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          limit: 20,
          offset: 0,
          orderBy: [{ column: 'createdAt', direction: 'desc' }]
        })
      );
    });

    it('应该验证必需的userId参数', async () => {
      await expect(
        orderService.getUserOrders(null)
      ).rejects.toThrow('缺少必需参数: userId');
    });

    it('应该支持分页参数', async () => {
      const options = { page: 2, limit: 10 };
      
      orderRepo.findByUserId.mockResolvedValue([]);
      orderRepo.count.mockResolvedValue(0);

      await orderService.getUserOrders(userId, options);

      expect(orderRepo.findByUserId).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          limit: 10,
          offset: 10
        })
      );
    });

    it('应该支持状态过滤', async () => {
      const options = { status: 'completed' };
      
      orderRepo.findByUserId.mockResolvedValue([]);
      orderRepo.count.mockResolvedValue(0);

      await orderService.getUserOrders(userId, options);

      expect(orderRepo.findByUserId).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          status: 'completed'
        })
      );
    });

    it('应该支持排序参数', async () => {
      const options = { orderBy: [{ column: 'status', direction: 'asc' }] };
      
      orderRepo.findByUserId.mockResolvedValue([]);
      orderRepo.count.mockResolvedValue(0);

      await orderService.getUserOrders(userId, options);

      expect(orderRepo.findByUserId).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          orderBy: [{ column: 'status', direction: 'asc' }]
        })
      );
    });
  });

  describe('getOrderById', () => {
    const orderId = 'ORD-20250625-001';
    const userId = 'test-user-id';

    it('应该成功获取订单详情', async () => {
      const mockOrder = global.testUtils.createMockOrder();
      const mockQuotes = [global.testUtils.createMockQuote()];

      orderRepo.checkUserAccess.mockResolvedValue(true);
      orderRepo.findById.mockResolvedValue(mockOrder);
      quoteRepo.findByOrderId.mockResolvedValue(mockQuotes);

      const result = await orderService.getOrderById(orderId, userId, 'user');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        ...mockOrder,
        quotes: mockQuotes
      }));
      expect(orderRepo.checkUserAccess).toHaveBeenCalledWith(orderId, userId, 'user');
      expect(orderRepo.findById).toHaveBeenCalledWith(orderId);
      expect(quoteRepo.findByOrderId).toHaveBeenCalledWith(orderId);
    });

    it('应该验证订单存在性', async () => {
      orderRepo.checkUserAccess.mockResolvedValue(true);
      orderRepo.findById.mockResolvedValue(null);

      await expect(
        orderService.getOrderById(orderId, userId, 'user')
      ).rejects.toThrow('订单不存在');
    });

    it('应该验证用户权限', async () => {
      orderRepo.checkUserAccess.mockResolvedValue(false);

      await expect(
        orderService.getOrderById(orderId, userId, 'user')
      ).rejects.toThrow('无权访问此订单');
    });

    it('管理员应该能访问任何订单', async () => {
      const mockOrder = global.testUtils.createMockOrder({ userId: 'other-user-id' });
      const mockQuotes = [];

      orderRepo.checkUserAccess.mockResolvedValue(true);
      orderRepo.findById.mockResolvedValue(mockOrder);
      quoteRepo.findByOrderId.mockResolvedValue(mockQuotes);

      const result = await orderService.getOrderById(orderId, userId, 'admin');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        ...mockOrder,
        quotes: mockQuotes
      }));
    });
  });

  describe('updateOrder', () => {
    const orderId = 'ORD-20250625-001';
    const userId = 'test-user-id';
    const updateData = {
      warehouse: 'Updated Warehouse',
      goods: 'Updated Goods'
    };

    it('应该成功更新订单', async () => {
      const mockOrder = global.testUtils.createMockOrder({ status: 'active' });
      const updatedOrder = { ...mockOrder, ...updateData };

      orderRepo.checkUserAccess.mockResolvedValue(true);
      orderRepo.findById.mockResolvedValue(mockOrder);
      orderRepo.updateById.mockResolvedValue(updatedOrder);

      const result = await orderService.updateOrder(orderId, updateData, userId, 'user');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedOrder);
      expect(orderRepo.updateById).toHaveBeenCalledWith(orderId, updateData);
    });

    it('应该验证订单存在性', async () => {
      orderRepo.checkUserAccess.mockResolvedValue(true);
      orderRepo.findById.mockResolvedValue(null);

      await expect(
        orderService.updateOrder(orderId, updateData, userId, 'user')
      ).rejects.toThrow('订单不存在');
    });

    it('应该验证用户权限', async () => {
      orderRepo.checkUserAccess.mockResolvedValue(false);

      await expect(
        orderService.updateOrder(orderId, updateData, userId, 'user')
      ).rejects.toThrow('无权修改此订单');
    });

    it('应该验证订单状态', async () => {
      const mockOrder = global.testUtils.createMockOrder({ status: 'completed' });

      orderRepo.checkUserAccess.mockResolvedValue(true);
      orderRepo.findById.mockResolvedValue(mockOrder);

      await expect(
        orderService.updateOrder(orderId, updateData, userId, 'user')
      ).rejects.toThrow('只能修改状态为活跃的订单');
    });
  });

  describe('selectProvider', () => {
    const orderId = 'ORD-20250625-001';
    const provider = 'Test Provider';
    const userId = 'test-user-id';

    it('应该成功选择供应商', async () => {
      const mockOrder = global.testUtils.createMockOrder({ status: 'active' });
      const mockQuote = global.testUtils.createMockQuote();
      const updatedOrder = {
        ...mockOrder,
        selectedProvider: provider,
        selectedPrice: mockQuote.price
      };

      orderRepo.checkUserAccess.mockResolvedValue(true);
      orderRepo.findById.mockResolvedValue(mockOrder);
      quoteRepo.findByOrderAndProvider.mockResolvedValue(mockQuote);
      orderRepo.selectProvider.mockResolvedValue(updatedOrder);

      const result = await orderService.selectProvider(orderId, provider, userId, 'user');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedOrder);
      expect(orderRepo.selectProvider).toHaveBeenCalledWith(orderId, provider, mockQuote.price);
    });

    it('应该验证报价存在性', async () => {
      const mockOrder = global.testUtils.createMockOrder({ status: 'active' });

      orderRepo.checkUserAccess.mockResolvedValue(true);
      orderRepo.findById.mockResolvedValue(mockOrder);
      quoteRepo.findByOrderAndProvider.mockResolvedValue(null);

      await expect(
        orderService.selectProvider(orderId, provider, userId, 'user')
      ).rejects.toThrow('报价不存在');
    });
  });

  describe('getOrderStats', () => {
    const userId = 'test-user-id';

    it('应该成功获取用户订单统计', async () => {
      const mockStats = {
        total: 10,
        active: 5,
        completed: 3,
        cancelled: 2
      };

      orderRepo.getOrderStats.mockResolvedValue(mockStats);

      const result = await orderService.getOrderStats(userId, 'user');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStats);
      expect(orderRepo.getOrderStats).toHaveBeenCalledWith({ userId });
    });

    it('管理员应该能获取全局统计', async () => {
      const mockStats = {
        total: 100,
        active: 50,
        completed: 30,
        cancelled: 20
      };

      orderRepo.getOrderStats.mockResolvedValue(mockStats);

      const result = await orderService.getOrderStats(null, 'admin');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStats);
      expect(orderRepo.getOrderStats).toHaveBeenCalledWith({});
    });

    it('应该支持过滤条件', async () => {
      const filters = { status: 'active', startDate: '2025-01-01' };
      orderRepo.getOrderStats.mockResolvedValue({});

      await orderService.getOrderStats(userId, 'user', filters);

      expect(orderRepo.getOrderStats).toHaveBeenCalledWith({
        userId,
        ...filters
      });
    });
  });
});
