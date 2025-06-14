#!/usr/bin/env node

// 检查服务状态脚本

const fetch = require('node-fetch');

async function checkService(name, url) {
  try {
    console.log(`检查 ${name}...`);
    const response = await fetch(url, { timeout: 5000 });
    
    if (response.ok) {
      console.log(`✅ ${name} 正常运行 (状态码: ${response.status})`);
      return true;
    } else {
      console.log(`❌ ${name} 响应异常 (状态码: ${response.status})`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${name} 连接失败: ${error.message}`);
    return false;
  }
}

async function checkBackupAPI() {
  try {
    console.log('检查备份API...');
    
    // 检查备份配置API
    const configResponse = await fetch('http://localhost:3000/api/backup/config');
    if (!configResponse.ok) {
      throw new Error(`配置API失败: ${configResponse.status}`);
    }
    
    // 检查备份历史API
    const historyResponse = await fetch('http://localhost:3000/api/backup/history');
    if (!historyResponse.ok) {
      throw new Error(`历史API失败: ${historyResponse.status}`);
    }
    
    console.log('✅ 备份API 正常运行');
    return true;
  } catch (error) {
    console.log(`❌ 备份API 异常: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('=== 服务状态检查 ===\n');
  
  const results = [];
  
  // 检查前端服务
  results.push(await checkService('前端服务 (Vite)', 'http://localhost:5173'));
  
  // 检查后端服务
  results.push(await checkService('后端服务 (Express)', 'http://localhost:3000'));
  
  // 检查备份API
  results.push(await checkBackupAPI());
  
  console.log('\n=== 检查结果 ===');
  const allOk = results.every(result => result);
  
  if (allOk) {
    console.log('🎉 所有服务运行正常！');
    console.log('\n📍 访问地址:');
    console.log('   前端: http://localhost:5173');
    console.log('   后端: http://localhost:3000');
    console.log('   管理员: http://localhost:5173/admin');
  } else {
    console.log('⚠️  部分服务存在问题，请检查日志');
  }
}

if (require.main === module) {
  main();
}
