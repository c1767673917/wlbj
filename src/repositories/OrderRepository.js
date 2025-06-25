/**
 * 订单数据访问层
 * 处理订单相关的数据库操作
 */

const BaseRepository = require('./BaseRepository');
const { logger } = require('../config/logger');

class OrderRepository extends BaseRepository {
  constructor() {
    super('orders', 'id');
  }

  /**
   * 根据用户ID查找订单
   * @param {string} userId - 用户ID
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 订单数组
   */
  async findByUserId(userId, options = {}, trx = null) {
    try {
      const {
        status = null,
        limit = null,
        offset = null,
        orderBy = [{ column: 'createdAt', direction: 'desc' }]
      } = options;

      const conditions = { userId };
      if (status) {
        conditions.status = status;
      }

      return await this.findMany(conditions, {
        orderBy,
        limit,
        offset
      }, trx);
    } catch (error) {
      logger.error('根据用户ID查找订单失败', {
        userId,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 根据状态查找订单
   * @param {string} status - 订单状态
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 订单数组
   */
  async findByStatus(status, options = {}, trx = null) {
    try {
      const {
        userId = null,
        limit = null,
        offset = null,
        orderBy = [{ column: 'createdAt', direction: 'desc' }]
      } = options;

      const conditions = { status };
      if (userId) {
        conditions.userId = userId;
      }

      return await this.findMany(conditions, {
        orderBy,
        limit,
        offset
      }, trx);
    } catch (error) {
      logger.error('根据状态查找订单失败', {
        status,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 根据日期范围查找订单
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 订单数组
   */
  async findByDateRange(startDate, endDate, options = {}, trx = null) {
    try {
      const {
        userId = null,
        status = null,
        limit = null,
        offset = null,
        orderBy = [{ column: 'createdAt', direction: 'desc' }]
      } = options;

      let query = this.query(trx)
        .whereBetween('createdAt', [startDate, endDate]);

      if (userId) {
        query = query.where('userId', userId);
      }

      if (status) {
        query = query.where('status', status);
      }

      if (orderBy) {
        if (Array.isArray(orderBy)) {
          orderBy.forEach(order => {
            query = query.orderBy(order.column, order.direction);
          });
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
      logger.error('根据日期范围查找订单失败', {
        startDate,
        endDate,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取用户的活跃订单
   * @param {string} userId - 用户ID
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 活跃订单数组
   */
  async getActiveOrdersByUser(userId, trx = null) {
    return await this.findByUserId(userId, {
      status: 'active',
      orderBy: [{ column: 'createdAt', direction: 'desc' }]
    }, trx);
  }

  /**
   * 获取待选择供应商的订单
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 订单数组
   */
  async getPendingOrders(options = {}, trx = null) {
    try {
      const {
        limit = null,
        offset = null
      } = options;

      return await this.query(trx)
        .where('status', 'active')
        .whereNull('selectedProvider')
        .orderBy('createdAt', 'asc')
        .limit(limit)
        .offset(offset);
    } catch (error) {
      logger.error('获取待选择供应商的订单失败', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 更新订单选择的供应商
   * @param {string} orderId - 订单ID
   * @param {string} provider - 供应商名称
   * @param {number} price - 选择的价格
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 更新后的订单
   */
  async selectProvider(orderId, provider, price, trx = null) {
    try {
      const updateData = {
        selectedProvider: provider,
        selectedPrice: price,
        selectedAt: new Date().toISOString(),
        status: 'confirmed'
      };

      return await this.updateById(orderId, updateData, trx);
    } catch (error) {
      logger.error('更新订单选择的供应商失败', {
        orderId,
        provider,
        price,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 取消订单
   * @param {string} orderId - 订单ID
   * @param {string} reason - 取消原因
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 更新后的订单
   */
  async cancelOrder(orderId, reason = null, trx = null) {
    try {
      const updateData = {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      };

      if (reason) {
        updateData.cancelReason = reason;
      }

      return await this.updateById(orderId, updateData, trx);
    } catch (error) {
      logger.error('取消订单失败', {
        orderId,
        reason,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 完成订单
   * @param {string} orderId - 订单ID
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 更新后的订单
   */
  async completeOrder(orderId, trx = null) {
    try {
      const updateData = {
        status: 'completed',
        completedAt: new Date().toISOString()
      };

      return await this.updateById(orderId, updateData, trx);
    } catch (error) {
      logger.error('完成订单失败', {
        orderId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取订单统计信息
   * @param {Object} filters - 过滤条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 统计信息
   */
  async getOrderStats(filters = {}, trx = null) {
    try {
      const {
        userId = null,
        startDate = null,
        endDate = null
      } = filters;

      let query = this.query(trx);

      if (userId) {
        query = query.where('userId', userId);
      }

      if (startDate && endDate) {
        query = query.whereBetween('createdAt', [startDate, endDate]);
      }

      const stats = await query
        .select('status')
        .count('* as count')
        .groupBy('status');

      const result = {
        total: 0,
        active: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0
      };

      stats.forEach(stat => {
        const count = parseInt(stat.count, 10);
        result.total += count;
        result[stat.status] = count;
      });

      return result;
    } catch (error) {
      logger.error('获取订单统计信息失败', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 搜索订单
   * @param {string} searchTerm - 搜索关键词
   * @param {Object} options - 搜索选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 搜索结果
   */
  async searchOrders(searchTerm, options = {}, trx = null) {
    try {
      const {
        userId = null,
        status = null,
        limit = 50,
        offset = 0
      } = options;

      let query = this.query(trx)
        .where(function() {
          this.where('id', 'like', `%${searchTerm}%`)
            .orWhere('warehouse', 'like', `%${searchTerm}%`)
            .orWhere('goods', 'like', `%${searchTerm}%`)
            .orWhere('deliveryAddress', 'like', `%${searchTerm}%`);
        });

      if (userId) {
        query = query.where('userId', userId);
      }

      if (status) {
        query = query.where('status', status);
      }

      return await query
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset);
    } catch (error) {
      logger.error('搜索订单失败', {
        searchTerm,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 检查用户是否有权限访问订单
   * @param {string} orderId - 订单ID
   * @param {string} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<boolean>} 是否有权限
   */
  async checkUserAccess(orderId, userId, userRole, trx = null) {
    try {
      // 管理员可以访问所有订单
      if (userRole === 'admin') {
        return true;
      }

      // 普通用户只能访问自己的订单
      const order = await this.findById(orderId, trx);
      return order && order.userId === userId;
    } catch (error) {
      logger.error('检查用户订单访问权限失败', {
        orderId,
        userId,
        userRole,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取用于导出的订单数据
   * @param {Object} filters - 过滤条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 订单数组
   */
  async findForExport(filters = {}, trx = null) {
    try {
      const {
        status = null,
        startDate = null,
        endDate = null,
        userId = null
      } = filters;

      let query = this.query(trx)
        .select([
          'id',
          'userId',
          'warehouse',
          'goods',
          'deliveryAddress',
          'status',
          'selectedProvider',
          'selectedPrice',
          'selectedAt',
          'createdAt',
          'updatedAt',
          'completedAt',
          'cancelledAt',
          'cancelReason'
        ]);

      if (status) {
        query = query.where('status', status);
      }

      if (userId) {
        query = query.where('userId', userId);
      }

      if (startDate && endDate) {
        query = query.whereBetween('createdAt', [startDate, endDate]);
      } else if (startDate) {
        query = query.where('createdAt', '>=', startDate);
      } else if (endDate) {
        query = query.where('createdAt', '<=', endDate);
      }

      return await query.orderBy('createdAt', 'desc');
    } catch (error) {
      logger.error('获取导出订单数据失败', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取待处理订单列表（管理员功能）
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 待处理订单列表
   */
  async getPendingOrders(options = {}, trx = null) {
    try {
      const {
        limit = 20,
        offset = 0,
        orderBy = [{ column: 'createdAt', direction: 'asc' }]
      } = options;

      let query = this.query(trx)
        .where('status', 'active')
        .whereNull('selectedProvider')
        .limit(limit)
        .offset(offset);

      // 应用排序
      orderBy.forEach(sort => {
        query = query.orderBy(sort.column, sort.direction);
      });

      return await query;
    } catch (error) {
      logger.error('获取待处理订单列表失败', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取全局统计信息（管理员）
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 全局统计信息
   */
  async getGlobalStats(trx = null) {
    try {
      const [statusStats, recentStats] = await Promise.all([
        // 按状态统计
        this.query(trx)
          .select('status')
          .count('* as count')
          .groupBy('status'),

        // 最近30天统计
        this.query(trx)
          .where('createdAt', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .count('* as recentCount')
          .first()
      ]);

      const result = {
        total: 0,
        active: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        recent30Days: parseInt(recentStats?.recentCount || 0, 10)
      };

      statusStats.forEach(stat => {
        const count = parseInt(stat.count, 10);
        result.total += count;
        result[stat.status] = count;
      });

      return result;
    } catch (error) {
      logger.error('获取全局统计信息失败', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = OrderRepository;
