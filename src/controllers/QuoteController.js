/**
 * 报价控制器
 * 处理报价相关的HTTP请求
 */

const BaseController = require('./BaseController');
const { quoteService } = require('../services');

class QuoteController extends BaseController {
  constructor() {
    super('QuoteController');
    this.allowedSortFields = ['price', 'createdAt', 'estimatedDelivery'];
    this.allowedFilterFields = ['startDate', 'endDate'];
  }

  /**
   * 创建或更新报价（供应商接口）
   * POST /api/quotes/:orderId
   */
  createOrUpdateQuote = this.asyncHandler(async (req, res) => {
    const { orderId } = this.validatePathParams(req, ['orderId']);
    const quoteData = this.validateRequestBody(req, ['price', 'estimatedDelivery']);

    // 从请求头获取供应商信息
    const provider = req.headers['x-provider-name'];
    const accessKey = req.headers['x-access-key'];

    if (!provider || !accessKey) {
      return this.sendError(res, '缺少供应商认证信息', 401, 'MISSING_PROVIDER_AUTH');
    }

    this.logOperation('create_or_update_quote_request', req, {
      orderId,
      provider,
      price: quoteData.price
    });

    const result = await quoteService.createOrUpdateQuote(orderId, provider, quoteData, accessKey);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 提交报价（供应商接口）- submitQuote别名
   * POST /api/quotes/orders/:orderId
   */
  submitQuote = this.createOrUpdateQuote;

  /**
   * 获取订单的所有报价
   * GET /api/quotes/order/:orderId
   */
  getOrderQuotes = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { orderId } = this.validatePathParams(req, ['orderId']);
    
    // 提取排序参数
    const orderBy = this.extractSortParams(req, this.allowedSortFields);

    const options = { orderBy };

    this.logOperation('get_order_quotes_request', req, {
      orderId,
      userId: user.id,
      options
    });

    const result = await quoteService.getOrderQuotes(orderId, options);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取订单的所有报价（别名）
   * GET /api/quotes/orders/:orderId
   */
  getQuotesByOrderId = this.getOrderQuotes;

  /**
   * 获取报价详情
   * GET /api/quotes/:id
   */
  getQuoteById = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { id: quoteId } = this.validatePathParams(req, ['id']);

    this.logOperation('get_quote_by_id_request', req, {
      quoteId,
      userId: user.id
    });

    const result = await quoteService.getQuoteById(quoteId, user.id, user.role);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 用户选择报价
   * POST /api/quotes/:id/select
   */
  selectQuote = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { id: quoteId } = this.validatePathParams(req, ['id']);

    this.logOperation('select_quote_request', req, {
      quoteId,
      userId: user.id
    });

    const result = await quoteService.selectQuote(quoteId, user.id, user.role);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 供应商更新报价
   * PATCH /api/quotes/:id
   */
  updateQuote = this.asyncHandler(async (req, res) => {
    const { id: quoteId } = this.validatePathParams(req, ['id']);
    const updateData = this.validateRequestBody(req, []);

    // 从请求头获取供应商信息
    const provider = req.headers['x-provider-name'];
    const accessKey = req.headers['x-access-key'];

    this.logOperation('update_quote_request', req, {
      quoteId,
      provider,
      updateFields: Object.keys(updateData)
    });

    const result = await quoteService.updateQuote(quoteId, updateData, provider, accessKey);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 供应商撤回报价
   * DELETE /api/quotes/:id
   */
  withdrawQuote = this.asyncHandler(async (req, res) => {
    const { id: quoteId } = this.validatePathParams(req, ['id']);

    // 从请求头获取供应商信息
    const provider = req.headers['x-provider-name'];
    const accessKey = req.headers['x-access-key'];

    this.logOperation('withdraw_quote_request', req, {
      quoteId,
      provider
    });

    const result = await quoteService.withdrawQuote(quoteId, provider, accessKey);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取所有报价（管理员）
   * GET /api/quotes/admin/all
   */
  getAllQuotes = this.asyncHandler(async (req, res) => {
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

    this.logOperation('get_all_quotes_request', req, {
      userId: user.id,
      options
    });

    const result = await quoteService.getAllQuotes(options);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取报价统计信息（管理员）
   * GET /api/quotes/admin/stats
   */
  getQuoteStats = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);

    this.logOperation('get_quote_stats_request', req, {
      userId: user.id
    });

    const result = await quoteService.getQuoteStats();

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取供应商的报价历史（供应商接口）
   * GET /api/quotes/provider/:provider
   */
  getProviderQuotes = this.asyncHandler(async (req, res) => {
    const { provider } = this.validatePathParams(req, ['provider']);
    
    // 从请求头获取访问密钥
    const accessKey = req.headers['x-access-key'];
    if (!accessKey) {
      return this.sendError(res, '缺少访问密钥', 401, 'MISSING_ACCESS_KEY');
    }

    // 提取查询参数
    const pagination = this.extractPaginationParams(req);
    const orderBy = this.extractSortParams(req, this.allowedSortFields);
    const filters = this.extractFilterParams(req, this.allowedFilterFields);

    const options = {
      ...pagination,
      orderBy,
      ...filters
    };

    this.logOperation('get_provider_quotes_request', req, {
      provider,
      options
    });

    const result = await quoteService.getProviderQuotes(provider, accessKey, options);
    
    if (result.data && result.meta && result.meta.pagination) {
      this.sendPaginatedResponse(res, result.data, result.meta.pagination.total, pagination, result.message);
    } else {
      this.sendSuccess(res, result.data, result.message, 200, result.meta);
    }
  });

  /**
   * 删除报价（供应商接口）
   * DELETE /api/quotes/:orderId/:provider
   */
  deleteQuote = this.asyncHandler(async (req, res) => {
    const { orderId, provider } = this.validatePathParams(req, ['orderId', 'provider']);
    
    // 从请求头获取访问密钥
    const accessKey = req.headers['x-access-key'];
    if (!accessKey) {
      return this.sendError(res, '缺少访问密钥', 401, 'MISSING_ACCESS_KEY');
    }

    this.logOperation('delete_quote_request', req, {
      orderId,
      provider
    });

    const result = await quoteService.deleteQuote(orderId, provider, accessKey);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取订单的最低报价
   * GET /api/quotes/order/:orderId/lowest
   */
  getLowestQuote = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { orderId } = this.validatePathParams(req, ['orderId']);

    this.logOperation('get_lowest_quote_request', req, {
      orderId,
      userId: user.id
    });

    const result = await quoteService.getLowestQuote(orderId);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 根据价格范围获取报价
   * GET /api/quotes/order/:orderId/price-range
   */
  getQuotesByPriceRange = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { orderId } = this.validatePathParams(req, ['orderId']);
    
    const { minPrice, maxPrice } = req.query;
    
    if (!minPrice || !maxPrice) {
      return this.sendError(res, '请提供价格范围参数', 400, 'MISSING_PRICE_RANGE');
    }

    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);

    if (isNaN(min) || isNaN(max)) {
      return this.sendError(res, '价格参数必须是有效数字', 400, 'INVALID_PRICE_FORMAT');
    }

    this.logOperation('get_quotes_by_price_range_request', req, {
      orderId,
      minPrice: min,
      maxPrice: max,
      userId: user.id
    });

    const result = await quoteService.getQuotesByPriceRange(orderId, min, max);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 批量获取多个订单的报价（管理员功能）
   * POST /api/quotes/batch
   */
  getBatchQuotes = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    const { orderIds } = this.validateRequestBody(req, ['orderIds']);

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return this.sendError(res, '订单ID列表不能为空', 400, 'EMPTY_ORDER_IDS');
    }

    if (orderIds.length > 100) {
      return this.sendError(res, '一次最多查询100个订单的报价', 400, 'TOO_MANY_ORDERS');
    }

    this.logOperation('get_batch_quotes_request', req, {
      orderIds,
      userId: user.id,
      count: orderIds.length
    });

    const result = await quoteService.getBatchQuotes(orderIds);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取报价统计信息（管理员功能）
   * GET /api/quotes/stats
   */
  getQuoteStatsAdmin = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    // 提取过滤参数
    const filters = this.extractFilterParams(req, ['startDate', 'endDate', 'provider']);

    this.logOperation('get_quote_stats_admin_request', req, {
      userId: user.id,
      filters
    });

    const result = await quoteService.getQuoteStatsAdmin(filters);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 导出报价数据（管理员功能）
   * GET /api/quotes/export
   */
  exportQuotes = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    // 提取过滤参数
    const filters = this.extractFilterParams(req, ['startDate', 'endDate', 'provider', 'orderId']);
    const format = req.query.format || 'csv';

    this.logOperation('export_quotes_request', req, {
      userId: user.id,
      filters,
      format
    });

    const result = await quoteService.exportQuotes(filters, format);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });
}

module.exports = QuoteController;
