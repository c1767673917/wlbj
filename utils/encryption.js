/**
 * 敏感数据加密工具模块
 *
 * 提供AES-256-GCM加密算法来保护敏感信息
 * 包括API密钥、密码等敏感数据的加密和解密
 */

const crypto = require('crypto');
const logger = require('../config/logger');

// 加密配置
const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 256位密钥
const IV_LENGTH = 16; // 128位初始化向量

// 获取加密密钥
function getEncryptionKey() {
  // 优先使用环境变量中的加密密钥
  if (process.env.ENCRYPTION_KEY) {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    if (key.length === KEY_LENGTH) {
      return key;
    }
    logger.warn('ENCRYPTION_KEY长度不正确，使用默认密钥生成方式');
  }

  // 基于JWT密钥生成加密密钥
  const jwtSecret = process.env.JWT_SECRET || 'fallback-key';
  return crypto.scryptSync(jwtSecret, 'encryption-salt', KEY_LENGTH);
}

/**
 * 加密文本数据
 * @param {string} text - 要加密的明文
 * @returns {string|null} - 加密后的数据（格式：iv:tag:encrypted）或null
 */
function encrypt(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 返回格式：iv:encrypted
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error('数据加密失败:', {
      error: error.message,
      textLength: text.length,
    });
    return null;
  }
}

/**
 * 解密文本数据
 * @param {string} encryptedData - 加密的数据（格式：iv:tag:encrypted）
 * @returns {string|null} - 解密后的明文或null
 */
function decrypt(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return null;
  }

  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      // 可能是未加密的数据，直接返回
      return encryptedData;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('数据解密失败:', {
      error: error.message,
      dataLength: encryptedData.length,
    });
    // 如果解密失败，可能是未加密的数据，返回原数据
    return encryptedData;
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

  // 检查是否符合加密数据格式：iv:encrypted
  const parts = data.split(':');
  if (parts.length !== 2) {
    return false;
  }

  // 检查IV长度是否正确
  try {
    const iv = Buffer.from(parts[0], 'hex');

    return iv.length === IV_LENGTH;
  } catch (error) {
    return false;
  }
}

/**
 * 生成新的加密密钥
 * @returns {string} - 十六进制格式的密钥
 */
function generateEncryptionKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * 批量加密对象中的敏感字段
 * @param {Object} obj - 包含敏感数据的对象
 * @param {Array} sensitiveFields - 需要加密的字段名数组
 * @returns {Object} - 加密后的对象
 */
function encryptSensitiveFields(obj, sensitiveFields) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result = { ...obj };

  sensitiveFields.forEach(field => {
    if (result[field] && !isEncrypted(result[field])) {
      const encrypted = encrypt(result[field]);
      if (encrypted) {
        result[field] = encrypted;
      }
    }
  });

  return result;
}

/**
 * 批量解密对象中的敏感字段
 * @param {Object} obj - 包含加密数据的对象
 * @param {Array} sensitiveFields - 需要解密的字段名数组
 * @returns {Object} - 解密后的对象
 */
function decryptSensitiveFields(obj, sensitiveFields) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result = { ...obj };

  sensitiveFields.forEach(field => {
    if (result[field]) {
      const decrypted = decrypt(result[field]);
      if (decrypted) {
        result[field] = decrypted;
      }
    }
  });

  return result;
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  generateEncryptionKey,
  encryptSensitiveFields,
  decryptSensitiveFields,
};
