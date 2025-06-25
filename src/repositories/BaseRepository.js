/**
 * 基础Repository类
 * 提供通用的数据访问方法，遵循Repository模式
 */

const { db, transactionManager } = require('../config/database');
const { logger } = require('../config/logger');

class BaseRepository {
  constructor(tableName, primaryKey = 'id') {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.db = db;
  }

  /**
   * 获取查询构建器
   * @param {Object} trx - 可选的事务对象
   * @returns {Object} Knex查询构建器
   */
  query(trx = null) {
    return (trx || this.db)(this.tableName);
  }

  /**
   * 根据ID查找记录
   * @param {string|number} id - 主键值
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 记录对象或null
   */
  async findById(id, trx = null) {
    try {
      const result = await this.query(trx)
        .where(this.primaryKey, id)
        .first();
      
      return result || null;
    } catch (error) {
      logger.error('根据ID查找记录失败', {
        table: this.tableName,
        id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 根据条件查找单条记录
   * @param {Object} conditions - 查询条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 记录对象或null
   */
  async findOne(conditions, trx = null) {
    try {
      const result = await this.query(trx)
        .where(conditions)
        .first();
      
      return result || null;
    } catch (error) {
      logger.error('根据条件查找记录失败', {
        table: this.tableName,
        conditions,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 根据条件查找多条记录
   * @param {Object} conditions - 查询条件
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 记录数组
   */
  async findMany(conditions = {}, options = {}, trx = null) {
    try {
      const {
        orderBy = null,
        limit = null,
        offset = null,
        select = '*'
      } = options;

      let query = this.query(trx)
        .select(select)
        .where(conditions);

      if (orderBy) {
        if (Array.isArray(orderBy)) {
          orderBy.forEach(order => {
            if (typeof order === 'string') {
              query = query.orderBy(order);
            } else {
              query = query.orderBy(order.column, order.direction);
            }
          });
        } else if (typeof orderBy === 'string') {
          query = query.orderBy(orderBy);
        } else {
          query = query.orderBy(orderBy.column, orderBy.direction);
        }
      }

      if (limit) {
        query = query.limit(limit);
      }

      if (offset) {
        query = query.offset(offset);
      }

      return await query;
    } catch (error) {
      logger.error('根据条件查找多条记录失败', {
        table: this.tableName,
        conditions,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取所有记录
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 记录数组
   */
  async findAll(options = {}, trx = null) {
    return await this.findMany({}, options, trx);
  }

  /**
   * 创建记录
   * @param {Object} data - 要创建的数据
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 创建的记录
   */
  async create(data, trx = null) {
    try {
      const now = new Date().toISOString();
      const dataWithTimestamps = {
        ...data,
        created_at: now,
        updated_at: now
      };

      const [id] = await this.query(trx)
        .insert(dataWithTimestamps)
        .returning(this.primaryKey);

      // 返回创建的记录
      return await this.findById(id || data[this.primaryKey], trx);
    } catch (error) {
      logger.error('创建记录失败', {
        table: this.tableName,
        data,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 批量创建记录
   * @param {Array} dataArray - 要创建的数据数组
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 创建的记录ID数组
   */
  async createMany(dataArray, trx = null) {
    try {
      const now = new Date().toISOString();
      const dataWithTimestamps = dataArray.map(data => ({
        ...data,
        created_at: now,
        updated_at: now
      }));

      const ids = await this.query(trx)
        .insert(dataWithTimestamps)
        .returning(this.primaryKey);

      return ids;
    } catch (error) {
      logger.error('批量创建记录失败', {
        table: this.tableName,
        count: dataArray.length,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 根据ID更新记录
   * @param {string|number} id - 主键值
   * @param {Object} data - 要更新的数据
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 更新后的记录
   */
  async updateById(id, data, trx = null) {
    try {
      const dataWithTimestamp = {
        ...data,
        updated_at: new Date().toISOString()
      };

      const affectedRows = await this.query(trx)
        .where(this.primaryKey, id)
        .update(dataWithTimestamp);

      if (affectedRows === 0) {
        return null;
      }

      return await this.findById(id, trx);
    } catch (error) {
      logger.error('根据ID更新记录失败', {
        table: this.tableName,
        id,
        data,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 根据条件更新记录
   * @param {Object} conditions - 更新条件
   * @param {Object} data - 要更新的数据
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<number>} 受影响的行数
   */
  async updateMany(conditions, data, trx = null) {
    try {
      const dataWithTimestamp = {
        ...data,
        updated_at: new Date().toISOString()
      };

      const affectedRows = await this.query(trx)
        .where(conditions)
        .update(dataWithTimestamp);

      return affectedRows;
    } catch (error) {
      logger.error('根据条件更新记录失败', {
        table: this.tableName,
        conditions,
        data,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 根据ID删除记录
   * @param {string|number} id - 主键值
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteById(id, trx = null) {
    try {
      const affectedRows = await this.query(trx)
        .where(this.primaryKey, id)
        .del();

      return affectedRows > 0;
    } catch (error) {
      logger.error('根据ID删除记录失败', {
        table: this.tableName,
        id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 根据条件删除记录
   * @param {Object} conditions - 删除条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<number>} 删除的记录数
   */
  async deleteMany(conditions, trx = null) {
    try {
      const affectedRows = await this.query(trx)
        .where(conditions)
        .del();

      return affectedRows;
    } catch (error) {
      logger.error('根据条件删除记录失败', {
        table: this.tableName,
        conditions,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 统计记录数
   * @param {Object} conditions - 统计条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<number>} 记录数
   */
  async count(conditions = {}, trx = null) {
    try {
      const result = await this.query(trx)
        .where(conditions)
        .count(`${this.primaryKey} as count`)
        .first();

      return parseInt(result.count, 10);
    } catch (error) {
      logger.error('统计记录数失败', {
        table: this.tableName,
        conditions,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 检查记录是否存在
   * @param {Object} conditions - 检查条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<boolean>} 是否存在
   */
  async exists(conditions, trx = null) {
    try {
      const count = await this.count(conditions, trx);
      return count > 0;
    } catch (error) {
      logger.error('检查记录存在性失败', {
        table: this.tableName,
        conditions,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 在事务中执行操作
   * @param {Function} callback - 事务回调函数
   * @returns {Promise<any>} 事务结果
   */
  async transaction(callback) {
    return await transactionManager.executeTransaction(callback);
  }

  /**
   * 带重试的事务执行
   * @param {Function} callback - 事务回调函数
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<any>} 事务结果
   */
  async transactionWithRetry(callback, maxRetries = 3) {
    return await transactionManager.executeWithRetry(callback, maxRetries);
  }
}

module.exports = BaseRepository;
