/**
 * 订单控制器
 * 处理订单相关的HTTP请求
 */

const BaseController = require('./BaseController');
const { orderService } = require('../services');

class OrderController extends BaseController {
  constructor() {
    super('OrderController');
    this.allowedSortFields = ['createdAt', 'updatedAt', 'status', 'selectedPrice'];
    this.allowedFilterFields = ['status', 'startDate', 'endDate'];
  }

  /**
   * 创建订单
   * POST /api/orders
   */
  createOrder = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const orderData = this.validateRequestBody(req, ['warehouse', 'goods', 'deliveryAddress']);

    this.logOperation('create_order_request', req, {
      warehouse: orderData.warehouse,
      userId: user.id
    });

    const result = await orderService.createOrder(orderData, user.id);
    
    this.sendSuccess(res, result.data, result.message, 201, result.meta);
  });

  /**
   * 获取订单详情
   * GET /api/orders/:orderId
   */
  getOrderById = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { orderId } = this.validatePathParams(req, ['orderId']);

    this.logOperation('get_order_request', req, { orderId, userId: user.id });

    const result = await orderService.getOrderById(orderId, user.id, user.role);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取用户订单列表
   * GET /api/orders
   */
  getUserOrders = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    
    // 提取查询参数
    const pagination = this.extractPaginationParams(req);
    const orderBy = this.extractSortParams(req, this.allowedSortFields);
    const filters = this.extractFilterParams(req, this.allowedFilterFields);

    const options = {
      ...pagination,
      orderBy,
      ...filters
    };

    this.logOperation('get_user_orders_request', req, {
      userId: user.id,
      options
    });

    const result = await orderService.getUserOrders(user.id, options);
    
    if (result.data && Array.isArray(result.data)) {
      this.sendPaginatedResponse(res, result.data, result.meta.pagination.total, pagination, result.message);
    } else {
      this.sendSuccess(res, result.data, result.message, 200, result.meta);
    }
  });

  /**
   * 更新订单
   * PUT /api/orders/:orderId
   */
  updateOrder = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { orderId } = this.validatePathParams(req, ['orderId']);
    const updateData = this.validateRequestBody(req);

    // 验证至少有一个可更新的字段
    const allowedFields = ['warehouse', 'goods', 'deliveryAddress'];
    const hasValidField = allowedFields.some(field => updateData[field] !== undefined);
    
    if (!hasValidField) {
      return this.sendError(res, '请提供至少一个可更新的字段', 400, 'NO_UPDATE_FIELDS');
    }

    this.logOperation('update_order_request', req, {
      orderId,
      userId: user.id,
      updateFields: Object.keys(updateData)
    });

    const result = await orderService.updateOrder(orderId, updateData, user.id, user.role);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 更新订单状态
   * PATCH /api/orders/:id/status
   */
  updateOrderStatus = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { id: orderId } = this.validatePathParams(req, ['id']);
    const { status } = this.validateRequestBody(req, ['status']);

    this.logOperation('update_order_status_request', req, {
      orderId,
      status,
      userId: user.id
    });

    const result = await orderService.updateOrderStatus(orderId, status, user.id, user.role);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 删除订单
   * DELETE /api/orders/:id
   */
  deleteOrder = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { id: orderId } = this.validatePathParams(req, ['id']);

    this.logOperation('delete_order_request', req, {
      orderId,
      userId: user.id
    });

    const result = await orderService.deleteOrder(orderId, user.id, user.role);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 选择供应商
   * POST /api/orders/:orderId/select-provider
   */
  selectProvider = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { orderId } = this.validatePathParams(req, ['orderId']);
    const { provider } = this.validateRequestBody(req, ['provider']);

    this.logOperation('select_provider_request', req, {
      orderId,
      provider,
      userId: user.id
    });

    const result = await orderService.selectProvider(orderId, provider, user.id, user.role);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 取消订单
   * POST /api/orders/:orderId/cancel
   */
  cancelOrder = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { orderId } = this.validatePathParams(req, ['orderId']);
    const { reason } = req.body || {};

    this.logOperation('cancel_order_request', req, {
      orderId,
      reason,
      userId: user.id
    });

    const result = await orderService.cancelOrder(orderId, reason, user.id, user.role);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 搜索订单
   * GET /api/orders/search
   */
  searchOrders = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { q: searchTerm } = req.query;

    if (!searchTerm) {
      return this.sendError(res, '搜索关键词不能为空', 400, 'MISSING_SEARCH_TERM');
    }

    // 提取查询参数
    const pagination = this.extractPaginationParams(req);
    const filters = this.extractFilterParams(req, ['status']);

    const options = {
      ...pagination,
      ...filters
    };

    this.logOperation('search_orders_request', req, {
      searchTerm,
      userId: user.id,
      options
    });

    const result = await orderService.searchOrders(searchTerm, user.id, user.role, options);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取订单统计信息
   * GET /api/orders/stats
   */
  getOrderStats = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    
    // 提取过滤参数
    const filters = this.extractFilterParams(req, ['startDate', 'endDate']);

    this.logOperation('get_order_stats_request', req, {
      userId: user.id,
      userRole: user.role,
      filters
    });

    const result = await orderService.getOrderStats(user.id, user.role, filters);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取待处理订单列表（管理员功能）
   * GET /api/orders/pending
   */
  getPendingOrders = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    // 提取查询参数
    const pagination = this.extractPaginationParams(req);
    const orderBy = this.extractSortParams(req, this.allowedSortFields);

    const options = {
      ...pagination,
      orderBy
    };

    this.logOperation('get_pending_orders_request', req, {
      userId: user.id,
      options
    });

    const result = await orderService.getPendingOrders(options);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 批量操作订单（管理员功能）
   * POST /api/orders/batch
   */
  batchOperateOrders = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    const { orderIds, operation } = this.validateRequestBody(req, ['orderIds', 'operation']);

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return this.sendError(res, '订单ID列表不能为空', 400, 'EMPTY_ORDER_IDS');
    }

    const validOperations = ['cancel', 'complete'];
    if (!validOperations.includes(operation)) {
      return this.sendError(res, '无效的批量操作类型', 400, 'INVALID_OPERATION');
    }

    this.logOperation('batch_operate_orders_request', req, {
      orderIds,
      operation,
      userId: user.id,
      count: orderIds.length
    });

    const result = await orderService.batchUpdateOrders(orderIds, operation, user.id);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 导出订单数据（管理员功能）
   * GET /api/orders/export
   */
  exportOrders = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    // 提取过滤参数
    const filters = this.extractFilterParams(req, ['status', 'startDate', 'endDate']);
    const format = req.query.format || 'csv';

    this.logOperation('export_orders_request', req, {
      userId: user.id,
      filters,
      format
    });

    const result = await orderService.exportOrders(filters, format);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取订单统计信息（管理员）
   * GET /api/orders/admin/stats
   */
  getOrderStats = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    this.logOperation('get_order_stats_request', req, {
      userId: user.id
    });

    const result = await orderService.getOrderStats();

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });
}

module.exports = OrderController;
