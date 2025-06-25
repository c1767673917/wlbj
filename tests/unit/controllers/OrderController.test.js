/**
 * OrderController单元测试
 * 测试订单控制器的HTTP请求处理逻辑
 */

const OrderController = require('../../../src/controllers/OrderController');

// 模拟依赖
jest.mock('../../../src/services', () => ({
  orderService: {
    createOrder: jest.fn(),
    getOrderById: jest.fn(),
    getUserOrders: jest.fn(),
    updateOrder: jest.fn(),
    cancelOrder: jest.fn(),
    selectProvider: jest.fn(),
    getOrderStats: jest.fn(),
    getPendingOrders: jest.fn(),
    batchUpdateOrders: jest.fn(),
    exportOrders: jest.fn()
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

const { orderService } = require('../../../src/services');

describe('OrderController', () => {
  let orderController;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 创建OrderController实例
    orderController = new OrderController();
    
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
      method: 'GET',
      url: '/api/orders',
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

  describe('createOrder', () => {
    const validOrderData = {
      warehouse: 'Test Warehouse',
      goods: 'Test Goods Description',
      deliveryAddress: 'Test Delivery Address'
    };

    it('应该成功创建订单', async () => {
      // 准备测试数据
      mockReq.body = validOrderData;
      
      const mockResult = {
        data: {
          id: 'ORD-20250625-001',
          ...validOrderData,
          userId: 'test-user-id',
          status: 'active'
        },
        message: '订单创建成功',
        meta: {}
      };
      
      orderService.createOrder.mockResolvedValue(mockResult);
      
      // 执行测试
      await orderController.createOrder(mockReq, mockRes, mockNext);
      
      // 验证结果
      expect(orderService.createOrder).toHaveBeenCalledWith(validOrderData, 'test-user-id');
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '订单创建成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在缺少必需参数时返回400错误', async () => {
      // 准备测试数据 - 缺少warehouse
      mockReq.body = {
        goods: 'Test Goods',
        deliveryAddress: 'Test Address'
      };
      
      // 执行测试
      await orderController.createOrder(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(orderService.createOrder).not.toHaveBeenCalled();
    });

    it('应该在用户未认证时返回401错误', async () => {
      // 准备测试数据 - 无用户信息
      mockReq.user = null;
      mockReq.body = validOrderData;
      
      // 执行测试
      await orderController.createOrder(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '用户未认证',
          statusCode: 401,
          code: 'UNAUTHORIZED'
        })
      );
      expect(orderService.createOrder).not.toHaveBeenCalled();
    });

    it('应该在请求体为空时返回400错误', async () => {
      // 准备测试数据 - 空请求体
      mockReq.body = null;
      
      // 执行测试
      await orderController.createOrder(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '请求体不能为空',
          statusCode: 400,
          code: 'EMPTY_REQUEST_BODY'
        })
      );
      expect(orderService.createOrder).not.toHaveBeenCalled();
    });

    it('应该处理服务层抛出的错误', async () => {
      // 准备测试数据
      mockReq.body = validOrderData;
      
      const serviceError = new Error('服务层错误');
      serviceError.statusCode = 500;
      orderService.createOrder.mockRejectedValue(serviceError);
      
      // 执行测试
      await orderController.createOrder(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '服务层错误',
          controller: 'OrderController'
        })
      );
    });
  });

  describe('getOrderById', () => {
    it('应该成功获取订单详情', async () => {
      // 准备测试数据
      const orderId = 'ORD-20250625-001';
      mockReq.params = { orderId };
      
      const mockResult = {
        data: {
          id: orderId,
          warehouse: 'Test Warehouse',
          goods: 'Test Goods',
          deliveryAddress: 'Test Address',
          userId: 'test-user-id',
          status: 'active'
        },
        message: '获取订单详情成功',
        meta: {}
      };
      
      orderService.getOrderById.mockResolvedValue(mockResult);
      
      // 执行测试
      await orderController.getOrderById(mockReq, mockRes, mockNext);
      
      // 验证结果
      expect(orderService.getOrderById).toHaveBeenCalledWith(orderId, 'test-user-id', 'user');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取订单详情成功',
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
      await orderController.getOrderById(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(orderService.getOrderById).not.toHaveBeenCalled();
    });

    it('应该在用户未认证时返回401错误', async () => {
      // 准备测试数据 - 无用户信息
      mockReq.user = null;
      mockReq.params = { orderId: 'ORD-20250625-001' };
      
      // 执行测试
      await orderController.getOrderById(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '用户未认证',
          statusCode: 401,
          code: 'UNAUTHORIZED'
        })
      );
      expect(orderService.getOrderById).not.toHaveBeenCalled();
    });
  });

  describe('getUserOrders', () => {
    it('应该成功获取用户订单列表', async () => {
      // 准备测试数据
      mockReq.query = {
        page: '1',
        limit: '10',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        status: 'active'
      };
      
      const mockResult = {
        data: [
          {
            id: 'ORD-20250625-001',
            warehouse: 'Test Warehouse 1',
            status: 'active'
          },
          {
            id: 'ORD-20250625-002',
            warehouse: 'Test Warehouse 2',
            status: 'active'
          }
        ],
        message: '获取订单列表成功',
        meta: {
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        }
      };
      
      orderService.getUserOrders.mockResolvedValue(mockResult);
      
      // 执行测试
      await orderController.getUserOrders(mockReq, mockRes, mockNext);
      
      // 验证结果
      expect(orderService.getUserOrders).toHaveBeenCalledWith('test-user-id', {
        page: 1,
        limit: 10,
        offset: 0,
        orderBy: [{ column: 'createdAt', direction: 'desc' }],
        status: 'active'
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取订单列表成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        })
      });
    });

    it('应该使用默认分页参数', async () => {
      // 准备测试数据 - 无查询参数
      mockReq.query = {};
      
      const mockResult = {
        data: [],
        message: '获取订单列表成功',
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      };
      
      orderService.getUserOrders.mockResolvedValue(mockResult);
      
      // 执行测试
      await orderController.getUserOrders(mockReq, mockRes, mockNext);
      
      // 验证结果
      expect(orderService.getUserOrders).toHaveBeenCalledWith('test-user-id', {
        page: 1,
        limit: 20,
        offset: 0,
        orderBy: []
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('updateOrder', () => {
    it('应该成功更新订单', async () => {
      // 准备测试数据
      const orderId = 'ORD-20250625-001';
      const updateData = {
        warehouse: 'Updated Warehouse',
        goods: 'Updated Goods'
      };

      mockReq.params = { orderId };
      mockReq.body = updateData;

      const mockResult = {
        data: {
          id: orderId,
          ...updateData,
          userId: 'test-user-id',
          status: 'active'
        },
        message: '订单更新成功',
        meta: {}
      };

      orderService.updateOrder.mockResolvedValue(mockResult);

      // 执行测试
      await orderController.updateOrder(mockReq, mockRes, mockNext);

      // 验证结果
      expect(orderService.updateOrder).toHaveBeenCalledWith(orderId, updateData, 'test-user-id', 'user');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '订单更新成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在缺少orderId参数时返回400错误', async () => {
      // 准备测试数据 - 缺少orderId
      mockReq.params = {};
      mockReq.body = { warehouse: 'Updated Warehouse' };

      // 执行测试
      await orderController.updateOrder(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(orderService.updateOrder).not.toHaveBeenCalled();
    });
  });

  describe('cancelOrder', () => {
    it('应该成功取消订单', async () => {
      // 准备测试数据
      const orderId = 'ORD-20250625-001';
      const reason = '用户主动取消';

      mockReq.params = { orderId };
      mockReq.body = { reason };

      const mockResult = {
        data: {
          id: orderId,
          status: 'cancelled',
          cancelReason: reason
        },
        message: '订单取消成功',
        meta: {}
      };

      orderService.cancelOrder.mockResolvedValue(mockResult);

      // 执行测试
      await orderController.cancelOrder(mockReq, mockRes, mockNext);

      // 验证结果
      expect(orderService.cancelOrder).toHaveBeenCalledWith(orderId, reason, 'test-user-id', 'user');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '订单取消成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在没有取消原因时也能成功取消订单', async () => {
      // 准备测试数据 - 无取消原因
      const orderId = 'ORD-20250625-001';

      mockReq.params = { orderId };
      mockReq.body = {};

      const mockResult = {
        data: {
          id: orderId,
          status: 'cancelled'
        },
        message: '订单取消成功',
        meta: {}
      };

      orderService.cancelOrder.mockResolvedValue(mockResult);

      // 执行测试
      await orderController.cancelOrder(mockReq, mockRes, mockNext);

      // 验证结果
      expect(orderService.cancelOrder).toHaveBeenCalledWith(orderId, undefined, 'test-user-id', 'user');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('selectProvider', () => {
    it('应该成功选择供应商', async () => {
      // 准备测试数据
      const orderId = 'ORD-20250625-001';
      const provider = 'Test Provider';

      mockReq.params = { orderId };
      mockReq.body = { provider };

      const mockResult = {
        data: {
          id: orderId,
          selectedProvider: provider,
          status: 'confirmed'
        },
        message: '供应商选择成功',
        meta: {}
      };

      orderService.selectProvider.mockResolvedValue(mockResult);

      // 执行测试
      await orderController.selectProvider(mockReq, mockRes, mockNext);

      // 验证结果
      expect(orderService.selectProvider).toHaveBeenCalledWith(orderId, provider, 'test-user-id', 'user');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '供应商选择成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在缺少provider参数时返回400错误', async () => {
      // 准备测试数据 - 缺少provider
      const orderId = 'ORD-20250625-001';

      mockReq.params = { orderId };
      mockReq.body = {};

      // 执行测试
      await orderController.selectProvider(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(orderService.selectProvider).not.toHaveBeenCalled();
    });
  });

  describe('getOrderStats', () => {
    it('应该成功获取订单统计信息', async () => {
      // 准备测试数据
      mockReq.query = {
        startDate: '2025-06-01',
        endDate: '2025-06-30'
      };

      const mockResult = {
        data: {
          totalOrders: 10,
          activeOrders: 5,
          completedOrders: 3,
          cancelledOrders: 2,
          totalValue: 5000.00
        },
        message: '获取订单统计成功',
        meta: {}
      };

      orderService.getOrderStats.mockResolvedValue(mockResult);

      // 执行测试
      await orderController.getOrderStats(mockReq, mockRes, mockNext);

      // 验证结果
      expect(orderService.getOrderStats).toHaveBeenCalledWith('test-user-id', 'user', {
        startDate: '2025-06-01',
        endDate: '2025-06-30'
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取订单统计成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在没有过滤参数时也能获取统计信息', async () => {
      // 准备测试数据 - 无过滤参数
      mockReq.query = {};

      const mockResult = {
        data: {
          totalOrders: 5,
          activeOrders: 3,
          completedOrders: 1,
          cancelledOrders: 1,
          totalValue: 2500.00
        },
        message: '获取订单统计成功',
        meta: {}
      };

      orderService.getOrderStats.mockResolvedValue(mockResult);

      // 执行测试
      await orderController.getOrderStats(mockReq, mockRes, mockNext);

      // 验证结果
      expect(orderService.getOrderStats).toHaveBeenCalledWith('test-user-id', 'user', {});
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getPendingOrders (管理员功能)', () => {
    beforeEach(() => {
      // 设置管理员用户
      mockReq.user.role = 'admin';
    });

    it('应该成功获取待处理订单列表', async () => {
      // 准备测试数据
      mockReq.query = {
        page: '1',
        limit: '10'
      };

      // 模拟服务响应
      orderService.getPendingOrders.mockResolvedValue({
        data: [],
        message: '获取待处理订单成功',
        meta: {
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      });

      // 执行测试
      await orderController.getPendingOrders(mockReq, mockRes, mockNext);

      // 验证结果
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取待处理订单成功',
        data: [],
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        })
      });
    });

    it('应该在非管理员用户访问时返回403错误', async () => {
      // 准备测试数据 - 普通用户
      mockReq.user.role = 'user';

      // 执行测试
      await orderController.getPendingOrders(mockReq, mockRes, mockNext);

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

  describe('exportOrders (管理员功能)', () => {
    beforeEach(() => {
      // 设置管理员用户
      mockReq.user.role = 'admin';
    });

    it('应该成功创建订单导出任务', async () => {
      // 准备测试数据
      mockReq.query = {
        status: 'active',
        startDate: '2025-06-01',
        endDate: '2025-06-30'
      };

      // 执行测试
      await orderController.exportOrders(mockReq, mockRes, mockNext);

      // 验证结果
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '订单导出任务已创建',
        data: expect.objectContaining({
          downloadUrl: expect.stringMatching(/\/api\/downloads\/orders_export_\d+\.csv/),
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
      await orderController.exportOrders(mockReq, mockRes, mockNext);

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

  describe('错误处理和边界情况', () => {
    it('应该正确处理控制器级别的错误', async () => {
      // 准备测试数据
      mockReq.body = {
        warehouse: 'Test Warehouse',
        goods: 'Test Goods',
        deliveryAddress: 'Test Address'
      };

      const serviceError = new Error('数据库连接失败');
      serviceError.statusCode = 500;
      serviceError.code = 'DATABASE_ERROR';
      orderService.createOrder.mockRejectedValue(serviceError);

      // 执行测试
      await orderController.createOrder(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '数据库连接失败',
          statusCode: 500,
          code: 'DATABASE_ERROR',
          controller: 'OrderController'
        })
      );
    });

    it('应该正确处理无效的分页参数', async () => {
      // 准备测试数据 - 无效的分页参数
      mockReq.query = {
        page: 'invalid',
        limit: 'invalid'
      };

      const mockResult = {
        data: [],
        message: '获取订单列表成功',
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      };

      orderService.getUserOrders.mockResolvedValue(mockResult);

      // 执行测试
      await orderController.getUserOrders(mockReq, mockRes, mockNext);

      // 验证结果 - 应该使用默认值
      expect(orderService.getUserOrders).toHaveBeenCalledWith('test-user-id', {
        page: 1,
        limit: 20,
        offset: 0,
        orderBy: []
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('应该正确处理无效的排序参数', async () => {
      // 准备测试数据 - 无效的排序字段
      mockReq.query = {
        sortBy: 'invalidField',
        sortOrder: 'asc'
      };

      // 执行测试
      await orderController.getUserOrders(mockReq, mockRes, mockNext);

      // 验证错误处理 - 应该抛出无效排序字段错误
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('不允许按字段'),
          statusCode: 400,
          code: 'INVALID_SORT_FIELD'
        })
      );
      expect(orderService.getUserOrders).not.toHaveBeenCalled();
    });
  });
});
