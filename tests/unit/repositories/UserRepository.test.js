/**
 * UserRepository单元测试
 * 测试用户数据访问层的所有功能
 */

const UserRepository = require('../../../src/repositories/UserRepository');

// 模拟bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true)
}));

// 模拟数据库连接
const mockDb = {
  raw: jest.fn(),
  transaction: jest.fn()
};

// 模拟查询构建器
const mockQuery = {
  where: jest.fn().mockReturnThis(),
  whereBetween: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
  first: jest.fn(),
  then: jest.fn(),
  catch: jest.fn()
};

// 模拟BaseRepository
jest.mock('../../../src/repositories/BaseRepository', () => {
  return class MockBaseRepository {
    constructor(tableName, primaryKey) {
      this.tableName = tableName;
      this.primaryKey = primaryKey;
      this.db = mockDb;
    }

    query(trx = null) {
      return mockQuery;
    }

    async findMany(conditions, options = {}, trx = null) {
      return [];
    }

    async findOne(conditions, trx = null) {
      return null;
    }

    async findById(id, trx = null) {
      return null;
    }

    async create(data, trx = null) {
      return { id: 'test-id', ...data };
    }

    async updateById(id, data, trx = null) {
      return { id, ...data };
    }

    async deleteById(id, trx = null) {
      return true;
    }

    async count(conditions = {}, trx = null) {
      return 0;
    }

    generateUserId() {
      return 'user-' + Date.now();
    }
  };
});

jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const bcrypt = require('bcryptjs');

describe('UserRepository', () => {
  let userRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository = new UserRepository();
    
    // 重置模拟查询构建器
    Object.keys(mockQuery).forEach(key => {
      if (typeof mockQuery[key] === 'function' && key !== 'first') {
        mockQuery[key].mockReturnThis();
      }
    });
  });

  describe('constructor', () => {
    it('应该正确初始化', () => {
      expect(userRepository.tableName).toBe('users');
      expect(userRepository.primaryKey).toBe('id');
    });
  });

  describe('findByEmail', () => {
    const email = 'test@example.com';

    it('应该成功根据邮箱查找用户', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test User' };
      userRepository.findOne = jest.fn().mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail(email);

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        null
      );
    });

    it('应该将邮箱转换为小写', async () => {
      userRepository.findOne = jest.fn().mockResolvedValue(null);

      await userRepository.findByEmail('TEST@EXAMPLE.COM');

      expect(userRepository.findOne).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        null
      );
    });

    it('应该在找不到用户时返回null', async () => {
      userRepository.findOne = jest.fn().mockResolvedValue(null);

      const result = await userRepository.findByEmail(email);

      expect(result).toBeNull();
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      userRepository.findOne = jest.fn().mockRejectedValue(error);

      await expect(
        userRepository.findByEmail(email)
      ).rejects.toThrow('Database error');
    });
  });

  describe('createUser', () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    };

    it('应该成功创建用户', async () => {
      const expectedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: 1
      };

      userRepository.findByEmail = jest.fn().mockResolvedValue(null);
      userRepository.create = jest.fn().mockResolvedValue(expectedUser);
      userRepository.generateUserId = jest.fn().mockReturnValue('user-123');

      const result = await userRepository.createUser(userData);

      expect(result).toEqual(expectedUser);
      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com', null);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          password: 'hashed-password',
          name: 'Test User',
          role: 'user',
          isActive: 1
        }),
        null
      );
    });

    it('应该检查邮箱是否已存在', async () => {
      const existingUser = { id: 'existing-user', email: 'test@example.com' };
      userRepository.findByEmail = jest.fn().mockResolvedValue(existingUser);

      await expect(
        userRepository.createUser(userData)
      ).rejects.toThrow('邮箱已被注册');
    });

    it('应该将邮箱转换为小写', async () => {
      const userDataWithUpperCase = {
        ...userData,
        email: 'TEST@EXAMPLE.COM'
      };

      userRepository.findByEmail = jest.fn().mockResolvedValue(null);
      userRepository.create = jest.fn().mockResolvedValue({});
      userRepository.generateUserId = jest.fn().mockReturnValue('user-123');

      await userRepository.createUser(userDataWithUpperCase);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com'
        }),
        null
      );
    });

    it('应该支持自定义角色', async () => {
      const adminUserData = { ...userData, role: 'admin' };

      userRepository.findByEmail = jest.fn().mockResolvedValue(null);
      userRepository.create = jest.fn().mockResolvedValue({});
      userRepository.generateUserId = jest.fn().mockReturnValue('user-123');

      await userRepository.createUser(adminUserData);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin'
        }),
        null
      );
    });

    it('应该支持事务', async () => {
      const mockTrx = {};
      userRepository.findByEmail = jest.fn().mockResolvedValue(null);
      userRepository.create = jest.fn().mockResolvedValue({});
      userRepository.generateUserId = jest.fn().mockReturnValue('user-123');

      await userRepository.createUser(userData, mockTrx);

      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com', mockTrx);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.any(Object),
        mockTrx
      );
    });

    it('应该处理密码加密错误', async () => {
      const error = new Error('Hashing error');
      userRepository.findByEmail = jest.fn().mockResolvedValue(null);
      bcrypt.hash.mockRejectedValue(error);

      await expect(
        userRepository.createUser(userData)
      ).rejects.toThrow('Hashing error');
    });
  });

  describe('validateUser', () => {
    const email = 'test@example.com';
    const password = 'password123';

    it('应该成功验证用户', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: 1
      };

      userRepository.findByEmail = jest.fn().mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const result = await userRepository.validateUser(email, password);

      expect(result).toEqual(mockUser);
      expect(userRepository.findByEmail).toHaveBeenCalledWith(email, null);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, 'hashed-password');
    });

    it('应该在用户不存在时返回null', async () => {
      userRepository.findByEmail = jest.fn().mockResolvedValue(null);

      const result = await userRepository.validateUser(email, password);

      expect(result).toBeNull();
    });

    it('应该在用户被禁用时返回null', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: 0
      };

      userRepository.findByEmail = jest.fn().mockResolvedValue(mockUser);

      const result = await userRepository.validateUser(email, password);

      expect(result).toBeNull();
    });

    it('应该在密码错误时返回null', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: 1
      };

      userRepository.findByEmail = jest.fn().mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const result = await userRepository.validateUser(email, password);

      expect(result).toBeNull();
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      userRepository.findByEmail = jest.fn().mockRejectedValue(error);

      await expect(
        userRepository.validateUser(email, password)
      ).rejects.toThrow('Database error');
    });
  });

  describe('updatePassword', () => {
    const userId = 'test-user-id';
    const newPassword = 'newPassword123';

    it('应该成功更新用户密码', async () => {
      const updatedUser = {
        id: userId,
        email: 'test@example.com',
        password: 'new-hashed-password'
      };

      userRepository.updateById = jest.fn().mockResolvedValue(updatedUser);

      const result = await userRepository.updatePassword(userId, newPassword);

      expect(result).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(userRepository.updateById).toHaveBeenCalledWith(
        userId,
        { password: 'hashed-password' },
        null
      );
    });

    it('应该支持事务', async () => {
      const mockTrx = {};
      userRepository.updateById = jest.fn().mockResolvedValue({});

      await userRepository.updatePassword(userId, newPassword, mockTrx);

      expect(userRepository.updateById).toHaveBeenCalledWith(
        userId,
        expect.any(Object),
        mockTrx
      );
    });

    it('应该处理密码加密错误', async () => {
      const error = new Error('Hashing error');
      bcrypt.hash.mockRejectedValue(error);

      await expect(
        userRepository.updatePassword(userId, newPassword)
      ).rejects.toThrow('Hashing error');
    });

    it('应该处理更新失败', async () => {
      userRepository.updateById = jest.fn().mockResolvedValue(null);

      const result = await userRepository.updatePassword(userId, newPassword);

      expect(result).toBe(false);
    });
  });

  describe('updateUser', () => {
    const userId = 'test-user-id';
    const updateData = {
      name: 'Updated Name',
      email: 'updated@example.com'
    };

    it('应该成功更新用户信息', async () => {
      const updatedUser = {
        id: userId,
        name: 'Updated Name',
        email: 'updated@example.com',
        password: 'hashed-password'
      };

      userRepository.findByEmail = jest.fn().mockResolvedValue(null);
      userRepository.updateById = jest.fn().mockResolvedValue(updatedUser);

      const result = await userRepository.updateUser(userId, updateData);

      expect(result).toEqual({
        id: userId,
        name: 'Updated Name',
        email: 'updated@example.com'
      });
      expect(userRepository.updateById).toHaveBeenCalledWith(
        userId,
        {
          name: 'Updated Name',
          email: 'updated@example.com'
        },
        null
      );
    });

    it('应该过滤不允许更新的字段', async () => {
      const invalidUpdateData = {
        name: 'Updated Name',
        password: 'should-be-filtered',
        id: 'should-be-filtered',
        created_at: 'should-be-filtered'
      };

      userRepository.findByEmail = jest.fn().mockResolvedValue(null);
      userRepository.updateById = jest.fn().mockResolvedValue({});

      await userRepository.updateUser(userId, invalidUpdateData);

      expect(userRepository.updateById).toHaveBeenCalledWith(
        userId,
        { name: 'Updated Name' },
        null
      );
    });

    it('应该检查邮箱重复', async () => {
      const existingUser = { id: 'other-user-id', email: 'updated@example.com' };
      userRepository.findByEmail = jest.fn().mockResolvedValue(existingUser);

      await expect(
        userRepository.updateUser(userId, updateData)
      ).rejects.toThrow('邮箱已被其他用户使用');
    });

    it('应该允许用户更新自己的邮箱', async () => {
      const existingUser = { id: userId, email: 'updated@example.com' };
      userRepository.findByEmail = jest.fn().mockResolvedValue(existingUser);
      userRepository.updateById = jest.fn().mockResolvedValue({});

      await userRepository.updateUser(userId, updateData);

      expect(userRepository.updateById).toHaveBeenCalled();
    });

    it('应该将邮箱转换为小写', async () => {
      const updateDataWithUpperCase = {
        email: 'UPDATED@EXAMPLE.COM'
      };

      userRepository.findByEmail = jest.fn().mockResolvedValue(null);
      userRepository.updateById = jest.fn().mockResolvedValue({});

      await userRepository.updateUser(userId, updateDataWithUpperCase);

      expect(userRepository.updateById).toHaveBeenCalledWith(
        userId,
        { email: 'updated@example.com' },
        null
      );
    });

    it('应该在更新失败时返回null', async () => {
      userRepository.findByEmail = jest.fn().mockResolvedValue(null);
      userRepository.updateById = jest.fn().mockResolvedValue(null);

      const result = await userRepository.updateUser(userId, updateData);

      expect(result).toBeNull();
    });
  });

  describe('getUserList', () => {
    it('应该成功获取用户列表', async () => {
      const mockUsers = [
        { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
        { id: 'user-2', email: 'user2@example.com', name: 'User 2' }
      ];

      userRepository.findMany = jest.fn().mockResolvedValue(mockUsers);

      const result = await userRepository.getUserList();

      expect(result).toEqual(mockUsers);
      expect(userRepository.findMany).toHaveBeenCalledWith(
        {},
        {
          select: ['id', 'email', 'name', 'role', 'isActive', 'created_at', 'updated_at'],
          orderBy: [{ column: 'created_at', direction: 'desc' }],
          limit: null,
          offset: null
        },
        null
      );
    });

    it('应该支持角色过滤', async () => {
      const options = { role: 'admin' };
      userRepository.findMany = jest.fn().mockResolvedValue([]);

      await userRepository.getUserList(options);

      expect(userRepository.findMany).toHaveBeenCalledWith(
        { role: 'admin' },
        expect.any(Object),
        null
      );
    });

    it('应该支持活跃状态过滤', async () => {
      const options = { isActive: true };
      userRepository.findMany = jest.fn().mockResolvedValue([]);

      await userRepository.getUserList(options);

      expect(userRepository.findMany).toHaveBeenCalledWith(
        { isActive: 1 },
        expect.any(Object),
        null
      );
    });

    it('应该支持分页参数', async () => {
      const options = { limit: 10, offset: 20 };
      userRepository.findMany = jest.fn().mockResolvedValue([]);

      await userRepository.getUserList(options);

      expect(userRepository.findMany).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          limit: 10,
          offset: 20
        }),
        null
      );
    });
  });

  describe('searchUsers', () => {
    const searchTerm = 'test';

    it('应该成功搜索用户', async () => {
      const mockUsers = [
        { id: 'user-1', email: 'test@example.com', name: 'Test User' }
      ];

      mockQuery.then.mockResolvedValue(mockUsers);

      const result = await userRepository.searchUsers(searchTerm);

      expect(result).toEqual(mockUsers);
      expect(mockQuery.select).toHaveBeenCalledWith(['id', 'email', 'name', 'role', 'isActive', 'created_at', 'updated_at']);
      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
      expect(mockQuery.offset).toHaveBeenCalledWith(0);
    });

    it('应该支持角色过滤', async () => {
      const options = { role: 'admin' };
      mockQuery.then.mockResolvedValue([]);

      await userRepository.searchUsers(searchTerm, options);

      expect(mockQuery.where).toHaveBeenCalledWith('role', 'admin');
    });

    it('应该支持活跃状态过滤', async () => {
      const options = { isActive: true };
      mockQuery.then.mockResolvedValue([]);

      await userRepository.searchUsers(searchTerm, options);

      expect(mockQuery.where).toHaveBeenCalledWith('isActive', 1);
    });

    it('应该支持分页参数', async () => {
      const options = { limit: 20, offset: 40 };
      mockQuery.then.mockResolvedValue([]);

      await userRepository.searchUsers(searchTerm, options);

      expect(mockQuery.limit).toHaveBeenCalledWith(20);
      expect(mockQuery.offset).toHaveBeenCalledWith(40);
    });
  });
});
