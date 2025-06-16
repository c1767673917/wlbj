/**
 * 测试物流公司企业微信webhook配置功能
 * 直接测试数据库和API层面的功能
 */

const db = require('./db/database');
const testWebhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=c0c1b86a-a458-4731-a855-0716eed4a23b';

console.log('🔧 开始测试物流公司企业微信webhook配置功能...\n');

// 测试1: 检查providers表结构
function testProvidersTableStructure() {
  return new Promise((resolve, reject) => {
    console.log('1. 检查providers表结构...');
    
    db.all("PRAGMA table_info(providers)", (err, columns) => {
      if (err) {
        console.error('❌ 获取表结构失败:', err.message);
        reject(err);
        return;
      }

      console.log('   providers表字段:');
      columns.forEach(col => {
        console.log(`   - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
      });

      const columnNames = columns.map(col => col.name);
      const hasWechatUrl = columnNames.includes('wechat_webhook_url');

      console.log(`   企业微信URL字段: ${hasWechatUrl ? '✅ 存在' : '❌ 缺失'}\n`);

      if (hasWechatUrl) {
        resolve();
      } else {
        reject(new Error('缺少wechat_webhook_url字段'));
      }
    });
  });
}

// 测试2: 获取现有物流公司
function getExistingProviders() {
  return new Promise((resolve, reject) => {
    console.log('2. 获取现有物流公司...');
    
    db.all('SELECT id, name, accessKey, wechat_webhook_url FROM providers ORDER BY createdAt DESC', [], (err, providers) => {
      if (err) {
        console.error('❌ 获取物流公司失败:', err.message);
        reject(err);
        return;
      }

      console.log(`   ✅ 找到 ${providers.length} 个物流公司:`);
      providers.forEach(provider => {
        console.log(`   - ID: ${provider.id}, 名称: ${provider.name}, Webhook: ${provider.wechat_webhook_url || '(未设置)'}`);
      });
      console.log('');

      resolve(providers);
    });
  });
}

// 测试3: 创建测试物流公司（如果没有的话）
function createTestProvider() {
  return new Promise((resolve, reject) => {
    console.log('3. 创建测试物流公司...');
    
    const testProvider = {
      id: 'test-provider-webhook',
      name: '测试物流公司-Webhook',
      accessKey: 'test-webhook-key',
      createdAt: new Date().toISOString(),
      wechatWebhookUrl: null
    };

    // 先删除可能存在的测试物流公司
    db.run('DELETE FROM providers WHERE id = ?', [testProvider.id], (err) => {
      if (err) {
        console.error('删除旧测试物流公司失败:', err.message);
      }

      // 创建新的测试物流公司
      db.run(
        'INSERT INTO providers (id, name, accessKey, createdAt, wechat_webhook_url) VALUES (?, ?, ?, ?, ?)',
        [testProvider.id, testProvider.name, testProvider.accessKey, testProvider.createdAt, testProvider.wechatWebhookUrl],
        function(err) {
          if (err) {
            console.error('❌ 创建测试物流公司失败:', err.message);
            reject(err);
            return;
          }

          console.log('   ✅ 测试物流公司创建成功');
          console.log(`   ID: ${testProvider.id}`);
          console.log(`   名称: ${testProvider.name}`);
          console.log(`   访问密钥: ${testProvider.accessKey}\n`);

          resolve(testProvider);
        }
      );
    });
  });
}

// 测试4: 更新物流公司webhook URL
function updateProviderWebhook(providerId) {
  return new Promise((resolve, reject) => {
    console.log('4. 更新物流公司webhook URL...');
    
    console.log(`   目标物流公司ID: ${providerId}`);
    console.log(`   新Webhook URL: ${testWebhookUrl}`);

    db.run(
      'UPDATE providers SET wechat_webhook_url = ? WHERE id = ?',
      [testWebhookUrl, providerId],
      function(err) {
        if (err) {
          console.error('❌ 更新webhook URL失败:', err.message);
          reject(err);
          return;
        }

        console.log(`   ✅ 更新成功，影响行数: ${this.changes}`);
        
        if (this.changes === 0) {
          console.log('   ⚠️  警告：没有找到要更新的记录');
          reject(new Error('未找到指定ID的物流公司'));
          return;
        }

        console.log('');
        resolve();
      }
    );
  });
}

// 测试5: 验证webhook URL是否保存成功
function verifyWebhookSaved(providerId) {
  return new Promise((resolve, reject) => {
    console.log('5. 验证webhook URL是否保存成功...');
    
    db.get(
      'SELECT id, name, wechat_webhook_url FROM providers WHERE id = ?',
      [providerId],
      (err, provider) => {
        if (err) {
          console.error('❌ 验证失败:', err.message);
          reject(err);
          return;
        }

        if (!provider) {
          console.error('❌ 未找到物流公司');
          reject(new Error('物流公司不存在'));
          return;
        }

        console.log('   ✅ 验证成功');
        console.log(`   物流公司: ${provider.name}`);
        console.log(`   保存的Webhook URL: ${provider.wechat_webhook_url}`);

        // 检查是否与预期一致
        const urlMatches = provider.wechat_webhook_url === testWebhookUrl;
        console.log(`   URL匹配: ${urlMatches ? '✅' : '❌'}\n`);

        resolve(urlMatches);
      }
    );
  });
}

// 测试6: 测试企业微信通知发送
async function testWechatNotification() {
  console.log('6. 测试企业微信通知发送...');
  
  try {
    const { sendWechatNotification } = require('./utils/wechatNotification');
    
    const testMessage = {
      msgtype: "markdown",
      markdown: {
        content: `🧪 **物流公司Webhook配置测试**

**测试时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
**测试类型**: 物流公司企业微信配置
**配置状态**: 数据库配置成功

✅ 如果您看到这条消息，说明物流公司企业微信配置功能已正常工作！

---
*物流报价系统配置测试消息*`
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

// 测试7: 清理测试数据
function cleanupTestData() {
  return new Promise((resolve, reject) => {
    console.log('7. 清理测试数据...');
    
    db.run('DELETE FROM providers WHERE id = ?', ['test-provider-webhook'], function(err) {
      if (err) {
        console.error('❌ 清理测试数据失败:', err.message);
        reject(err);
        return;
      }

      console.log('   ✅ 测试数据清理完成\n');
      resolve();
    });
  });
}

// 运行所有测试
async function runAllTests() {
  try {
    await testProvidersTableStructure();
    const existingProviders = await getExistingProviders();
    
    let testProviderId;
    if (existingProviders.length > 0) {
      // 使用第一个现有的物流公司进行测试
      testProviderId = existingProviders[0].id;
      console.log(`使用现有物流公司进行测试: ${existingProviders[0].name} (ID: ${testProviderId})\n`);
    } else {
      // 创建测试物流公司
      const testProvider = await createTestProvider();
      testProviderId = testProvider.id;
    }
    
    await updateProviderWebhook(testProviderId);
    const webhookSaved = await verifyWebhookSaved(testProviderId);
    const notificationSent = await testWechatNotification();
    
    // 如果使用的是测试物流公司，清理测试数据
    if (testProviderId === 'test-provider-webhook') {
      await cleanupTestData();
    }
    
    console.log('📊 测试结果汇总:');
    console.log(`   数据库表结构: ✅ 正常`);
    console.log(`   物流公司数据: ✅ 正常`);
    console.log(`   Webhook更新: ✅ 正常`);
    console.log(`   配置保存验证: ${webhookSaved ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   企业微信通知: ${notificationSent ? '✅ 正常' : '❌ 失败'}`);
    
    if (webhookSaved && notificationSent) {
      console.log('\n🎉 所有测试通过！物流公司企业微信配置功能正常工作。');
      console.log('\n✅ 功能验证:');
      console.log('   - 数据库表结构正确');
      console.log('   - Webhook配置可以正常保存');
      console.log('   - 配置数据可以正确读取');
      console.log('   - 企业微信通知可以正常发送');
      console.log('\n📱 请检查您的企业微信群，应该收到了测试消息！');
      
      console.log('\n🔍 如果前端保存失败，问题可能在于:');
      console.log('   1. 前端API调用问题');
      console.log('   2. 用户认证token问题');
      console.log('   3. 前端状态更新问题');
      console.log('   4. 网络连接问题');
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
