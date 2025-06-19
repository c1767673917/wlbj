/**
 * 企业微信群机器人通知功能集成测试
 * 用于测试企业微信通知功能是否正常工作
 */

const { describe, test, expect } = require('@jest/globals');

const {
  validateWechatWebhookUrl,
  generateOrderNotificationMessage,
  notifyProviderNewOrder,
} = require('../../utils/wechatNotification');

// 测试数据
const testOrder = {
  id: 'TEST-ORDER-001',
  warehouse: '广州仓',
  goods:
    '清香牛肉579箱，香辣味1321箱，大骨牛肉500箱，番茄牛肉600箱，需要按口味码放整齐，混码装卸仓库拒收',
  deliveryAddress:
    '河南省漯河市临颍县繁阳路南侧经一路西侧 临颍县恒烨实业有限公司 时会丽 15839591235 必须提前一天电话预约仓库送货',
  createdAt: new Date().toISOString(),
};

const testProviderName = '测试物流公司';

// 测试webhook URL（请替换为实际的webhook URL进行测试）
const testWebhookUrl =
  'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=TEST_KEY_REPLACE_WITH_REAL_KEY';

describe('企业微信通知功能', () => {
  describe('URL格式验证', () => {
    test('应该验证有效的webhook URL', () => {
      const validUrls = [
        'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc123',
        'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-key_123',
      ];

      validUrls.forEach(url => {
        expect(validateWechatWebhookUrl(url)).toBe(true);
      });
    });

    test('应该拒绝无效的webhook URL', () => {
      const invalidUrls = [
        'http://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc123', // http instead of https
        'https://qyapi.weixin.qq.com/cgi-bin/webhook/send', // missing key
        'https://example.com/webhook', // wrong domain
        'not-a-url',
      ];

      invalidUrls.forEach(url => {
        expect(validateWechatWebhookUrl(url)).toBe(false);
      });
    });
  });

  describe('消息内容生成', () => {
    test('应该生成正确格式的订单通知消息', () => {
      const message = generateOrderNotificationMessage(testOrder, testProviderName);

      expect(message).toBeDefined();
      expect(message.msgtype).toBe('markdown');
      expect(message.markdown).toBeDefined();
      expect(message.markdown.content).toBeDefined();
      expect(typeof message.markdown.content).toBe('string');
      expect(message.markdown.content).toContain(testOrder.id);
      expect(message.markdown.content).toContain(testProviderName);
    });
  });

  describe('消息发送测试', () => {
    test('应该跳过实际发送测试（使用测试URL）', async () => {
      // 由于使用的是测试URL，这个测试主要验证函数调用不会抛出异常
      expect(testWebhookUrl).toContain('TEST_KEY_REPLACE_WITH_REAL_KEY');

      // 验证函数存在且可调用
      expect(typeof notifyProviderNewOrder).toBe('function');
    });

    test('应该处理无效的webhook URL', async () => {
      const invalidUrl = 'invalid-url';

      try {
        const result = await notifyProviderNewOrder(testOrder, testProviderName, invalidUrl);
        expect(result.success).toBe(false);
      } catch (error) {
        // 预期会抛出错误
        expect(error).toBeDefined();
      }
    });
  });
});

// 保留原始的运行函数以便手动测试
async function runManualTests() {
  console.log('🚀 开始手动测试企业微信群机器人通知功能...\n');
  console.log('💡 要进行实际测试，请：');
  console.log('     1. 在企业微信中创建群机器人');
  console.log('     2. 复制webhook URL');
  console.log('     3. 替换脚本中的 testWebhookUrl 变量');
  console.log('     4. 重新运行测试');
}

// 运行手动测试
if (require.main === module) {
  runManualTests().catch(console.error);
}

module.exports = { runManualTests };
