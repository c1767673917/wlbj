/**
 * 订单ID生成服务
 * 解决原系统中订单ID生成的数据污染问题
 * 使用专门的序列表确保并发安全和数据一致性
 */

const { db, transactionManager } = require('../config/database');
const { logger } = require('../config/logger');

class OrderIdService {
  constructor() {
    this.dateFormat = 'YYYYMMDD';
  }

  /**
   * 生成订单ID
   * 格式: RX + yymmdd + "-" + 3位流水号
   * @returns {Promise<string>} 订单ID
   */
  async generateOrderId() {
    try {
      const result = await transactionManager.executeWithRetry(async (trx) => {
        const now = new Date();
        const dateStr = this.formatDate(now);
        const shortYear = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const datePrefix = `${shortYear}${month}${day}`;

        // 使用原子操作获取并更新序列号
        const sequence = await this.getNextSequence(trx, dateStr);
        const orderId = `RX${datePrefix}-${sequence.toString().padStart(3, '0')}`;

        logger.info('订单ID生成成功', {
          orderId,
          date: dateStr,
          sequence,
          operation: 'generateOrderId'
        });

        return orderId;
      });

      return result;
    } catch (error) {
      logger.error('订单ID生成失败', {
        error: error.message,
        stack: error.stack,
        operation: 'generateOrderId'
      });
      throw new Error(`订单ID生成失败: ${error.message}`);
    }
  }

  /**
   * 获取下一个序列号（原子操作）
   * @param {Object} trx - 数据库事务对象
   * @param {string} dateStr - 日期字符串
   * @returns {Promise<number>} 序列号
   */
  async getNextSequence(trx, dateStr) {
    // 尝试插入新的日期记录，如果已存在则忽略
    await trx.raw(`
      INSERT OR IGNORE INTO order_sequences (date, sequence, created_at, updated_at) 
      VALUES (?, 0, datetime('now'), datetime('now'))
    `, [dateStr]);

    // 原子性地增加序列号并返回新值
    const result = await trx.raw(`
      UPDATE order_sequences 
      SET sequence = sequence + 1, updated_at = datetime('now')
      WHERE date = ?
      RETURNING sequence
    `, [dateStr]);

    if (!result || result.length === 0) {
      throw new Error(`无法获取日期 ${dateStr} 的序列号`);
    }

    return result[0].sequence;
  }

  /**
   * 格式化日期为YYYYMMDD格式
   * @param {Date} date - 日期对象
   * @returns {string} 格式化的日期字符串
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * 获取指定日期的当前序列号（不增加）
   * @param {string} dateStr - 日期字符串，可选，默认为今天
   * @returns {Promise<number>} 当前序列号
   */
  async getCurrentSequence(dateStr = null) {
    try {
      const targetDate = dateStr || this.formatDate(new Date());
      
      const result = await db('order_sequences')
        .select('sequence')
        .where('date', targetDate)
        .first();

      return result ? result.sequence : 0;
    } catch (error) {
      logger.error('获取当前序列号失败', {
        error: error.message,
        dateStr,
        operation: 'getCurrentSequence'
      });
      throw error;
    }
  }

  /**
   * 重置指定日期的序列号（谨慎使用）
   * @param {string} dateStr - 日期字符串
   * @param {number} sequence - 新的序列号，默认为0
   * @returns {Promise<void>}
   */
  async resetSequence(dateStr, sequence = 0) {
    try {
      await transactionManager.executeTransaction(async (trx) => {
        await trx('order_sequences')
          .where('date', dateStr)
          .update({
            sequence,
            updated_at: trx.fn.now()
          });

        logger.warn('序列号已重置', {
          dateStr,
          newSequence: sequence,
          operation: 'resetSequence'
        });
      });
    } catch (error) {
      logger.error('重置序列号失败', {
        error: error.message,
        dateStr,
        sequence,
        operation: 'resetSequence'
      });
      throw error;
    }
  }

  /**
   * 验证订单ID格式
   * @param {string} orderId - 订单ID
   * @returns {boolean} 是否有效
   */
  validateOrderId(orderId) {
    // 格式: RX + yymmdd + "-" + 3位数字
    const pattern = /^RX\d{6}-\d{3}$/;
    return pattern.test(orderId);
  }

  /**
   * 从订单ID中提取日期信息
   * @param {string} orderId - 订单ID
   * @returns {Object|null} 日期信息对象或null
   */
  parseOrderId(orderId) {
    if (!this.validateOrderId(orderId)) {
      return null;
    }

    const match = orderId.match(/^RX(\d{2})(\d{2})(\d{2})-(\d{3})$/);
    if (!match) {
      return null;
    }

    const [, year, month, day, sequence] = match;
    const fullYear = 2000 + parseInt(year, 10);

    return {
      year: fullYear,
      month: parseInt(month, 10),
      day: parseInt(day, 10),
      sequence: parseInt(sequence, 10),
      date: new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10))
    };
  }
}

module.exports = OrderIdService;
