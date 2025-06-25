/**
 * NotificationService单元测试
 * 测试通知业务逻辑服务的所有功能
 */

const NotificationService = require('../../../src/services/NotificationService');

// 模拟依赖
jest.mock('../../../src/repositories', () => ({
  providerRepo: global.testUtils.createMockRepository()
}));

jest.mock('../../../src/utils/AsyncOptimizer');
jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('node-fetch', () => jest.fn());

const { providerRepo } = require('../../../src/repositories');
const AsyncOptimizer = require('../../../src/utils/AsyncOptimizer');
const fetch = require('node-fetch');

describe('NotificationService', () => {
  let notificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 模拟AsyncOptimizer
    AsyncOptimizer.executeBatch = jest.fn().mockResolvedValue({
      results: [],
      stats: {
        successful: 2,
        failed: 0,
        duration: 1000
      }
    });
    
    notificationService = new NotificationService();
  });

  describe('notifyProvidersNewOrder', () => {
    const mockOrder = global.testUtils.createMockOrder();

    it('应该成功通知所有供应商', async () => {
      const mockProviders = [
        { id: 1, name: 'Provider 1', webhookUrl: 'http://provider1.com/webhook' },
        { id: 2, name: 'Provider 2', webhookUrl: 'http://provider2.com/webhook' }
      ];

      // 模拟成功的批量执行结果
      AsyncOptimizer.executeBatch.mockResolvedValue({
        results: [
          { provider: 'Provider 1', status: 'sent', messageId: 'msg-1' },
          { provider: 'Provider 2', status: 'sent', messageId: 'msg-2' }
        ],
        errors: [],
        stats: {
          successful: 2,
          failed: 0,
          duration: 1500
        }
      });

      const result = await notificationService.notifyProvidersNewOrder(mockOrder, mockProviders);

      expect(result.success).toBe(true);
      expect(result.message).toBe('供应商通知发送完成');
      expect(result.data.summary.total).toBe(2);
      expect(result.data.summary.success).toBe(2);
      expect(result.data.summary.failed).toBe(0);
      expect(result.data.notifications).toHaveLength(2);

      expect(AsyncOptimizer.executeBatch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          maxConcurrency: 3,
          retryAttempts: 2,
          retryDelay: 1000,
          failFast: false
        })
      );
    });

    it('应该验证必需的订单参数', async () => {
      await expect(
        notificationService.notifyProvidersNewOrder(null, [])
      ).rejects.toThrow('缺少必需参数: order');

      await expect(
        notificationService.notifyProvidersNewOrder({}, [])
      ).rejects.toThrow('缺少必需参数: id, warehouse, goods, deliveryAddress');
    });

    it('应该处理没有活跃供应商的情况', async () => {
      const result = await notificationService.notifyProvidersNewOrder(mockOrder, []);

      expect(result.success).toBe(true);
      expect(result.message).toBe('没有可通知的供应商');
    });

    it('应该处理部分通知失败的情况', async () => {
      const mockProviders = [
        { id: 1, name: 'Provider 1', webhookUrl: 'http://provider1.com/webhook' },
        { id: 2, name: 'Provider 2', webhookUrl: 'http://provider2.com/webhook' }
      ];

      // 模拟部分失败的批量执行结果
      AsyncOptimizer.executeBatch.mockResolvedValue({
        results: [
          { provider: 'Provider 1', status: 'sent', messageId: 'msg-1' }
        ],
        errors: [
          { index: 1, error: 'Network timeout' }
        ],
        stats: {
          successful: 1,
          failed: 1,
          duration: 2000
        }
      });

      const result = await notificationService.notifyProvidersNewOrder(mockOrder, mockProviders);

      expect(result.success).toBe(true);
      expect(result.message).toBe('供应商通知发送完成');
      expect(result.data.summary.success).toBe(1);
      expect(result.data.summary.failed).toBe(1);
      expect(result.data.errors).toHaveLength(1);
    });
  });

  describe('sendNotification', () => {
    const message = {
      msgtype: 'text',
      text: {
        content: 'Test notification message'
      }
    };
    const type = 'new_order';
    const metadata = { orderId: 'ORD-20250625-001' };

    it('应该成功发送通知', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ errcode: 0, msgid: 'msg-123' })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await notificationService.sendNotification(message, type, metadata);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(fetch).toHaveBeenCalledWith(
        'http://test-webhook.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(message)
        })
      );
    });

    it('应该处理网络错误', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      await expect(
        notificationService.sendNotification(message, type, metadata)
      ).rejects.toThrow('Network error');
    });

    it('应该处理HTTP错误响应', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      };
      fetch.mockResolvedValue(mockResponse);

      await expect(
        notificationService.sendNotification(message, type, metadata)
      ).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('应该处理微信API错误', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ errcode: 40001, errmsg: 'Invalid token' })
      };
      fetch.mockResolvedValue(mockResponse);

      await expect(
        notificationService.sendNotification(message, type, metadata)
      ).rejects.toThrow('WeChat API Error: Invalid token (code: 40001)');
    });

    it('应该支持重试机制', async () => {
      // 第一次失败，第二次成功
      fetch
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ errcode: 0, msgid: 'msg-retry' })
        });

      const result = await notificationService.sendNotification(message, type, metadata);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-retry');
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateNewOrderMessage', () => {
    const mockOrder = global.testUtils.createMockOrder();
    const mockProvider = { name: 'Test Provider', id: 1 };

    it('应该生成正确的新订单消息', () => {
      const message = notificationService.generateNewOrderMessage(mockOrder, mockProvider);

      expect(message.msgtype).toBe('text');
      expect(message.text.content).toContain('新订单通知');
      expect(message.text.content).toContain(mockOrder.id);
      expect(message.text.content).toContain(mockOrder.warehouse);
      expect(message.text.content).toContain(mockOrder.goods);
      expect(message.text.content).toContain(mockOrder.deliveryAddress);
      expect(message.text.content).toContain(mockProvider.name);
    });

    it('应该包含系统提示信息', () => {
      const message = notificationService.generateNewOrderMessage(mockOrder, mockProvider);

      expect(message.text.content).toContain('请及时登录系统查看详情并提供报价');
    });
  });

  describe('generateQuoteNotificationMessage', () => {
    const mockOrder = global.testUtils.createMockOrder();
    const mockQuote = global.testUtils.createMockQuote();
    const mockUser = global.testUtils.createMockUser();

    it('应该生成正确的报价通知消息', () => {
      const message = notificationService.generateQuoteNotificationMessage(mockQuote, mockOrder, mockUser);

      expect(message.msgtype).toBe('text');
      expect(message.text.content).toContain('新报价通知');
      expect(message.text.content).toContain(mockOrder.id);
      expect(message.text.content).toContain(mockQuote.provider);
      expect(message.text.content).toContain(mockQuote.price.toString());
      expect(message.text.content).toContain(mockUser.name);
    });

    it('应该包含预计送达时间', () => {
      const message = notificationService.generateQuoteNotificationMessage(mockQuote, mockOrder, mockUser);

      expect(message.text.content).toContain('预计送达');
    });

    it('应该包含系统提示信息', () => {
      const message = notificationService.generateQuoteNotificationMessage(mockQuote, mockOrder, mockUser);

      expect(message.text.content).toContain('请登录系统查看详细报价信息');
    });
  });

  describe('notifyUserNewQuote', () => {
    const mockOrder = global.testUtils.createMockOrder();
    const mockQuote = global.testUtils.createMockQuote();
    const mockUser = global.testUtils.createMockUser();

    it('应该成功通知用户新报价', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ errcode: 0, msgid: 'user-msg-123' })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await notificationService.notifyUserNewQuote(mockQuote, mockOrder, mockUser);

      expect(result.success).toBe(true);
      expect(result.data.messageId).toBe('user-msg-123');
      expect(fetch).toHaveBeenCalledWith(
        'http://test-webhook.com/webhook',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('新报价通知')
        })
      );
    });

    it('应该验证必需参数', async () => {
      await expect(
        notificationService.notifyUserNewQuote(null, mockOrder, mockUser)
      ).rejects.toThrow('缺少必需参数: quote');

      await expect(
        notificationService.notifyUserNewQuote(mockQuote, null, mockUser)
      ).rejects.toThrow('缺少必需参数: order');

      await expect(
        notificationService.notifyUserNewQuote(mockQuote, mockOrder, null)
      ).rejects.toThrow('缺少必需参数: user');
    });
  });

  describe('getNotificationStats', () => {
    it('应该成功获取通知统计', async () => {
      const result = await notificationService.getNotificationStats();

      expect(result.success).toBe(true);
      expect(result.message).toBe('获取通知统计成功');
      expect(result.data).toEqual(expect.objectContaining({
        total: expect.any(Number),
        success: expect.any(Number),
        failed: expect.any(Number),
        byType: expect.any(Object),
        recentActivity: expect.any(Array)
      }));
    });
  });
});
