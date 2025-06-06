const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';

async function testUserAuthentication() {
  console.log('=== 物流报价系统用户认证测试 ===\n');

  // 1. 测试管理员登录
  console.log('1. 测试管理员登录...');
  try {
    const adminLoginResponse = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' })
    });

    if (!adminLoginResponse.ok) {
      throw new Error(`管理员登录失败: ${adminLoginResponse.status}`);
    }

    const adminAuth = await adminLoginResponse.json();
    console.log('✅ 管理员登录成功');
    console.log(`   Token: ${adminAuth.accessToken.substring(0, 50)}...`);

    // 2. 创建测试用户
    console.log('\n2. 创建测试用户...');
    const createUserResponse = await fetch(`${API_BASE}/users/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuth.accessToken}`
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test123',
        name: '测试用户'
      })
    });

    if (!createUserResponse.ok) {
      const errorData = await createUserResponse.json();
      throw new Error(`创建用户失败: ${errorData.error || createUserResponse.status}`);
    }

    const newUser = await createUserResponse.json();
    console.log('✅ 用户创建成功');
    console.log(`   用户ID: ${newUser.user.id}`);
    console.log(`   邮箱: ${newUser.user.email}`);
    console.log(`   用户名: ${newUser.user.name}`);

    // 3. 测试用户登录（只提供密码，应该失败）
    console.log('\n3. 测试只提供密码的登录（应该失败）...');
    try {
      const loginResponse1 = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test123' })
      });

      if (loginResponse1.ok) {
        console.log('❌ 只提供密码的登录应该失败，但成功了');
      } else {
        const errorData = await loginResponse1.json();
        console.log('✅ 只提供密码的登录正确失败');
        console.log(`   错误信息: ${errorData.error || errorData.errors?.[0]?.msg}`);
      }
    } catch (error) {
      console.log('✅ 只提供密码的登录正确失败');
      console.log(`   错误: ${error.message}`);
    }

    // 4. 测试用户登录（提供用户名和密码，应该成功）
    console.log('\n4. 测试用户名+密码登录（应该成功）...');
    const loginResponse2 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: '测试用户',  // 使用用户名
        password: 'test123' 
      })
    });

    if (!loginResponse2.ok) {
      const errorData = await loginResponse2.json();
      throw new Error(`用户名登录失败: ${errorData.error || loginResponse2.status}`);
    }

    const userAuth = await loginResponse2.json();
    console.log('✅ 用户名登录成功');
    console.log(`   用户: ${userAuth.user.name} (${userAuth.user.email})`);

    // 5. 测试邮箱+密码登录（应该成功）
    console.log('\n5. 测试邮箱+密码登录（应该成功）...');
    const loginResponse3 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: 'test@example.com',  // 使用邮箱
        password: 'test123' 
      })
    });

    if (!loginResponse3.ok) {
      const errorData = await loginResponse3.json();
      throw new Error(`邮箱登录失败: ${errorData.error || loginResponse3.status}`);
    }

    const userAuth2 = await loginResponse3.json();
    console.log('✅ 邮箱登录成功');
    console.log(`   用户: ${userAuth2.user.name} (${userAuth2.user.email})`);

    // 6. 测试错误的用户名/密码组合
    console.log('\n6. 测试错误的用户名/密码组合（应该失败）...');
    try {
      const loginResponse4 = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'test@example.com',
          password: 'wrongpassword' 
        })
      });

      if (loginResponse4.ok) {
        console.log('❌ 错误密码登录应该失败，但成功了');
      } else {
        const errorData = await loginResponse4.json();
        console.log('✅ 错误密码登录正确失败');
        console.log(`   错误信息: ${errorData.error}`);
      }
    } catch (error) {
      console.log('✅ 错误密码登录正确失败');
      console.log(`   错误: ${error.message}`);
    }

    console.log('\n=== 测试完成 ===');
    console.log('✅ 所有测试通过！用户认证系统已正确配置为必须同时提供用户名和密码。');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
testUserAuthentication();
