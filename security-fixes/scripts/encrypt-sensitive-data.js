/**
 * 敏感数据加密修复脚本
 *
 * 功能：
 * 1. 创建加密工具模块
 * 2. 迁移现有明文敏感数据
 * 3. 更新相关代码以支持加密存储
 * 4. 验证加密功能
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

class SensitiveDataEncryptor {
  constructor() {
    this.projectRoot = path.join(__dirname, '../..');
    this.dbPath = path.join(this.projectRoot, 'data/logistics.db');
    this.utilsPath = path.join(this.projectRoot, 'utils');
    this.encryptionUtilPath = path.join(this.utilsPath, 'encryption.js');
    this.backupRoutesPath = path.join(this.projectRoot, 'routes/backupRoutes.js');
    this.qiniuScriptPath = path.join(this.projectRoot, 'scripts/qiniu-backup.js');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '✅';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  // 生成加密密钥
  generateEncryptionKey() {
    const key = crypto.randomBytes(32).toString('hex');
    this.log(`生成加密密钥: ${key.substring(0, 16)}...（已截断显示）`);
    return key;
  }

  // 备份文件
  backupFile(filePath) {
    if (fs.existsSync(filePath)) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      this.log(`已备份文件: ${path.basename(filePath)} -> ${path.basename(backupPath)}`);
      return backupPath;
    }
    return null;
  }

  // 创建加密工具模块
  createEncryptionUtil() {
    this.log('创建加密工具模块...');

    const encryptionCode = `const crypto = require('crypto');
const logger = require('../config/logger');

// 加密配置
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY must be set in production environment');
  }
  // 开发环境使用固定密钥（仅用于测试）
  return crypto.createHash('sha256').update('dev-encryption-key').digest();
})();

/**
 * 加密文本
 * @param {string} text - 要加密的文本
 * @returns {string|null} - 加密后的字符串，格式：iv:authTag:encrypted
 */
function encrypt(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // 返回格式：iv:authTag:encrypted
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error('加密失败:', { error: error.message });
    throw new Error('数据加密失败');
  }
}

/**
 * 解密文本
 * @param {string} encryptedData - 加密的数据
 * @returns {string|null} - 解密后的文本
 */
function decrypt(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return null;
  }

  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('解密失败:', { error: error.message });
    throw new Error('数据解密失败');
  }
}

/**
 * 检查数据是否已加密
 * @param {string} data - 要检查的数据
 * @returns {boolean} - 是否已加密
 */
function isEncrypted(data) {
  if (!data || typeof data !== 'string') {
    return false;
  }
  
  // 检查是否符合加密格式：iv:authTag:encrypted
  const parts = data.split(':');
  return parts.length === 3 && 
         parts[0].length === 32 && // IV长度
         parts[1].length === 32 && // AuthTag长度
         parts[2].length > 0;      // 加密数据
}

/**
 * 安全地加密敏感字段
 * @param {object} data - 包含敏感字段的对象
 * @param {string[]} sensitiveFields - 需要加密的字段名数组
 * @returns {object} - 加密后的对象
 */
function encryptSensitiveFields(data, sensitiveFields) {
  const result = { ...data };
  
  sensitiveFields.forEach(field => {
    if (result[field] && !isEncrypted(result[field])) {
      result[field] = encrypt(result[field]);
    }
  });
  
  return result;
}

/**
 * 安全地解密敏感字段
 * @param {object} data - 包含加密字段的对象
 * @param {string[]} sensitiveFields - 需要解密的字段名数组
 * @returns {object} - 解密后的对象
 */
function decryptSensitiveFields(data, sensitiveFields) {
  const result = { ...data };
  
  sensitiveFields.forEach(field => {
    if (result[field] && isEncrypted(result[field])) {
      result[field] = decrypt(result[field]);
    }
  });
  
  return result;
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  encryptSensitiveFields,
  decryptSensitiveFields
};`;

    // 确保utils目录存在
    if (!fs.existsSync(this.utilsPath)) {
      fs.mkdirSync(this.utilsPath, { recursive: true });
    }

    fs.writeFileSync(this.encryptionUtilPath, encryptionCode);
    this.log('✅ 加密工具模块创建完成');
  }

  // 更新环境变量配置
  updateEnvFile(encryptionKey) {
    this.log('更新.env文件中的ENCRYPTION_KEY...');

    const envPath = path.join(this.projectRoot, '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // 更新或添加ENCRYPTION_KEY
    const encryptionKeyRegex = /^ENCRYPTION_KEY=.*$/m;
    if (encryptionKeyRegex.test(envContent)) {
      envContent = envContent.replace(encryptionKeyRegex, `ENCRYPTION_KEY=${encryptionKey}`);
      this.log('已更新现有的ENCRYPTION_KEY');
    } else {
      envContent += `\n# 数据加密配置\nENCRYPTION_KEY=${encryptionKey}\n`;
      this.log('已添加新的ENCRYPTION_KEY');
    }

    fs.writeFileSync(envPath, envContent);
    this.log('✅ .env文件更新完成');
  }

  // 迁移数据库中的敏感数据
  async migrateDatabase() {
    this.log('开始迁移数据库中的敏感数据...');

    if (!fs.existsSync(this.dbPath)) {
      this.log('数据库文件不存在，跳过数据迁移', 'warn');
      return;
    }

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);

      // 导入加密工具
      const { encrypt, isEncrypted } = require(this.encryptionUtilPath);

      db.serialize(() => {
        // 查询所有备份配置
        db.all('SELECT * FROM backup_config', (err, rows) => {
          if (err) {
            this.log(`查询备份配置失败: ${err.message}`, 'error');
            reject(err);
            return;
          }

          if (rows.length === 0) {
            this.log('未找到需要迁移的备份配置');
            resolve();
            return;
          }

          let migratedCount = 0;
          const totalCount = rows.length;

          rows.forEach(row => {
            let needsUpdate = false;
            const updates = [];
            const values = [];

            // 检查并加密qiniu_secret_key
            if (row.qiniu_secret_key && !isEncrypted(row.qiniu_secret_key)) {
              const encrypted = encrypt(row.qiniu_secret_key);
              updates.push('qiniu_secret_key = ?');
              values.push(encrypted);
              needsUpdate = true;
              this.log(`加密七牛云密钥 (ID: ${row.id})`);
            }

            // 检查并加密qiniu_access_key（如果需要）
            if (row.qiniu_access_key && !isEncrypted(row.qiniu_access_key)) {
              const encrypted = encrypt(row.qiniu_access_key);
              updates.push('qiniu_access_key = ?');
              values.push(encrypted);
              needsUpdate = true;
              this.log(`加密七牛云访问密钥 (ID: ${row.id})`);
            }

            if (needsUpdate) {
              values.push(row.id);
              const sql = `UPDATE backup_config SET ${updates.join(', ')} WHERE id = ?`;

              db.run(sql, values, function (updateErr) {
                if (updateErr) {
                  this.log(`更新配置失败 (ID: ${row.id}): ${updateErr.message}`, 'error');
                } else {
                  this.log(`✅ 配置加密完成 (ID: ${row.id})`);
                }

                migratedCount++;
                if (migratedCount === totalCount) {
                  db.close();
                  resolve();
                }
              });
            } else {
              migratedCount++;
              if (migratedCount === totalCount) {
                db.close();
                resolve();
              }
            }
          });
        });
      });
    });
  }

  // 更新备份路由代码
  updateBackupRoutes() {
    this.log('更新备份路由代码...');

    if (!fs.existsSync(this.backupRoutesPath)) {
      this.log('备份路由文件不存在，跳过更新', 'warn');
      return;
    }

    this.backupFile(this.backupRoutesPath);
    let content = fs.readFileSync(this.backupRoutesPath, 'utf8');

    // 添加加密工具导入
    if (!content.includes("require('../utils/encryption')")) {
      const requirePattern = /const\s+\w+\s*=\s*require\([^)]+\);?\s*$/m;
      const lastRequire = content.match(requirePattern);
      if (lastRequire) {
        content = content.replace(
          lastRequire[0],
          lastRequire[0] +
            "\nconst { encrypt, decrypt, isEncrypted } = require('../utils/encryption');"
        );
      }
    }

    // 更新获取配置的代码
    const getConfigPattern = /\/\/ 隐藏敏感信息[\s\S]*?res\.json\(config\);/;
    const newGetConfigCode = `// 隐藏敏感信息
    const config = {
      ...row,
      qiniu_secret_key: row.qiniu_secret_key ? '***已配置***' : '',
      qiniu_access_key: row.qiniu_access_key ? '***已配置***' : '',
      auto_backup_enabled: Boolean(row.auto_backup_enabled),
      notification_enabled: Boolean(row.notification_enabled)
    };

    res.json(config);`;

    if (getConfigPattern.test(content)) {
      content = content.replace(getConfigPattern, newGetConfigCode);
      this.log('已更新获取配置的代码');
    }

    // 更新保存配置的代码
    const saveSecretPattern =
      /if \(qiniu_secret_key[\s\S]*?updateValues\.push\(qiniu_secret_key\);[\s\S]*?}/;
    const newSaveSecretCode = `if (qiniu_secret_key !== undefined && qiniu_secret_key !== '***已配置***') {
    updateFields.push('qiniu_secret_key = ?');
    updateValues.push(encrypt(qiniu_secret_key));
  }

  if (qiniu_access_key !== undefined && qiniu_access_key !== '***已配置***') {
    updateFields.push('qiniu_access_key = ?');
    updateValues.push(encrypt(qiniu_access_key));
  }`;

    if (saveSecretPattern.test(content)) {
      content = content.replace(saveSecretPattern, newSaveSecretCode);
      this.log('已更新保存配置的代码');
    }

    fs.writeFileSync(this.backupRoutesPath, content);
    this.log('✅ 备份路由代码更新完成');
  }

  // 更新七牛云备份脚本
  updateQiniuScript() {
    this.log('更新七牛云备份脚本...');

    if (!fs.existsSync(this.qiniuScriptPath)) {
      this.log('七牛云备份脚本不存在，跳过更新', 'warn');
      return;
    }

    this.backupFile(this.qiniuScriptPath);
    let content = fs.readFileSync(this.qiniuScriptPath, 'utf8');

    // 添加加密工具导入
    if (!content.includes("require('../utils/encryption')")) {
      const requirePattern = /const\s+\w+\s*=\s*require\([^)]+\);?\s*$/m;
      const matches = content.match(new RegExp(requirePattern.source, 'gm'));
      if (matches && matches.length > 0) {
        const lastRequire = matches[matches.length - 1];
        content = content.replace(
          lastRequire,
          lastRequire + "\nconst { decrypt } = require('../utils/encryption');"
        );
      }
    }

    // 更新配置读取代码
    const configPattern = /QINIU_CONFIG = {[\s\S]*?};/;
    const newConfigCode = `QINIU_CONFIG = {
        accessKey: decrypt(row.qiniu_access_key) || process.env.QINIU_ACCESS_KEY,
        secretKey: decrypt(row.qiniu_secret_key) || process.env.QINIU_SECRET_KEY,
        bucket: row.qiniu_bucket || process.env.QINIU_BUCKET,
        zone: row.qiniu_zone || process.env.QINIU_ZONE || 'z0'
      };`;

    if (configPattern.test(content)) {
      content = content.replace(configPattern, newConfigCode);
      this.log('已更新七牛云配置读取代码');
    }

    fs.writeFileSync(this.qiniuScriptPath, content);
    this.log('✅ 七牛云备份脚本更新完成');
  }

  // 验证加密功能
  async verifyEncryption() {
    this.log('验证加密功能...');

    try {
      const { encrypt, decrypt, isEncrypted } = require(this.encryptionUtilPath);

      // 测试加密解密
      const testData = 'test-secret-key-12345';
      const encrypted = encrypt(testData);
      const decrypted = decrypt(encrypted);

      if (decrypted !== testData) {
        this.log('加密解密测试失败', 'error');
        return false;
      }

      if (!isEncrypted(encrypted)) {
        this.log('加密格式检测失败', 'error');
        return false;
      }

      this.log('✅ 加密功能验证成功');
      return true;
    } catch (error) {
      this.log(`加密功能验证失败: ${error.message}`, 'error');
      return false;
    }
  }

  // 生成修复报告
  generateReport(encryptionKey) {
    const report = {
      timestamp: new Date().toISOString(),
      action: 'Sensitive Data Encryption',
      changes: [
        {
          file: 'utils/encryption.js',
          action: 'Created encryption utility module',
        },
        {
          file: '.env',
          action: 'Added ENCRYPTION_KEY configuration',
        },
        {
          file: 'routes/backupRoutes.js',
          action: 'Updated to use encrypted storage',
        },
        {
          file: 'scripts/qiniu-backup.js',
          action: 'Updated to decrypt sensitive data',
        },
        {
          database: 'backup_config table',
          action: 'Migrated sensitive data to encrypted format',
        },
      ],
      encryptionKeyLength: encryptionKey.length,
      recommendations: [
        '确保ENCRYPTION_KEY环境变量在生产环境中正确设置',
        '定期轮换加密密钥以提高安全性',
        '备份加密密钥到安全位置',
        '测试备份和恢复功能以确保加密正常工作',
      ],
    };

    const reportPath = path.join(
      __dirname,
      '../backups',
      `encryption-fix-report-${Date.now()}.json`
    );

    // 确保备份目录存在
    const backupDir = path.dirname(reportPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`修复报告已保存: ${reportPath}`);

    return report;
  }

  // 主修复流程
  async run() {
    this.log('开始敏感数据加密修复...');

    try {
      // 1. 生成加密密钥
      const encryptionKey = this.generateEncryptionKey();

      // 2. 创建加密工具模块
      this.createEncryptionUtil();

      // 3. 更新环境变量
      this.updateEnvFile(encryptionKey);

      // 4. 验证加密功能
      const isValid = await this.verifyEncryption();
      if (!isValid) {
        this.log('加密功能验证失败', 'error');
        return false;
      }

      // 5. 迁移数据库数据
      await this.migrateDatabase();

      // 6. 更新相关代码
      this.updateBackupRoutes();
      this.updateQiniuScript();

      // 7. 生成修复报告
      const report = this.generateReport(encryptionKey);

      this.log('🎉 敏感数据加密修复完成！');
      this.log('');
      this.log('重要提醒：');
      this.log('1. 请重启应用服务器以使新配置生效');
      this.log('2. 确保生产环境的ENCRYPTION_KEY环境变量已正确设置');
      this.log('3. 测试备份功能以确保加密正常工作');

      return true;
    } catch (error) {
      this.log(`修复过程出错：${error.message}`, 'error');
      this.log('请检查错误信息并手动修复', 'error');
      return false;
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const encryptor = new SensitiveDataEncryptor();
  encryptor.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = SensitiveDataEncryptor;
