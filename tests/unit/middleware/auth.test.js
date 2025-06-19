/**
 * 认证中间件测试
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

// Mock依赖
jest.mock('../../../utils/auth');

describe('Auth Middleware', () => {
  let authMiddleware;
  let mockAuthUtils;
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    // 重新加载模块
    delete require.cache[require.resolve('../../../middleware/auth')];
    delete require.cache[require.resolve('../../../utils/auth')];

    mockAuthUtils = require('../../../utils/auth');
    authMiddleware = require('../../../middleware/auth');

    // 创建mock对象
    req = {
      headers: {},
      user: null,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('authenticateToken', () => {
    test('应该验证有效的JWT令牌', () => {
      const mockUser = { id: 1, username: 'testuser', role: 'user' };
      const mockToken = 'valid.jwt.token';

      req.headers.authorization = `Bearer ${mockToken}`;
      mockAuthUtils.verifyToken.mockReturnValue(mockUser);

      authMiddleware.authenticateToken(req, res, next);

      expect(mockAuthUtils.verifyToken).toHaveBeenCalledWith(mockToken);
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('应该拒绝缺少Authorization头的请求', () => {
      authMiddleware.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: '未提供访问令牌',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('应该拒绝无效格式的Authorization头', () => {
      req.headers.authorization = 'InvalidFormat';

      authMiddleware.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: '未提供访问令牌',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('应该拒绝无效的JWT令牌', () => {
      const mockToken = 'invalid.jwt.token';

      req.headers.authorization = `Bearer ${mockToken}`;
      mockAuthUtils.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authMiddleware.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: '无效的访问令牌',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('应该处理过期的JWT令牌', () => {
      const mockToken = 'expired.jwt.token';

      req.headers.authorization = `Bearer ${mockToken}`;

      const expiredError = new Error('Token已过期');
      mockAuthUtils.verifyToken.mockImplementation(() => {
        throw expiredError;
      });

      authMiddleware.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: '访问令牌已过期',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    test('应该允许具有正确角色的用户访问', () => {
      req.user = { id: 1, username: 'admin', role: 'admin' };

      const middleware = authMiddleware.requireRole('admin');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('应该拒绝没有用户信息的请求', () => {
      req.user = null;

      const middleware = authMiddleware.requireRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: '需要身份验证',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('应该拒绝角色不匹配的用户', () => {
      req.user = { id: 1, username: 'user', role: 'user' };

      const middleware = authMiddleware.requireRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: '权限不足',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('应该支持多个角色验证', () => {
      req.user = { id: 1, username: 'user', role: 'user' };

      const middleware = authMiddleware.requireRole(['admin', 'user']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('应该拒绝不在允许角色列表中的用户', () => {
      req.user = { id: 1, username: 'guest', role: 'guest' };

      const middleware = authMiddleware.requireRole(['admin', 'user']);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: '权限不足',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    test('应该在有效令牌时设置用户信息', () => {
      const mockUser = { id: 1, username: 'testuser', role: 'user' };
      const mockToken = 'valid.jwt.token';

      req.headers.authorization = `Bearer ${mockToken}`;
      mockAuthUtils.verifyToken.mockReturnValue(mockUser);

      authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('应该在没有令牌时继续处理', () => {
      authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('应该在无效令牌时继续处理', () => {
      const mockToken = 'invalid.jwt.token';

      req.headers.authorization = `Bearer ${mockToken}`;
      mockAuthUtils.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requireOwnership', () => {
    test('应该允许资源所有者访问', () => {
      req.user = { id: 1, username: 'testuser', role: 'user' };
      req.params = { userId: '1' };

      authMiddleware.requireOwnership(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('应该允许管理员访问任何资源', () => {
      req.user = { id: 2, username: 'admin', role: 'admin' };
      req.params = { userId: '1' };

      authMiddleware.requireOwnership(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('应该拒绝非所有者访问', () => {
      req.user = { id: 2, username: 'otheruser', role: 'user' };
      req.params = { userId: '1' };

      authMiddleware.requireOwnership(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: '只能访问自己的资源',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('应该处理缺少用户信息的情况', () => {
      req.user = null;
      req.params = { userId: '1' };

      authMiddleware.requireOwnership(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: '需要身份验证',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
