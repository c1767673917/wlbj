/**
 * UserController单元测试
 * 测试用户控制器的HTTP请求处理逻辑
 */

const UserController = require('../../../src/controllers/UserController');

// 模拟依赖
jest.mock('../../../src/services', () => ({
  userService: {
    registerUser: jest.fn(),
    loginUser: jest.fn(),
    getUserById: jest.fn(),
    updateUserProfile: jest.fn(),
    changePassword: jest.fn(),
    getUserList: jest.fn(),
    updateUser: jest.fn(),
    setUserActive: jest.fn(),
    deleteUser: jest.fn(),
    forcePasswordChange: jest.fn()
  }
}));

jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const { userService } = require('../../../src/services');

describe('UserController', () => {
  let userController;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 创建UserController实例
    userController = new UserController();
    
    // 创建模拟的Express对象
    mockReq = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user'
      },
      body: {},
      params: {},
      query: {},
      method: 'GET',
      url: '/api/users',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent')
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  describe('register', () => {
    const validUserData = {
      email: 'newuser@example.com',
      password: 'StrongPassword123!',
      name: 'New User'
    };

    it('应该成功注册用户', async () => {
      // 准备测试数据
      mockReq.body = validUserData;
      
      const mockResult = {
        data: {
          id: 'new-user-id',
          email: 'newuser@example.com',
          name: 'New User',
          role: 'user'
        },
        message: '用户注册成功',
        meta: {}
      };
      
      userService.registerUser.mockResolvedValue(mockResult);
      
      // 执行测试
      await userController.register(mockReq, mockRes, mockNext);
      
      // 验证结果
      expect(userService.registerUser).toHaveBeenCalledWith(validUserData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '用户注册成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在缺少必需参数时返回400错误', async () => {
      // 准备测试数据 - 缺少password
      mockReq.body = {
        email: 'newuser@example.com',
        name: 'New User'
      };
      
      // 执行测试
      await userController.register(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(userService.registerUser).not.toHaveBeenCalled();
    });

    it('应该在请求体为空时返回400错误', async () => {
      // 准备测试数据 - 空请求体
      mockReq.body = null;
      
      // 执行测试
      await userController.register(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '请求体不能为空',
          statusCode: 400,
          code: 'EMPTY_REQUEST_BODY'
        })
      );
      expect(userService.registerUser).not.toHaveBeenCalled();
    });

    it('应该处理服务层抛出的错误', async () => {
      // 准备测试数据
      mockReq.body = validUserData;
      
      const serviceError = new Error('邮箱已存在');
      serviceError.statusCode = 409;
      userService.registerUser.mockRejectedValue(serviceError);
      
      // 执行测试
      await userController.register(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '邮箱已存在',
          controller: 'UserController'
        })
      );
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    it('应该成功登录用户', async () => {
      // 准备测试数据
      mockReq.body = validLoginData;
      
      const mockResult = {
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user'
          },
          token: 'jwt-token-here'
        },
        message: '登录成功',
        meta: {}
      };
      
      userService.loginUser.mockResolvedValue(mockResult);
      
      // 执行测试
      await userController.login(mockReq, mockRes, mockNext);
      
      // 验证结果
      expect(userService.loginUser).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '登录成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在缺少必需参数时返回400错误', async () => {
      // 准备测试数据 - 缺少password
      mockReq.body = {
        email: 'test@example.com'
      };
      
      // 执行测试
      await userController.login(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(userService.loginUser).not.toHaveBeenCalled();
    });

    it('应该处理登录失败的错误', async () => {
      // 准备测试数据
      mockReq.body = validLoginData;
      
      const serviceError = new Error('邮箱或密码错误');
      serviceError.statusCode = 401;
      userService.loginUser.mockRejectedValue(serviceError);
      
      // 执行测试
      await userController.login(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '邮箱或密码错误',
          controller: 'UserController'
        })
      );
    });
  });

  describe('getCurrentUserInfo', () => {
    it('应该成功获取当前用户信息', async () => {
      // 准备测试数据
      const mockResult = {
        data: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user'
        },
        message: '获取用户信息成功',
        meta: {}
      };
      
      userService.getUserById.mockResolvedValue(mockResult);
      
      // 执行测试
      await userController.getCurrentUserInfo(mockReq, mockRes, mockNext);
      
      // 验证结果
      expect(userService.getUserById).toHaveBeenCalledWith('test-user-id');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取用户信息成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在用户未认证时返回401错误', async () => {
      // 准备测试数据 - 无用户信息
      mockReq.user = null;
      
      // 执行测试
      await userController.getCurrentUserInfo(mockReq, mockRes, mockNext);
      
      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '用户未认证',
          statusCode: 401,
          code: 'UNAUTHORIZED'
        })
      );
      expect(userService.getUserById).not.toHaveBeenCalled();
    });
  });

  describe('updateCurrentUser', () => {
    it('应该成功更新用户资料', async () => {
      // 准备测试数据
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };
      mockReq.body = updateData;

      const mockResult = {
        data: {
          id: 'test-user-id',
          name: 'Updated Name',
          email: 'updated@example.com',
          role: 'user'
        },
        message: '用户信息更新成功',
        meta: {}
      };

      userService.updateUser.mockResolvedValue(mockResult);

      // 执行测试
      await userController.updateCurrentUser(mockReq, mockRes, mockNext);

      // 验证结果
      expect(userService.updateUser).toHaveBeenCalledWith('test-user-id', updateData, 'user');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '用户信息更新成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在用户未认证时返回401错误', async () => {
      // 准备测试数据 - 无用户信息
      mockReq.user = null;
      mockReq.body = { name: 'Updated Name' };

      // 执行测试
      await userController.updateCurrentUser(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '用户未认证',
          statusCode: 401,
          code: 'UNAUTHORIZED'
        })
      );
      expect(userService.updateUser).not.toHaveBeenCalled();
    });

    it('应该在没有可更新字段时返回400错误', async () => {
      // 准备测试数据 - 没有有效的更新字段
      mockReq.body = { invalidField: 'value' };

      // 执行测试
      await userController.updateCurrentUser(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '请提供至少一个可更新的字段',
        code: 'NO_UPDATE_FIELDS',
        timestamp: expect.any(String)
      });
      expect(userService.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const validPasswordData = {
      currentPassword: 'oldPassword123',
      newPassword: 'NewPassword456!'
    };

    it('应该成功更改密码', async () => {
      // 准备测试数据
      mockReq.body = validPasswordData;

      const mockResult = {
        data: null,
        message: '密码更改成功',
        meta: {}
      };

      userService.changePassword.mockResolvedValue(mockResult);

      // 执行测试
      await userController.changePassword(mockReq, mockRes, mockNext);

      // 验证结果
      expect(userService.changePassword).toHaveBeenCalledWith(
        'test-user-id',
        'oldPassword123',
        'NewPassword456!'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '密码更改成功',
        data: null,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在缺少必需参数时返回400错误', async () => {
      // 准备测试数据 - 缺少newPassword
      mockReq.body = {
        currentPassword: 'oldPassword123'
      };

      // 执行测试
      await userController.changePassword(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(userService.changePassword).not.toHaveBeenCalled();
    });

    it('应该处理密码验证失败的错误', async () => {
      // 准备测试数据
      mockReq.body = validPasswordData;

      const serviceError = new Error('当前密码错误');
      serviceError.statusCode = 400;
      userService.changePassword.mockRejectedValue(serviceError);

      // 执行测试
      await userController.changePassword(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '当前密码错误',
          controller: 'UserController'
        })
      );
    });
  });

  describe('getUserList (管理员功能)', () => {
    beforeEach(() => {
      // 设置管理员用户
      mockReq.user.role = 'admin';
    });

    it('应该成功获取用户列表', async () => {
      // 准备测试数据
      mockReq.query = {
        page: '1',
        limit: '10',
        sortBy: 'created_at',
        sortOrder: 'desc',
        role: 'user',
        isActive: 'true'
      };

      const mockResult = {
        data: [
          {
            id: 'user-1',
            email: 'user1@example.com',
            name: 'User 1',
            role: 'user'
          },
          {
            id: 'user-2',
            email: 'user2@example.com',
            name: 'User 2',
            role: 'user'
          }
        ],
        message: '获取用户列表成功',
        meta: {
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        }
      };

      userService.getUserList.mockResolvedValue(mockResult);

      // 执行测试
      await userController.getUserList(mockReq, mockRes, mockNext);

      // 验证结果
      expect(userService.getUserList).toHaveBeenCalledWith('admin', {
        page: 1,
        limit: 10,
        offset: 0,
        orderBy: [{ column: 'created_at', direction: 'desc' }],
        role: 'user',
        isActive: 'true'
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取用户列表成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          pagination: mockResult.meta.pagination
        })
      });
    });

    it('应该在非管理员用户访问时返回403错误', async () => {
      // 准备测试数据 - 普通用户
      mockReq.user.role = 'user';

      // 执行测试
      await userController.getUserList(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('权限不足'),
          statusCode: 403,
          code: 'INSUFFICIENT_PERMISSIONS'
        })
      );
      expect(userService.getUserList).not.toHaveBeenCalled();
    });

    it('应该使用默认分页参数', async () => {
      // 准备测试数据 - 无查询参数
      mockReq.query = {};

      const mockResult = {
        data: [],
        message: '获取用户列表成功',
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      };

      userService.getUserList.mockResolvedValue(mockResult);

      // 执行测试
      await userController.getUserList(mockReq, mockRes, mockNext);

      // 验证结果
      expect(userService.getUserList).toHaveBeenCalledWith('admin', {
        page: 1,
        limit: 20,
        offset: 0,
        orderBy: []
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getUserById (管理员功能)', () => {
    beforeEach(() => {
      // 设置管理员用户
      mockReq.user.role = 'admin';
    });

    it('应该成功根据ID获取用户信息', async () => {
      // 准备测试数据
      const userId = 'target-user-id';
      mockReq.params = { userId };

      const mockResult = {
        data: {
          id: userId,
          email: 'target@example.com',
          name: 'Target User',
          role: 'user'
        },
        message: '获取用户信息成功',
        meta: {}
      };

      userService.getUserById.mockResolvedValue(mockResult);

      // 执行测试
      await userController.getUserById(mockReq, mockRes, mockNext);

      // 验证结果
      expect(userService.getUserById).toHaveBeenCalledWith(userId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '获取用户信息成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在非管理员用户访问时返回403错误', async () => {
      // 准备测试数据 - 普通用户
      mockReq.user.role = 'user';
      mockReq.params = { userId: 'target-user-id' };

      // 执行测试
      await userController.getUserById(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('权限不足'),
          statusCode: 403,
          code: 'INSUFFICIENT_PERMISSIONS'
        })
      );
      expect(userService.getUserById).not.toHaveBeenCalled();
    });

    it('应该在缺少userId参数时返回400错误', async () => {
      // 准备测试数据 - 缺少userId
      mockReq.params = {};

      // 执行测试
      await userController.getUserById(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(userService.getUserById).not.toHaveBeenCalled();
    });
  });

  describe('updateUser (管理员功能)', () => {
    beforeEach(() => {
      // 设置管理员用户
      mockReq.user.role = 'admin';
    });

    it('应该成功更新用户信息', async () => {
      // 准备测试数据
      const userId = 'target-user-id';
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
        role: 'admin'
      };

      mockReq.params = { userId };
      mockReq.body = updateData;

      const mockResult = {
        data: {
          id: userId,
          name: 'Updated Name',
          email: 'updated@example.com',
          role: 'admin'
        },
        message: '用户信息更新成功',
        meta: {}
      };

      userService.updateUser.mockResolvedValue(mockResult);

      // 执行测试
      await userController.updateUser(mockReq, mockRes, mockNext);

      // 验证结果
      expect(userService.updateUser).toHaveBeenCalledWith(userId, updateData, 'admin');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '用户信息更新成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在没有可更新字段时返回400错误', async () => {
      // 准备测试数据 - 没有有效的更新字段
      const userId = 'target-user-id';
      mockReq.params = { userId };
      mockReq.body = { invalidField: 'value' };

      // 执行测试
      await userController.updateUser(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '请提供至少一个可更新的字段',
        code: 'NO_UPDATE_FIELDS',
        timestamp: expect.any(String)
      });
      expect(userService.updateUser).not.toHaveBeenCalled();
    });

    it('应该在非管理员用户访问时返回403错误', async () => {
      // 准备测试数据 - 普通用户
      mockReq.user.role = 'user';
      mockReq.params = { userId: 'target-user-id' };
      mockReq.body = { name: 'Updated Name' };

      // 执行测试
      await userController.updateUser(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('权限不足'),
          statusCode: 403,
          code: 'INSUFFICIENT_PERMISSIONS'
        })
      );
      expect(userService.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('toggleUserStatus (管理员功能)', () => {
    beforeEach(() => {
      // 设置管理员用户
      mockReq.user.role = 'admin';
    });

    it('应该成功切换用户状态', async () => {
      // 准备测试数据
      const userId = 'target-user-id';
      mockReq.params = { userId };
      mockReq.body = { isActive: false };

      const mockResult = {
        data: {
          id: userId,
          isActive: false
        },
        message: '用户状态更新成功',
        meta: {}
      };

      userService.setUserActive.mockResolvedValue(mockResult);

      // 执行测试
      await userController.toggleUserStatus(mockReq, mockRes, mockNext);

      // 验证结果
      expect(userService.setUserActive).toHaveBeenCalledWith(userId, false, 'admin');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '用户状态更新成功',
        data: mockResult.data,
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在isActive不是布尔值时返回400错误', async () => {
      // 准备测试数据 - isActive不是布尔值
      const userId = 'target-user-id';
      mockReq.params = { userId };
      mockReq.body = { isActive: 'not-boolean' };

      // 执行测试
      await userController.toggleUserStatus(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'isActive 必须是布尔值',
        code: 'INVALID_BOOLEAN',
        timestamp: expect.any(String)
      });
      expect(userService.setUserActive).not.toHaveBeenCalled();
    });

    it('应该在缺少必需参数时返回400错误', async () => {
      // 准备测试数据 - 缺少isActive
      const userId = 'target-user-id';
      mockReq.params = { userId };
      mockReq.body = {};

      // 执行测试
      await userController.toggleUserStatus(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('缺少必需参数'),
          statusCode: 400,
          code: 'MISSING_REQUIRED_PARAMS'
        })
      );
      expect(userService.setUserActive).not.toHaveBeenCalled();
    });
  });

  describe('exportUsers (管理员功能)', () => {
    beforeEach(() => {
      // 设置管理员用户
      mockReq.user.role = 'admin';
    });

    it('应该成功创建用户导出任务', async () => {
      // 准备测试数据
      mockReq.query = {
        role: 'user',
        isActive: 'true'
      };

      // 执行测试
      await userController.exportUsers(mockReq, mockRes, mockNext);

      // 验证结果
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '用户导出任务已创建',
        data: expect.objectContaining({
          downloadUrl: expect.stringMatching(/\/api\/downloads\/users_export_\d+\.csv/),
          expiresAt: expect.any(String)
        }),
        meta: expect.objectContaining({
          timestamp: expect.any(String)
        })
      });
    });

    it('应该在非管理员用户访问时返回403错误', async () => {
      // 准备测试数据 - 普通用户
      mockReq.user.role = 'user';

      // 执行测试
      await userController.exportUsers(mockReq, mockRes, mockNext);

      // 验证错误处理
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('权限不足'),
          statusCode: 403,
          code: 'INSUFFICIENT_PERMISSIONS'
        })
      );
    });
  });
});
