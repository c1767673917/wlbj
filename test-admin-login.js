const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';

async function testAdminLogin() {
  console.log('=== 管理员登录测试 ===\n');

  try {
    // 测试管理员登录
    console.log('1. 测试管理员登录...');
    const adminLoginResponse = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' })
    });

    if (!adminLoginResponse.ok) {
      const errorData = await adminLoginResponse.json();
      throw new Error(`管理员登录失败: ${errorData.error || adminLoginResponse.status}`);
    }

    const adminAuth = await adminLoginResponse.json();
    console.log('✅ 管理员登录成功');
    console.log(`   用户: ${adminAuth.user.name} (${adminAuth.user.email})`);
    console.log(`   角色: ${adminAuth.user.role}`);
    console.log(`   Token: ${adminAuth.accessToken.substring(0, 50)}...`);

    // 测试管理员统计信息API
    console.log('\n2. 测试管理员统计信息API...');
    const statsResponse = await fetch(`${API_BASE}/admin/stats`, {
      headers: {
        'Authorization': `Bearer ${adminAuth.accessToken}`
      }
    });

    if (!statsResponse.ok) {
      const errorData = await statsResponse.json();
      throw new Error(`获取统计信息失败: ${errorData.error || statsResponse.status}`);
    }

    const stats = await statsResponse.json();
    console.log('✅ 统计信息获取成功');
    console.log(`   总用户数: ${stats.users.total}`);
    console.log(`   活跃用户: ${stats.users.active}`);
    console.log(`   总订单数: ${stats.orders.total}`);
    console.log(`   物流公司数: ${stats.providers.total}`);

    console.log('\n=== 测试完成 ===');
    console.log('✅ 管理员登录和API访问正常！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
testAdminLogin();
