#!/usr/bin/env node

// 安全恢复脚本 - 自动停止服务、恢复数据、重启服务

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// 配置
const APP_DIR = process.cwd();
const BACKUP_FILE = process.argv[2];

if (!BACKUP_FILE || !fs.existsSync(BACKUP_FILE)) {
  console.error('❌ 请提供有效的备份文件路径');
  console.error('用法: node safe-restore.js <备份文件路径>');
  process.exit(1);
}

// 日志函数
function log(message) {
  const timestamp = new Date().toLocaleString('zh-CN');
  console.log(`[${timestamp}] ${message}`);
}

function error(message) {
  const timestamp = new Date().toLocaleString('zh-CN');
  console.error(`[${timestamp}] ❌ ${message}`);
}

// 检查是否有Node.js进程在运行
function checkRunningProcesses() {
  try {
    const result = execSync('ps aux | grep node | grep -v grep', { encoding: 'utf8' });
    const processes = result.split('\n').filter(line => line.trim());
    
    if (processes.length > 0) {
      log('发现正在运行的Node.js进程:');
      processes.forEach(proc => {
        const parts = proc.split(/\s+/);
        const pid = parts[1];
        const command = parts.slice(10).join(' ');
        if (command.includes('npm start') || command.includes('server.js') || command.includes('app.js')) {
          log(`  PID: ${pid} - ${command}`);
        }
      });
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

// 停止相关服务
function stopServices() {
  log('🛑 停止相关服务...');
  
  try {
    // 尝试优雅停止npm进程
    try {
      execSync('pkill -f "npm start"', { stdio: 'ignore' });
      log('已停止 npm start 进程');
    } catch (e) {
      // 进程可能不存在，忽略错误
    }
    
    // 尝试停止Node.js服务器进程
    try {
      execSync('pkill -f "node.*server"', { stdio: 'ignore' });
      log('已停止 Node.js 服务器进程');
    } catch (e) {
      // 进程可能不存在，忽略错误
    }
    
    // 等待进程完全停止
    log('等待进程完全停止...');
    setTimeout(() => {}, 2000);
    
    return true;
  } catch (err) {
    error(`停止服务失败: ${err.message}`);
    return false;
  }
}

// 创建恢复前备份
function createPreRestoreBackup() {
  log('📦 创建恢复前备份...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(APP_DIR, 'backup', `pre-restore-${timestamp}`);
  
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // 备份数据库
    const dbPath = path.join(APP_DIR, 'data', 'logistics.db');
    if (fs.existsSync(dbPath)) {
      const backupDbPath = path.join(backupDir, 'logistics.db');
      fs.copyFileSync(dbPath, backupDbPath);
      log(`数据库已备份到: ${backupDbPath}`);
    }
    
    // 备份配置文件
    const configs = ['.env', 'auth_config.json', 'ip_whitelist.json'];
    for (const config of configs) {
      const configPath = path.join(APP_DIR, config);
      if (fs.existsSync(configPath)) {
        const backupConfigPath = path.join(backupDir, config);
        fs.copyFileSync(configPath, backupConfigPath);
        log(`配置文件已备份: ${config}`);
      }
    }
    
    log(`✅ 恢复前备份完成: ${backupDir}`);
    return backupDir;
  } catch (err) {
    error(`创建恢复前备份失败: ${err.message}`);
    return null;
  }
}

// 执行恢复操作
function executeRestore() {
  log('🔄 执行数据恢复...');
  
  return new Promise((resolve, reject) => {
    const restoreScript = path.join(APP_DIR, 'scripts', 'restore-backup.js');
    const options = JSON.stringify({
      restoreDatabase: true,
      restoreConfigs: true,
      restoreLogs: false,
      createBackup: false, // 我们已经手动创建了备份
      verifyIntegrity: true
    });
    
    const child = spawn('node', [restoreScript, BACKUP_FILE, options], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      // 实时显示恢复进度
      text.split('\n').forEach(line => {
        if (line.trim()) {
          log(`恢复: ${line.trim()}`);
        }
      });
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        log('✅ 数据恢复完成');
        resolve();
      } else {
        error(`数据恢复失败，退出码: ${code}`);
        if (errorOutput) {
          error(`错误信息: ${errorOutput}`);
        }
        reject(new Error(`恢复失败: ${errorOutput || '未知错误'}`));
      }
    });
    
    child.on('error', (err) => {
      error(`恢复脚本启动失败: ${err.message}`);
      reject(err);
    });
  });
}

// 重启服务
function restartServices() {
  log('🚀 重启服务...');
  
  return new Promise((resolve, reject) => {
    // 启动后端服务
    const child = spawn('npm', ['start'], {
      cwd: APP_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true
    });
    
    let startupOutput = '';
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      startupOutput += text;
      
      // 检查服务是否启动成功
      if (text.includes('服务器运行在') || text.includes('Server running on')) {
        log('✅ 后端服务启动成功');
        
        // 分离进程，让它在后台运行
        child.unref();
        
        setTimeout(() => {
          resolve();
        }, 2000);
      }
    });
    
    child.stderr.on('data', (data) => {
      const text = data.toString();
      if (!text.includes('warning') && !text.includes('deprecated')) {
        error(`服务启动错误: ${text}`);
      }
    });
    
    child.on('error', (err) => {
      error(`服务启动失败: ${err.message}`);
      reject(err);
    });
    
    // 超时检查
    setTimeout(() => {
      if (!startupOutput.includes('服务器运行在') && !startupOutput.includes('Server running on')) {
        log('⚠️  服务启动超时，请手动检查');
        resolve(); // 不阻塞流程
      }
    }, 10000);
  });
}

// 验证恢复结果
async function verifyRestore() {
  log('🔍 验证恢复结果...');
  
  // 等待服务完全启动
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    const fetch = require('node-fetch');
    
    // 检查后端API
    const response = await fetch('http://localhost:3000/api/backup/config', {
      timeout: 5000
    });
    
    if (response.ok) {
      log('✅ 后端API响应正常');
      return true;
    } else {
      error(`API响应异常: ${response.status}`);
      return false;
    }
  } catch (err) {
    error(`API验证失败: ${err.message}`);
    log('💡 请手动检查服务状态: http://localhost:3000');
    return false;
  }
}

// 主函数
async function main() {
  try {
    log('🎯 开始安全恢复流程...');
    log(`备份文件: ${BACKUP_FILE}`);
    
    // 1. 检查运行中的进程
    if (checkRunningProcesses()) {
      log('⚠️  检测到正在运行的服务');
    }
    
    // 2. 停止服务
    stopServices();
    
    // 3. 创建恢复前备份
    const preBackupDir = createPreRestoreBackup();
    if (!preBackupDir) {
      throw new Error('创建恢复前备份失败');
    }
    
    // 4. 执行恢复
    await executeRestore();
    
    // 5. 重启服务
    await restartServices();
    
    // 6. 验证结果
    const verified = await verifyRestore();
    
    log('🎉 安全恢复流程完成！');
    log('');
    log('📍 访问地址:');
    log('   前端: http://localhost:5173');
    log('   后端: http://localhost:3000');
    log('   管理员: http://localhost:5173/admin');
    log('');
    if (preBackupDir) {
      log(`💾 恢复前备份保存在: ${preBackupDir}`);
    }
    
    if (!verified) {
      log('⚠️  请手动验证服务状态');
    }
    
  } catch (err) {
    error(`安全恢复失败: ${err.message}`);
    log('');
    log('🔧 故障排除建议:');
    log('1. 手动启动后端服务: npm start');
    log('2. 检查数据库文件: ls -la data/logistics.db');
    log('3. 查看错误日志: tail -f logs/app.log');
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}
