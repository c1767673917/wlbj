/**
 * 使用curl命令测试API端点
 * 绕过登录问题，直接测试API功能
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const API_BASE_URL = 'http://localhost:3000/api';
const testWebhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=c0c1b86a-a458-4731-a855-0716eed4a23b';

console.log('🔧 使用curl测试用户企业微信配置API...\n');

// 测试1: 用户登录获取token
async function loginWithCurl() {
  console.log('1. 用户登录获取token...');
  
  const loginData = {
    email: '1767673917@qq.com',
    password: '123456'
  };

  const curlCommand = `curl -s -X POST "${API_BASE_URL}/users/login" \\
    -H "Content-Type: application/json" \\
    -d '${JSON.stringify(loginData)}'`;

  try {
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.error('   ❌ curl错误:', stderr);
      throw new Error(stderr);
    }

    console.log('   响应内容:', stdout);
    
    try {
      const result = JSON.parse(stdout);
      if (result.accessToken) {
        console.log('   ✅ 登录成功');
        console.log(`   用户: ${result.user.email}\n`);
        return result.accessToken;
      } else {
        console.log('   ❌ 登录失败:', result.error || '未知错误');
        return null;
      }
    } catch (parseError) {
      console.error('   ❌ 解析响应失败:', parseError.message);
      return null;
    }
  } catch (error) {
    console.error('   ❌ 登录请求失败:', error.message);
    return null;
  }
}

// 测试2: 获取当前企业微信配置
async function getWechatConfigWithCurl(token) {
  console.log('2. 获取当前企业微信配置...');
  
  if (!token) {
    console.log('   ❌ 没有有效的token，跳过测试\n');
    return null;
  }

  const curlCommand = `curl -s -X GET "${API_BASE_URL}/users/me/wechat-config" \\
    -H "Authorization: Bearer ${token}" \\
    -H "Content-Type: application/json"`;

  try {
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.error('   ❌ curl错误:', stderr);
      throw new Error(stderr);
    }

    console.log('   响应内容:', stdout);
    
    try {
      const result = JSON.parse(stdout);
      console.log('   ✅ 获取配置成功');
      console.log(`   当前Webhook URL: ${result.wechat_webhook_url || '(未设置)'}`);
      console.log(`   通知启用: ${result.wechat_notification_enabled ? '是' : '否'}\n`);
      return result;
    } catch (parseError) {
      console.error('   ❌ 解析响应失败:', parseError.message);
      return null;
    }
  } catch (error) {
    console.error('   ❌ 获取配置请求失败:', error.message);
    return null;
  }
}

// 测试3: 更新企业微信配置
async function updateWechatConfigWithCurl(token) {
  console.log('3. 更新企业微信配置...');
  
  if (!token) {
    console.log('   ❌ 没有有效的token，跳过测试\n');
    return false;
  }

  const configData = {
    wechat_webhook_url: testWebhookUrl,
    wechat_notification_enabled: true
  };

  console.log('   发送的配置数据:');
  console.log(`   - Webhook URL: ${configData.wechat_webhook_url}`);
  console.log(`   - 通知启用: ${configData.wechat_notification_enabled}`);

  const curlCommand = `curl -s -X PUT "${API_BASE_URL}/users/me/wechat-config" \\
    -H "Authorization: Bearer ${token}" \\
    -H "Content-Type: application/json" \\
    -d '${JSON.stringify(configData)}'`;

  try {
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.error('   ❌ curl错误:', stderr);
      throw new Error(stderr);
    }

    console.log('   响应内容:', stdout);
    
    try {
      const result = JSON.parse(stdout);
      if (result.message && result.message.includes('成功')) {
        console.log('   ✅ 更新配置成功');
        console.log(`   返回消息: ${result.message}\n`);
        return true;
      } else {
        console.log('   ❌ 更新配置失败');
        if (result.errors) {
          console.log('   验证错误:');
          result.errors.forEach(err => {
            console.log(`   - ${err.msg}: ${err.param}`);
          });
        } else {
          console.log(`   错误信息: ${result.error || result.message || '未知错误'}`);
        }
        console.log('');
        return false;
      }
    } catch (parseError) {
      console.error('   ❌ 解析响应失败:', parseError.message);
      console.log('   原始响应:', stdout);
      return false;
    }
  } catch (error) {
    console.error('   ❌ 更新配置请求失败:', error.message);
    return false;
  }
}

// 测试4: 验证配置是否保存成功
async function verifyConfigWithCurl(token) {
  console.log('4. 验证配置是否保存成功...');
  
  if (!token) {
    console.log('   ❌ 没有有效的token，跳过测试\n');
    return false;
  }

  const curlCommand = `curl -s -X GET "${API_BASE_URL}/users/me/wechat-config" \\
    -H "Authorization: Bearer ${token}" \\
    -H "Content-Type: application/json"`;

  try {
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.error('   ❌ curl错误:', stderr);
      throw new Error(stderr);
    }

    console.log('   响应内容:', stdout);
    
    try {
      const result = JSON.parse(stdout);
      console.log('   ✅ 验证成功');
      console.log(`   保存的Webhook URL: ${result.wechat_webhook_url || '(未设置)'}`);
      console.log(`   保存的通知状态: ${result.wechat_notification_enabled ? '启用' : '禁用'}`);
      
      // 检查是否与预期一致
      const urlMatches = result.wechat_webhook_url === testWebhookUrl;
      const enabledMatches = result.wechat_notification_enabled === true;
      
      console.log(`   URL匹配: ${urlMatches ? '✅' : '❌'}`);
      console.log(`   状态匹配: ${enabledMatches ? '✅' : '❌'}\n`);
      
      return urlMatches && enabledMatches;
    } catch (parseError) {
      console.error('   ❌ 解析响应失败:', parseError.message);
      return false;
    }
  } catch (error) {
    console.error('   ❌ 验证请求失败:', error.message);
    return false;
  }
}

// 运行完整测试
async function runCompleteTest() {
  try {
    const token = await loginWithCurl();
    
    if (!token) {
      console.log('❌ 无法获取有效token，测试终止');
      console.log('\n🔍 可能的问题:');
      console.log('   1. 用户邮箱或密码错误');
      console.log('   2. 用户账户被禁用');
      console.log('   3. 服务器认证配置问题');
      return;
    }
    
    await getWechatConfigWithCurl(token);
    const updateSuccess = await updateWechatConfigWithCurl(token);
    
    if (updateSuccess) {
      const verifySuccess = await verifyConfigWithCurl(token);
      
      if (verifySuccess) {
        console.log('🎉 所有测试通过！用户企业微信配置API功能正常工作。');
        console.log('\n✅ 功能验证:');
        console.log('   - 用户登录正常');
        console.log('   - 获取配置正常');
        console.log('   - 更新配置正常');
        console.log('   - 配置保存正常');
        console.log('   - 数据持久化正常');
      } else {
        console.log('❌ 配置保存验证失败');
      }
    } else {
      console.log('❌ 配置更新失败，请检查API验证逻辑');
    }
    
  } catch (error) {
    console.error('\n💥 测试过程中发生错误:', error.message);
  }
}

// 启动测试
runCompleteTest();
