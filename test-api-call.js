/**
 * 测试用户企业微信配置API调用
 * 模拟前端的API请求来诊断问题
 */

// 使用内置的fetch (Node.js 18+)
const fetch = globalThis.fetch || require('node-fetch');

// 测试配置
const API_BASE_URL = 'http://localhost:3000/api';
const testWebhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=c0c1b86a-a458-4731-a855-0716eed4a23b';

// 测试用户登录信息 - 使用现有用户
const testUser = {
  email: '1767673917@qq.com',
  password: '123456'  // 假设这是密码，如果不对需要调整
};

console.log('🔧 开始测试用户企业微信配置API...\n');

// 步骤1: 用户登录获取token
async function loginUser() {
  console.log('1. 用户登录...');

  try {
    const response = await fetch(`${API_BASE_URL}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser)
    });

    const responseText = await response.text();
    console.log(`   响应状态: ${response.status}`);
    console.log(`   响应内容: ${responseText}`);

    if (!response.ok) {
      throw new Error(`登录失败: ${response.status} ${responseText}`);
    }

    const result = JSON.parse(responseText);
    console.log('   ✅ 登录成功');
    console.log(`   用户ID: ${result.user.id}`);
    console.log(`   邮箱: ${result.user.email}\n`);

    return result.accessToken;
  } catch (error) {
    console.error('   ❌ 登录失败:', error.message);
    throw error;
  }
}

// 步骤2: 获取当前企业微信配置
async function getCurrentConfig(token) {
  console.log('2. 获取当前企业微信配置...');

  try {
    const response = await fetch(`${API_BASE_URL}/users/me/wechat-config`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    const responseText = await response.text();
    console.log(`   响应状态: ${response.status}`);
    console.log(`   响应内容: ${responseText}`);

    if (!response.ok) {
      throw new Error(`获取配置失败: ${response.status} ${responseText}`);
    }

    const result = JSON.parse(responseText);
    console.log('   ✅ 获取配置成功');
    console.log(`   当前Webhook URL: ${result.wechat_webhook_url || '(未设置)'}`);
    console.log(`   通知启用: ${result.wechat_notification_enabled ? '是' : '否'}\n`);

    return result;
  } catch (error) {
    console.error('   ❌ 获取配置失败:', error.message);
    throw error;
  }
}

// 步骤3: 更新企业微信配置
async function updateWechatConfig(token) {
  console.log('3. 更新企业微信配置...');

  const configData = {
    wechat_webhook_url: testWebhookUrl,
    wechat_notification_enabled: true
  };

  console.log('   发送的配置数据:');
  console.log(`   - Webhook URL: ${configData.wechat_webhook_url}`);
  console.log(`   - 通知启用: ${configData.wechat_notification_enabled}`);

  try {
    const response = await fetch(`${API_BASE_URL}/users/me/wechat-config`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(configData)
    });

    const responseText = await response.text();
    console.log(`   响应状态: ${response.status}`);
    console.log(`   响应内容: ${responseText}`);

    if (!response.ok) {
      console.error('   ❌ 更新配置失败');

      // 尝试解析错误信息
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.errors) {
          console.error('   验证错误:');
          errorData.errors.forEach(err => {
            console.error(`   - ${err.msg}: ${err.param}`);
          });
        } else {
          console.error(`   错误信息: ${errorData.error || errorData.message}`);
        }
      } catch (parseError) {
        console.error(`   原始错误: ${responseText}`);
      }

      throw new Error(`更新配置失败: ${response.status}`);
    }

    const result = JSON.parse(responseText);
    console.log('   ✅ 更新配置成功');
    console.log(`   返回消息: ${result.message}`);
    console.log(`   新Webhook URL: ${result.wechat_webhook_url || '(未设置)'}`);
    console.log(`   新通知状态: ${result.wechat_notification_enabled ? '启用' : '禁用'}\n`);

    return result;
  } catch (error) {
    console.error('   ❌ 更新配置失败:', error.message);
    throw error;
  }
}

// 步骤4: 验证配置是否保存成功
async function verifyConfigSaved(token) {
  console.log('4. 验证配置是否保存成功...');

  try {
    const response = await fetch(`${API_BASE_URL}/users/me/wechat-config`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    const responseText = await response.text();
    console.log(`   响应状态: ${response.status}`);

    if (!response.ok) {
      throw new Error(`验证失败: ${response.status} ${responseText}`);
    }

    const result = JSON.parse(responseText);
    console.log('   ✅ 验证成功');
    console.log(`   保存的Webhook URL: ${result.wechat_webhook_url || '(未设置)'}`);
    console.log(`   保存的通知状态: ${result.wechat_notification_enabled ? '启用' : '禁用'}`);

    // 检查是否与预期一致
    if (result.wechat_webhook_url === testWebhookUrl && result.wechat_notification_enabled === true) {
      console.log('   🎉 配置保存验证通过！\n');
      return true;
    } else {
      console.log('   ❌ 配置保存验证失败，数据不匹配\n');
      return false;
    }
  } catch (error) {
    console.error('   ❌ 验证失败:', error.message);
    throw error;
  }
}

// 运行完整测试
async function runCompleteTest() {
  try {
    const token = await loginUser();
    await getCurrentConfig(token);
    await updateWechatConfig(token);
    const verified = await verifyConfigSaved(token);

    if (verified) {
      console.log('🎉 所有测试通过！用户企业微信配置功能正常工作。');
      console.log('\n✅ 功能验证:');
      console.log('   - 用户登录正常');
      console.log('   - 获取配置正常');
      console.log('   - 更新配置正常');
      console.log('   - 配置保存正常');
      console.log('   - 数据持久化正常');
    } else {
      console.log('❌ 测试失败：配置保存验证不通过');
    }

  } catch (error) {
    console.error('\n💥 测试过程中发生错误:', error.message);
    console.log('\n🔍 可能的问题:');
    console.log('   1. 用户不存在或密码错误');
    console.log('   2. API路由配置问题');
    console.log('   3. 数据库连接问题');
    console.log('   4. 验证规则过于严格');
    console.log('   5. 权限认证问题');
  }
}

// 启动测试
runCompleteTest();
