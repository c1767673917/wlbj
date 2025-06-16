/**
 * 用户企业微信配置功能测试脚本
 * 用于测试用户端企业微信通知配置的保存和读取功能
 */

const db = require('./db/database');

// 测试数据
const testUserId = 'test-user-001';
const testUserEmail = 'test@example.com';
const testUserName = '测试用户';
const testWebhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=TEST_KEY';

console.log('开始测试用户企业微信配置功能...\n');

// 测试1: 检查数据库表结构
function testDatabaseSchema() {
  return new Promise((resolve, reject) => {
    console.log('1. 检查用户表结构...');
    
    db.all("PRAGMA table_info(users)", (err, columns) => {
      if (err) {
        console.error('❌ 获取用户表结构失败:', err.message);
        reject(err);
        return;
      }

      const columnNames = columns.map(col => col.name);
      const hasWechatUrl = columnNames.includes('wechat_webhook_url');
      const hasWechatEnabled = columnNames.includes('wechat_notification_enabled');

      console.log('   用户表字段:', columnNames.join(', '));
      console.log('   企业微信URL字段:', hasWechatUrl ? '✅ 存在' : '❌ 缺失');
      console.log('   企业微信启用字段:', hasWechatEnabled ? '✅ 存在' : '❌ 缺失');

      if (hasWechatUrl && hasWechatEnabled) {
        console.log('✅ 数据库表结构检查通过\n');
        resolve();
      } else {
        console.log('❌ 数据库表结构检查失败\n');
        reject(new Error('缺少必要的企业微信配置字段'));
      }
    });
  });
}

// 测试2: 创建测试用户
function createTestUser() {
  return new Promise((resolve, reject) => {
    console.log('2. 创建测试用户...');
    
    // 先删除可能存在的测试用户
    db.run('DELETE FROM users WHERE id = ?', [testUserId], (err) => {
      if (err) {
        console.error('删除旧测试用户失败:', err.message);
      }

      // 创建新的测试用户
      const createdAt = new Date().toISOString();
      db.run(
        'INSERT INTO users (id, email, password, name, role, createdAt, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [testUserId, testUserEmail, 'test_password_hash', testUserName, 'user', createdAt, 1],
        function(err) {
          if (err) {
            console.error('❌ 创建测试用户失败:', err.message);
            reject(err);
            return;
          }

          console.log('✅ 测试用户创建成功');
          console.log(`   用户ID: ${testUserId}`);
          console.log(`   邮箱: ${testUserEmail}\n`);
          resolve();
        }
      );
    });
  });
}

// 测试3: 更新用户企业微信配置
function updateUserWechatConfig() {
  return new Promise((resolve, reject) => {
    console.log('3. 更新用户企业微信配置...');
    
    const updatedAt = new Date().toISOString();
    db.run(
      'UPDATE users SET wechat_webhook_url = ?, wechat_notification_enabled = ?, updatedAt = ? WHERE id = ?',
      [testWebhookUrl, 1, updatedAt, testUserId],
      function(err) {
        if (err) {
          console.error('❌ 更新用户企业微信配置失败:', err.message);
          reject(err);
          return;
        }

        if (this.changes === 0) {
          console.error('❌ 未找到要更新的用户');
          reject(new Error('用户不存在'));
          return;
        }

        console.log('✅ 用户企业微信配置更新成功');
        console.log(`   Webhook URL: ${testWebhookUrl}`);
        console.log(`   通知启用: 是\n`);
        resolve();
      }
    );
  });
}

// 测试4: 读取用户企业微信配置
function readUserWechatConfig() {
  return new Promise((resolve, reject) => {
    console.log('4. 读取用户企业微信配置...');
    
    db.get(
      'SELECT wechat_webhook_url, wechat_notification_enabled FROM users WHERE id = ?',
      [testUserId],
      (err, user) => {
        if (err) {
          console.error('❌ 读取用户企业微信配置失败:', err.message);
          reject(err);
          return;
        }

        if (!user) {
          console.error('❌ 未找到用户');
          reject(new Error('用户不存在'));
          return;
        }

        console.log('✅ 用户企业微信配置读取成功');
        console.log(`   Webhook URL: ${user.wechat_webhook_url}`);
        console.log(`   通知启用: ${user.wechat_notification_enabled ? '是' : '否'}`);
        
        // 验证数据是否正确
        if (user.wechat_webhook_url === testWebhookUrl && user.wechat_notification_enabled === 1) {
          console.log('✅ 配置数据验证通过\n');
          resolve();
        } else {
          console.log('❌ 配置数据验证失败\n');
          reject(new Error('配置数据不匹配'));
        }
      }
    );
  });
}

// 测试5: 清理测试数据
function cleanupTestData() {
  return new Promise((resolve, reject) => {
    console.log('5. 清理测试数据...');
    
    db.run('DELETE FROM users WHERE id = ?', [testUserId], function(err) {
      if (err) {
        console.error('❌ 清理测试数据失败:', err.message);
        reject(err);
        return;
      }

      console.log('✅ 测试数据清理完成\n');
      resolve();
    });
  });
}

// 运行所有测试
async function runTests() {
  try {
    await testDatabaseSchema();
    await createTestUser();
    await updateUserWechatConfig();
    await readUserWechatConfig();
    await cleanupTestData();
    
    console.log('🎉 所有测试通过！用户企业微信配置功能正常工作。');
    console.log('\n功能说明:');
    console.log('- ✅ 用户表已包含企业微信配置字段');
    console.log('- ✅ 可以成功保存用户企业微信配置');
    console.log('- ✅ 可以正确读取用户企业微信配置');
    console.log('- ✅ 数据持久化功能正常');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.log('\n请检查:');
    console.log('1. 数据库连接是否正常');
    console.log('2. 用户表是否包含必要的企业微信字段');
    console.log('3. 数据库迁移是否已执行');
  } finally {
    // 关闭数据库连接
    db.close((err) => {
      if (err) {
        console.error('关闭数据库连接失败:', err.message);
      } else {
        console.log('\n数据库连接已关闭');
      }
    });
  }
}

// 启动测试
runTests();
