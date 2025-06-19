// 物流报价系统 - 备份文件验证脚本

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// 获取命令行参数
const backupFilePath = process.argv[2];

if (!backupFilePath || !fs.existsSync(backupFilePath)) {
  console.error(
    JSON.stringify({
      valid: false,
      error: '备份文件路径无效',
    })
  );
  process.exit(1);
}

// 配置
const VERIFY_TEMP_DIR = path.join(__dirname, '..', 'temp_verify');

// 验证结果
const result = {
  valid: false,
  metadata: null,
  components: [],
  errors: [],
  warnings: [],
};

// 日志函数
function log(message) {
  // 验证脚本的日志不输出到stdout，避免干扰JSON结果
}

function addError(message) {
  result.errors.push(message);
}

function addWarning(message) {
  result.warnings.push(message);
}

// 清理临时目录
function cleanup() {
  if (fs.existsSync(VERIFY_TEMP_DIR)) {
    fs.rmSync(VERIFY_TEMP_DIR, { recursive: true, force: true });
  }
}

// 验证文件格式
function verifyFileFormat() {
  const fileExtension = path.extname(backupFilePath).toLowerCase();
  const fileName = path.basename(backupFilePath).toLowerCase();

  if (!fileName.endsWith('.tar.gz') && !fileName.endsWith('.zip')) {
    addError('不支持的文件格式，仅支持 .tar.gz 和 .zip 格式');
    return false;
  }

  // 检查文件大小
  const stats = fs.statSync(backupFilePath);
  if (stats.size === 0) {
    addError('备份文件为空');
    return false;
  }

  if (stats.size > 500 * 1024 * 1024) {
    // 500MB
    addWarning('备份文件较大，可能需要较长时间处理');
  }

  return true;
}

// 解压并验证备份文件
function extractAndVerify() {
  // 清理并创建临时目录
  cleanup();
  fs.mkdirSync(VERIFY_TEMP_DIR, { recursive: true });

  try {
    // 解压备份文件
    if (backupFilePath.toLowerCase().endsWith('.tar.gz')) {
      execSync(`tar -xzf "${backupFilePath}" -C "${VERIFY_TEMP_DIR}"`);
    } else if (backupFilePath.toLowerCase().endsWith('.zip')) {
      execSync(`unzip -q "${backupFilePath}" -d "${VERIFY_TEMP_DIR}"`);
    }

    // 查找解压后的备份目录
    const items = fs.readdirSync(VERIFY_TEMP_DIR);
    const backupDir = items.find(item => {
      const itemPath = path.join(VERIFY_TEMP_DIR, item);
      return fs.statSync(itemPath).isDirectory();
    });

    if (!backupDir) {
      addError('备份文件格式无效，未找到备份目录');
      return null;
    }

    return path.join(VERIFY_TEMP_DIR, backupDir);
  } catch (err) {
    addError(`解压备份文件失败: ${err.message}`);
    return null;
  }
}

// 验证备份元数据
function verifyMetadata(backupDir) {
  const metadataPath = path.join(backupDir, 'backup-metadata.json');

  if (!fs.existsSync(metadataPath)) {
    addWarning('未找到备份元数据文件，这可能是旧版本的备份');
    return null;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    // 验证必需字段
    const requiredFields = ['version', 'timestamp', 'created_at', 'backup_info'];
    for (const field of requiredFields) {
      if (!metadata[field]) {
        addError(`备份元数据缺少必需字段: ${field}`);
        return null;
      }
    }

    // 验证版本兼容性
    if (metadata.version && !metadata.version.startsWith('2.')) {
      addWarning(`备份版本 ${metadata.version} 可能不完全兼容当前系统`);
    }

    result.metadata = metadata;
    return metadata;
  } catch (err) {
    addError(`备份元数据格式无效: ${err.message}`);
    return null;
  }
}

// 验证数据库组件
function verifyDatabaseComponent(backupDir) {
  const dbDir = path.join(backupDir, 'database');

  if (!fs.existsSync(dbDir)) {
    addError('缺少数据库备份组件');
    return false;
  }

  const dbFiles = fs.readdirSync(dbDir).filter(file => file.endsWith('.db.gz'));

  if (dbFiles.length === 0) {
    addError('数据库备份目录中未找到数据库文件');
    return false;
  }

  if (dbFiles.length > 1) {
    addWarning('数据库备份目录中包含多个数据库文件');
  }

  // 检查数据库文件大小
  const dbFile = path.join(dbDir, dbFiles[0]);
  const stats = fs.statSync(dbFile);

  if (stats.size < 100) {
    // 小于100字节可能是空文件
    addWarning('数据库备份文件可能为空或损坏');
  }

  result.components.push({
    name: 'database',
    status: 'valid',
    files: dbFiles,
    size: stats.size,
  });

  return true;
}

// 验证配置组件
function verifyConfigComponent(backupDir) {
  const configDir = path.join(backupDir, 'configs');

  if (!fs.existsSync(configDir)) {
    addError('缺少配置备份组件');
    return false;
  }

  const configFiles = fs.readdirSync(configDir);

  if (configFiles.length === 0) {
    addError('配置备份目录为空');
    return false;
  }

  // 检查是否有压缩包或直接的配置文件
  const hasArchive = configFiles.some(file => file.endsWith('.tar.gz'));
  const hasDirectFiles = configFiles.some(file => file.includes('.env') || file.includes('.json'));

  if (!hasArchive && !hasDirectFiles) {
    addError('配置备份目录中未找到有效的配置文件');
    return false;
  }

  let totalSize = 0;
  configFiles.forEach(file => {
    const filePath = path.join(configDir, file);
    totalSize += fs.statSync(filePath).size;
  });

  result.components.push({
    name: 'configs',
    status: 'valid',
    files: configFiles,
    size: totalSize,
  });

  return true;
}

// 验证日志组件
function verifyLogComponent(backupDir) {
  const logDir = path.join(backupDir, 'logs');

  if (!fs.existsSync(logDir)) {
    addWarning('未找到日志备份组件（可选）');
    return true; // 日志是可选的
  }

  const logFiles = fs.readdirSync(logDir);

  if (logFiles.length === 0) {
    addWarning('日志备份目录为空');
    return true;
  }

  let totalSize = 0;
  logFiles.forEach(file => {
    const filePath = path.join(logDir, file);
    totalSize += fs.statSync(filePath).size;
  });

  result.components.push({
    name: 'logs',
    status: 'valid',
    files: logFiles,
    size: totalSize,
  });

  return true;
}

// 验证校验和（如果存在）
function verifyChecksum(backupDir, metadata) {
  if (!metadata || !metadata.checksum) {
    addWarning('备份文件未包含校验和，无法验证完整性');
    return true;
  }

  try {
    // 计算当前文件的校验和
    const hash = crypto.createHash('sha256');
    const fileBuffer = fs.readFileSync(backupFilePath);
    hash.update(fileBuffer);
    const currentChecksum = hash.digest('hex');

    if (currentChecksum !== metadata.checksum) {
      addError('备份文件校验和不匹配，文件可能已损坏');
      return false;
    }

    return true;
  } catch (err) {
    addError(`校验和验证失败: ${err.message}`);
    return false;
  }
}

// 主验证函数
function main() {
  try {
    // 验证文件格式
    if (!verifyFileFormat()) {
      cleanup();
      console.log(JSON.stringify(result));
      process.exit(1);
    }

    // 解压并获取备份目录
    const backupDir = extractAndVerify();
    if (!backupDir) {
      cleanup();
      console.log(JSON.stringify(result));
      process.exit(1);
    }

    // 验证备份元数据
    const metadata = verifyMetadata(backupDir);

    // 验证各个组件
    const dbValid = verifyDatabaseComponent(backupDir);
    const configValid = verifyConfigComponent(backupDir);
    const logValid = verifyLogComponent(backupDir);

    // 验证校验和
    const checksumValid = verifyChecksum(backupDir, metadata);

    // 确定整体验证结果
    result.valid =
      dbValid && configValid && logValid && checksumValid && result.errors.length === 0;

    // 添加总结信息
    if (result.valid) {
      result.message = '备份文件验证通过，可以安全恢复';
    } else {
      result.message = `备份文件验证失败，发现 ${result.errors.length} 个错误`;
    }

    // 清理临时文件
    cleanup();

    // 输出验证结果
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    addError(`验证过程出错: ${err.message}`);
    cleanup();
    console.log(JSON.stringify(result));
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}
