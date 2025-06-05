// 测试API连接的脚本
const https = require('https');
const http = require('http');
const { URL } = require('url');

const API_BASE_URL = 'http://localhost:3000/api';

async function adminLogin() {
  console.log('开始测试管理员登录...\n');

  try {
    const loginData = {
      password: 'shrx', // 从 .env 获取的 APP_PASSWORD
      role: 'admin'    // 从 utils/auth.js 确认的管理员角色
    };

    console.log('登录请求数据:', JSON.stringify(loginData, null, 2));

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ 登录失败:', responseData);
      throw new Error(`登录请求失败: ${response.status} ${response.statusText}`);
    }
    
    console.log('✅ 管理员登录成功:');
    console.log('   - Access Token:', responseData.accessToken);
    console.log('   - Refresh Token:', responseData.refreshToken);
    console.log('   - User Info:', JSON.stringify(responseData.user, null, 2));

    // 后续可以使用 accessToken 进行其他管理员操作的测试
    // 例如: const adminToken = responseData.accessToken;
    // await testAdminFunction(adminToken);

  } catch (error) {
    console.error('❌ 管理员登录测试失败:', error.message);
    if (error.response) {
        const errorData = await error.response.json();
        console.error('错误详情:', errorData);
    }
  }
}

adminLogin();
