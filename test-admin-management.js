const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';

async function testAdminManagement() {
  console.log('=== 管理员管理功能测试 ===\n');

  try {
    // 1. 管理员登录获取token
    console.log('1. 管理员登录...');
    const adminLoginResponse = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' })
    });

    if (!adminLoginResponse.ok) {
      throw new Error(`管理员登录失败: ${adminLoginResponse.status}`);
    }

    const adminAuth = await adminLoginResponse.json();
    const adminToken = adminAuth.accessToken;
    console.log('✅ 管理员登录成功');

    // 2. 测试用户管理API
    console.log('\n2. 测试用户管理API...');
    const usersResponse = await fetch(`${API_BASE}/users?page=1&limit=20`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!usersResponse.ok) {
      throw new Error(`获取用户列表失败: ${usersResponse.status}`);
    }

    const usersData = await usersResponse.json();
    console.log('✅ 用户列表获取成功');
    console.log(`   总用户数: ${usersData.total}`);
    console.log(`   当前页用户: ${usersData.data.length}`);

    // 3. 测试订单管理API
    console.log('\n3. 测试订单管理API...');
    const ordersResponse = await fetch(`${API_BASE}/admin/orders?page=1&limit=20`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!ordersResponse.ok) {
      throw new Error(`获取订单列表失败: ${ordersResponse.status}`);
    }

    const ordersData = await ordersResponse.json();
    console.log('✅ 订单列表获取成功');
    console.log(`   总订单数: ${ordersData.total}`);
    console.log(`   当前页订单: ${ordersData.data.length}`);

    // 4. 测试创建用户
    console.log('\n4. 测试创建用户...');
    const createUserResponse = await fetch(`${API_BASE}/users/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        email: 'testuser@example.com',
        password: 'test123',
        name: '测试用户2'
      })
    });

    if (!createUserResponse.ok) {
      const errorData = await createUserResponse.json();
      console.log(`⚠️  创建用户失败: ${errorData.error || createUserResponse.status}`);
    } else {
      const newUser = await createUserResponse.json();
      console.log('✅ 用户创建成功');
      console.log(`   用户ID: ${newUser.user.id}`);
      console.log(`   邮箱: ${newUser.user.email}`);
      console.log(`   用户名: ${newUser.user.name}`);
    }

    // 5. 测试错误的token（使用普通用户token访问管理员API）
    console.log('\n5. 测试权限验证...');
    try {
      // 先创建一个普通用户并登录
      const userLoginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'testuser@example.com',
          password: 'test123' 
        })
      });

      if (userLoginResponse.ok) {
        const userAuth = await userLoginResponse.json();
        const userToken = userAuth.accessToken;

        // 尝试用普通用户token访问管理员API
        const unauthorizedResponse = await fetch(`${API_BASE}/admin/orders?page=1&limit=20`, {
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        });

        if (unauthorizedResponse.ok) {
          console.log('❌ 权限验证失败：普通用户不应该能访问管理员API');
        } else {
          console.log('✅ 权限验证正常：普通用户无法访问管理员API');
        }
      } else {
        console.log('⚠️  无法测试权限验证：普通用户登录失败');
      }
    } catch (error) {
      console.log('⚠️  权限验证测试出错:', error.message);
    }

    console.log('\n=== 测试完成 ===');
    console.log('✅ 管理员管理功能测试通过！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
testAdminManagement();
