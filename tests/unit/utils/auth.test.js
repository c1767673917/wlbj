/**
 * 认证工具测试
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');
const jwt = require('jsonwebtoken');

// Mock JWT模块
jest.mock('jsonwebtoken');

describe('Auth Utils', () => {
  let authUtils;

  beforeEach(() => {
    jest.clearAllMocks();
    // 重新加载模块以确保清洁状态
    delete require.cache[require.resolve('../../../utils/auth')];
    authUtils = require('../../../utils/auth');
  });

  describe('generateAccessToken', () => {
    test('应该生成有效的访问令牌', () => {
      const mockToken = 'mock.jwt.token';
      jwt.sign.mockReturnValue(mockToken);

      const user = { id: 1, username: 'testuser', role: 'user' };
      const token = authUtils.generateAccessToken(user);

      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 1, username: 'testuser', role: 'user' },
        expect.any(String),
        { expiresIn: '15m' }
      );
      expect(token).toBe(mockToken);
    });

    test('应该处理空用户对象', () => {
      const mockToken = 'mock.jwt.token';
      jwt.sign.mockReturnValue(mockToken);

      const token = authUtils.generateAccessToken({});

      expect(jwt.sign).toHaveBeenCalled();
      expect(token).toBe(mockToken);
    });
  });

  describe('generateRefreshToken', () => {
    test('应该生成有效的刷新令牌', () => {
      const mockToken = 'mock.refresh.token';
      jwt.sign.mockReturnValue(mockToken);

      const user = { id: 1, username: 'testuser', role: 'user' };
      const token = authUtils.generateRefreshToken(user);

      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 1, username: 'testuser', role: 'user' },
        expect.any(String),
        { expiresIn: '7d' }
      );
      expect(token).toBe(mockToken);
    });
  });

  describe('verifyToken', () => {
    test('应该验证有效的JWT令牌', () => {
      const mockDecoded = { id: 1, username: 'testuser', role: 'user' };
      jwt.verify.mockReturnValue(mockDecoded);

      const token = 'valid.jwt.token';
      const decoded = authUtils.verifyToken(token);

      expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(decoded).toEqual(mockDecoded);
    });

    test('应该处理无效的JWT令牌', () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const token = 'invalid.jwt.token';

      expect(() => {
        authUtils.verifyToken(token);
      }).toThrow('Invalid token');
    });

    test('应该处理过期的JWT令牌', () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      const token = 'expired.jwt.token';

      expect(() => {
        authUtils.verifyToken(token);
      }).toThrow('Token已过期');
    });
  });

  describe('hashPassword', () => {
    test('应该对密码进行哈希处理', async () => {
      const password = 'testpassword123';
      const hashedPassword = await authUtils.hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword.length).toBeGreaterThan(0);
    });

    test('应该为相同密码生成不同的哈希值', async () => {
      const password = 'testpassword123';
      const hash1 = await authUtils.hashPassword(password);
      const hash2 = await authUtils.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    test('应该处理空密码', async () => {
      const password = '';
      const hashedPassword = await authUtils.hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(typeof hashedPassword).toBe('string');
    });
  });

  describe('verifyPassword', () => {
    test('应该验证正确的密码', async () => {
      const password = 'testpassword123';
      const hashedPassword = await authUtils.hashPassword(password);

      const isValid = await authUtils.verifyPassword(password, hashedPassword);

      expect(isValid).toBe(true);
    });

    test('应该拒绝错误的密码', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hashedPassword = await authUtils.hashPassword(password);

      const isValid = await authUtils.verifyPassword(wrongPassword, hashedPassword);

      expect(isValid).toBe(false);
    });

    test('应该处理空密码验证', async () => {
      const hashedPassword = await authUtils.hashPassword('somepassword');

      const isValid = await authUtils.verifyPassword('', hashedPassword);

      expect(isValid).toBe(false);
    });
  });

  describe('hasPermission', () => {
    test('应该检查用户是否有特定权限', () => {
      const hasCreateOrder = authUtils.hasPermission('user', 'create_order');
      const hasManageProviders = authUtils.hasPermission('user', 'manage_providers');
      const hasAdminPermission = authUtils.hasPermission('admin', 'view_all_data');

      expect(hasCreateOrder).toBe(true);
      expect(hasManageProviders).toBe(true);
      expect(hasAdminPermission).toBe(true);
    });

    test('应该拒绝用户没有的权限', () => {
      const hasProviderPermission = authUtils.hasPermission('user', 'view_available_orders');

      expect(hasProviderPermission).toBe(false);
    });

    test('应该处理无效角色', () => {
      const hasPermission = authUtils.hasPermission('invalid_role', 'create_order');

      expect(hasPermission).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    test('应该检查用户是否有任意一个权限', () => {
      const permissions = ['create_order', 'view_available_orders'];
      const hasAny = authUtils.hasAnyPermission('user', permissions);

      expect(hasAny).toBe(true);
    });

    test('应该在用户没有任何权限时返回false', () => {
      const permissions = ['view_available_orders', 'create_quote'];
      const hasAny = authUtils.hasAnyPermission('user', permissions);

      expect(hasAny).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    test('应该检查用户是否有所有权限', () => {
      const permissions = ['create_order', 'view_order'];
      const hasAll = authUtils.hasAllPermissions('user', permissions);

      expect(hasAll).toBe(true);
    });

    test('应该在用户缺少任何权限时返回false', () => {
      const permissions = ['create_order', 'view_available_orders'];
      const hasAll = authUtils.hasAllPermissions('user', permissions);

      expect(hasAll).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    test('应该刷新访问令牌', () => {
      const mockDecoded = { id: 1, role: 'user', email: 'test@example.com' };
      const mockNewToken = 'new.access.token';

      jwt.verify.mockReturnValue(mockDecoded);
      jwt.sign.mockReturnValue(mockNewToken);

      const refreshToken = 'valid.refresh.token';
      const newAccessToken = authUtils.refreshAccessToken(refreshToken);

      expect(jwt.verify).toHaveBeenCalledWith(refreshToken, expect.any(String));
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 1, role: 'user', email: 'test@example.com' },
        expect.any(String),
        { expiresIn: '15m' }
      );
      expect(newAccessToken).toBe(mockNewToken);
    });

    test('应该处理无效的刷新令牌', () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const refreshToken = 'invalid.refresh.token';

      expect(() => {
        authUtils.refreshAccessToken(refreshToken);
      }).toThrow('Invalid token');
    });
  });
});
