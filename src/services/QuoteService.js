/**
 * 报价业务逻辑服务
 * 处理报价相关的业务逻辑
 */

const BaseService = require('./BaseService');
const { quoteRepo, orderRepo, providerRepo } = require('../repositories');
const { logger } = require('../config/logger');

class QuoteService extends BaseService {
  constructor() {
    super('QuoteService');
    this.allowedSortFields = ['price', 'createdAt', 'estimatedDelivery'];
  }

  /**
   * 创建或更新报价
   * @param {string} orderId - 订单ID
   * @param {string} provider - 供应商名称
   * @param {Object} quoteData - 报价数据
   * @param {string} accessKey - 供应商访问密钥
   * @returns {Promise<Object>} 创建或更新的报价
   */
  async createOrUpdateQuote(orderId, provider, quoteData, accessKey) {
    return await this.handleAsyncOperation(async () => {
      // 验证必需参数
      this.validateRequiredParams({ orderId, provider, accessKey }, ['orderId', 'provider', 'accessKey']);
      this.validateRequiredParams(quoteData, ['price', 'estimatedDelivery']);

      // 验证参数类型
      this.validateParamTypes(quoteData, {
        price: 'number',
        estimatedDelivery: 'string'
      });

      // 验证供应商访问权限
      const providerInfo = await providerRepo.validateAccess(accessKey);
      if (!providerInfo) {
        throw this.createBusinessError('无效的访问密钥', 'INVALID_ACCESS_KEY', 401);
      }

      if (providerInfo.name !== provider) {
        throw this.createBusinessError('供应商名称与访问密钥不匹配', 'PROVIDER_MISMATCH', 403);
      }

      // 验证订单是否存在且状态有效
      const order = await orderRepo.findById(orderId);
      if (!order) {
        throw this.createBusinessError('订单不存在', 'ORDER_NOT_FOUND', 404);
      }

      if (order.status !== 'active') {
        throw this.createBusinessError('只能为活跃状态的订单提供报价', 'INVALID_ORDER_STATUS', 400);
      }

      // 验证报价数据
      if (quoteData.price <= 0) {
        throw this.createBusinessError('报价金额必须大于0');
      }

      if (quoteData.price > 999999.99) {
        throw this.createBusinessError('报价金额不能超过999999.99');
      }

      // 验证预计送达时间格式
      const deliveryDate = new Date(quoteData.estimatedDelivery);
      if (isNaN(deliveryDate.getTime())) {
        throw this.createBusinessError('预计送达时间格式无效');
      }

      if (deliveryDate <= new Date()) {
        throw this.createBusinessError('预计送达时间必须是未来时间');
      }

      // 清理和标准化数据
      const cleanQuoteData = {
        price: parseFloat(quoteData.price.toFixed(2)),
        estimatedDelivery: deliveryDate.toISOString(),
        remarks: quoteData.remarks ? quoteData.remarks.trim() : null
      };

      // 创建或更新报价
      const quote = await quoteRepo.upsertQuote(orderId, provider, cleanQuoteData);

      this.logOperation('quote_created_or_updated', {
        orderId,
        provider,
        price: cleanQuoteData.price,
        quoteId: quote.id
      });

      return this.buildResponse(quote, '报价提交成功');
    }, 'createOrUpdateQuote', { orderId, provider });
  }

  /**
   * 获取订单的所有报价
   * @param {string} orderId - 订单ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 报价列表
   */
  async getOrderQuotes(orderId, options = {}) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderId }, ['orderId']);

      // 验证订单是否存在
      const order = await orderRepo.findById(orderId);
      if (!order) {
        throw this.createBusinessError('订单不存在', 'ORDER_NOT_FOUND', 404);
      }

      // 标准化排序参数
      const orderBy = this.normalizeOrderByParams(options.orderBy, this.allowedSortFields);

      // 构建查询选项
      const queryOptions = {
        orderBy: orderBy.length > 0 ? orderBy : [{ column: 'price', direction: 'asc' }]
      };

      // 获取报价列表和统计信息
      const [quotes, stats] = await Promise.all([
        quoteRepo.findByOrderId(orderId, queryOptions),
        quoteRepo.getQuoteStats(orderId)
      ]);

      const result = {
        order: {
          id: order.id,
          warehouse: order.warehouse,
          goods: order.goods,
          deliveryAddress: order.deliveryAddress,
          status: order.status,
          selectedProvider: order.selectedProvider,
          selectedPrice: order.selectedPrice
        },
        quotes,
        stats
      };

      return this.buildResponse(result, '获取报价列表成功');
    }, 'getOrderQuotes', { orderId });
  }

  /**
   * 获取供应商的报价历史
   * @param {string} provider - 供应商名称
   * @param {string} accessKey - 访问密钥
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 报价历史
   */
  async getProviderQuotes(provider, accessKey, options = {}) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ provider, accessKey }, ['provider', 'accessKey']);

      // 验证供应商访问权限
      const providerInfo = await providerRepo.validateAccess(accessKey);
      if (!providerInfo || providerInfo.name !== provider) {
        throw this.createBusinessError('无权访问', 'ACCESS_DENIED', 403);
      }

      // 标准化分页参数
      const pagination = this.normalizePaginationParams(options);
      
      // 标准化排序参数
      const orderBy = this.normalizeOrderByParams(options.orderBy, this.allowedSortFields);

      // 构建查询选项
      const queryOptions = {
        limit: pagination.limit,
        offset: pagination.offset,
        orderBy: orderBy.length > 0 ? orderBy : [{ column: 'createdAt', direction: 'desc' }],
        startDate: options.startDate || null,
        endDate: options.endDate || null
      };

      // 获取报价列表和统计信息
      const [quotes, stats] = await Promise.all([
        quoteRepo.findByProvider(provider, queryOptions),
        quoteRepo.getProviderStats(provider, {
          startDate: options.startDate,
          endDate: options.endDate
        })
      ]);

      const result = {
        provider: providerInfo.name,
        quotes,
        stats
      };

      return this.buildPaginatedResponse(result, stats.totalQuotes, pagination);
    }, 'getProviderQuotes', { provider });
  }

  /**
   * 获取报价详情
   * @param {string} quoteId - 报价ID
   * @param {string} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 报价详情
   */
  async getQuoteById(quoteId, userId, userRole) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ quoteId, userId, userRole }, ['quoteId', 'userId', 'userRole']);

      const quote = await quoteRepo.findById(quoteId);
      if (!quote) {
        throw this.createBusinessError('报价不存在', 'QUOTE_NOT_FOUND', 404);
      }

      // 检查访问权限
      if (userRole !== 'admin') {
        const order = await orderRepo.findById(quote.orderId);
        if (!order || order.userId !== userId) {
          throw this.createBusinessError('无权查看此报价', 'ACCESS_DENIED', 403);
        }
      }

      return this.buildResponse(quote, '获取报价详情成功');
    }, 'getQuoteById', { quoteId, userId });
  }

  /**
   * 用户选择报价
   * @param {string} quoteId - 报价ID
   * @param {string} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 选择结果
   */
  async selectQuote(quoteId, userId, userRole) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ quoteId, userId, userRole }, ['quoteId', 'userId', 'userRole']);

      const quote = await quoteRepo.findById(quoteId);
      if (!quote) {
        throw this.createBusinessError('报价不存在', 'QUOTE_NOT_FOUND', 404);
      }

      // 检查访问权限
      const order = await orderRepo.findById(quote.orderId);
      if (!order) {
        throw this.createBusinessError('订单不存在', 'ORDER_NOT_FOUND', 404);
      }

      if (userRole !== 'admin' && order.userId !== userId) {
        throw this.createBusinessError('无权选择此报价', 'ACCESS_DENIED', 403);
      }

      // 更新订单状态为已选择供应商
      await orderRepo.updateById(quote.orderId, {
        selectedProvider: quote.provider,
        selectedQuoteId: quoteId,
        status: 'in_progress'
      });

      this.logOperation('quote_selected', {
        quoteId,
        orderId: quote.orderId,
        provider: quote.provider,
        userId
      });

      return this.buildResponse({
        quote,
        order: { ...order, selectedProvider: quote.provider, selectedQuoteId: quoteId }
      }, '报价选择成功');
    }, 'selectQuote', { quoteId, userId });
  }

  /**
   * 供应商更新报价
   * @param {string} quoteId - 报价ID
   * @param {Object} updateData - 更新数据
   * @param {string} provider - 供应商名称
   * @param {string} accessKey - 访问密钥
   * @returns {Promise<Object>} 更新结果
   */
  async updateQuote(quoteId, updateData, provider, accessKey) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ quoteId, provider, accessKey }, ['quoteId', 'provider', 'accessKey']);

      // 验证供应商访问权限
      const providerInfo = await providerRepo.validateAccess(accessKey);
      if (!providerInfo || providerInfo.name !== provider) {
        throw this.createBusinessError('无权访问', 'ACCESS_DENIED', 403);
      }

      const quote = await quoteRepo.findById(quoteId);
      if (!quote) {
        throw this.createBusinessError('报价不存在', 'QUOTE_NOT_FOUND', 404);
      }

      if (quote.provider !== provider) {
        throw this.createBusinessError('无权修改此报价', 'ACCESS_DENIED', 403);
      }

      // 清理和验证更新数据
      const cleanUpdateData = this.sanitizeData(updateData);

      if (cleanUpdateData.price !== undefined) {
        if (typeof cleanUpdateData.price !== 'number' || cleanUpdateData.price <= 0) {
          throw this.createBusinessError('价格格式无效');
        }
      }

      if (cleanUpdateData.estimatedDelivery !== undefined) {
        const deliveryDate = new Date(cleanUpdateData.estimatedDelivery);
        if (isNaN(deliveryDate.getTime()) || deliveryDate <= new Date()) {
          throw this.createBusinessError('预计送达时间无效');
        }
      }

      // 更新报价
      const updatedQuote = await quoteRepo.updateById(quoteId, cleanUpdateData);

      this.logOperation('quote_updated', {
        quoteId,
        provider,
        updatedFields: Object.keys(cleanUpdateData)
      });

      return this.buildResponse(updatedQuote, '报价更新成功');
    }, 'updateQuote', { quoteId, provider });
  }

  /**
   * 供应商撤回报价
   * @param {string} quoteId - 报价ID
   * @param {string} provider - 供应商名称
   * @param {string} accessKey - 访问密钥
   * @returns {Promise<Object>} 撤回结果
   */
  async withdrawQuote(quoteId, provider, accessKey) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ quoteId, provider, accessKey }, ['quoteId', 'provider', 'accessKey']);

      // 验证供应商访问权限
      const providerInfo = await providerRepo.validateAccess(accessKey);
      if (!providerInfo || providerInfo.name !== provider) {
        throw this.createBusinessError('无权访问', 'ACCESS_DENIED', 403);
      }

      const quote = await quoteRepo.findById(quoteId);
      if (!quote) {
        throw this.createBusinessError('报价不存在', 'QUOTE_NOT_FOUND', 404);
      }

      if (quote.provider !== provider) {
        throw this.createBusinessError('无权撤回此报价', 'ACCESS_DENIED', 403);
      }

      // 检查报价是否已被选择
      const order = await orderRepo.findById(quote.orderId);
      if (order && order.selectedQuoteId === quoteId) {
        throw this.createBusinessError('已被选择的报价不能撤回', 'QUOTE_SELECTED', 400);
      }

      // 删除报价
      await quoteRepo.deleteById(quoteId);

      this.logOperation('quote_withdrawn', {
        quoteId,
        orderId: quote.orderId,
        provider
      });

      return this.buildResponse({
        withdrawn: true,
        quoteId
      }, '报价撤回成功');
    }, 'withdrawQuote', { quoteId, provider });
  }

  /**
   * 获取所有报价（管理员）
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 报价列表
   */
  async getAllQuotes(options = {}) {
    return await this.handleAsyncOperation(async () => {
      // 标准化分页参数
      const pagination = this.normalizePaginationParams(options);

      // 标准化排序参数
      const orderBy = this.normalizeOrderByParams(options.orderBy, this.allowedSortFields);

      // 构建查询选项
      const queryOptions = {
        limit: pagination.limit,
        offset: pagination.offset,
        orderBy: orderBy.length > 0 ? orderBy : [{ column: 'createdAt', direction: 'desc' }],
        startDate: options.startDate || null,
        endDate: options.endDate || null
      };

      // 获取报价列表和总数
      const [quotes, totalCount] = await Promise.all([
        quoteRepo.findAll(queryOptions),
        quoteRepo.countAll(queryOptions)
      ]);

      return this.buildPaginatedResponse(quotes, totalCount, pagination);
    }, 'getAllQuotes', { options });
  }

  /**
   * 获取报价统计信息（管理员）
   * @returns {Promise<Object>} 统计信息
   */
  async getQuoteStats() {
    return await this.handleAsyncOperation(async () => {
      const stats = await quoteRepo.getGlobalStats();

      return this.buildResponse(stats, '获取报价统计成功');
    }, 'getQuoteStats');
  }

  /**
   * 删除报价
   * @param {string} orderId - 订单ID
   * @param {string} provider - 供应商名称
   * @param {string} accessKey - 访问密钥
   * @returns {Promise<Object>} 删除结果
   */
  async deleteQuote(orderId, provider, accessKey) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderId, provider, accessKey }, ['orderId', 'provider', 'accessKey']);

      // 验证供应商访问权限
      const providerInfo = await providerRepo.validateAccess(accessKey);
      if (!providerInfo || providerInfo.name !== provider) {
        throw this.createBusinessError('无权访问', 'ACCESS_DENIED', 403);
      }

      // 验证报价是否存在
      const quote = await quoteRepo.findByOrderAndProvider(orderId, provider);
      if (!quote) {
        throw this.createBusinessError('报价不存在', 'QUOTE_NOT_FOUND', 404);
      }

      // 检查订单状态
      const order = await orderRepo.findById(orderId);
      if (order && order.selectedProvider === provider) {
        throw this.createBusinessError('无法删除已被选中的报价', 'CANNOT_DELETE_SELECTED_QUOTE', 400);
      }

      // 删除报价
      const deleted = await quoteRepo.deleteById(quote.id);
      if (!deleted) {
        throw this.createBusinessError('删除报价失败', 'DELETE_FAILED', 500);
      }

      this.logOperation('quote_deleted', {
        orderId,
        provider,
        quoteId: quote.id,
        price: quote.price
      });

      return this.buildResponse(null, '报价删除成功');
    }, 'deleteQuote', { orderId, provider });
  }

  /**
   * 获取最低报价
   * @param {string} orderId - 订单ID
   * @returns {Promise<Object>} 最低报价信息
   */
  async getLowestQuote(orderId) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderId }, ['orderId']);

      // 验证订单是否存在
      const order = await orderRepo.findById(orderId);
      if (!order) {
        throw this.createBusinessError('订单不存在', 'ORDER_NOT_FOUND', 404);
      }

      const lowestQuote = await quoteRepo.getLowestQuote(orderId);
      
      return this.buildResponse(lowestQuote, '获取最低报价成功');
    }, 'getLowestQuote', { orderId });
  }

  /**
   * 获取价格范围内的报价
   * @param {string} orderId - 订单ID
   * @param {number} minPrice - 最低价格
   * @param {number} maxPrice - 最高价格
   * @returns {Promise<Object>} 价格范围内的报价
   */
  async getQuotesByPriceRange(orderId, minPrice, maxPrice) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderId, minPrice, maxPrice }, ['orderId', 'minPrice', 'maxPrice']);
      this.validateParamTypes({ minPrice, maxPrice }, { minPrice: 'number', maxPrice: 'number' });

      if (minPrice < 0 || maxPrice < 0) {
        throw this.createBusinessError('价格不能为负数');
      }

      if (minPrice > maxPrice) {
        throw this.createBusinessError('最低价格不能大于最高价格');
      }

      // 验证订单是否存在
      const order = await orderRepo.findById(orderId);
      if (!order) {
        throw this.createBusinessError('订单不存在', 'ORDER_NOT_FOUND', 404);
      }

      const quotes = await quoteRepo.findByPriceRange(orderId, minPrice, maxPrice);
      
      return this.buildResponse(quotes, '获取价格范围报价成功', {
        priceRange: { minPrice, maxPrice },
        resultCount: quotes.length
      });
    }, 'getQuotesByPriceRange', { orderId, minPrice, maxPrice });
  }

  /**
   * 获取报价统计信息（管理员功能）
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 报价统计信息
   */
  async getQuoteStatsAdmin(filters = {}) {
    return await this.handleAsyncOperation(async () => {
      const {
        startDate = null,
        endDate = null,
        provider = null
      } = filters;

      // 构建查询条件
      const queryOptions = {
        startDate,
        endDate,
        provider
      };

      // 获取统计数据
      const [
        totalStats,
        providerStats,
        priceStats,
        timeSeriesData
      ] = await Promise.all([
        quoteRepo.getTotalStats(queryOptions),
        quoteRepo.getProviderStats(queryOptions),
        quoteRepo.getPriceStats(queryOptions),
        quoteRepo.getTimeSeriesData(queryOptions)
      ]);

      const result = {
        totalQuotes: totalStats.totalQuotes || 0,
        totalOrders: totalStats.totalOrders || 0,
        averageQuotesPerOrder: totalStats.totalOrders > 0
          ? (totalStats.totalQuotes / totalStats.totalOrders).toFixed(2)
          : 0,
        priceStats: {
          min: priceStats.minPrice || 0,
          max: priceStats.maxPrice || 0,
          avg: priceStats.avgPrice || 0,
          median: priceStats.medianPrice || 0
        },
        providerStats: providerStats || [],
        timeSeriesData: timeSeriesData || []
      };

      return this.buildResponse(result, '获取报价统计成功');
    }, 'getQuoteStatsAdmin', { filters });
  }

  /**
   * 导出报价数据（管理员功能）
   * @param {Object} filters - 过滤条件
   * @param {string} format - 导出格式 ('csv', 'excel')
   * @returns {Promise<Object>} 导出结果
   */
  async exportQuotes(filters = {}, format = 'csv') {
    return await this.handleAsyncOperation(async () => {
      const validFormats = ['csv', 'excel'];
      if (!validFormats.includes(format)) {
        throw this.createBusinessError('不支持的导出格式');
      }

      // 构建查询条件
      const queryOptions = {
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
        provider: filters.provider || null,
        orderId: filters.orderId || null
      };

      // 获取要导出的报价数据
      const quotes = await quoteRepo.findForExport(queryOptions);

      // 生成导出文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `quotes_export_${timestamp}.${format}`;
      const downloadUrl = `/api/downloads/${fileName}`;

      // 导出信息
      const exportInfo = {
        downloadUrl,
        fileName,
        format,
        recordCount: quotes.length,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1小时后过期
        filters: queryOptions
      };

      this.logOperation('quotes_export_created', {
        fileName,
        format,
        recordCount: quotes.length,
        filters: queryOptions
      });

      return this.buildResponse(exportInfo, '报价导出任务已创建');
    }, 'exportQuotes', { filters, format });
  }

  /**
   * 批量获取多个订单的报价（管理员功能）
   * @param {Array} orderIds - 订单ID列表
   * @returns {Promise<Object>} 批量报价结果
   */
  async getBatchQuotes(orderIds) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderIds }, ['orderIds']);

      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        throw this.createBusinessError('订单ID列表不能为空');
      }

      if (orderIds.length > 100) {
        throw this.createBusinessError('一次最多只能查询100个订单的报价');
      }

      // 批量获取报价数据
      const batchResults = await Promise.all(
        orderIds.map(async (orderId) => {
          try {
            // 获取订单的所有报价
            const quotes = await quoteRepo.findByOrderId(orderId);

            // 计算统计信息
            const stats = {
              count: quotes.length,
              minPrice: quotes.length > 0 ? Math.min(...quotes.map(q => q.price)) : 0,
              maxPrice: quotes.length > 0 ? Math.max(...quotes.map(q => q.price)) : 0,
              avgPrice: quotes.length > 0
                ? (quotes.reduce((sum, q) => sum + q.price, 0) / quotes.length).toFixed(2)
                : 0
            };

            return {
              orderId,
              quotes,
              stats
            };
          } catch (error) {
            this.logger.error('获取单个订单报价失败', {
              orderId,
              error: error.message
            });

            return {
              orderId,
              quotes: [],
              stats: { count: 0, minPrice: 0, maxPrice: 0, avgPrice: 0 },
              error: error.message
            };
          }
        })
      );

      return this.buildResponse(batchResults, '批量获取报价完成');
    }, 'getBatchQuotes', { orderIds });
  }
}

module.exports = QuoteService;
