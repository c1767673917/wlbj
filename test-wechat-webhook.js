/**
 * 企业微信Webhook URL测试脚本
 * 测试用户提供的企业微信webhook是否能正常接收消息
 */

const { 
  generateOrderNotificationMessage, 
  generateUserQuoteNotificationMessage,
  sendWechatNotification 
} = require('./utils/wechatNotification');

// 用户提供的企业微信webhook URL
const testWebhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=c0c1b86a-a458-4731-a855-0716eed4a23b';

// 测试订单数据
const testOrder = {
  id: 'RX250616-TEST',
  warehouse: '广州仓',
  goods: '清香牛肉579箱，香辣味1321箱，大骨牛肉500箱，番茄牛肉600箱',
  deliveryAddress: '河南省漯河市临颍县繁阳路南侧经一路西侧 临颍县恒烨实业有限公司 时会丽 15839591235',
  createdAt: new Date().toISOString(),
  userId: 'test-user-001'
};

// 测试报价数据
const testQuote = {
  id: 'quote-test-001',
  orderId: 'RX250616-TEST',
  provider: '顺丰速运',
  price: 1580.00,
  estimatedDelivery: '2-3个工作日',
  createdAt: new Date().toISOString()
};

// 测试用户数据
const testUser = {
  id: 'test-user-001',
  email: 'test@example.com',
  name: '测试用户'
};

console.log('🚀 开始测试企业微信Webhook功能...\n');
console.log(`📡 测试URL: ${testWebhookUrl}\n`);

// 测试1: 发送订单通知消息
async function testOrderNotification() {
  console.log('1. 测试订单通知消息...');
  
  try {
    const message = generateOrderNotificationMessage(testOrder, '测试物流公司');
    console.log('   生成的消息内容:');
    console.log('   ' + message.markdown.content.split('\n').join('\n   '));
    
    const result = await sendWechatNotification(testWebhookUrl, message);
    
    if (result.success) {
      console.log('   ✅ 订单通知发送成功！');
      console.log(`   📱 消息已发送到企业微信群\n`);
      return true;
    } else {
      console.log('   ❌ 订单通知发送失败:');
      console.log(`   错误信息: ${result.message}`);
      console.log(`   详细错误:`, result.error);
      return false;
    }
  } catch (error) {
    console.log('   ❌ 订单通知测试出错:');
    console.log(`   错误信息: ${error.message}\n`);
    return false;
  }
}

// 测试2: 发送用户报价通知消息
async function testUserQuoteNotification() {
  console.log('2. 测试用户报价通知消息...');
  
  try {
    const message = generateUserQuoteNotificationMessage(testOrder, testQuote, testUser);
    console.log('   生成的消息内容:');
    console.log('   ' + message.markdown.content.split('\n').join('\n   '));
    
    const result = await sendWechatNotification(testWebhookUrl, message);
    
    if (result.success) {
      console.log('   ✅ 用户报价通知发送成功！');
      console.log(`   📱 消息已发送到企业微信群\n`);
      return true;
    } else {
      console.log('   ❌ 用户报价通知发送失败:');
      console.log(`   错误信息: ${result.message}`);
      console.log(`   详细错误:`, result.error);
      return false;
    }
  } catch (error) {
    console.log('   ❌ 用户报价通知测试出错:');
    console.log(`   错误信息: ${error.message}\n`);
    return false;
  }
}

// 测试3: 发送简单测试消息
async function testSimpleMessage() {
  console.log('3. 测试简单消息...');
  
  try {
    const message = {
      msgtype: "markdown",
      markdown: {
        content: `🧪 **企业微信通知功能测试**

**测试时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
**测试状态**: 功能正常
**系统**: 瑞勋物流报价平台

✅ 如果您看到这条消息，说明企业微信通知功能已正常工作！

---
*物流报价系统自动测试消息*`
      }
    };
    
    console.log('   生成的消息内容:');
    console.log('   ' + message.markdown.content.split('\n').join('\n   '));
    
    const result = await sendWechatNotification(testWebhookUrl, message);
    
    if (result.success) {
      console.log('   ✅ 简单测试消息发送成功！');
      console.log(`   📱 消息已发送到企业微信群\n`);
      return true;
    } else {
      console.log('   ❌ 简单测试消息发送失败:');
      console.log(`   错误信息: ${result.message}`);
      console.log(`   详细错误:`, result.error);
      return false;
    }
  } catch (error) {
    console.log('   ❌ 简单测试消息出错:');
    console.log(`   错误信息: ${error.message}\n`);
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  const results = [];
  
  // 等待2秒，避免发送过快
  console.log('⏳ 准备发送测试消息...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  results.push(await testSimpleMessage());
  
  // 等待3秒
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  results.push(await testOrderNotification());
  
  // 等待3秒
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  results.push(await testUserQuoteNotification());
  
  // 测试结果汇总
  const successCount = results.filter(r => r).length;
  const totalCount = results.length;
  
  console.log('📊 测试结果汇总:');
  console.log(`   成功: ${successCount}/${totalCount}`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 所有测试通过！企业微信通知功能正常工作。');
    console.log('\n✅ 功能验证:');
    console.log('   - 企业微信webhook URL有效');
    console.log('   - 消息格式正确');
    console.log('   - 网络连接正常');
    console.log('   - 订单通知功能可用');
    console.log('   - 用户报价通知功能可用');
    console.log('\n📱 请检查您的企业微信群，应该已收到3条测试消息。');
  } else {
    console.log('\n❌ 部分测试失败，请检查:');
    console.log('   1. 企业微信webhook URL是否正确');
    console.log('   2. 机器人是否已添加到群聊');
    console.log('   3. 网络连接是否正常');
    console.log('   4. 企业微信群是否允许接收消息');
  }
}

// 启动测试
runAllTests().catch(error => {
  console.error('\n💥 测试过程中发生未预期的错误:', error);
});
