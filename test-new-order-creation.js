/**
 * 测试新订单创建功能和订单号生成
 */

// 尝试导入fetch
let fetch;
try {
  fetch = require('node-fetch');
} catch (e) {
  console.error('请安装node-fetch: npm install node-fetch');
  process.exit(1);
}

async function testOrderCreation() {
  console.log('🚀 开始测试新订单创建功能...\n');

  const testOrders = [
    {
      warehouse: '广州仓',
      goods: '清香牛肉579箱，香辣味1321箱，大骨牛肉500箱',
      deliveryAddress: '河南省漯河市临颍县繁阳路南侧经一路西侧 临颍县恒烨实业有限公司 时会丽 15839591235'
    },
    {
      warehouse: '深圳仓',
      goods: '番茄牛肉600箱，需要按口味码放整齐',
      deliveryAddress: '广东省深圳市南山区科技园 深圳科技有限公司 张三 13800138000'
    },
    {
      warehouse: '上海仓',
      goods: '混合口味牛肉1000箱，混码装卸仓库拒收',
      deliveryAddress: '上海市浦东新区陆家嘴金融区 上海贸易公司 李四 13900139000'
    }
  ];

  try {
    for (let i = 0; i < testOrders.length; i++) {
      const orderData = testOrders[i];
      console.log(`📦 创建测试订单 ${i + 1}:`);
      console.log(`   仓库: ${orderData.warehouse}`);
      console.log(`   货物: ${orderData.goods.substring(0, 50)}...`);

      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ 订单创建成功！`);
        console.log(`   📋 订单号: ${result.id}`);
        console.log(`   ⏰ 创建时间: ${new Date(result.createdAt).toLocaleString('zh-CN')}`);

        // 验证订单号格式
        const orderIdPattern = /^RX\d{6}-\d{3}$/;
        const isValidFormat = orderIdPattern.test(result.id);
        console.log(`   🔍 格式验证: ${isValidFormat ? '✅ 正确' : '❌ 错误'}`);

        if (isValidFormat) {
          const dateStr = result.id.substring(2, 8);
          const sequenceStr = result.id.substring(9, 12);
          console.log(`   📅 日期部分: ${dateStr} (yymmdd)`);
          console.log(`   🔢 流水号: ${sequenceStr}`);
        }

      } else {
        const error = await response.json();
        console.log(`   ❌ 订单创建失败: ${error.error}`);
      }

      console.log('');

      // 等待1秒再创建下一个订单
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 获取今日所有订单验证
    console.log('📋 验证今日订单列表:');
    const ordersResponse = await fetch('http://localhost:3000/api/orders?status=active&page=1&pageSize=20');

    if (ordersResponse.ok) {
      const ordersData = await ordersResponse.json();
      const todayOrders = ordersData.orders.filter(order => {
        const orderDate = new Date(order.createdAt).toDateString();
        const today = new Date().toDateString();
        return orderDate === today;
      });

      console.log(`   📊 今日订单总数: ${todayOrders.length}`);
      console.log('   📋 今日订单号列表:');

      todayOrders.forEach((order, index) => {
        console.log(`     ${index + 1}. ${order.id} (${new Date(order.createdAt).toLocaleTimeString('zh-CN')})`);
      });

      // 验证流水号是否连续
      const todayOrderIds = todayOrders
        .map(order => order.id)
        .filter(id => /^RX\d{6}-\d{3}$/.test(id))
        .sort();

      console.log('\n   🔍 流水号连续性检查:');
      let isSequential = true;
      for (let i = 0; i < todayOrderIds.length; i++) {
        const expectedSequence = (i + 1).toString().padStart(3, '0');
        const actualSequence = todayOrderIds[i].substring(9, 12);
        const isCorrect = actualSequence === expectedSequence;

        console.log(`     订单 ${i + 1}: ${todayOrderIds[i]} - 流水号 ${actualSequence} ${isCorrect ? '✅' : '❌'}`);

        if (!isCorrect) {
          isSequential = false;
        }
      }

      console.log(`   📈 流水号连续性: ${isSequential ? '✅ 正确' : '❌ 有问题'}`);

    } else {
      console.log('   ❌ 获取订单列表失败');
    }

  } catch (error) {
    console.error('测试过程中出现错误:', error.message);
  }

  console.log('\n🎉 测试完成！');
  console.log('\n📚 订单号格式说明：');
  console.log('- 格式: RXyymmdd-nnn');
  console.log('- RX: 固定前缀');
  console.log('- yymmdd: 年月日 (年份后两位)');
  console.log('- nnn: 3位流水号，每日从001开始');
  console.log('- 示例: RX250526-001, RX250526-002, RX250526-003');
}

// 运行测试
if (require.main === module) {
  testOrderCreation().catch(console.error);
}

module.exports = { testOrderCreation };
