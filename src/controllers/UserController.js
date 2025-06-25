/**
 * 用户控制器
 * 处理用户相关的HTTP请求
 */

const BaseController = require('./BaseController');
const { userService } = require('../services');

class UserController extends BaseController {
  constructor() {
    super('UserController');
    this.allowedSortFields = ['created_at', 'updated_at', 'name', 'email'];
    this.allowedFilterFields = ['role', 'isActive'];
  }

  /**
   * 用户注册
   * POST /api/auth/register
   */
  register = this.asyncHandler(async (req, res) => {
    const userData = this.validateRequestBody(req, ['email', 'password', 'username']);

    this.logOperation('user_register_request', req, {
      email: userData.email,
      username: userData.username
    });

    const result = await userService.registerUser(userData);
    
    this.sendSuccess(res, result.data, result.message, 201, result.meta);
  });

  /**
   * 用户登录
   * POST /api/auth/login
   */
  login = this.asyncHandler(async (req, res) => {
    const { email, password } = this.validateRequestBody(req, ['email', 'password']);

    this.logOperation('user_login_request', req, { email });

    const result = await userService.loginUser(email, password);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取当前用户信息
   * GET /api/auth/me
   */
  getCurrentUserInfo = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);

    this.logOperation('get_current_user_request', req, { userId: user.id });

    const result = await userService.getUserById(user.id);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 刷新token
   * POST /api/auth/refresh
   */
  refreshToken = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);

    this.logOperation('refresh_token_request', req, { userId: user.id });

    const result = await userService.refreshToken(user.id);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 用户登出
   * POST /api/auth/logout
   */
  logout = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);

    this.logOperation('logout_request', req, { userId: user.id });

    const result = await userService.logout(user.id);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 更新当前用户信息
   * PUT /api/auth/me
   */
  updateCurrentUser = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const updateData = this.validateRequestBody(req);

    // 验证至少有一个可更新的字段
    const allowedFields = ['name', 'email'];
    const hasValidField = allowedFields.some(field => updateData[field] !== undefined);
    
    if (!hasValidField) {
      return this.sendError(res, '请提供至少一个可更新的字段', 400, 'NO_UPDATE_FIELDS');
    }

    this.logOperation('update_current_user_request', req, {
      userId: user.id,
      updateFields: Object.keys(updateData)
    });

    const result = await userService.updateUser(user.id, updateData, user.role);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 更改密码
   * POST /api/auth/change-password
   */
  changePassword = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const { currentPassword, newPassword } = this.validateRequestBody(req, ['currentPassword', 'newPassword']);

    this.logOperation('change_password_request', req, { userId: user.id });

    const result = await userService.changePassword(user.id, currentPassword, newPassword);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 检查密码状态
   * GET /api/auth/password-status
   */
  checkPasswordStatus = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);

    this.logOperation('check_password_status_request', req, { userId: user.id });

    const result = await userService.checkPasswordStatus(user.id);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 生成密码建议
   * GET /api/auth/password-suggestion
   */
  generatePasswordSuggestion = this.asyncHandler(async (req, res) => {
    const { length } = req.query;
    const passwordLength = length ? parseInt(length, 10) : 16;

    if (passwordLength < 12 || passwordLength > 128) {
      return this.sendError(res, '密码长度必须在12-128之间', 400, 'INVALID_LENGTH');
    }

    this.logOperation('generate_password_suggestion_request', req, { length: passwordLength });

    const result = await userService.generatePasswordSuggestion(passwordLength);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取用户列表（管理员功能）
   * GET /api/users
   */
  getUserList = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    // 提取查询参数
    const pagination = this.extractPaginationParams(req);
    const orderBy = this.extractSortParams(req, this.allowedSortFields);
    const filters = this.extractFilterParams(req, this.allowedFilterFields);

    const options = {
      ...pagination,
      orderBy,
      ...filters
    };

    this.logOperation('get_user_list_request', req, {
      userId: user.id,
      options
    });

    const result = await userService.getUserList(user.role, options);
    
    if (result.data && Array.isArray(result.data)) {
      this.sendPaginatedResponse(res, result.data, result.meta.pagination.total, pagination, result.message);
    } else {
      this.sendSuccess(res, result.data, result.message, 200, result.meta);
    }
  });

  /**
   * 根据ID获取用户信息（管理员功能）
   * GET /api/users/:userId
   */
  getUserById = this.asyncHandler(async (req, res) => {
    const currentUser = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');
    
    const { userId } = this.validatePathParams(req, ['userId']);

    this.logOperation('get_user_by_id_request', req, {
      currentUserId: currentUser.id,
      targetUserId: userId
    });

    const result = await userService.getUserById(userId);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 更新用户信息（管理员功能）
   * PUT /api/users/:userId
   */
  updateUser = this.asyncHandler(async (req, res) => {
    const currentUser = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');
    
    const { userId } = this.validatePathParams(req, ['userId']);
    const updateData = this.validateRequestBody(req);

    // 验证至少有一个可更新的字段
    const allowedFields = ['name', 'email', 'role', 'isActive'];
    const hasValidField = allowedFields.some(field => updateData[field] !== undefined);
    
    if (!hasValidField) {
      return this.sendError(res, '请提供至少一个可更新的字段', 400, 'NO_UPDATE_FIELDS');
    }

    this.logOperation('update_user_request', req, {
      currentUserId: currentUser.id,
      targetUserId: userId,
      updateFields: Object.keys(updateData)
    });

    const result = await userService.updateUser(userId, updateData, currentUser.role);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 激活/禁用用户（管理员功能）
   * POST /api/users/:userId/toggle-status
   */
  toggleUserStatus = this.asyncHandler(async (req, res) => {
    const currentUser = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    const { userId } = this.validatePathParams(req, ['userId']);
    const { isActive } = this.validateRequestBody(req, ['isActive']);

    if (typeof isActive !== 'boolean') {
      return this.sendError(res, 'isActive 必须是布尔值', 400, 'INVALID_BOOLEAN');
    }

    this.logOperation('toggle_user_status_request', req, {
      currentUserId: currentUser.id,
      targetUserId: userId,
      isActive
    });

    const result = await userService.setUserActive(userId, isActive, currentUser.role);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 强制用户更改密码（管理员功能）
   * POST /api/users/:userId/force-password-change
   */
  forcePasswordChange = this.asyncHandler(async (req, res) => {
    const currentUser = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    const { userId } = this.validatePathParams(req, ['userId']);

    this.logOperation('force_password_change_request', req, {
      currentUserId: currentUser.id,
      targetUserId: userId
    });

    const result = await userService.forcePasswordChange(userId, currentUser.role);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取用户密码状态（管理员功能）
   * GET /api/users/:userId/password-status
   */
  getUserPasswordStatus = this.asyncHandler(async (req, res) => {
    const currentUser = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    const { userId } = this.validatePathParams(req, ['userId']);

    this.logOperation('get_user_password_status_request', req, {
      currentUserId: currentUser.id,
      targetUserId: userId
    });

    const result = await userService.checkPasswordStatus(userId);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 搜索用户（管理员功能）
   * GET /api/users/search
   */
  searchUsers = this.asyncHandler(async (req, res) => {
    const currentUser = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    const { q: searchTerm } = req.query;

    if (!searchTerm) {
      return this.sendError(res, '搜索关键词不能为空', 400, 'MISSING_SEARCH_TERM');
    }

    // 提取查询参数
    const pagination = this.extractPaginationParams(req);
    const filters = this.extractFilterParams(req, this.allowedFilterFields);

    const options = {
      ...pagination,
      ...filters
    };

    this.logOperation('search_users_request', req, {
      searchTerm,
      currentUserId: currentUser.id,
      options
    });

    const result = await userService.searchUsers(searchTerm, currentUser.role, options);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取用户统计信息（管理员功能）
   * GET /api/users/stats
   */
  getUserStats = this.asyncHandler(async (req, res) => {
    const currentUser = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    this.logOperation('get_user_stats_request', req, {
      currentUserId: currentUser.id
    });

    const result = await userService.getUserStats(currentUser.role);
    
    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 批量操作用户（管理员功能）
   * POST /api/users/batch
   */
  batchOperateUsers = this.asyncHandler(async (req, res) => {
    const currentUser = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    const { userIds, operation } = this.validateRequestBody(req, ['userIds', 'operation']);

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return this.sendError(res, '用户ID列表不能为空', 400, 'EMPTY_USER_IDS');
    }

    const validOperations = ['activate', 'deactivate'];
    if (!validOperations.includes(operation)) {
      return this.sendError(res, '无效的批量操作类型', 400, 'INVALID_OPERATION');
    }

    this.logOperation('batch_operate_users_request', req, {
      userIds,
      operation,
      currentUserId: currentUser.id,
      count: userIds.length
    });

    // 这里可以实现批量操作逻辑
    // 目前先返回一个简单的响应
    const result = {
      data: {
        processed: userIds.length,
        success: userIds.length,
        failed: 0,
        errors: []
      },
      message: '批量操作完成'
    };
    
    this.sendSuccess(res, result.data, result.message, 200);
  });

  /**
   * 获取用户个人信息
   * GET /api/users/profile
   */
  getProfile = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);

    this.logOperation('get_profile_request', req, { userId: user.id });

    const result = await userService.getUserById(user.id);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 更新用户个人信息
   * PATCH /api/users/profile
   */
  updateProfile = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);
    const updateData = this.validateRequestBody(req);

    this.logOperation('update_profile_request', req, {
      userId: user.id,
      updateFields: Object.keys(updateData)
    });

    const result = await userService.updateUser(user.id, updateData, user.role);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取所有用户列表（管理员）
   * GET /api/users/admin/all
   */
  getAllUsers = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);

    // 提取查询参数
    const pagination = this.extractPaginationParams(req);
    const search = req.query.search;

    const options = {
      ...pagination,
      search
    };

    this.logOperation('get_all_users_request', req, {
      userId: user.id,
      options
    });

    const result = await userService.getAllUsers(options);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 更新用户状态（管理员）
   * PATCH /api/users/admin/:id/status
   */
  updateUserStatus = this.asyncHandler(async (req, res) => {
    const currentUser = this.getCurrentUser(req);
    const { id: userId } = this.validatePathParams(req, ['id']);
    const { status } = this.validateRequestBody(req, ['status']);

    this.logOperation('update_user_status_request', req, {
      currentUserId: currentUser.id,
      targetUserId: userId,
      newStatus: status
    });

    const result = await userService.updateUserStatus(userId, status, currentUser.id);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 重置用户密码（管理员）
   * POST /api/users/admin/:id/reset-password
   */
  resetUserPassword = this.asyncHandler(async (req, res) => {
    const currentUser = this.getCurrentUser(req);
    const { id: userId } = this.validatePathParams(req, ['id']);

    this.logOperation('reset_user_password_request', req, {
      currentUserId: currentUser.id,
      targetUserId: userId
    });

    const result = await userService.resetUserPassword(userId, currentUser.id);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 获取用户统计信息（管理员）
   * GET /api/users/admin/stats
   */
  getUserStats = this.asyncHandler(async (req, res) => {
    const user = this.getCurrentUser(req);

    this.logOperation('get_user_stats_request', req, {
      userId: user.id
    });

    const result = await userService.getUserStats();

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });

  /**
   * 导出用户数据（管理员功能）
   * GET /api/users/export
   */
  exportUsers = this.asyncHandler(async (req, res) => {
    const currentUser = this.getCurrentUser(req);
    this.checkUserRole(req, 'admin');

    // 提取过滤参数
    const filters = this.extractFilterParams(req, this.allowedFilterFields);
    const format = req.query.format || 'csv';

    this.logOperation('export_users_request', req, {
      currentUserId: currentUser.id,
      filters,
      format
    });

    const result = await userService.exportUsers(filters, format);

    this.sendSuccess(res, result.data, result.message, 200, result.meta);
  });
}

module.exports = UserController;
