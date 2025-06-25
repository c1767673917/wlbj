/**
 * 密码历史记录数据访问层
 * 管理用户密码历史记录的存储和查询
 */

const BaseRepository = require('./BaseRepository');
const { logger } = require('../config/logger');

class PasswordHistoryRepository extends BaseRepository {
  constructor() {
    super('password_history');
  }

  /**
   * 添加密码历史记录
   * @param {number} userId - 用户ID
   * @param {string} passwordHash - 密码哈希值
   * @param {string} ipAddress - IP地址
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 创建的记录
   */
  async addPasswordHistory(userId, passwordHash, ipAddress = null, trx = null) {
    try {
      const historyData = {
        user_id: userId,
        password_hash: passwordHash,
        created_by_ip: ipAddress,
        created_at: new Date()
      };

      const result = await this.create(historyData, trx);
      
      // 清理旧的密码历史记录，只保留最近的N条
      await this.cleanupOldHistory(userId, 5, trx);
      
      logger.info('密码历史记录已添加', {
        userId,
        historyId: result.id,
        ipAddress
      });

      return result;
    } catch (error) {
      logger.error('添加密码历史记录失败', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取用户的密码历史记录
   * @param {number} userId - 用户ID
   * @param {number} limit - 限制数量
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 密码历史记录列表
   */
  async getUserPasswordHistory(userId, limit = 5, trx = null) {
    try {
      const query = this.getQueryBuilder(trx)
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(limit);

      const history = await query;
      
      logger.debug('获取用户密码历史记录', {
        userId,
        count: history.length,
        limit
      });

      return history;
    } catch (error) {
      logger.error('获取用户密码历史记录失败', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取用户最近的密码哈希列表
   * @param {number} userId - 用户ID
   * @param {number} count - 数量
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 密码哈希列表
   */
  async getRecentPasswordHashes(userId, count = 5, trx = null) {
    try {
      const query = this.getQueryBuilder(trx)
        .select('password_hash')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(count);

      const results = await query;
      const hashes = results.map(row => row.password_hash);
      
      logger.debug('获取用户最近密码哈希', {
        userId,
        count: hashes.length
      });

      return hashes;
    } catch (error) {
      logger.error('获取用户最近密码哈希失败', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 清理旧的密码历史记录
   * @param {number} userId - 用户ID
   * @param {number} keepCount - 保留数量
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<number>} 删除的记录数
   */
  async cleanupOldHistory(userId, keepCount = 5, trx = null) {
    try {
      // 获取需要保留的记录ID
      const keepIds = await this.getQueryBuilder(trx)
        .select('id')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(keepCount);

      if (keepIds.length === 0) {
        return 0;
      }

      const keepIdList = keepIds.map(row => row.id);

      // 删除不在保留列表中的记录
      const deletedCount = await this.getQueryBuilder(trx)
        .where('user_id', userId)
        .whereNotIn('id', keepIdList)
        .del();

      if (deletedCount > 0) {
        logger.info('清理旧密码历史记录', {
          userId,
          deletedCount,
          keepCount
        });
      }

      return deletedCount;
    } catch (error) {
      logger.error('清理旧密码历史记录失败', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取密码历史统计信息
   * @param {number} userId - 用户ID
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 统计信息
   */
  async getPasswordHistoryStats(userId, trx = null) {
    try {
      const stats = await this.getQueryBuilder(trx)
        .where('user_id', userId)
        .select([
          this.db.raw('COUNT(*) as total_changes'),
          this.db.raw('MIN(created_at) as first_change'),
          this.db.raw('MAX(created_at) as last_change')
        ])
        .first();

      // 计算平均更改间隔
      if (stats.total_changes > 1 && stats.first_change && stats.last_change) {
        const firstDate = new Date(stats.first_change);
        const lastDate = new Date(stats.last_change);
        const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
        stats.average_change_interval_days = Math.round(daysDiff / (stats.total_changes - 1));
      } else {
        stats.average_change_interval_days = null;
      }

      logger.debug('获取密码历史统计信息', {
        userId,
        totalChanges: stats.total_changes
      });

      return stats;
    } catch (error) {
      logger.error('获取密码历史统计信息失败', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 批量清理所有用户的旧密码历史
   * @param {number} keepCount - 每个用户保留的记录数
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 清理结果
   */
  async batchCleanupAllUsers(keepCount = 5, trx = null) {
    try {
      // 获取所有有密码历史记录的用户
      const users = await this.getQueryBuilder(trx)
        .distinct('user_id')
        .select('user_id');

      let totalDeleted = 0;
      let processedUsers = 0;

      for (const user of users) {
        const deleted = await this.cleanupOldHistory(user.user_id, keepCount, trx);
        totalDeleted += deleted;
        processedUsers++;
      }

      logger.info('批量清理密码历史记录完成', {
        processedUsers,
        totalDeleted,
        keepCount
      });

      return {
        processedUsers,
        totalDeleted,
        keepCount
      };
    } catch (error) {
      logger.error('批量清理密码历史记录失败', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 删除用户的所有密码历史记录
   * @param {number} userId - 用户ID
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<number>} 删除的记录数
   */
  async deleteUserHistory(userId, trx = null) {
    try {
      const deletedCount = await this.getQueryBuilder(trx)
        .where('user_id', userId)
        .del();

      logger.info('删除用户密码历史记录', {
        userId,
        deletedCount
      });

      return deletedCount;
    } catch (error) {
      logger.error('删除用户密码历史记录失败', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取密码历史记录的详细信息
   * @param {number} historyId - 历史记录ID
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 历史记录详情
   */
  async getHistoryDetails(historyId, trx = null) {
    try {
      const history = await this.getQueryBuilder(trx)
        .select([
          'id',
          'user_id',
          'created_at',
          'created_by_ip'
        ])
        .where('id', historyId)
        .first();

      if (history) {
        logger.debug('获取密码历史记录详情', {
          historyId,
          userId: history.user_id
        });
      }

      return history;
    } catch (error) {
      logger.error('获取密码历史记录详情失败', {
        historyId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = PasswordHistoryRepository;
