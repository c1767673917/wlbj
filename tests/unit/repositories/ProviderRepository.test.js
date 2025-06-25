/**
 * ProviderRepository单元测试
 * 测试供应商数据访问层的所有功能
 */

const ProviderRepository = require('../../../src/repositories/ProviderRepository');

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

describe('ProviderRepository', () => {
  let providerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    providerRepository = new ProviderRepository();
    
    // 重置模拟查询构建器
    Object.keys(mockQuery).forEach(key => {
      if (typeof mockQuery[key] === 'function' && key !== 'first') {
        mockQuery[key].mockReturnThis();
      }
    });
  });

  describe('constructor', () => {
    it('应该正确初始化', () => {
      expect(providerRepository.tableName).toBe('providers');
      expect(providerRepository.primaryKey).toBe('id');
    });
  });

  describe('findByName', () => {
    const providerName = 'Test Provider';

    it('应该成功根据名称查找供应商', async () => {
      const mockProvider = { id: 1, name: 'Test Provider', isActive: 1 };
      providerRepository.findOne = jest.fn().mockResolvedValue(mockProvider);

      const result = await providerRepository.findByName(providerName);

      expect(result).toEqual(mockProvider);
      expect(providerRepository.findOne).toHaveBeenCalledWith(
        { name: providerName },
        null
      );
    });

    it('应该在找不到供应商时返回null', async () => {
      providerRepository.findOne = jest.fn().mockResolvedValue(null);

      const result = await providerRepository.findByName(providerName);

      expect(result).toBeNull();
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      providerRepository.findOne = jest.fn().mockRejectedValue(error);

      await expect(
        providerRepository.findByName(providerName)
      ).rejects.toThrow('Database error');
    });
  });

  describe('findActiveProviders', () => {
    it('应该成功获取活跃供应商列表', async () => {
      const mockProviders = [
        { id: 1, name: 'Provider 1', isActive: 1 },
        { id: 2, name: 'Provider 2', isActive: 1 }
      ];

      providerRepository.findMany = jest.fn().mockResolvedValue(mockProviders);

      const result = await providerRepository.findActiveProviders();

      expect(result).toEqual(mockProviders);
      expect(providerRepository.findMany).toHaveBeenCalledWith(
        { isActive: 1 },
        {},
        null
      );
    });

    it('应该支持事务', async () => {
      const mockTrx = {};
      providerRepository.findMany = jest.fn().mockResolvedValue([]);

      await providerRepository.findActiveProviders(mockTrx);

      expect(providerRepository.findMany).toHaveBeenCalledWith(
        { isActive: 1 },
        expect.any(Object),
        mockTrx
      );
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      providerRepository.findMany = jest.fn().mockRejectedValue(error);

      await expect(
        providerRepository.findActiveProviders()
      ).rejects.toThrow('Database error');
    });
  });

  describe('validateAccess', () => {
    const accessKey = 'test-access-key';

    it('应该成功验证访问密钥', async () => {
      const mockProvider = {
        id: 1,
        name: 'Test Provider',
        accessKey: 'test-access-key',
        isActive: 1,
        contactInfo: '{}'
      };

      const expectedResult = {
        id: 1,
        name: 'Test Provider',
        accessKey: 'test-access-key',
        isActive: 1,
        contactInfo: {}
      };

      providerRepository.findByAccessKey = jest.fn().mockResolvedValue(mockProvider);

      const result = await providerRepository.validateAccess(accessKey);

      expect(result).toEqual(expectedResult);
      expect(providerRepository.findByAccessKey).toHaveBeenCalledWith(
        accessKey,
        null
      );
    });

    it('应该在访问密钥无效时返回null', async () => {
      providerRepository.findOne = jest.fn().mockResolvedValue(null);

      const result = await providerRepository.validateAccess(accessKey);

      expect(result).toBeNull();
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      providerRepository.findOne = jest.fn().mockRejectedValue(error);

      await expect(
        providerRepository.validateAccess(accessKey)
      ).rejects.toThrow('Database error');
    });
  });

  describe('createProvider', () => {
    const providerData = {
      name: 'New Provider',
      accessKey: 'generated-access-key',
      contactInfo: {
        email: 'contact@provider.com',
        phone: '123-456-7890',
        description: 'Test provider description'
      }
    };

    it('应该成功创建供应商', async () => {
      const expectedProvider = {
        id: 'provider_1750834379680_90uytg8v4',
        name: 'New Provider',
        accessKey: 'generated-access-key',
        contactInfo: '{"email":"contact@provider.com","phone":"123-456-7890","description":"Test provider description"}',
        isActive: 1
      };

      providerRepository.findByName = jest.fn().mockResolvedValue(null);
      providerRepository.findByAccessKey = jest.fn().mockResolvedValue(null);
      providerRepository.create = jest.fn().mockResolvedValue(expectedProvider);

      const result = await providerRepository.createProvider(providerData);

      expect(result).toEqual(expectedProvider);
      expect(providerRepository.findByName).toHaveBeenCalledWith('New Provider', null);
      expect(providerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Provider',
          accessKey: 'generated-access-key',
          contactInfo: '{"email":"contact@provider.com","phone":"123-456-7890","description":"Test provider description"}',
          isActive: 1
        }),
        null
      );
    });

    it('应该检查供应商名称是否已存在', async () => {
      const existingProvider = { id: 1, name: 'New Provider' };
      providerRepository.findByName = jest.fn().mockResolvedValue(existingProvider);

      await expect(
        providerRepository.createProvider(providerData)
      ).rejects.toThrow('供应商名称已存在');
    });

    it('应该支持事务', async () => {
      const mockTrx = {};
      providerRepository.findByName = jest.fn().mockResolvedValue(null);
      providerRepository.create = jest.fn().mockResolvedValue({});
      providerRepository.generateAccessKey = jest.fn().mockReturnValue('generated-access-key');

      await providerRepository.createProvider(providerData, mockTrx);

      expect(providerRepository.findByName).toHaveBeenCalledWith('New Provider', mockTrx);
      expect(providerRepository.create).toHaveBeenCalledWith(
        expect.any(Object),
        mockTrx
      );
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      providerRepository.findByName = jest.fn().mockRejectedValue(error);

      await expect(
        providerRepository.createProvider(providerData)
      ).rejects.toThrow('Database error');
    });
  });

  describe('updateProvider', () => {
    const providerId = 1;
    const updateData = {
      contactEmail: 'updated@provider.com',
      contactPhone: '987-654-3210',
      description: 'Updated description'
    };

    it('应该成功更新供应商信息', async () => {
      const updatedProvider = { id: providerId, ...updateData };
      providerRepository.updateById = jest.fn().mockResolvedValue(updatedProvider);

      const result = await providerRepository.updateProvider(providerId, updateData);

      expect(result).toEqual(updatedProvider);
      expect(providerRepository.updateById).toHaveBeenCalledWith(
        providerId,
        updateData,
        null
      );
    });

    it('应该过滤不允许更新的字段', async () => {
      const invalidUpdateData = {
        ...updateData,
        id: 999,
        accessKey: 'should-not-update',
        created_at: 'should-not-update'
      };

      providerRepository.findByAccessKey = jest.fn().mockResolvedValue(null);
      providerRepository.updateById = jest.fn().mockResolvedValue({});

      await providerRepository.updateProvider(providerId, invalidUpdateData);

      expect(providerRepository.updateById).toHaveBeenCalledWith(
        providerId,
        {
          contactEmail: 'updated@provider.com',
          contactPhone: '987-654-3210',
          description: 'Updated description',
          accessKey: 'should-not-update'
        },
        null
      );
    });

    it('应该支持事务', async () => {
      const mockTrx = {};
      providerRepository.updateById = jest.fn().mockResolvedValue({});

      await providerRepository.updateProvider(providerId, updateData, mockTrx);

      expect(providerRepository.updateById).toHaveBeenCalledWith(
        providerId,
        updateData,
        mockTrx
      );
    });

    it('应该处理数据库错误', async () => {
      const error = new Error('Database error');
      providerRepository.updateById = jest.fn().mockRejectedValue(error);

      await expect(
        providerRepository.updateProvider(providerId, updateData)
      ).rejects.toThrow('Database error');
    });
  });
});
