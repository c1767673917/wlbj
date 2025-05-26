/**
 * 测试新的订单号生成逻辑
 * 格式：RX + yymmdd + "-" + 3位流水号
 */

const db = require('./db/database');

// 生成订单号：RX + yymmdd + "-" + 3位流水号
function generateOrderId() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // 取年份后两位
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 月份补零
  const day = now.getDate().toString().padStart(2, '0'); // 日期补零
  const dateStr = year + month + day;
  
  return new Promise((resolve, reject) => {
    // 查询今天已有的订单数量来生成流水号
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    
    db.get(
      'SELECT COUNT(*) as count FROM orders WHERE createdAt >= ? AND createdAt < ?',
      [todayStart, todayEnd],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        const sequenceNumber = (row.count + 1).toString().padStart(3, '0'); // 3位流水号，从001开始
        const orderId = `RX${dateStr}-${sequenceNumber}`;
        resolve(orderId);
      }
    );
  });
}

async function testOrderIdGeneration() {
  console.log('🚀 开始测试订单号生成逻辑...\n');

  try {
    // 测试1: 生成多个订单号
    console.log('📋 测试1: 生成订单号格式');
    
    for (let i = 1; i <= 5; i++) {
      const orderId = await generateOrderId();
      console.log(`  订单 ${i}: ${orderId}`);
      
      // 验证格式
      const pattern = /^RX\d{6}-\d{3}$/;
      const isValid = pattern.test(orderId);
      console.log(`    格式验证: ${isValid ? '✅ 正确' : '❌ 错误'}`);
      
      // 解析订单号
      const dateStr = orderId.substring(2, 8); // 提取日期部分
      const sequenceStr = orderId.substring(9, 12); // 提取流水号部分
      console.log(`    日期部分: ${dateStr} (yymmdd)`);
      console.log(`    流水号: ${sequenceStr}`);
      console.log('');
    }

    // 测试2: 验证今日订单计数
    console.log('📋 测试2: 验证今日订单计数');
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    
    db.get(
      'SELECT COUNT(*) as count FROM orders WHERE createdAt >= ? AND createdAt < ?',
      [todayStart, todayEnd],
      (err, row) => {
        if (err) {
          console.error('查询今日订单数量失败:', err);
          return;
        }
        
        console.log(`  今日已有订单数量: ${row.count}`);
        console.log(`  下一个流水号将是: ${(row.count + 1).toString().padStart(3, '0')}`);
        
        // 测试3: 验证日期格式
        console.log('\n📋 测试3: 验证日期格式');
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const expectedDateStr = year + month + day;
        
        console.log(`  当前日期: ${now.toLocaleDateString('zh-CN')}`);
        console.log(`  格式化后: ${expectedDateStr} (yymmdd)`);
        console.log(`  年份: ${year} (yy)`);
        console.log(`  月份: ${month} (mm)`);
        console.log(`  日期: ${day} (dd)`);
        
        console.log('\n🎉 测试完成！');
        console.log('\n📚 订单号格式说明：');
        console.log('- 前缀: RX');
        console.log('- 日期: yymmdd (年月日，年份取后两位)');
        console.log('- 分隔符: -');
        console.log('- 流水号: 3位数字，从001开始，每日重置');
        console.log('- 示例: RX250126-001, RX250126-002, ...');
        
        // 关闭数据库连接
        db.close();
      }
    );

  } catch (error) {
    console.error('测试过程中出现错误:', error);
    db.close();
  }
}

// 运行测试
if (require.main === module) {
  testOrderIdGeneration();
}

module.exports = { generateOrderId, testOrderIdGeneration };
