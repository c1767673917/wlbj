#!/usr/bin/env node

// 物流报价系统 - 七牛云备份执行脚本

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// 配置
const APP_DIR = path.join(__dirname, '..');
const BACKUP_ROOT = path.join(APP_DIR, 'backup');
const DATE = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// 从环境变量获取七牛云配置
const QINIU_CONFIG = {
  accessKey: process.env.QINIU_ACCESS_KEY,
  secretKey: process.env.QINIU_SECRET_KEY,
  bucket: process.env.QINIU_BUCKET,
  zone: process.env.QINIU_ZONE || 'z0'
};

const WECHAT_WEBHOOK_URL = process.env.WECHAT_WEBHOOK_URL;

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function error(message) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❌ ${message}`);
}

// 发送企业微信通知
async function sendWechatNotification(message, type = 'info') {
  if (!WECHAT_WEBHOOK_URL) return;

  const emoji = type === 'success' ? '✅' : type === 'error' ? '🚨' : 'ℹ️';
  const fullMessage = `${emoji} 【物流报价系统备份】\n\n${message}\n\n时间: ${new Date().toLocaleString('zh-CN')}`;

  try {
    const fetch = require('node-fetch');
    await fetch(WECHAT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'text',
        text: { content: fullMessage }
      })
    });
  } catch (err) {
    log(`企业微信通知发送失败: ${err.message}`);
  }
}

// 检查七牛云配置
function checkQiniuConfig() {
  if (!QINIU_CONFIG.accessKey || !QINIU_CONFIG.secretKey || !QINIU_CONFIG.bucket) {
    throw new Error('七牛云配置不完整');
  }
}

// 创建备份目录
function createBackupDir() {
  const backupDir = path.join(BACKUP_ROOT, DATE);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

// 备份数据库
async function backupDatabase(backupDir) {
  log('开始备份数据库...');
  
  const dbPath = path.join(APP_DIR, 'data', 'logistics.db');
  const dbBackupDir = path.join(backupDir, 'database');
  
  if (!fs.existsSync(dbBackupDir)) {
    fs.mkdirSync(dbBackupDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
      const backupPath = path.join(dbBackupDir, `logistics_${DATE}.db`);
      
      db.backup(backupPath, (err) => {
        db.close();
        
        if (err) {
          reject(err);
          return;
        }

        // 压缩数据库文件
        const { execSync } = require('child_process');
        try {
          execSync(`gzip "${backupPath}"`);
          const compressedPath = `${backupPath}.gz`;
          const size = fs.statSync(compressedPath).size;
          log(`数据库备份完成: ${path.basename(compressedPath)} (${formatBytes(size)})`);
          resolve(size);
        } catch (compressErr) {
          reject(compressErr);
        }
      });
    });
  } else {
    log('数据库文件不存在，跳过备份');
    return 0;
  }
}

// 备份配置文件
async function backupConfigs(backupDir) {
  log('开始备份配置文件...');
  
  const configBackupDir = path.join(backupDir, 'configs');
  if (!fs.existsSync(configBackupDir)) {
    fs.mkdirSync(configBackupDir, { recursive: true });
  }

  const configs = ['.env', 'auth_config.json', 'ip_whitelist.json', 'package.json'];
  let totalSize = 0;

  for (const config of configs) {
    const configPath = path.join(APP_DIR, config);
    if (fs.existsSync(configPath)) {
      const destPath = path.join(configBackupDir, config);
      fs.copyFileSync(configPath, destPath);
      totalSize += fs.statSync(destPath).size;
      log(`配置文件备份: ${config}`);
    }
  }

  // 压缩配置文件
  if (totalSize > 0) {
    const { execSync } = require('child_process');
    const tarPath = path.join(configBackupDir, `configs_${DATE}.tar.gz`);
    
    try {
      execSync(`tar -czf "${tarPath}" -C "${configBackupDir}" ${configs.join(' ')}`, {
        cwd: configBackupDir
      });
      
      // 删除原始文件
      configs.forEach(config => {
        const filePath = path.join(configBackupDir, config);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      
      const compressedSize = fs.statSync(tarPath).size;
      log(`配置文件压缩完成: ${path.basename(tarPath)} (${formatBytes(compressedSize)})`);
      return compressedSize;
    } catch (err) {
      error(`配置文件压缩失败: ${err.message}`);
      return totalSize;
    }
  }

  return 0;
}

// 备份日志文件
async function backupLogs(backupDir) {
  log('开始备份日志文件...');
  
  const logsDir = path.join(APP_DIR, 'logs');
  const logBackupDir = path.join(backupDir, 'logs');
  
  if (!fs.existsSync(logBackupDir)) {
    fs.mkdirSync(logBackupDir, { recursive: true });
  }

  if (fs.existsSync(logsDir)) {
    const { execSync } = require('child_process');
    const tarPath = path.join(logBackupDir, `logs_${DATE}.tar.gz`);
    
    try {
      execSync(`tar -czf "${tarPath}" -C "${APP_DIR}" logs/`);
      const size = fs.statSync(tarPath).size;
      log(`日志文件备份完成: ${path.basename(tarPath)} (${formatBytes(size)})`);
      return size;
    } catch (err) {
      error(`日志文件备份失败: ${err.message}`);
      return 0;
    }
  } else {
    log('日志目录不存在，跳过备份');
    return 0;
  }
}

// 上传到七牛云
async function uploadToQiniu(backupDir) {
  log('开始上传到七牛云...');
  
  // 检查qshell工具
  try {
    const { execSync } = require('child_process');
    execSync('which qshell', { stdio: 'ignore' });
  } catch (err) {
    throw new Error('qshell工具未安装，请先安装七牛云工具');
  }

  // 配置qshell
  const { execSync } = require('child_process');
  execSync(`qshell account "${QINIU_CONFIG.accessKey}" "${QINIU_CONFIG.secretKey}" "backup-account"`);

  // 上传所有文件
  const files = getAllFiles(backupDir);
  let uploadedCount = 0;
  let totalSize = 0;

  for (const file of files) {
    const relativePath = path.relative(backupDir, file);
    const qiniuKey = `backups/wlbj-logistics/${DATE}/${relativePath}`;
    
    try {
      execSync(`qshell fput "${QINIU_CONFIG.bucket}" "${qiniuKey}" "${file}"`);
      const size = fs.statSync(file).size;
      totalSize += size;
      uploadedCount++;
      log(`上传成功: ${relativePath} (${formatBytes(size)})`);
    } catch (err) {
      error(`上传失败: ${relativePath} - ${err.message}`);
    }
  }

  log(`七牛云上传完成，共上传 ${uploadedCount} 个文件，总大小 ${formatBytes(totalSize)}`);
  return { count: uploadedCount, size: totalSize };
}

// 获取目录下所有文件
function getAllFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// 格式化字节大小
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 清理本地备份
function cleanupLocal() {
  log('清理本地旧备份...');
  
  const retentionDays = 3; // 本地保留3天
  const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  
  if (fs.existsSync(BACKUP_ROOT)) {
    const items = fs.readdirSync(BACKUP_ROOT);
    
    for (const item of items) {
      const itemPath = path.join(BACKUP_ROOT, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory() && stat.mtime.getTime() < cutoffTime) {
        fs.rmSync(itemPath, { recursive: true, force: true });
        log(`删除旧备份: ${item}`);
      }
    }
  }
}

// 主函数
async function main() {
  try {
    log('开始执行备份任务...');
    
    // 检查配置
    checkQiniuConfig();
    
    // 创建备份目录
    const backupDir = createBackupDir();
    log(`备份目录: ${backupDir}`);
    
    // 执行备份
    const dbSize = await backupDatabase(backupDir);
    const configSize = await backupConfigs(backupDir);
    const logSize = await backupLogs(backupDir);
    
    const totalLocalSize = dbSize + configSize + logSize;
    log(`本地备份完成，总大小: ${formatBytes(totalLocalSize)}`);
    
    // 上传到七牛云
    const uploadResult = await uploadToQiniu(backupDir);
    
    // 清理本地备份
    cleanupLocal();
    
    // 发送成功通知
    const message = `备份任务执行成功\n\n📊 备份信息:\n• 时间: ${DATE}\n• 文件数量: ${uploadResult.count}\n• 备份大小: ${formatBytes(uploadResult.size)}\n• 存储位置: 七牛云`;
    await sendWechatNotification(message, 'success');
    
    log('🎉 备份任务执行完成');
    console.log(`备份大小: ${formatBytes(uploadResult.size)}`); // 用于提取备份大小
    
  } catch (err) {
    error(`备份任务失败: ${err.message}`);
    
    // 发送失败通知
    const message = `备份任务执行失败\n\n❌ 错误信息:\n${err.message}`;
    await sendWechatNotification(message, 'error');
    
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}
