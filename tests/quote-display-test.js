/**
 * 订单报价显示功能自动化测试脚本
 *
 * 使用方法：
 * node tests/quote-display-test.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
const TEST_USER = {
  email: 'lcs',
  password: 'lcslcs',
};

let authToken = '';

// 颜色输出函数
const colors = {
  green: text => `\x1b[32m${text}\x1b[0m`,
  red: text => `\x1b[31m${text}\x1b[0m`,
  yellow: text => `\x1b[33m${text}\x1b[0m`,
  blue: text => `\x1b[34m${text}\x1b[0m`,
  cyan: text => `\x1b[36m${text}\x1b[0m`,
};

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
};

// 断言函数
function assert(condition, message) {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    console.log(colors.green(`✓ ${message}`));
    return true;
  } else {
    testResults.failed++;
    console.log(colors.red(`✗ ${message}`));
    return false;
  }
}

// 登录获取token
async function login() {
  try {
    console.log(colors.blue('\n=== 用户登录测试 ==='));
    const response = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
    authToken = response.data.accessToken;
    assert(!!authToken, '用户登录成功，获取到访问令牌');
    return true;
  } catch (error) {
    assert(false, `用户登录失败: ${error.message}`);
    return false;
  }
}

// 测试最低报价批量查询
async function testLowestQuoteBatch() {
  console.log(colors.blue('\n=== 最低报价批量查询测试 ==='));

  try {
    // 测试有报价的订单
    const orderIds = ['RX250616-004', 'RX250616-005', 'RX250618-002', 'RX250618-001'];
    const response = await axios.get(
      `${BASE_URL}/quotes/lowest-batch?orderIds=${orderIds.join(',')}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const data = response.data;
    assert(typeof data === 'object', '返回数据格式正确（对象类型）');

    // 验证有报价的订单
    if (data['RX250616-004']) {
      assert(
        data['RX250616-004'].provider && data['RX250616-004'].price,
        'RX250616-004 返回了正确的最低报价信息'
      );
      assert(typeof data['RX250616-004'].price === 'number', '报价价格为数字类型');
      console.log(
        colors.cyan(
          `  RX250616-004: ${data['RX250616-004'].provider} ¥${data['RX250616-004'].price}`
        )
      );
    }

    if (data['RX250616-005']) {
      assert(
        data['RX250616-005'].provider && data['RX250616-005'].price,
        'RX250616-005 返回了正确的最低报价信息'
      );
      console.log(
        colors.cyan(
          `  RX250616-005: ${data['RX250616-005'].provider} ¥${data['RX250616-005'].price}`
        )
      );
    }

    // 验证无报价的订单
    if (data.hasOwnProperty('RX250618-001')) {
      assert(data['RX250618-001'] === null, 'RX250618-001 正确返回null（无报价）');
    }
  } catch (error) {
    assert(false, `最低报价批量查询失败: ${error.message}`);
  }
}

// 测试单个订单最低报价查询
async function testSingleLowestQuote() {
  console.log(colors.blue('\n=== 单个订单最低报价查询测试 ==='));

  try {
    // 测试有报价的订单
    const response = await axios.get(`${BASE_URL}/quotes/lowest/RX250616-004`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const data = response.data;
    if (data) {
      assert(data.provider && data.price, 'RX250616-004 单个查询返回正确的最低报价');
      assert(typeof data.price === 'number', '单个查询报价价格为数字类型');
      console.log(colors.cyan(`  最低报价: ${data.provider} ¥${data.price}`));
    } else {
      assert(false, 'RX250616-004 应该有报价数据');
    }

    // 测试无报价的订单
    const noQuoteResponse = await axios.get(`${BASE_URL}/quotes/lowest/RX250618-001`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    assert(noQuoteResponse.data === null, 'RX250618-001 单个查询正确返回null');
  } catch (error) {
    assert(false, `单个订单最低报价查询失败: ${error.message}`);
  }
}

// 测试历史订单选择报价显示
async function testClosedOrdersSelectedQuotes() {
  console.log(colors.blue('\n=== 历史订单选择报价测试 ==='));

  try {
    const response = await axios.get(`${BASE_URL}/orders/closed`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const data = response.data;
    assert(Array.isArray(data.items), '历史订单返回数据格式正确');

    // 查找已选择报价的订单
    const selectedOrder = data.items.find(order => order.selectedProvider);
    if (selectedOrder) {
      assert(!!selectedOrder.selectedProvider, '找到已选择报价的历史订单');
      assert(typeof selectedOrder.selectedPrice === 'number', '选择报价价格为数字类型');
      assert(!!selectedOrder.selectedAt, '选择报价时间存在');
      console.log(
        colors.cyan(
          `  ${selectedOrder.id}: ${selectedOrder.selectedProvider} ¥${selectedOrder.selectedPrice}`
        )
      );
    }

    // 查找未选择报价的订单
    const unselectedOrder = data.items.find(order => !order.selectedProvider);
    if (unselectedOrder) {
      assert(unselectedOrder.selectedProvider === null, '未选择报价的订单selectedProvider为null');
      assert(unselectedOrder.selectedPrice === null, '未选择报价的订单selectedPrice为null');
      console.log(colors.cyan(`  ${unselectedOrder.id}: 未选择报价`));
    }
  } catch (error) {
    assert(false, `历史订单查询失败: ${error.message}`);
  }
}

// 测试活跃订单查询
async function testActiveOrders() {
  console.log(colors.blue('\n=== 活跃订单查询测试 ==='));

  try {
    const response = await axios.get(`${BASE_URL}/orders?status=active`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const data = response.data;
    assert(Array.isArray(data.items), '活跃订单返回数据格式正确');
    assert(data.totalItems >= 0, '总数量字段存在且为非负数');
    assert(data.currentPage >= 1, '当前页码正确');

    if (data.items.length > 0) {
      const order = data.items[0];
      assert(!!order.id, '订单ID存在');
      assert(!!order.warehouse, '仓库信息存在');
      assert(!!order.goods, '货物信息存在');
      assert(!!order.deliveryAddress, '收货地址存在');
      assert(order.status === 'active', '订单状态为active');
      console.log(colors.cyan(`  示例订单: ${order.id} - ${order.warehouse}`));
    }
  } catch (error) {
    assert(false, `活跃订单查询失败: ${error.message}`);
  }
}

// 测试字段兼容性
async function testFieldCompatibility() {
  console.log(colors.blue('\n=== 字段兼容性测试 ==='));

  try {
    const response = await axios.get(`${BASE_URL}/orders?status=active&pageSize=5`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const orders = response.data.items;

    for (const order of orders) {
      // 检查新字段存在
      const hasNewFields = order.warehouse && order.deliveryAddress;
      // 检查旧字段存在（如果有的话）
      const hasOldFields = order.from && order.to;

      assert(hasNewFields || hasOldFields, `订单 ${order.id} 至少包含一套字段（新字段或旧字段）`);

      if (hasNewFields) {
        console.log(colors.cyan(`  ${order.id}: 使用新字段 warehouse/deliveryAddress`));
      } else if (hasOldFields) {
        console.log(colors.cyan(`  ${order.id}: 使用旧字段 from/to`));
      }
    }
  } catch (error) {
    assert(false, `字段兼容性测试失败: ${error.message}`);
  }
}

// 性能测试
async function testPerformance() {
  console.log(colors.blue('\n=== 性能测试 ==='));

  try {
    // 测试批量查询性能
    const startTime = Date.now();
    const orderIds = [
      'RX250616-004',
      'RX250616-005',
      'RX250618-002',
      'RX250618-001',
      'RX250617-047',
    ];

    await axios.get(`${BASE_URL}/quotes/lowest-batch?orderIds=${orderIds.join(',')}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    assert(duration < 2000, `批量查询响应时间 ${duration}ms < 2000ms`);
    console.log(colors.cyan(`  批量查询耗时: ${duration}ms`));

    // 测试分页查询性能
    const pageStartTime = Date.now();
    await axios.get(`${BASE_URL}/orders?status=active&page=1&pageSize=20`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const pageEndTime = Date.now();
    const pageDuration = pageEndTime - pageStartTime;

    assert(pageDuration < 1000, `分页查询响应时间 ${pageDuration}ms < 1000ms`);
    console.log(colors.cyan(`  分页查询耗时: ${pageDuration}ms`));
  } catch (error) {
    assert(false, `性能测试失败: ${error.message}`);
  }
}

// 主测试函数
async function runTests() {
  console.log(colors.yellow('开始执行订单报价显示功能测试...\n'));

  // 登录
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log(colors.red('\n登录失败，终止测试'));
    return;
  }

  // 执行各项测试
  await testLowestQuoteBatch();
  await testSingleLowestQuote();
  await testClosedOrdersSelectedQuotes();
  await testActiveOrders();
  await testFieldCompatibility();
  await testPerformance();

  // 输出测试结果
  console.log(colors.yellow('\n=== 测试结果汇总 ==='));
  console.log(`总测试数: ${testResults.total}`);
  console.log(colors.green(`通过: ${testResults.passed}`));
  console.log(colors.red(`失败: ${testResults.failed}`));

  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  console.log(`成功率: ${successRate}%`);

  if (testResults.failed === 0) {
    console.log(colors.green('\n🎉 所有测试通过！修复功能正常工作。'));
  } else {
    console.log(colors.red('\n❌ 部分测试失败，请检查相关功能。'));
    process.exit(1);
  }
}

// 错误处理
process.on('unhandledRejection', error => {
  console.log(colors.red(`未处理的错误: ${error.message}`));
  process.exit(1);
});

// 运行测试
runTests().catch(error => {
  console.log(colors.red(`测试执行失败: ${error.message}`));
  process.exit(1);
});
