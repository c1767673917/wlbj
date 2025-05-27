// 测试API连接的脚本
const https = require('https');
const http = require('http');
const { URL } = require('url');

const API_BASE_URL = 'http://localhost:3000/api';

async function testAPI() {
  console.log('开始测试API连接...\n');

  try {
    // 测试获取订单列表
    console.log('1. 测试获取订单列表...');
    const ordersResponse = await fetch(`${API_BASE_URL}/orders`);
    const ordersData = await ordersResponse.json();
    console.log('✅ 订单列表获取成功:', ordersData);
    console.log(`   - 总订单数: ${ordersData.totalItems}`);
    console.log(`   - 当前页订单数: ${ordersData.items.length}\n`);

    // 测试获取物流公司列表
    console.log('2. 测试获取物流公司列表...');
    const providersResponse = await fetch(`${API_BASE_URL}/providers`);
    const providersData = await providersResponse.json();
    console.log('✅ 物流公司列表获取成功:', providersData);
    console.log(`   - 物流公司数量: ${providersData.length}\n`);

    // 测试创建新订单
    console.log('3. 测试创建新订单...');
    const newOrderData = {
      warehouse: '测试仓库-API测试',
      goods: '测试货物-API测试',
      deliveryAddress: '测试地址-API测试'
    };

    const createResponse = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newOrderData)
    });

    const newOrder = await createResponse.json();
    console.log('✅ 订单创建成功:', newOrder);
    console.log(`   - 订单ID: ${newOrder.id}`);
    console.log(`   - 订单状态: ${newOrder.status}\n`);

    console.log('🎉 所有API测试通过！');

  } catch (error) {
    console.error('❌ API测试失败:', error.message);
  }
}

testAPI();
