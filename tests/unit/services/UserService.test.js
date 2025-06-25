/**
 * UserService单元测试
 * 测试用户业务逻辑服务的所有功能
 */

const UserService = require('../../../src/services/UserService');

// 模拟依赖
jest.mock('../../../src/repositories', () => ({
  userRepo: global.testUtils.createMockRepository()
}));

jest.mock('../../../src/repositories/PasswordHistoryRepository');
jest.mock('../../../src/utils/PasswordPolicy');
jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true)
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ id: 'test-user-id', email: 'test@example.com' })
}));

const { userRepo } = require('../../../src/repositories');
const PasswordHistoryRepository = require('../../../src/repositories/PasswordHistoryRepository');
const passwordPolicy = require('../../../src/utils/PasswordPolicy');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('UserService', () => {
  let userService;
  let mockPasswordHistoryRepo;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建模拟的PasswordHistoryRepository实例
    mockPasswordHistoryRepo = {
      addPasswordHistory: jest.fn(),
      checkPasswordHistory: jest.fn().mockResolvedValue(false),
      cleanupOldPasswords: jest.fn(),
      getRecentPasswordHashes: jest.fn().mockResolvedValue([])
    };
    PasswordHistoryRepository.mockImplementation(() => mockPasswordHistoryRepo);
    
    // 模拟密码策略
    passwordPolicy.validatePassword = jest.fn().mockReturnValue({
      isValid: true,
      score: 85,
      strength: 'STRONG',
      feedback: []
    });
    passwordPolicy.checkPasswordHistory = jest.fn().mockResolvedValue(false);
    
    userService = new UserService();

    // 模拟executeInTransaction方法
    userService.executeInTransaction = jest.fn().mockImplementation(async (callback) => {
      return await callback();
    });
  });

  describe('registerUser', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'StrongPassword123!',
      name: 'Test User'
    };

    it('应该成功注册用户', async () => {
      const expectedUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: true,
        created_at: expect.any(String)
      };

      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.createUser.mockResolvedValue(expectedUser);

      const result = await userService.registerUser(validUserData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('用户注册成功');
      expect(result.data.user).toEqual(expectedUser);
      expect(result.data.token).toBe('mock-jwt-token');
      
      expect(passwordPolicy.validatePassword).toHaveBeenCalledWith(
        validUserData.password,
        expect.objectContaining({
          name: 'Test User',
          email: 'test@example.com'
        })
      );
      // bcrypt.hash在createUser方法内部调用，不需要在这里验证
      expect(userRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          password: 'StrongPassword123!'
        })
      );
      // 注册时不记录密码历史，只在密码更改时记录
    });

    it('应该验证必需参数', async () => {
      // 测试缺少email
      await expect(
        userService.registerUser({ password: 'test', name: 'test' })
      ).rejects.toThrow('缺少必需参数: email');

      // 测试缺少password
      await expect(
        userService.registerUser({ email: 'test@example.com', name: 'test' })
      ).rejects.toThrow('缺少必需参数: password');

      // 测试缺少name
      await expect(
        userService.registerUser({ email: 'test@example.com', password: 'test' })
      ).rejects.toThrow('缺少必需参数: name');
    });

    it('应该验证参数类型', async () => {
      await expect(
        userService.registerUser({ 
          email: 123, 
          password: 'test', 
          name: 'test' 
        })
      ).rejects.toThrow('参数类型错误');
    });

    it('应该验证邮箱格式', async () => {
      await expect(
        userService.registerUser({ 
          email: 'invalid-email', 
          password: 'StrongPassword123!', 
          name: 'Test User' 
        })
      ).rejects.toThrow('邮箱格式无效');
    });

    it('应该验证密码强度', async () => {
      passwordPolicy.validatePassword.mockReturnValue({
        isValid: false,
        score: 30,
        strength: 'WEAK',
        errors: ['密码太短', '缺少特殊字符']
      });

      await expect(
        userService.registerUser(validUserData)
      ).rejects.toThrow('密码不符合安全要求');
    });

    it('应该检查邮箱是否已存在', async () => {
      userRepo.createUser.mockRejectedValue(new Error('邮箱已被注册'));

      await expect(
        userService.registerUser(validUserData)
      ).rejects.toThrow('邮箱已被注册');
    });

    it('应该清理和标准化输入数据', async () => {
      const userDataWithSpaces = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'StrongPassword123!',
        name: '  Test User  '
      };

      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.createUser.mockResolvedValue({});

      await userService.registerUser(userDataWithSpaces);

      expect(userRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com', // 转换为小写并去除空格
          name: 'Test User' // 去除前后空格
        })
      );
    });
  });

  describe('loginUser', () => {
    const email = 'test@example.com';
    const password = 'StrongPassword123!';

    it('应该成功登录用户', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: true
      };

      userRepo.validateUser.mockResolvedValue(mockUser);

      const result = await userService.loginUser(email, password);

      expect(result.success).toBe(true);
      expect(result.message).toBe('登录成功');
      expect(result.data.token).toBe('mock-jwt-token');
      expect(result.data.user).toEqual(expect.objectContaining({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role
      }));

      expect(userRepo.validateUser).toHaveBeenCalledWith('test@example.com', 'StrongPassword123!');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role
        }),
        expect.any(String),
        expect.objectContaining({ expiresIn: '15m' })
      );
    });

    it('应该验证必需参数', async () => {
      await expect(
        userService.loginUser(null, 'test')
      ).rejects.toThrow('缺少必需参数: email');

      await expect(
        userService.loginUser('test@example.com', null)
      ).rejects.toThrow('缺少必需参数: password');
    });

    it('应该验证用户存在性', async () => {
      userRepo.validateUser.mockResolvedValue(null);

      await expect(
        userService.loginUser(email, password)
      ).rejects.toThrow('邮箱或密码错误');
    });

    it('应该处理用户验证失败（包括密码错误和账户禁用）', async () => {
      // validateUser方法会处理所有验证逻辑，包括密码验证和账户状态检查
      userRepo.validateUser.mockResolvedValue(null);

      await expect(
        userService.loginUser(email, password)
      ).rejects.toThrow('邮箱或密码错误');
    });
  });

  describe('changePassword', () => {
    const userId = 'test-user-id';
    const currentPassword = 'OldPassword123!';
    const newPassword = 'NewPassword123!';

    it('应该成功更改密码', async () => {
      const mockUser = {
        id: userId,
        email: 'test@example.com'
      };

      userRepo.findById.mockResolvedValue(mockUser);
      userRepo.validateUser.mockResolvedValue(mockUser);
      mockPasswordHistoryRepo.getRecentPasswordHashes.mockResolvedValue([]);
      passwordPolicy.checkPasswordHistory.mockResolvedValue(false);
      userRepo.updatePassword.mockResolvedValue(true);
      userRepo.updateById.mockResolvedValue({});

      const result = await userService.changePassword(userId, currentPassword, newPassword);

      expect(result.success).toBe(true);
      expect(result.message).toBe('密码更改成功');

      expect(userRepo.validateUser).toHaveBeenCalledWith('test@example.com', 'OldPassword123!');
      expect(passwordPolicy.validatePassword).toHaveBeenCalledWith('NewPassword123!', expect.any(Object));
      expect(mockPasswordHistoryRepo.getRecentPasswordHashes).toHaveBeenCalledWith(userId, 5);
      expect(passwordPolicy.checkPasswordHistory).toHaveBeenCalledWith('NewPassword123!', []);
      expect(userRepo.updatePassword).toHaveBeenCalledWith(userId, 'NewPassword123!', undefined);
      expect(mockPasswordHistoryRepo.addPasswordHistory).toHaveBeenCalled();
    });

    it('应该验证当前密码', async () => {
      const mockUser = {
        id: userId,
        email: 'test@example.com'
      };

      userRepo.findById.mockResolvedValue(mockUser);
      userRepo.validateUser.mockResolvedValue(null); // 密码验证失败

      await expect(
        userService.changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('当前密码错误');
    });

    it('应该检查密码历史', async () => {
      const mockUser = {
        id: userId,
        email: 'test@example.com'
      };

      userRepo.findById.mockResolvedValue(mockUser);
      userRepo.validateUser.mockResolvedValue(mockUser);
      mockPasswordHistoryRepo.getRecentPasswordHashes.mockResolvedValue(['old-hash']);
      passwordPolicy.checkPasswordHistory.mockResolvedValue(true);

      await expect(
        userService.changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('新密码不能与最近使用过的密码相同');
    });
  });
});
