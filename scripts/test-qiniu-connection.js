#!/usr/bin/env node

// 七牛云连接测试脚本

const fs = require('fs');
const { execSync } = require('child_process');

function main() {
  try {
    // 获取配置文件路径
    const configPath = process.argv[2];
    if (!configPath || !fs.existsSync(configPath)) {
      throw new Error('配置文件不存在');
    }

    // 读取配置
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.access_key || !config.secret_key || !config.bucket) {
      throw new Error('配置信息不完整');
    }

    // 检查qshell工具
    try {
      execSync('which qshell', { stdio: 'ignore' });
    } catch (err) {
      throw new Error('qshell工具未安装');
    }

    // 生成唯一的账号名称
    const accountName = `test-account-${Date.now()}`;

    // 配置qshell
    execSync(`qshell account "${config.access_key}" "${config.secret_key}" "${accountName}"`);

    // 测试连接 - 列出存储空间
    const result = execSync('qshell buckets', { encoding: 'utf8' });

    // 清理账号
    try {
      execSync(`qshell user rm "${accountName}"`, { stdio: 'ignore' });
    } catch (e) {
      // 忽略清理错误
    }

    if (result.includes(config.bucket)) {
      console.log('✅ 七牛云连接测试成功');
      console.log(`✅ 存储空间 ${config.bucket} 可访问`);
      process.exit(0);
    } else {
      throw new Error(`存储空间 ${config.bucket} 不存在或无权限访问`);
    }

  } catch (err) {
    console.error('❌ 七牛云连接测试失败:', err.message);
    process.exit(1);
  }
}

main();
