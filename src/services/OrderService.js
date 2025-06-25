/**
 * 订单业务逻辑服务
 * 处理订单相关的业务逻辑
 */

const BaseService = require('./BaseService');
const { orderRepo, quoteRepo } = require('../repositories');
const OrderIdService = require('./OrderIdService');
const { logger } = require('../config/logger');

class OrderService extends BaseService {
  constructor() {
    super('OrderService');
    this.orderIdService = new OrderIdService();
    this.allowedSortFields = ['createdAt', 'updatedAt', 'status', 'selectedPrice'];
  }

  /**
   * 创建订单
   * @param {Object} orderData - 订单数据
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 创建的订单
   */
  async createOrder(orderData, userId) {
    return await this.handleAsyncOperation(async () => {
      // 验证必需参数
      this.validateRequiredParams(orderData, ['warehouse', 'goods', 'deliveryAddress']);
      this.validateRequiredParams({ userId }, ['userId']);

      // 验证参数类型
      this.validateParamTypes(orderData, {
        warehouse: 'string',
        goods: 'string',
        deliveryAddress: 'string'
      });

      // 清理和标准化数据
      const cleanData = {
        warehouse: orderData.warehouse.trim(),
        goods: orderData.goods.trim(),
        deliveryAddress: orderData.deliveryAddress.trim()
      };

      // 验证数据长度
      if (cleanData.warehouse.length < 2 || cleanData.warehouse.length > 100) {
        throw this.createBusinessError('仓库名称长度必须在2-100字符之间');
      }

      if (cleanData.goods.length < 2 || cleanData.goods.length > 500) {
        throw this.createBusinessError('货物描述长度必须在2-500字符之间');
      }

      if (cleanData.deliveryAddress.length < 5 || cleanData.deliveryAddress.length > 200) {
        throw this.createBusinessError('配送地址长度必须在5-200字符之间');
      }

      // 在事务中创建订单
      const result = await orderRepo.transactionWithRetry(async (trx) => {
        // 生成订单ID
        const orderId = await this.orderIdService.generateOrderId();

        // 创建订单
        const newOrder = {
          id: orderId,
          ...cleanData,
          userId,
          status: 'active',
          createdAt: new Date().toISOString()
        };

        const createdOrder = await orderRepo.create(newOrder, trx);

        this.logOperation('order_created', {
          orderId: createdOrder.id,
          userId,
          warehouse: createdOrder.warehouse
        });

        return createdOrder;
      });

      return this.buildResponse(result, '订单创建成功');
    }, 'createOrder', { userId, warehouse: orderData.warehouse });
  }

  /**
   * 获取订单详情
   * @param {string} orderId - 订单ID
   * @param {string} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 订单详情
   */
  async getOrderById(orderId, userId, userRole) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderId, userId, userRole }, ['orderId', 'userId', 'userRole']);

      // 检查访问权限
      const hasAccess = await orderRepo.checkUserAccess(orderId, userId, userRole);
      if (!hasAccess) {
        throw this.createBusinessError('无权访问此订单', 'ACCESS_DENIED', 403);
      }

      // 获取订单信息
      const order = await orderRepo.findById(orderId);
      if (!order) {
        throw this.createBusinessError('订单不存在', 'ORDER_NOT_FOUND', 404);
      }

      // 获取订单的报价信息
      const quotes = await quoteRepo.findByOrderId(orderId);

      const result = {
        ...order,
        quotes: quotes || []
      };

      return this.buildResponse(result, '获取订单详情成功');
    }, 'getOrderById', { orderId, userId });
  }

  /**
   * 获取用户订单列表
   * @param {string} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 订单列表
   */
  async getUserOrders(userId, options = {}) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ userId }, ['userId']);

      // 标准化分页参数
      const pagination = this.normalizePaginationParams(options);
      
      // 标准化排序参数
      const orderBy = this.normalizeOrderByParams(options.orderBy, this.allowedSortFields);

      // 构建查询选项
      const queryOptions = {
        status: options.status || null,
        limit: pagination.limit,
        offset: pagination.offset,
        orderBy: orderBy.length > 0 ? orderBy : [{ column: 'createdAt', direction: 'desc' }]
      };

      // 获取订单列表和总数
      const [orders, total] = await Promise.all([
        orderRepo.findByUserId(userId, queryOptions),
        orderRepo.count({ userId, ...(options.status && { status: options.status }) })
      ]);

      return this.buildPaginatedResponse(orders, total, pagination);
    }, 'getUserOrders', { userId, options });
  }

  /**
   * 更新订单
   * @param {string} orderId - 订单ID
   * @param {Object} updateData - 更新数据
   * @param {string} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 更新后的订单
   */
  async updateOrder(orderId, updateData, userId, userRole) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderId, userId, userRole }, ['orderId', 'userId', 'userRole']);

      // 检查访问权限
      const hasAccess = await orderRepo.checkUserAccess(orderId, userId, userRole);
      if (!hasAccess) {
        throw this.createBusinessError('无权修改此订单', 'ACCESS_DENIED', 403);
      }

      // 获取现有订单
      const existingOrder = await orderRepo.findById(orderId);
      if (!existingOrder) {
        throw this.createBusinessError('订单不存在', 'ORDER_NOT_FOUND', 404);
      }

      // 检查订单状态是否允许修改
      if (existingOrder.status !== 'active') {
        throw this.createBusinessError('只能修改状态为活跃的订单', 'INVALID_ORDER_STATUS', 400);
      }

      // 验证和清理更新数据
      const allowedFields = ['warehouse', 'goods', 'deliveryAddress'];
      const cleanUpdateData = {};

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          if (typeof updateData[field] !== 'string') {
            throw this.createBusinessError(`${field} 必须是字符串类型`);
          }
          cleanUpdateData[field] = updateData[field].trim();
        }
      }

      if (Object.keys(cleanUpdateData).length === 0) {
        throw this.createBusinessError('没有提供有效的更新字段');
      }

      // 验证字段长度
      if (cleanUpdateData.warehouse && (cleanUpdateData.warehouse.length < 2 || cleanUpdateData.warehouse.length > 100)) {
        throw this.createBusinessError('仓库名称长度必须在2-100字符之间');
      }

      if (cleanUpdateData.goods && (cleanUpdateData.goods.length < 2 || cleanUpdateData.goods.length > 500)) {
        throw this.createBusinessError('货物描述长度必须在2-500字符之间');
      }

      if (cleanUpdateData.deliveryAddress && (cleanUpdateData.deliveryAddress.length < 5 || cleanUpdateData.deliveryAddress.length > 200)) {
        throw this.createBusinessError('配送地址长度必须在5-200字符之间');
      }

      // 更新订单
      const updatedOrder = await orderRepo.updateById(orderId, cleanUpdateData);

      this.logOperation('order_updated', {
        orderId,
        userId,
        updatedFields: Object.keys(cleanUpdateData)
      });

      return this.buildResponse(updatedOrder, '订单更新成功');
    }, 'updateOrder', { orderId, userId });
  }

  /**
   * 更新订单状态
   * @param {string} orderId - 订单ID
   * @param {string} status - 新状态
   * @param {string} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 更新后的订单
   */
  async updateOrderStatus(orderId, status, userId, userRole) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderId, status, userId, userRole }, ['orderId', 'status', 'userId', 'userRole']);

      // 验证状态值
      const validStatuses = ['active', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw this.createBusinessError('无效的订单状态', 'INVALID_STATUS', 400);
      }

      // 检查访问权限
      const hasAccess = await orderRepo.checkUserAccess(orderId, userId, userRole);
      if (!hasAccess) {
        throw this.createBusinessError('无权修改此订单', 'ACCESS_DENIED', 403);
      }

      // 获取现有订单
      const existingOrder = await orderRepo.findById(orderId);
      if (!existingOrder) {
        throw this.createBusinessError('订单不存在', 'ORDER_NOT_FOUND', 404);
      }

      // 检查状态转换是否合法
      if (existingOrder.status === status) {
        throw this.createBusinessError('订单状态未发生变化', 'NO_STATUS_CHANGE', 400);
      }

      // 更新订单状态
      const updatedOrder = await orderRepo.updateById(orderId, { status });

      this.logOperation('order_status_updated', {
        orderId,
        userId,
        oldStatus: existingOrder.status,
        newStatus: status
      });

      return this.buildResponse(updatedOrder, '订单状态更新成功');
    }, 'updateOrderStatus', { orderId, status, userId });
  }

  /**
   * 删除订单
   * @param {string} orderId - 订单ID
   * @param {string} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 删除结果
   */
  async deleteOrder(orderId, userId, userRole) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderId, userId, userRole }, ['orderId', 'userId', 'userRole']);

      // 检查访问权限
      const hasAccess = await orderRepo.checkUserAccess(orderId, userId, userRole);
      if (!hasAccess) {
        throw this.createBusinessError('无权删除此订单', 'ACCESS_DENIED', 403);
      }

      // 获取现有订单
      const existingOrder = await orderRepo.findById(orderId);
      if (!existingOrder) {
        throw this.createBusinessError('订单不存在', 'ORDER_NOT_FOUND', 404);
      }

      // 检查订单状态是否允许删除
      if (existingOrder.status === 'completed') {
        throw this.createBusinessError('已完成的订单不能删除', 'CANNOT_DELETE_COMPLETED', 400);
      }

      // 删除订单
      await orderRepo.deleteById(orderId);

      this.logOperation('order_deleted', {
        orderId,
        userId,
        orderStatus: existingOrder.status
      });

      return this.buildResponse({
        deleted: true,
        orderId
      }, '订单删除成功');
    }, 'deleteOrder', { orderId, userId });
  }

  /**
   * 选择供应商
   * @param {string} orderId - 订单ID
   * @param {string} provider - 供应商名称
   * @param {string} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 更新后的订单
   */
  async selectProvider(orderId, provider, userId, userRole) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderId, provider, userId, userRole }, ['orderId', 'provider', 'userId', 'userRole']);

      // 检查访问权限
      const hasAccess = await orderRepo.checkUserAccess(orderId, userId, userRole);
      if (!hasAccess) {
        throw this.createBusinessError('无权操作此订单', 'ACCESS_DENIED', 403);
      }

      // 获取订单和报价信息
      const [order, quote] = await Promise.all([
        orderRepo.findById(orderId),
        quoteRepo.findByOrderAndProvider(orderId, provider)
      ]);

      if (!order) {
        throw this.createBusinessError('订单不存在', 'ORDER_NOT_FOUND', 404);
      }

      if (!quote) {
        throw this.createBusinessError('报价不存在', 'QUOTE_NOT_FOUND', 404);
      }

      if (order.status !== 'active') {
        throw this.createBusinessError('只能为活跃状态的订单选择供应商', 'INVALID_ORDER_STATUS', 400);
      }

      // 更新订单选择的供应商
      const updatedOrder = await orderRepo.selectProvider(orderId, provider, quote.price);

      this.logOperation('provider_selected', {
        orderId,
        provider,
        price: quote.price,
        userId
      });

      return this.buildResponse(updatedOrder, '供应商选择成功');
    }, 'selectProvider', { orderId, provider, userId });
  }

  /**
   * 取消订单
   * @param {string} orderId - 订单ID
   * @param {string} reason - 取消原因
   * @param {string} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 取消后的订单
   */
  async cancelOrder(orderId, reason, userId, userRole) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderId, userId, userRole }, ['orderId', 'userId', 'userRole']);

      // 检查访问权限
      const hasAccess = await orderRepo.checkUserAccess(orderId, userId, userRole);
      if (!hasAccess) {
        throw this.createBusinessError('无权取消此订单', 'ACCESS_DENIED', 403);
      }

      // 获取订单信息
      const order = await orderRepo.findById(orderId);
      if (!order) {
        throw this.createBusinessError('订单不存在', 'ORDER_NOT_FOUND', 404);
      }

      if (order.status === 'cancelled') {
        throw this.createBusinessError('订单已经被取消', 'ORDER_ALREADY_CANCELLED', 400);
      }

      if (order.status === 'completed') {
        throw this.createBusinessError('已完成的订单无法取消', 'CANNOT_CANCEL_COMPLETED_ORDER', 400);
      }

      // 取消订单
      const cancelledOrder = await orderRepo.cancelOrder(orderId, reason);

      this.logOperation('order_cancelled', {
        orderId,
        reason,
        userId,
        previousStatus: order.status
      });

      return this.buildResponse(cancelledOrder, '订单取消成功');
    }, 'cancelOrder', { orderId, userId });
  }

  /**
   * 获取订单统计信息
   * @param {string} userId - 用户ID（可选，管理员可以不传）
   * @param {string} userRole - 用户角色
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 统计信息
   */
  async getOrderStats(userId, userRole, filters = {}) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ userRole }, ['userRole']);

      // 构建过滤条件
      const statsFilters = { ...filters };
      
      // 非管理员只能查看自己的统计
      if (userRole !== 'admin' && userId) {
        statsFilters.userId = userId;
      }

      const stats = await orderRepo.getOrderStats(statsFilters);

      return this.buildResponse(stats, '获取订单统计成功');
    }, 'getOrderStats', { userId, userRole });
  }

  /**
   * 搜索订单
   * @param {string} searchTerm - 搜索关键词
   * @param {string} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async searchOrders(searchTerm, userId, userRole, options = {}) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ searchTerm, userId, userRole }, ['searchTerm', 'userId', 'userRole']);

      if (searchTerm.length < 2) {
        throw this.createBusinessError('搜索关键词至少需要2个字符');
      }

      // 标准化分页参数
      const pagination = this.normalizePaginationParams(options);

      // 构建搜索选项
      const searchOptions = {
        status: options.status || null,
        limit: pagination.limit,
        offset: pagination.offset
      };

      // 非管理员只能搜索自己的订单
      if (userRole !== 'admin') {
        searchOptions.userId = userId;
      }

      const orders = await orderRepo.searchOrders(searchTerm, searchOptions);

      return this.buildResponse(orders, '搜索完成', {
        searchTerm,
        resultCount: orders.length
      });
    }, 'searchOrders', { searchTerm, userId, userRole });
  }

  /**
   * 获取订单统计信息（管理员）
   * @returns {Promise<Object>} 统计信息
   */
  async getOrderStats() {
    return await this.handleAsyncOperation(async () => {
      const stats = await orderRepo.getGlobalStats();

      return this.buildResponse(stats, '获取订单统计成功');
    }, 'getOrderStats');
  }

  /**
   * 获取待处理订单列表（管理员功能）
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 待处理订单列表
   */
  async getPendingOrders(options = {}) {
    return await this.handleAsyncOperation(async () => {
      // 标准化分页参数
      const pagination = this.normalizePaginationParams(options);

      // 标准化排序参数
      const orderBy = this.normalizeOrderByParams(options.orderBy, this.allowedSortFields);

      // 构建查询选项
      const queryOptions = {
        limit: pagination.limit,
        offset: pagination.offset,
        orderBy: orderBy.length > 0 ? orderBy : [{ column: 'createdAt', direction: 'asc' }]
      };

      // 获取待处理订单列表和总数
      const [orders, total] = await Promise.all([
        orderRepo.getPendingOrders(queryOptions),
        orderRepo.count({ status: 'active', selectedProvider: null })
      ]);

      return this.buildPaginatedResponse(orders, total, pagination, '获取待处理订单成功');
    }, 'getPendingOrders', { options });
  }

  /**
   * 批量操作订单（管理员功能）
   * @param {Array} orderIds - 订单ID列表
   * @param {string} operation - 操作类型 ('cancel', 'complete')
   * @param {string} adminId - 管理员ID
   * @returns {Promise<Object>} 批量操作结果
   */
  async batchUpdateOrders(orderIds, operation, adminId) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ orderIds, operation, adminId }, ['orderIds', 'operation', 'adminId']);

      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        throw this.createBusinessError('订单ID列表不能为空');
      }

      const validOperations = ['cancel', 'complete'];
      if (!validOperations.includes(operation)) {
        throw this.createBusinessError('无效的批量操作类型');
      }

      // 使用事务确保数据一致性
      const results = await this.executeInTransaction(async (trx) => {
        const processedResults = {
          processed: 0,
          success: 0,
          failed: 0,
          errors: []
        };

        for (const orderId of orderIds) {
          try {
            processedResults.processed++;

            // 验证订单存在且状态允许操作
            const order = await orderRepo.findById(orderId, trx);
            if (!order) {
              processedResults.failed++;
              processedResults.errors.push({
                orderId,
                error: '订单不存在'
              });
              continue;
            }

            if (order.status === 'cancelled' || order.status === 'completed') {
              processedResults.failed++;
              processedResults.errors.push({
                orderId,
                error: '订单状态不允许此操作'
              });
              continue;
            }

            // 执行状态更新
            const newStatus = operation === 'cancel' ? 'cancelled' : 'completed';
            await orderRepo.updateById(orderId, {
              status: newStatus,
              updatedAt: new Date().toISOString()
            }, trx);

            processedResults.success++;

            this.logOperation('batch_order_updated', {
              orderId,
              operation,
              newStatus,
              adminId
            });

          } catch (error) {
            processedResults.failed++;
            processedResults.errors.push({
              orderId,
              error: error.message
            });
            this.logger.error('批量操作单个订单失败', {
              orderId,
              operation,
              error: error.message
            });
          }
        }

        return processedResults;
      });

      this.logOperation('batch_orders_completed', {
        totalOrders: orderIds.length,
        operation,
        results,
        adminId
      });

      return this.buildResponse(results, '批量操作完成');
    }, 'batchUpdateOrders', { orderIds, operation, adminId });
  }

  /**
   * 导出订单数据（管理员功能）
   * @param {Object} filters - 过滤条件
   * @param {string} format - 导出格式 ('csv', 'excel')
   * @returns {Promise<Object>} 导出结果
   */
  async exportOrders(filters = {}, format = 'csv') {
    return await this.handleAsyncOperation(async () => {
      const validFormats = ['csv', 'excel'];
      if (!validFormats.includes(format)) {
        throw this.createBusinessError('不支持的导出格式');
      }

      // 构建查询条件
      const queryOptions = {
        status: filters.status || null,
        startDate: filters.startDate || null,
        endDate: filters.endDate || null
      };

      // 获取要导出的订单数据
      const orders = await orderRepo.findForExport(queryOptions);

      // 生成导出文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `orders_export_${timestamp}.${format}`;
      const downloadUrl = `/api/downloads/${fileName}`;

      // 这里可以实现实际的文件生成逻辑
      // 目前先返回文件信息，实际文件生成可以异步处理
      const exportInfo = {
        downloadUrl,
        fileName,
        format,
        recordCount: orders.length,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1小时后过期
        filters: queryOptions
      };

      this.logOperation('orders_export_created', {
        fileName,
        format,
        recordCount: orders.length,
        filters: queryOptions
      });

      return this.buildResponse(exportInfo, '订单导出任务已创建');
    }, 'exportOrders', { filters, format });
  }
}

module.exports = OrderService;
