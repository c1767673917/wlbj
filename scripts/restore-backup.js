#!/usr/bin/env node

// 物流报价系统 - 恢复备份脚本

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// 配置
const APP_DIR = path.join(__dirname, '..');
const RESTORE_TEMP_DIR = path.join(APP_DIR, 'temp_restore');

// 获取命令行参数
const backupFilePath = process.argv[2];
const optionsJson = process.argv[3];

if (!backupFilePath || !fs.existsSync(backupFilePath)) {
  console.error('错误: 备份文件路径无效');
  process.exit(1);
}

let options;
try {
  options = JSON.parse(optionsJson || '{}');
} catch (e) {
  console.error('错误: 恢复选项格式无效');
  process.exit(1);
}

// 默认选项
const defaultOptions = {
  restoreDatabase: true,
  restoreConfigs: true,
  restoreLogs: false,
  createBackup: true,
  verifyIntegrity: true
};

options = { ...defaultOptions, ...options };

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function error(message) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❌ ${message}`);
}

// 创建恢复前备份
async function createPreRestoreBackup() {
  if (!options.createBackup) {
    log('跳过恢复前备份');
    return;
  }

  log('创建恢复前备份...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const preBackupDir = path.join(APP_DIR, 'backup', `pre-restore-${timestamp}`);
  
  if (!fs.existsSync(preBackupDir)) {
    fs.mkdirSync(preBackupDir, { recursive: true });
  }

  // 备份当前数据库
  const dbPath = path.join(APP_DIR, 'data', 'logistics.db');
  if (fs.existsSync(dbPath)) {
    const backupDbPath = path.join(preBackupDir, 'logistics.db');
    fs.copyFileSync(dbPath, backupDbPath);
    log('当前数据库已备份');
  }

  // 备份当前配置文件
  const configs = ['.env', 'auth_config.json', 'ip_whitelist.json'];
  for (const config of configs) {
    const configPath = path.join(APP_DIR, config);
    if (fs.existsSync(configPath)) {
      const backupConfigPath = path.join(preBackupDir, config);
      fs.copyFileSync(configPath, backupConfigPath);
      log(`配置文件已备份: ${config}`);
    }
  }

  log(`恢复前备份完成: ${preBackupDir}`);
}

// 解压备份文件
function extractBackupFile(backupFilePath) {
  log('解压备份文件...');
  
  // 清理并创建临时目录
  if (fs.existsSync(RESTORE_TEMP_DIR)) {
    fs.rmSync(RESTORE_TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(RESTORE_TEMP_DIR, { recursive: true });

  try {
    // 解压备份文件
    execSync(`tar -xzf "${backupFilePath}" -C "${RESTORE_TEMP_DIR}"`);
    
    // 查找解压后的备份目录
    const items = fs.readdirSync(RESTORE_TEMP_DIR);
    const backupDir = items.find(item => {
      const itemPath = path.join(RESTORE_TEMP_DIR, item);
      return fs.statSync(itemPath).isDirectory();
    });

    if (!backupDir) {
      throw new Error('备份文件格式无效，未找到备份目录');
    }

    const extractedPath = path.join(RESTORE_TEMP_DIR, backupDir);
    log(`备份文件解压完成: ${extractedPath}`);
    
    return extractedPath;
  } catch (err) {
    throw new Error(`解压备份文件失败: ${err.message}`);
  }
}

// 验证备份完整性
function verifyBackupIntegrity(backupDir) {
  log('验证备份完整性...');
  
  // 检查元数据文件
  const metadataPath = path.join(backupDir, 'backup-metadata.json');
  if (fs.existsSync(metadataPath)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      log(`备份版本: ${metadata.version}, 创建时间: ${metadata.created_at}`);
      
      // 验证备份组件
      const requiredDirs = [];
      if (options.restoreDatabase) requiredDirs.push('database');
      if (options.restoreConfigs) requiredDirs.push('configs');
      if (options.restoreLogs) requiredDirs.push('logs');
      
      for (const dir of requiredDirs) {
        const dirPath = path.join(backupDir, dir);
        if (!fs.existsSync(dirPath)) {
          throw new Error(`缺少必需的备份组件: ${dir}`);
        }
      }
      
      log('备份完整性验证通过');
    } catch (err) {
      throw new Error(`备份元数据验证失败: ${err.message}`);
    }
  } else {
    log('警告: 未找到备份元数据文件，跳过完整性验证');
  }
}

// 恢复数据库
async function restoreDatabase(backupDir) {
  if (!options.restoreDatabase) {
    log('跳过数据库恢复');
    return;
  }

  log('开始恢复数据库...');
  
  const dbBackupDir = path.join(backupDir, 'database');
  if (!fs.existsSync(dbBackupDir)) {
    log('警告: 数据库备份目录不存在，跳过数据库恢复');
    return;
  }

  // 查找数据库备份文件
  const dbFiles = fs.readdirSync(dbBackupDir).filter(file => file.endsWith('.db.gz'));
  if (dbFiles.length === 0) {
    log('警告: 未找到数据库备份文件，跳过数据库恢复');
    return;
  }

  const dbBackupFile = path.join(dbBackupDir, dbFiles[0]);
  const dbPath = path.join(APP_DIR, 'data', 'logistics.db');
  
  // 确保数据目录存在
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    // 解压并恢复数据库
    execSync(`gunzip -c "${dbBackupFile}" > "${dbPath}"`);
    
    // 设置正确的权限
    fs.chmodSync(dbPath, 0o644);
    
    log('数据库恢复完成');
    
    // 验证数据库完整性
    if (options.verifyIntegrity) {
      await verifyDatabaseIntegrity(dbPath);
    }
  } catch (err) {
    throw new Error(`数据库恢复失败: ${err.message}`);
  }
}

// 验证数据库完整性
async function verifyDatabaseIntegrity(dbPath) {
  return new Promise((resolve, reject) => {
    log('验证数据库完整性...');
    
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    
    db.get('PRAGMA integrity_check', (err, row) => {
      db.close();
      
      if (err) {
        reject(new Error(`数据库完整性检查失败: ${err.message}`));
        return;
      }
      
      if (row && row.integrity_check === 'ok') {
        log('数据库完整性验证通过');
        resolve();
      } else {
        reject(new Error('数据库完整性验证失败'));
      }
    });
  });
}

// 恢复配置文件
function restoreConfigs(backupDir) {
  if (!options.restoreConfigs) {
    log('跳过配置文件恢复');
    return;
  }

  log('开始恢复配置文件...');
  
  const configBackupDir = path.join(backupDir, 'configs');
  if (!fs.existsSync(configBackupDir)) {
    log('警告: 配置备份目录不存在，跳过配置恢复');
    return;
  }

  // 查找配置压缩包
  const configArchives = fs.readdirSync(configBackupDir).filter(file => file.endsWith('.tar.gz'));
  
  if (configArchives.length > 0) {
    // 解压配置文件
    const configArchive = path.join(configBackupDir, configArchives[0]);
    const tempConfigDir = path.join(RESTORE_TEMP_DIR, 'configs_temp');
    
    if (!fs.existsSync(tempConfigDir)) {
      fs.mkdirSync(tempConfigDir, { recursive: true });
    }
    
    try {
      execSync(`tar -xzf "${configArchive}" -C "${tempConfigDir}"`);
      
      // 恢复配置文件
      const configs = ['.env', 'auth_config.json', 'ip_whitelist.json'];
      for (const config of configs) {
        const configFile = path.join(tempConfigDir, config);
        if (fs.existsSync(configFile)) {
          const destPath = path.join(APP_DIR, config);
          fs.copyFileSync(configFile, destPath);
          log(`配置文件恢复: ${config}`);
        }
      }
    } catch (err) {
      throw new Error(`配置文件恢复失败: ${err.message}`);
    }
  } else {
    // 直接从备份目录恢复
    const configs = ['.env', 'auth_config.json', 'ip_whitelist.json'];
    for (const config of configs) {
      const configFiles = fs.readdirSync(configBackupDir).filter(file => file.startsWith(config));
      if (configFiles.length > 0) {
        const configFile = path.join(configBackupDir, configFiles[0]);
        const destPath = path.join(APP_DIR, config);
        fs.copyFileSync(configFile, destPath);
        log(`配置文件恢复: ${config}`);
      }
    }
  }

  log('配置文件恢复完成');
}

// 恢复日志文件
function restoreLogs(backupDir) {
  if (!options.restoreLogs) {
    log('跳过日志文件恢复');
    return;
  }

  log('开始恢复日志文件...');
  
  const logBackupDir = path.join(backupDir, 'logs');
  if (!fs.existsSync(logBackupDir)) {
    log('警告: 日志备份目录不存在，跳过日志恢复');
    return;
  }

  // 查找日志压缩包
  const logArchives = fs.readdirSync(logBackupDir).filter(file => file.endsWith('.tar.gz'));
  
  if (logArchives.length > 0) {
    const logArchive = path.join(logBackupDir, logArchives[0]);
    
    try {
      // 备份现有日志
      const logsDir = path.join(APP_DIR, 'logs');
      if (fs.existsSync(logsDir)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupLogsDir = path.join(APP_DIR, `logs_backup_${timestamp}`);
        fs.renameSync(logsDir, backupLogsDir);
        log(`现有日志已备份到: ${backupLogsDir}`);
      }
      
      // 解压日志文件
      execSync(`tar -xzf "${logArchive}" -C "${APP_DIR}"`);
      log('日志文件恢复完成');
    } catch (err) {
      throw new Error(`日志文件恢复失败: ${err.message}`);
    }
  } else {
    log('警告: 未找到日志备份文件');
  }
}

// 清理临时文件
function cleanup() {
  log('清理临时文件...');
  
  if (fs.existsSync(RESTORE_TEMP_DIR)) {
    fs.rmSync(RESTORE_TEMP_DIR, { recursive: true, force: true });
    log('临时文件清理完成');
  }
}

// 主函数
async function main() {
  try {
    log('开始执行恢复任务...');
    log(`备份文件: ${backupFilePath}`);
    log(`恢复选项: ${JSON.stringify(options)}`);
    
    // 创建恢复前备份
    await createPreRestoreBackup();
    
    // 解压备份文件
    const backupDir = extractBackupFile(backupFilePath);
    
    // 验证备份完整性
    verifyBackupIntegrity(backupDir);
    
    // 执行恢复
    await restoreDatabase(backupDir);
    restoreConfigs(backupDir);
    restoreLogs(backupDir);
    
    // 清理临时文件
    cleanup();
    
    log('🎉 数据恢复完成');
    
  } catch (err) {
    error(`数据恢复失败: ${err.message}`);
    
    // 清理临时文件
    cleanup();
    
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}
