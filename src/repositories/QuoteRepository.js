/**
 * 报价数据访问层
 * 处理报价相关的数据库操作
 */

const BaseRepository = require('./BaseRepository');
const { logger } = require('../config/logger');

class QuoteRepository extends BaseRepository {
  constructor() {
    super('quotes', 'id');
  }

  /**
   * 根据订单ID查找报价
   * @param {string} orderId - 订单ID
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 报价数组
   */
  async findByOrderId(orderId, options = {}, trx = null) {
    try {
      const {
        orderBy = [{ column: 'price', direction: 'asc' }],
        limit = null,
        offset = null
      } = options;

      return await this.findMany({ orderId }, {
        orderBy,
        limit,
        offset
      }, trx);
    } catch (error) {
      logger.error('根据订单ID查找报价失败', {
        orderId,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 根据供应商查找报价
   * @param {string} provider - 供应商名称
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 报价数组
   */
  async findByProvider(provider, options = {}, trx = null) {
    try {
      const {
        orderBy = [{ column: 'createdAt', direction: 'desc' }],
        limit = null,
        offset = null,
        startDate = null,
        endDate = null
      } = options;

      let conditions = { provider };

      // 如果指定了日期范围，需要使用更复杂的查询
      if (startDate && endDate) {
        return await this.query(trx)
          .where('provider', provider)
          .whereBetween('createdAt', [startDate, endDate])
          .orderBy(orderBy[0].column, orderBy[0].direction)
          .limit(limit)
          .offset(offset);
      }

      return await this.findMany(conditions, {
        orderBy,
        limit,
        offset
      }, trx);
    } catch (error) {
      logger.error('根据供应商查找报价失败', {
        provider,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 查找特定订单和供应商的报价
   * @param {string} orderId - 订单ID
   * @param {string} provider - 供应商名称
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 报价对象或null
   */
  async findByOrderAndProvider(orderId, provider, trx = null) {
    try {
      return await this.findOne({ orderId, provider }, trx);
    } catch (error) {
      logger.error('根据订单和供应商查找报价失败', {
        orderId,
        provider,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 创建或更新报价
   * @param {string} orderId - 订单ID
   * @param {string} provider - 供应商名称
   * @param {Object} quoteData - 报价数据
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 报价对象
   */
  async upsertQuote(orderId, provider, quoteData, trx = null) {
    try {
      const existingQuote = await this.findByOrderAndProvider(orderId, provider, trx);
      
      const data = {
        orderId,
        provider,
        ...quoteData
      };

      if (existingQuote) {
        // 更新现有报价
        return await this.updateById(existingQuote.id, data, trx);
      } else {
        // 创建新报价
        return await this.create(data, trx);
      }
    } catch (error) {
      logger.error('创建或更新报价失败', {
        orderId,
        provider,
        quoteData,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取订单的最低报价
   * @param {string} orderId - 订单ID
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 最低报价对象或null
   */
  async getLowestQuote(orderId, trx = null) {
    try {
      return await this.query(trx)
        .where('orderId', orderId)
        .orderBy('price', 'asc')
        .first();
    } catch (error) {
      logger.error('获取订单最低报价失败', {
        orderId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取订单的报价统计
   * @param {string} orderId - 订单ID
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 报价统计信息
   */
  async getQuoteStats(orderId, trx = null) {
    try {
      const stats = await this.query(trx)
        .where('orderId', orderId)
        .select(
          this.db.raw('COUNT(*) as count'),
          this.db.raw('MIN(price) as minPrice'),
          this.db.raw('MAX(price) as maxPrice'),
          this.db.raw('AVG(price) as avgPrice')
        )
        .first();

      return {
        count: parseInt(stats.count, 10),
        minPrice: parseFloat(stats.minPrice) || 0,
        maxPrice: parseFloat(stats.maxPrice) || 0,
        avgPrice: parseFloat(stats.avgPrice) || 0
      };
    } catch (error) {
      logger.error('获取订单报价统计失败', {
        orderId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取供应商的报价统计
   * @param {string} provider - 供应商名称
   * @param {Object} options - 选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 供应商报价统计
   */
  async getProviderStats(provider, options = {}, trx = null) {
    try {
      const {
        startDate = null,
        endDate = null
      } = options;

      let query = this.query(trx)
        .where('provider', provider);

      if (startDate && endDate) {
        query = query.whereBetween('createdAt', [startDate, endDate]);
      }

      const stats = await query
        .select(
          this.db.raw('COUNT(*) as totalQuotes'),
          this.db.raw('MIN(price) as minPrice'),
          this.db.raw('MAX(price) as maxPrice'),
          this.db.raw('AVG(price) as avgPrice')
        )
        .first();

      return {
        totalQuotes: parseInt(stats.totalQuotes, 10),
        minPrice: parseFloat(stats.minPrice) || 0,
        maxPrice: parseFloat(stats.maxPrice) || 0,
        avgPrice: parseFloat(stats.avgPrice) || 0
      };
    } catch (error) {
      logger.error('获取供应商报价统计失败', {
        provider,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取价格范围内的报价
   * @param {string} orderId - 订单ID
   * @param {number} minPrice - 最低价格
   * @param {number} maxPrice - 最高价格
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 报价数组
   */
  async findByPriceRange(orderId, minPrice, maxPrice, trx = null) {
    try {
      return await this.query(trx)
        .where('orderId', orderId)
        .whereBetween('price', [minPrice, maxPrice])
        .orderBy('price', 'asc');
    } catch (error) {
      logger.error('根据价格范围查找报价失败', {
        orderId,
        minPrice,
        maxPrice,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 删除订单的所有报价
   * @param {string} orderId - 订单ID
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<number>} 删除的报价数量
   */
  async deleteByOrderId(orderId, trx = null) {
    try {
      return await this.deleteMany({ orderId }, trx);
    } catch (error) {
      logger.error('删除订单报价失败', {
        orderId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 删除供应商的所有报价
   * @param {string} provider - 供应商名称
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<number>} 删除的报价数量
   */
  async deleteByProvider(provider, trx = null) {
    try {
      return await this.deleteMany({ provider }, trx);
    } catch (error) {
      logger.error('删除供应商报价失败', {
        provider,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取热门供应商（按报价数量排序）
   * @param {Object} options - 选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 供应商统计数组
   */
  async getTopProviders(options = {}, trx = null) {
    try {
      const {
        limit = 10,
        startDate = null,
        endDate = null
      } = options;

      let query = this.query(trx)
        .select('provider')
        .count('* as quoteCount')
        .groupBy('provider')
        .orderBy('quoteCount', 'desc')
        .limit(limit);

      if (startDate && endDate) {
        query = query.whereBetween('createdAt', [startDate, endDate]);
      }

      const results = await query;
      
      return results.map(result => ({
        provider: result.provider,
        quoteCount: parseInt(result.quoteCount, 10)
      }));
    } catch (error) {
      logger.error('获取热门供应商失败', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取最近的报价
   * @param {Object} options - 选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 最近报价数组
   */
  async getRecentQuotes(options = {}, trx = null) {
    try {
      const {
        limit = 20,
        provider = null,
        orderId = null
      } = options;

      let query = this.query(trx)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (provider) {
        query = query.where('provider', provider);
      }

      if (orderId) {
        query = query.where('orderId', orderId);
      }

      return await query;
    } catch (error) {
      logger.error('获取最近报价失败', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 检查报价是否存在
   * @param {string} orderId - 订单ID
   * @param {string} provider - 供应商名称
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<boolean>} 是否存在
   */
  async quoteExists(orderId, provider, trx = null) {
    try {
      return await this.exists({ orderId, provider }, trx);
    } catch (error) {
      logger.error('检查报价存在性失败', {
        orderId,
        provider,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取总体统计信息
   * @param {Object} filters - 过滤条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 统计信息
   */
  async getTotalStats(filters = {}, trx = null) {
    try {
      const {
        startDate = null,
        endDate = null,
        provider = null
      } = filters;

      let quoteQuery = this.query(trx);
      let orderQuery = this.query(trx).distinct('orderId');

      if (startDate && endDate) {
        quoteQuery = quoteQuery.whereBetween('createdAt', [startDate, endDate]);
        orderQuery = orderQuery.whereBetween('createdAt', [startDate, endDate]);
      }

      if (provider) {
        quoteQuery = quoteQuery.where('provider', provider);
        orderQuery = orderQuery.where('provider', provider);
      }

      const [quoteCount, orderCount] = await Promise.all([
        quoteQuery.count('* as count').first(),
        orderQuery.count('orderId as count').first()
      ]);

      return {
        totalQuotes: parseInt(quoteCount?.count || 0, 10),
        totalOrders: parseInt(orderCount?.count || 0, 10)
      };
    } catch (error) {
      logger.error('获取总体统计信息失败', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取供应商统计信息
   * @param {Object} filters - 过滤条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 供应商统计数组
   */
  async getProviderStats(filters = {}, trx = null) {
    try {
      const {
        startDate = null,
        endDate = null,
        provider = null
      } = filters;

      let query = this.query(trx)
        .select('provider')
        .count('* as quoteCount')
        .avg('price as avgPrice')
        .min('price as minPrice')
        .max('price as maxPrice')
        .groupBy('provider')
        .orderBy('quoteCount', 'desc');

      if (startDate && endDate) {
        query = query.whereBetween('createdAt', [startDate, endDate]);
      }

      if (provider) {
        query = query.where('provider', provider);
      }

      const results = await query;

      return results.map(result => ({
        provider: result.provider,
        quoteCount: parseInt(result.quoteCount, 10),
        avgPrice: parseFloat(result.avgPrice || 0).toFixed(2),
        minPrice: parseFloat(result.minPrice || 0),
        maxPrice: parseFloat(result.maxPrice || 0)
      }));
    } catch (error) {
      logger.error('获取供应商统计信息失败', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取价格统计信息
   * @param {Object} filters - 过滤条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 价格统计信息
   */
  async getPriceStats(filters = {}, trx = null) {
    try {
      const {
        startDate = null,
        endDate = null,
        provider = null
      } = filters;

      let query = this.query(trx)
        .min('price as minPrice')
        .max('price as maxPrice')
        .avg('price as avgPrice');

      if (startDate && endDate) {
        query = query.whereBetween('createdAt', [startDate, endDate]);
      }

      if (provider) {
        query = query.where('provider', provider);
      }

      const result = await query.first();

      // 获取中位数（简化实现）
      let medianQuery = this.query(trx).select('price').orderBy('price');

      if (startDate && endDate) {
        medianQuery = medianQuery.whereBetween('createdAt', [startDate, endDate]);
      }

      if (provider) {
        medianQuery = medianQuery.where('provider', provider);
      }

      const prices = await medianQuery;
      const medianPrice = prices.length > 0
        ? prices[Math.floor(prices.length / 2)]?.price || 0
        : 0;

      return {
        minPrice: parseFloat(result?.minPrice || 0),
        maxPrice: parseFloat(result?.maxPrice || 0),
        avgPrice: parseFloat(result?.avgPrice || 0).toFixed(2),
        medianPrice: parseFloat(medianPrice)
      };
    } catch (error) {
      logger.error('获取价格统计信息失败', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取时间序列数据
   * @param {Object} filters - 过滤条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 时间序列数据
   */
  async getTimeSeriesData(filters = {}, trx = null) {
    try {
      const {
        startDate = null,
        endDate = null,
        provider = null
      } = filters;

      // 默认获取最近30天的数据
      const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const defaultEndDate = endDate || new Date().toISOString();

      let query = this.query(trx)
        .select(this.db.raw('DATE(createdAt) as date'))
        .count('* as count')
        .avg('price as avgPrice')
        .whereBetween('createdAt', [defaultStartDate, defaultEndDate])
        .groupBy(this.db.raw('DATE(createdAt)'))
        .orderBy('date');

      if (provider) {
        query = query.where('provider', provider);
      }

      const results = await query;

      return results.map(result => ({
        date: result.date,
        count: parseInt(result.count, 10),
        avgPrice: parseFloat(result.avgPrice || 0).toFixed(2)
      }));
    } catch (error) {
      logger.error('获取时间序列数据失败', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取用于导出的报价数据
   * @param {Object} filters - 过滤条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 报价数组
   */
  async findForExport(filters = {}, trx = null) {
    try {
      const {
        startDate = null,
        endDate = null,
        provider = null,
        orderId = null
      } = filters;

      let query = this.query(trx)
        .select([
          'id',
          'orderId',
          'provider',
          'price',
          'estimatedDelivery',
          'createdAt',
          'updatedAt'
        ]);

      if (startDate && endDate) {
        query = query.whereBetween('createdAt', [startDate, endDate]);
      } else if (startDate) {
        query = query.where('createdAt', '>=', startDate);
      } else if (endDate) {
        query = query.where('createdAt', '<=', endDate);
      }

      if (provider) {
        query = query.where('provider', provider);
      }

      if (orderId) {
        query = query.where('orderId', orderId);
      }

      return await query.orderBy('createdAt', 'desc');
    } catch (error) {
      logger.error('获取导出报价数据失败', {
        filters,
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
      const [totalStats, recentStats, providerCount] = await Promise.all([
        // 总体统计
        this.query(trx)
          .count('* as totalQuotes')
          .countDistinct('orderId as totalOrders')
          .avg('price as avgPrice')
          .min('price as minPrice')
          .max('price as maxPrice')
          .first(),

        // 最近30天统计
        this.query(trx)
          .where('createdAt', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .count('* as recentQuotes')
          .first(),

        // 供应商数量
        this.query(trx)
          .countDistinct('provider as providerCount')
          .first()
      ]);

      return {
        totalQuotes: parseInt(totalStats?.totalQuotes || 0, 10),
        totalOrders: parseInt(totalStats?.totalOrders || 0, 10),
        avgPrice: parseFloat(totalStats?.avgPrice || 0).toFixed(2),
        minPrice: parseFloat(totalStats?.minPrice || 0),
        maxPrice: parseFloat(totalStats?.maxPrice || 0),
        recentQuotes: parseInt(recentStats?.recentQuotes || 0, 10),
        providerCount: parseInt(providerCount?.providerCount || 0, 10)
      };
    } catch (error) {
      logger.error('获取全局统计信息失败', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = QuoteRepository;
