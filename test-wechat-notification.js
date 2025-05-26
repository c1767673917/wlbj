/**
 * 企业微信群机器人通知功能测试脚本
 * 用于测试企业微信通知功能是否正常工作
 */

const { 
  validateWechatWebhookUrl, 
  generateOrderNotificationMessage, 
  notifyProviderNewOrder 
} = require('./utils/wechatNotification');

// 测试数据
const testOrder = {
  id: 'TEST-ORDER-001',
  warehouse: '广州仓',
  goods: '清香牛肉579箱，香辣味1321箱，大骨牛肉500箱，番茄牛肉600箱，需要按口味码放整齐，混码装卸仓库拒收',
  deliveryAddress: '河南省漯河市临颍县繁阳路南侧经一路西侧 临颍县恒烨实业有限公司 时会丽 15839591235 必须提前一天电话预约仓库送货',
  createdAt: new Date().toISOString()
};

const testProviderName = '测试物流公司';

// 测试webhook URL（请替换为实际的webhook URL进行测试）
const testWebhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=TEST_KEY_REPLACE_WITH_REAL_KEY';

async function runTests() {
  console.log('🚀 开始测试企业微信群机器人通知功能...\n');

  // 测试1: URL格式验证
  console.log('📋 测试1: webhook URL格式验证');
  
  const validUrls = [
    'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc123',
    'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-key_123'
  ];
  
  const invalidUrls = [
    'http://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc123', // http instead of https
    'https://qyapi.weixin.qq.com/cgi-bin/webhook/send', // missing key
    'https://example.com/webhook', // wrong domain
    'not-a-url'
  ];

  validUrls.forEach(url => {
    const isValid = validateWechatWebhookUrl(url);
    console.log(`  ✅ ${url} - ${isValid ? '有效' : '无效'}`);
  });

  invalidUrls.forEach(url => {
    const isValid = validateWechatWebhookUrl(url);
    console.log(`  ❌ ${url} - ${isValid ? '有效' : '无效'}`);
  });

  console.log('\n📋 测试2: 消息内容生成');
  
  // 测试2: 消息生成
  const message = generateOrderNotificationMessage(testOrder, testProviderName);
  console.log('  生成的消息内容:');
  console.log('  ---');
  console.log(message.markdown.content);
  console.log('  ---\n');

  // 测试3: 实际发送（需要真实的webhook URL）
  console.log('📋 测试3: 消息发送测试');
  
  if (testWebhookUrl.includes('TEST_KEY_REPLACE_WITH_REAL_KEY')) {
    console.log('  ⚠️  跳过实际发送测试 - 请在脚本中配置真实的webhook URL');
    console.log('  💡 要进行实际测试，请：');
    console.log('     1. 在企业微信中创建群机器人');
    console.log('     2. 复制webhook URL');
    console.log('     3. 替换脚本中的 testWebhookUrl 变量');
    console.log('     4. 重新运行测试');
  } else {
    console.log('  🚀 正在发送测试消息...');
    try {
      const result = await notifyProviderNewOrder(testOrder, testProviderName, testWebhookUrl);
      if (result.success) {
        console.log('  ✅ 消息发送成功！');
        console.log(`  📝 响应: ${result.message}`);
      } else {
        console.log('  ❌ 消息发送失败！');
        console.log(`  📝 错误: ${result.message}`);
      }
    } catch (error) {
      console.log('  ❌ 发送过程中出现异常！');
      console.log(`  📝 错误: ${error.message}`);
    }
  }

  console.log('\n🎉 测试完成！');
  console.log('\n📚 使用说明：');
  console.log('1. 在物流公司管理页面配置企业微信webhook URL');
  console.log('2. 发布新订单时系统会自动发送通知');
  console.log('3. 查看服务器日志了解发送状态');
}

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
