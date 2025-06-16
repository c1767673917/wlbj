/**
 * 直接测试数据库操作和企业微信配置功能
 * 绕过API层面，直接测试数据库层面的功能
 */

const db = require('./db/database');

// 测试配置
const testWebhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=c0c1b86a-a458-4731-a855-0716eed4a23b';
const testUserId = '8a9ebf27-d699-434c-849c-67226c97b313'; // 现有用户ID

console.log('🔧 开始直接测试数据库企业微信配置功能...\n');

// 测试1: 检查用户表结构
function testTableStructure() {
  return new Promise((resolve, reject) => {
    console.log('1. 检查用户表结构...');
    
    db.all("PRAGMA table_info(users)", (err, columns) => {
      if (err) {
        console.error('❌ 获取表结构失败:', err.message);
        reject(err);
        return;
      }

      console.log('   用户表字段:');
      columns.forEach(col => {
        console.log(`   - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
      });

      const columnNames = columns.map(col => col.name);
      const hasWechatUrl = columnNames.includes('wechat_webhook_url');
      const hasWechatEnabled = columnNames.includes('wechat_notification_enabled');

      console.log(`   企业微信URL字段: ${hasWechatUrl ? '✅ 存在' : '❌ 缺失'}`);
      console.log(`   企业微信启用字段: ${hasWechatEnabled ? '✅ 存在' : '❌ 缺失'}\n`);

      if (hasWechatUrl && hasWechatEnabled) {
        resolve();
      } else {
        reject(new Error('缺少必要的企业微信配置字段'));
      }
    });
  });
}

// 测试2: 获取当前用户信息
function getCurrentUserInfo() {
  return new Promise((resolve, reject) => {
    console.log('2. 获取当前用户信息...');
    
    db.get(
      'SELECT id, email, name, wechat_webhook_url, wechat_notification_enabled FROM users WHERE id = ?',
      [testUserId],
      (err, user) => {
        if (err) {
          console.error('❌ 获取用户信息失败:', err.message);
          reject(err);
          return;
        }

        if (!user) {
          console.error('❌ 用户不存在');
          reject(new Error('用户不存在'));
          return;
        }

        console.log('   ✅ 用户信息获取成功');
        console.log(`   用户ID: ${user.id}`);
        console.log(`   邮箱: ${user.email}`);
        console.log(`   姓名: ${user.name}`);
        console.log(`   当前Webhook URL: ${user.wechat_webhook_url || '(未设置)'}`);
        console.log(`   当前通知状态: ${user.wechat_notification_enabled ? '启用' : '禁用'}\n`);

        resolve(user);
      }
    );
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

        console.log('   ✅ 用户企业微信配置更新成功');
        console.log(`   更新的记录数: ${this.changes}`);
        console.log(`   新Webhook URL: ${testWebhookUrl}`);
        console.log(`   新通知状态: 启用\n`);

        resolve();
      }
    );
  });
}

// 测试4: 验证配置是否保存成功
function verifyConfigSaved() {
  return new Promise((resolve, reject) => {
    console.log('4. 验证配置是否保存成功...');
    
    db.get(
      'SELECT wechat_webhook_url, wechat_notification_enabled FROM users WHERE id = ?',
      [testUserId],
      (err, user) => {
        if (err) {
          console.error('❌ 验证配置失败:', err.message);
          reject(err);
          return;
        }

        if (!user) {
          console.error('❌ 用户不存在');
          reject(new Error('用户不存在'));
          return;
        }

        console.log('   ✅ 配置验证成功');
        console.log(`   保存的Webhook URL: ${user.wechat_webhook_url}`);
        console.log(`   保存的通知状态: ${user.wechat_notification_enabled ? '启用' : '禁用'}`);

        // 验证数据是否正确
        const urlMatches = user.wechat_webhook_url === testWebhookUrl;
        const enabledMatches = user.wechat_notification_enabled === 1;

        console.log(`   URL匹配: ${urlMatches ? '✅' : '❌'}`);
        console.log(`   状态匹配: ${enabledMatches ? '✅' : '❌'}\n`);

        if (urlMatches && enabledMatches) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    );
  });
}

// 测试5: 测试企业微信通知发送
async function testWechatNotification() {
  console.log('5. 测试企业微信通知发送...');
  
  try {
    const { sendWechatNotification } = require('./utils/wechatNotification');
    
    const testMessage = {
      msgtype: "markdown",
      markdown: {
        content: `🧪 **数据库配置测试**

**测试时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
**用户ID**: ${testUserId}
**配置状态**: 数据库配置成功

✅ 如果您看到这条消息，说明用户企业微信配置功能已正常工作！

---
*物流报价系统数据库测试消息*`
      }
    };

    const result = await sendWechatNotification(testWebhookUrl, testMessage);

    if (result.success) {
      console.log('   ✅ 企业微信通知发送成功！');
      console.log('   📱 消息已发送到企业微信群\n');
      return true;
    } else {
      console.log('   ❌ 企业微信通知发送失败:');
      console.log(`   错误信息: ${result.message}\n`);
      return false;
    }
  } catch (error) {
    console.error('   ❌ 测试企业微信通知时出错:', error.message);
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  try {
    await testTableStructure();
    const currentUser = await getCurrentUserInfo();
    await updateUserWechatConfig();
    const configSaved = await verifyConfigSaved();
    const notificationSent = await testWechatNotification();
    
    console.log('📊 测试结果汇总:');
    console.log(`   数据库表结构: ✅ 正常`);
    console.log(`   用户信息获取: ✅ 正常`);
    console.log(`   配置更新: ✅ 正常`);
    console.log(`   配置保存验证: ${configSaved ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   企业微信通知: ${notificationSent ? '✅ 正常' : '❌ 失败'}`);
    
    if (configSaved && notificationSent) {
      console.log('\n🎉 所有测试通过！数据库层面的企业微信配置功能正常工作。');
      console.log('\n✅ 功能验证:');
      console.log('   - 数据库表结构正确');
      console.log('   - 配置数据可以正常保存');
      console.log('   - 配置数据可以正确读取');
      console.log('   - 企业微信通知可以正常发送');
      console.log('\n📱 请检查您的企业微信群，应该收到了测试消息！');
      
      console.log('\n🔍 如果前端保存失败，问题可能在于:');
      console.log('   1. API路由层面的验证问题');
      console.log('   2. 前端请求格式问题');
      console.log('   3. 用户认证token问题');
      console.log('   4. CORS或网络连接问题');
    } else {
      console.log('\n❌ 部分测试失败，需要进一步检查');
    }
    
  } catch (error) {
    console.error('\n💥 测试过程中发生错误:', error.message);
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
runAllTests();
