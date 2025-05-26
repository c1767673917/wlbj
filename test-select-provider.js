const http = require('http');

const BASE_URL = 'http://localhost:3000';

// 简单的fetch实现
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data))
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function testSelectProviderFeature() {
  console.log('开始测试选择物流商功能...\n');

  try {
    // 1. 创建一个测试订单
    console.log('1. 创建测试订单...');
    const orderResponse = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        warehouse: '测试仓库',
        goods: '测试货物',
        deliveryAddress: '测试收货地址'
      })
    });

    if (!orderResponse.ok) {
      throw new Error(`创建订单失败: ${orderResponse.status}`);
    }

    const order = await orderResponse.json();
    console.log(`✓ 订单创建成功: ${order.id}`);

    // 2. 为订单添加几个测试报价
    console.log('\n2. 添加测试报价...');
    const quotes = [
      { provider: '顺丰速运', price: 25.50, estimatedDelivery: '1-2天' },
      { provider: '圆通速递', price: 18.80, estimatedDelivery: '2-3天' },
      { provider: '中通快递', price: 16.90, estimatedDelivery: '3-4天' }
    ];

    for (const quote of quotes) {
      const quoteResponse = await fetch(`${BASE_URL}/api/orders/${order.id}/quotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(quote)
      });

      if (!quoteResponse.ok) {
        throw new Error(`添加报价失败: ${quoteResponse.status}`);
      }

      console.log(`✓ 添加报价: ${quote.provider} - ¥${quote.price}`);
    }

    // 3. 获取订单报价列表
    console.log('\n3. 获取订单报价列表...');
    const quotesResponse = await fetch(`${BASE_URL}/api/orders/${order.id}/quotes`);

    if (!quotesResponse.ok) {
      throw new Error(`获取报价失败: ${quotesResponse.status}`);
    }

    const orderQuotes = await quotesResponse.json();
    console.log(`✓ 获取到 ${orderQuotes.length} 个报价`);
    orderQuotes.forEach(q => {
      console.log(`  - ${q.provider}: ¥${q.price} (${q.estimatedDelivery})`);
    });

    // 4. 选择一个物流商
    console.log('\n4. 选择物流商...');
    const selectedQuote = orderQuotes[1]; // 选择圆通速递
    const selectResponse = await fetch(`${BASE_URL}/api/orders/${order.id}/select-provider`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: selectedQuote.provider,
        price: selectedQuote.price
      })
    });

    if (!selectResponse.ok) {
      throw new Error(`选择物流商失败: ${selectResponse.status}`);
    }

    const selectResult = await selectResponse.json();
    console.log(`✓ 成功选择物流商: ${selectedQuote.provider} - ¥${selectedQuote.price}`);
    console.log(`✓ 订单状态: ${selectResult.status}`);
    console.log(`✓ 选择时间: ${selectResult.selectedAt}`);

    // 5. 验证订单已移至历史记录
    console.log('\n5. 验证订单状态...');
    const orderCheckResponse = await fetch(`${BASE_URL}/api/orders/${order.id}`);

    if (!orderCheckResponse.ok) {
      throw new Error(`获取订单失败: ${orderCheckResponse.status}`);
    }

    const updatedOrder = await orderCheckResponse.json();
    console.log(`✓ 订单状态: ${updatedOrder.status}`);
    console.log(`✓ 选择的物流商: ${updatedOrder.selectedProvider}`);
    console.log(`✓ 选择的价格: ¥${updatedOrder.selectedPrice}`);

    // 6. 检查活跃订单列表（应该不包含此订单）
    console.log('\n6. 检查活跃订单列表...');
    const activeOrdersResponse = await fetch(`${BASE_URL}/api/orders?status=active`);

    if (!activeOrdersResponse.ok) {
      throw new Error(`获取活跃订单失败: ${activeOrdersResponse.status}`);
    }

    const activeOrders = await activeOrdersResponse.json();
    const isInActive = activeOrders.items.some(o => o.id === order.id);
    console.log(`✓ 订单是否在活跃列表中: ${isInActive ? '是' : '否'}`);

    // 7. 检查历史订单列表（应该包含此订单）
    console.log('\n7. 检查历史订单列表...');
    const historyOrdersResponse = await fetch(`${BASE_URL}/api/orders?status=closed`);

    if (!historyOrdersResponse.ok) {
      throw new Error(`获取历史订单失败: ${historyOrdersResponse.status}`);
    }

    const historyOrders = await historyOrdersResponse.json();
    const isInHistory = historyOrders.items.some(o => o.id === order.id);
    console.log(`✓ 订单是否在历史列表中: ${isInHistory ? '是' : '否'}`);

    console.log('\n🎉 所有测试通过！选择物流商功能正常工作。');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
testSelectProviderFeature();
