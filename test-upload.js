#!/usr/bin/env node

// 测试备份文件上传功能

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  const backupFile = './backup/wlbj-backup-2025-06-14T03-50-15.tar.gz';
  
  if (!fs.existsSync(backupFile)) {
    console.error('备份文件不存在:', backupFile);
    process.exit(1);
  }

  console.log('测试文件上传功能...');
  console.log('备份文件:', backupFile);
  console.log('文件大小:', fs.statSync(backupFile).size, 'bytes');

  // 创建FormData
  const form = new FormData();
  form.append('backupFile', fs.createReadStream(backupFile));
  form.append('options', JSON.stringify({
    restoreDatabase: true,
    restoreConfigs: true,
    restoreLogs: false,
    createBackup: true,
    verifyIntegrity: true
  }));

  try {
    console.log('发送恢复请求...');
    const response = await fetch('http://localhost:3000/api/backup/restore', {
      method: 'POST',
      body: form
    });

    const result = await response.text();
    console.log('响应状态:', response.status);
    console.log('响应内容:', result);

    if (response.ok) {
      console.log('✅ 文件上传成功！');
    } else {
      console.log('❌ 文件上传失败！');
    }
  } catch (error) {
    console.error('请求失败:', error.message);
  }
}

// 测试验证功能
async function testVerify() {
  const backupFile = './backup/wlbj-backup-2025-06-14T03-50-15.tar.gz';
  
  if (!fs.existsSync(backupFile)) {
    console.error('备份文件不存在:', backupFile);
    process.exit(1);
  }

  console.log('\n测试文件验证功能...');

  // 创建FormData
  const form = new FormData();
  form.append('backupFile', fs.createReadStream(backupFile));

  try {
    console.log('发送验证请求...');
    const response = await fetch('http://localhost:3000/api/backup/verify', {
      method: 'POST',
      body: form
    });

    const result = await response.text();
    console.log('响应状态:', response.status);
    console.log('响应内容:', result);

    if (response.ok) {
      console.log('✅ 文件验证成功！');
    } else {
      console.log('❌ 文件验证失败！');
    }
  } catch (error) {
    console.error('验证请求失败:', error.message);
  }
}

async function main() {
  console.log('=== 备份恢复功能测试 ===\n');
  
  // 测试验证功能
  await testVerify();
  
  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 测试上传恢复功能
  await testUpload();
}

if (require.main === module) {
  main();
}
