const knex = require('knex');
const knexConfig = require('../../knexfile');
const logger = require('./logger');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

// 创建数据库连接
const db = knex(config);

// 数据库连接测试
async function testConnection() {
  try {
    await db.raw('SELECT 1');
    logger.info('数据库连接成功', { environment });
    return true;
  } catch (error) {
    logger.error('数据库连接失败', { error: error.message, environment });
    throw error;
  }
}

// 优雅关闭数据库连接
async function closeConnection() {
  try {
    await db.destroy();
    logger.info('数据库连接已关闭');
  } catch (error) {
    logger.error('关闭数据库连接失败', { error: error.message });
    throw error;
  }
}

// 事务管理器
class TransactionManager {
  async executeTransaction(callback) {
    const trx = await db.transaction();
    
    try {
      const result = await callback(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async executeWithRetry(callback, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeTransaction(callback);
      } catch (error) {
        lastError = error;
        
        // 如果是数据库锁定错误，等待后重试
        if (error.code === 'SQLITE_BUSY' && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }
}

const transactionManager = new TransactionManager();

module.exports = {
  db,
  testConnection,
  closeConnection,
  transactionManager,
};
