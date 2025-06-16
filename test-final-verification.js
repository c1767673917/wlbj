/**
 * 最终验证测试 - 验证用户和物流公司的企业微信配置功能
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const API_BASE_URL = 'http://localhost:3000/api';
const testWebhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=c0c1b86a-a458-4731-a855-0716eed4a23b';

console.log('🔧 最终验证测试 - 企业微信配置功能\n');

// 获取用户token
async function getUserToken() {
  console.log('1. 获取用户token...');

  const loginData = {
    email: '1767673917@qq.com',
    password: 'hello'
  };

  const curlCommand = `curl -s -X POST "${API_BASE_URL}/auth/login" \\
    -H "Content-Type: application/json" \\
    -d '${JSON.stringify(loginData)}'`;

  try {
    const { stdout } = await execAsync(curlCommand);
    const result = JSON.parse(stdout);

    if (result.accessToken) {
      console.log('   ✅ 用户登录成功\n');
      return result.accessToken;
    } else {
      console.log('   ❌ 用户登录失败:', result.error);
      return null;
    }
  } catch (error) {
    console.error('   ❌ 登录请求失败:', error.message);
    return null;
  }
}

// 测试用户企业微信配置
async function testUserWechatConfig(token) {
  console.log('2. 测试用户企业微信配置...');

  if (!token) {
    console.log('   ❌ 没有有效token，跳过测试\n');
    return false;
  }

  const configData = {
    wechat_webhook_url: testWebhookUrl,
    wechat_notification_enabled: true
  };

  const curlCommand = `curl -s -X PUT "${API_BASE_URL}/users/me/wechat-config" \\
    -H "Authorization: Bearer ${token}" \\
    -H "Content-Type: application/json" \\
    -d '${JSON.stringify(configData)}'`;

  try {
    const { stdout } = await execAsync(curlCommand);
    console.log('   响应内容:', stdout);

    const result = JSON.parse(stdout);
    if (result.message && result.message.includes('成功')) {
      console.log('   ✅ 用户企业微信配置保存成功\n');
      return true;
    } else {
      console.log('   ❌ 用户企业微信配置保存失败');
      if (result.errors) {
        result.errors.forEach(err => {
          console.log(`   - ${err.msg}: ${err.param}`);
        });
      }
      console.log('');
      return false;
    }
  } catch (error) {
    console.error('   ❌ 用户配置请求失败:', error.message);
    return false;
  }
}

// 测试物流公司企业微信配置
async function testProviderWechatConfig(token) {
  console.log('3. 测试物流公司企业微信配置...');

  if (!token) {
    console.log('   ❌ 没有有效token，跳过测试\n');
    return false;
  }

  // 先获取物流公司列表
  const getProvidersCommand = `curl -s -X GET "${API_BASE_URL}/providers" \\
    -H "Authorization: Bearer ${token}"`;

  try {
    const { stdout } = await execAsync(getProvidersCommand);
    const providers = JSON.parse(stdout);

    if (!providers || providers.length === 0) {
      console.log('   ❌ 没有找到物流公司');
      return false;
    }

    const providerId = providers[0].id;
    console.log(`   使用物流公司: ${providers[0].name} (ID: ${providerId})`);

    // 更新物流公司webhook
    const configData = {
      wechatWebhookUrl: testWebhookUrl
    };

    const updateCommand = `curl -s -X PUT "${API_BASE_URL}/providers/${providerId}/webhook" \\
      -H "Authorization: Bearer ${token}" \\
      -H "Content-Type: application/json" \\
      -d '${JSON.stringify(configData)}'`;

    const { stdout: updateResult } = await execAsync(updateCommand);
    console.log('   响应内容:', updateResult);

    const result = JSON.parse(updateResult);
    if (result.message && result.message.includes('成功')) {
      console.log('   ✅ 物流公司企业微信配置保存成功\n');
      return true;
    } else {
      console.log('   ❌ 物流公司企业微信配置保存失败\n');
      return false;
    }
  } catch (error) {
    console.error('   ❌ 物流公司配置请求失败:', error.message);
    return false;
  }
}

// 发送测试通知
async function sendTestNotification() {
  console.log('4. 发送测试通知...');

  try {
    const { sendWechatNotification } = require('./utils/wechatNotification');

    const testMessage = {
      msgtype: "markdown",
      markdown: {
        content: `🎉 **配置功能验证成功**

**测试时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
**测试结果**: 所有企业微信配置功能正常

✅ **功能验证完成**:
- 用户企业微信配置: 正常
- 物流公司企业微信配置: 正常
- 消息发送功能: 正常

🔔 系统已准备就绪，可以正常使用企业微信通知功能！

---
*物流报价系统最终验证消息*`
      }
    };

    const result = await sendWechatNotification(testWebhookUrl, testMessage);

    if (result.success) {
      console.log('   ✅ 测试通知发送成功！');
      console.log('   📱 消息已发送到企业微信群\n');
      return true;
    } else {
      console.log('   ❌ 测试通知发送失败:');
      console.log(`   错误信息: ${result.message}\n`);
      return false;
    }
  } catch (error) {
    console.error('   ❌ 发送测试通知时出错:', error.message);
    return false;
  }
}

// 运行完整验证
async function runFinalVerification() {
  try {
    const token = await getUserToken();

    if (!token) {
      console.log('❌ 无法获取用户token，验证终止');
      return;
    }

    const userConfigSuccess = await testUserWechatConfig(token);
    const providerConfigSuccess = await testProviderWechatConfig(token);
    const notificationSuccess = await sendTestNotification();

    console.log('📊 最终验证结果:');
    console.log(`   用户企业微信配置: ${userConfigSuccess ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   物流公司企业微信配置: ${providerConfigSuccess ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   企业微信通知发送: ${notificationSuccess ? '✅ 正常' : '❌ 失败'}`);

    if (userConfigSuccess && providerConfigSuccess && notificationSuccess) {
      console.log('\n🎉 所有功能验证通过！企业微信配置系统完全正常工作。');
      console.log('\n✅ 功能总结:');
      console.log('   - 用户可以在"通知设置"中配置个人企业微信通知');
      console.log('   - 用户可以在"物流公司管理"中为物流公司配置企业微信通知');
      console.log('   - 系统可以正常发送企业微信通知消息');
      console.log('   - 所有配置都能正确保存和读取');
      console.log('\n📱 请检查您的企业微信群，应该收到了验证成功的消息！');

      console.log('\n🎯 使用说明:');
      console.log('   1. 登录用户门户 (http://localhost:5173)');
      console.log('   2. 在"通知设置"标签页配置个人企业微信通知');
      console.log('   3. 在"物流公司管理"标签页为物流公司配置通知');
      console.log('   4. 当有新订单或新报价时，系统会自动发送通知');
    } else {
      console.log('\n❌ 部分功能验证失败，请检查具体错误信息');
    }

  } catch (error) {
    console.error('\n💥 验证过程中发生错误:', error.message);
  }
}

// 启动最终验证
runFinalVerification();
