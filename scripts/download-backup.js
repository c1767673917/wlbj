// 物流报价系统 - 下载最新备份脚本

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const APP_DIR = path.join(__dirname, '..');
const DOWNLOAD_DIR = path.join(APP_DIR, 'downloads');

// 从环境变量获取七牛云配置
const QINIU_CONFIG = {
  accessKey: process.env.QINIU_ACCESS_KEY,
  secretKey: process.env.QINIU_SECRET_KEY,
  bucket: process.env.QINIU_BUCKET,
  zone: process.env.QINIU_ZONE || 'z0',
};

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function error(message) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❌ ${message}`);
}

// 检查七牛云配置
function checkQiniuConfig() {
  if (!QINIU_CONFIG.accessKey || !QINIU_CONFIG.secretKey || !QINIU_CONFIG.bucket) {
    throw new Error('七牛云配置不完整');
  }
}

// 创建下载目录
function createDownloadDir() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
  return DOWNLOAD_DIR;
}

// 获取最新备份文件列表
function getLatestBackupFromQiniu() {
  log('获取七牛云最新备份文件...');

  try {
    // 检查qshell工具
    execSync('which qshell', { stdio: 'ignore' });
  } catch (err) {
    throw new Error('qshell工具未安装，请先安装七牛云工具');
  }

  // 配置qshell
  try {
    execSync(
      `qshell account "${QINIU_CONFIG.accessKey}" "${QINIU_CONFIG.secretKey}" "download-account"`
    );
  } catch (err) {
    if (err.message.includes('already exist')) {
      try {
        execSync('qshell user rm download-account');
        execSync(
          `qshell account "${QINIU_CONFIG.accessKey}" "${QINIU_CONFIG.secretKey}" "download-account"`
        );
      } catch (retryErr) {
        log('qshell账户配置警告，但继续执行下载');
      }
    } else {
      throw err;
    }
  }

  // 列出统一备份包
  try {
    const listOutput = execSync(
      `qshell listbucket "${QINIU_CONFIG.bucket}" "unified-backups/wlbj-logistics/" ""`,
      { encoding: 'utf8' }
    );
    const lines = listOutput.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('未找到任何备份文件');
    }

    // 解析文件列表，找到最新的备份文件
    const backupFiles = lines
      .map(line => {
        const parts = line.split('\t');
        if (parts.length >= 4) {
          return {
            key: parts[0],
            size: parseInt(parts[1]),
            hash: parts[2],
            mtime: parseInt(parts[3]),
          };
        }
        return null;
      })
      .filter(file => file && file.key.endsWith('.tar.gz'))
      .sort((a, b) => b.mtime - a.mtime);

    if (backupFiles.length === 0) {
      throw new Error('未找到有效的备份文件');
    }

    return backupFiles[0];
  } catch (err) {
    throw new Error(`获取备份文件列表失败: ${err.message}`);
  }
}

// 下载备份文件
function downloadBackupFile(backupFile, downloadDir) {
  log(`开始下载备份文件: ${backupFile.key}`);

  const fileName = path.basename(backupFile.key);
  const localPath = path.join(downloadDir, fileName);

  try {
    execSync(`qshell qdownload "${QINIU_CONFIG.bucket}" "${backupFile.key}" "${localPath}"`);

    if (fs.existsSync(localPath)) {
      const localSize = fs.statSync(localPath).size;
      if (localSize === backupFile.size) {
        log(`备份文件下载成功: ${fileName} (${formatBytes(localSize)})`);
        return localPath;
      } else {
        throw new Error(`文件大小不匹配，期望: ${backupFile.size}, 实际: ${localSize}`);
      }
    } else {
      throw new Error('下载的文件不存在');
    }
  } catch (err) {
    throw new Error(`下载备份文件失败: ${err.message}`);
  }
}

// 格式化字节大小
function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 主函数
async function main() {
  try {
    log('开始下载最新备份...');

    // 检查配置
    checkQiniuConfig();

    // 创建下载目录
    const downloadDir = createDownloadDir();
    log(`下载目录: ${downloadDir}`);

    // 获取最新备份文件信息
    const latestBackup = getLatestBackupFromQiniu();
    log(`找到最新备份: ${latestBackup.key}`);

    // 下载备份文件
    const localPath = downloadBackupFile(latestBackup, downloadDir);

    log('🎉 备份下载完成');
    console.log(`下载文件路径: ${localPath}`); // 用于API提取文件路径
  } catch (err) {
    error(`备份下载失败: ${err.message}`);
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}
