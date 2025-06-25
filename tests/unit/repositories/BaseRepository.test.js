/**
 * BaseRepository单元测试
 */

const BaseRepository = require('../../../src/repositories/BaseRepository');
const { db, transactionManager } = require('../../../src/config/database');

// Mock数据库和事务管理器
jest.mock('../../../src/config/database', () => ({
  db: jest.fn(),
  transactionManager: {
    executeTransaction: jest.fn(),
    executeWithRetry: jest.fn()
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

describe('BaseRepository', () => {
  let repository;
  let mockQuery;

  beforeEach(() => {
    repository = new BaseRepository('test_table', 'id');

    // 创建mock查询构建器
    mockQuery = {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
      count: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([1]),
      groupBy: jest.fn().mockReturnThis(),
      // 添加链式调用支持
      mockResolvedValue: jest.fn().mockReturnThis(),
      then: jest.fn().mockReturnThis(),
      catch: jest.fn().mockReturnThis()
    };

    // Mock db函数返回查询构建器
    db.mockReturnValue(mockQuery);

    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('应该正确初始化Repository', () => {
      expect(repository.tableName).toBe('test_table');
      expect(repository.primaryKey).toBe('id');
      expect(repository.db).toBe(db);
    });

    it('应该使用默认主键', () => {
      const repo = new BaseRepository('users');
      expect(repo.primaryKey).toBe('id');
    });
  });

  describe('query', () => {
    it('应该返回数据库查询构建器', () => {
      const result = repository.query();
      expect(db).toHaveBeenCalledWith('test_table');
      expect(result).toBe(mockQuery);
    });

    it('应该使用事务对象', () => {
      const mockTrx = jest.fn().mockReturnValue(mockQuery);
      const result = repository.query(mockTrx);
      expect(mockTrx).toHaveBeenCalledWith('test_table');
      expect(result).toBe(mockQuery);
    });
  });

  describe('findById', () => {
    it('应该根据ID查找记录', async () => {
      const mockRecord = { id: 1, name: 'test' };
      mockQuery.first.mockResolvedValue(mockRecord);

      const result = await repository.findById(1);

      expect(mockQuery.where).toHaveBeenCalledWith('id', 1);
      expect(mockQuery.first).toHaveBeenCalled();
      expect(result).toBe(mockRecord);
    });

    it('应该在记录不存在时返回null', async () => {
      mockQuery.first.mockResolvedValue(undefined);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });

    it('应该在查询失败时抛出错误', async () => {
      const error = new Error('Database error');
      mockQuery.first.mockRejectedValue(error);

      await expect(repository.findById(1)).rejects.toThrow('Database error');
    });
  });

  describe('findOne', () => {
    it('应该根据条件查找单条记录', async () => {
      const mockRecord = { id: 1, email: 'test@example.com' };
      const conditions = { email: 'test@example.com' };
      mockQuery.first.mockResolvedValue(mockRecord);

      const result = await repository.findOne(conditions);

      expect(mockQuery.where).toHaveBeenCalledWith(conditions);
      expect(mockQuery.first).toHaveBeenCalled();
      expect(result).toBe(mockRecord);
    });
  });

  describe('findMany', () => {
    it('应该根据条件查找多条记录', async () => {
      const mockRecords = [
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' }
      ];
      const conditions = { status: 'active' };

      // 模拟查询构建器的链式调用
      mockQuery.then = jest.fn().mockResolvedValue(mockRecords);

      const result = await repository.findMany(conditions);

      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.where).toHaveBeenCalledWith(conditions);
      expect(result).toBe(mockRecords);
    });

    it('应该支持排序选项', async () => {
      const mockRecords = [];
      const conditions = {};
      const options = {
        orderBy: [{ column: 'created_at', direction: 'desc' }]
      };

      mockQuery.then = jest.fn().mockResolvedValue(mockRecords);

      await repository.findMany(conditions, options);

      expect(mockQuery.orderBy).toHaveBeenCalledWith('created_at', 'desc');
    });

    it('应该支持分页选项', async () => {
      const mockRecords = [];
      const conditions = {};
      const options = { limit: 10, offset: 20 };

      mockQuery.then = jest.fn().mockResolvedValue(mockRecords);

      await repository.findMany(conditions, options);

      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.offset).toHaveBeenCalledWith(20);
    });
  });

  describe('create', () => {
    it('应该创建新记录', async () => {
      const data = { name: 'test', email: 'test@example.com' };
      const createdRecord = { id: 1, ...data, created_at: expect.any(String), updated_at: expect.any(String) };

      // 模拟insert().returning()的链式调用
      const mockInsertQuery = {
        returning: jest.fn().mockResolvedValue([1])
      };
      mockQuery.insert.mockReturnValue(mockInsertQuery);
      mockQuery.first.mockResolvedValue(createdRecord);

      const result = await repository.create(data);

      expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        ...data,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      }));
      expect(mockInsertQuery.returning).toHaveBeenCalledWith('id');
      expect(result).toBe(createdRecord);
    });
  });

  describe('updateById', () => {
    it('应该根据ID更新记录', async () => {
      const updateData = { name: 'updated' };
      const updatedRecord = { id: 1, name: 'updated', updated_at: expect.any(String) };
      
      mockQuery.update.mockResolvedValue(1); // 1 row affected
      mockQuery.first.mockResolvedValue(updatedRecord);

      const result = await repository.updateById(1, updateData);

      expect(mockQuery.where).toHaveBeenCalledWith('id', 1);
      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
        ...updateData,
        updated_at: expect.any(String)
      }));
      expect(result).toBe(updatedRecord);
    });

    it('应该在记录不存在时返回null', async () => {
      mockQuery.update.mockResolvedValue(0); // 0 rows affected

      const result = await repository.updateById(999, { name: 'test' });

      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('应该根据ID删除记录', async () => {
      mockQuery.del.mockResolvedValue(1); // 1 row deleted

      const result = await repository.deleteById(1);

      expect(mockQuery.where).toHaveBeenCalledWith('id', 1);
      expect(mockQuery.del).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('应该在记录不存在时返回false', async () => {
      mockQuery.del.mockResolvedValue(0); // 0 rows deleted

      const result = await repository.deleteById(999);

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('应该统计记录数', async () => {
      const conditions = { status: 'active' };

      // 模拟count().first()的链式调用
      const mockCountQuery = {
        first: jest.fn().mockResolvedValue({ count: '5' })
      };
      mockQuery.count.mockReturnValue(mockCountQuery);

      const result = await repository.count(conditions);

      expect(mockQuery.where).toHaveBeenCalledWith(conditions);
      expect(mockQuery.count).toHaveBeenCalledWith('id as count');
      expect(mockCountQuery.first).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });

  describe('exists', () => {
    it('应该检查记录是否存在', async () => {
      const conditions = { email: 'test@example.com' };

      // 模拟count().first()的链式调用
      const mockCountQuery = {
        first: jest.fn().mockResolvedValue({ count: '1' })
      };
      mockQuery.count.mockReturnValue(mockCountQuery);

      const result = await repository.exists(conditions);

      expect(result).toBe(true);
    });

    it('应该在记录不存在时返回false', async () => {
      const conditions = { email: 'nonexistent@example.com' };

      // 模拟count().first()的链式调用
      const mockCountQuery = {
        first: jest.fn().mockResolvedValue({ count: '0' })
      };
      mockQuery.count.mockReturnValue(mockCountQuery);

      const result = await repository.exists(conditions);

      expect(result).toBe(false);
    });
  });

  describe('transaction', () => {
    it('应该执行事务', async () => {
      const callback = jest.fn().mockResolvedValue('result');
      transactionManager.executeTransaction.mockResolvedValue('result');

      const result = await repository.transaction(callback);

      expect(transactionManager.executeTransaction).toHaveBeenCalledWith(callback);
      expect(result).toBe('result');
    });
  });

  describe('transactionWithRetry', () => {
    it('应该执行带重试的事务', async () => {
      const callback = jest.fn().mockResolvedValue('result');
      transactionManager.executeWithRetry.mockResolvedValue('result');

      const result = await repository.transactionWithRetry(callback, 5);

      expect(transactionManager.executeWithRetry).toHaveBeenCalledWith(callback, 5);
      expect(result).toBe('result');
    });

    it('应该使用默认重试次数', async () => {
      const callback = jest.fn().mockResolvedValue('result');
      transactionManager.executeWithRetry.mockResolvedValue('result');

      await repository.transactionWithRetry(callback);

      expect(transactionManager.executeWithRetry).toHaveBeenCalledWith(callback, 3);
    });
  });
});
