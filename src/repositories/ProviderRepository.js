/**
 * 物流供应商数据访问层
 * 处理物流供应商相关的数据库操作
 */

const BaseRepository = require('./BaseRepository');
const { logger } = require('../config/logger');

class ProviderRepository extends BaseRepository {
  constructor() {
    super('providers', 'id');
  }

  /**
   * 根据访问密钥查找供应商
   * @param {string} accessKey - 访问密钥
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 供应商对象或null
   */
  async findByAccessKey(accessKey, trx = null) {
    try {
      return await this.findOne({ accessKey }, trx);
    } catch (error) {
      logger.error('根据访问密钥查找供应商失败', {
        accessKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 根据供应商名称查找
   * @param {string} name - 供应商名称
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 供应商对象或null
   */
  async findByName(name, trx = null) {
    try {
      return await this.findOne({ name }, trx);
    } catch (error) {
      logger.error('根据名称查找供应商失败', {
        name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 创建供应商
   * @param {Object} providerData - 供应商数据
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 创建的供应商对象
   */
  async createProvider(providerData, trx = null) {
    try {
      const { name, accessKey, contactInfo, isActive = true } = providerData;

      // 检查名称是否已存在
      const existingByName = await this.findByName(name, trx);
      if (existingByName) {
        throw new Error('供应商名称已存在');
      }

      // 检查访问密钥是否已存在
      const existingByKey = await this.findByAccessKey(accessKey, trx);
      if (existingByKey) {
        throw new Error('访问密钥已存在');
      }

      const newProvider = {
        id: this.generateProviderId(),
        name,
        accessKey,
        contactInfo: JSON.stringify(contactInfo || {}),
        isActive: isActive ? 1 : 0
      };

      return await this.create(newProvider, trx);
    } catch (error) {
      logger.error('创建供应商失败', {
        providerData,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 更新供应商信息
   * @param {string} providerId - 供应商ID
   * @param {Object} updateData - 更新数据
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 更新后的供应商对象
   */
  async updateProvider(providerId, updateData, trx = null) {
    try {
      // 过滤掉不允许直接更新的字段
      const { id, created_at, ...allowedData } = updateData;

      // 如果更新名称，需要检查是否重复
      if (allowedData.name) {
        const existingProvider = await this.findByName(allowedData.name, trx);
        if (existingProvider && existingProvider.id !== providerId) {
          throw new Error('供应商名称已被其他供应商使用');
        }
      }

      // 如果更新访问密钥，需要检查是否重复
      if (allowedData.accessKey) {
        const existingProvider = await this.findByAccessKey(allowedData.accessKey, trx);
        if (existingProvider && existingProvider.id !== providerId) {
          throw new Error('访问密钥已被其他供应商使用');
        }
      }

      // 如果更新联系信息，需要序列化
      if (allowedData.contactInfo && typeof allowedData.contactInfo === 'object') {
        allowedData.contactInfo = JSON.stringify(allowedData.contactInfo);
      }

      return await this.updateById(providerId, allowedData, trx);
    } catch (error) {
      logger.error('更新供应商信息失败', {
        providerId,
        updateData,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 激活/禁用供应商
   * @param {string} providerId - 供应商ID
   * @param {boolean} isActive - 是否激活
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 更新后的供应商对象
   */
  async setProviderActive(providerId, isActive, trx = null) {
    try {
      return await this.updateById(providerId, {
        isActive: isActive ? 1 : 0
      }, trx);
    } catch (error) {
      logger.error('设置供应商状态失败', {
        providerId,
        isActive,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取活跃供应商列表
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 活跃供应商数组
   */
  async getActiveProviders(options = {}, trx = null) {
    try {
      const {
        limit = null,
        offset = null,
        orderBy = [{ column: 'name', direction: 'asc' }]
      } = options;

      const providers = await this.findMany({ isActive: 1 }, {
        orderBy,
        limit,
        offset
      }, trx);

      // 解析联系信息
      return providers.map(provider => ({
        ...provider,
        contactInfo: this.parseContactInfo(provider.contactInfo)
      }));
    } catch (error) {
      logger.error('获取活跃供应商列表失败', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 验证供应商访问权限
   * @param {string} accessKey - 访问密钥
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 验证成功返回供应商对象，失败返回null
   */
  async validateAccess(accessKey, trx = null) {
    try {
      const provider = await this.findByAccessKey(accessKey, trx);
      
      if (!provider) {
        return null;
      }

      // 检查供应商是否激活
      if (!provider.isActive) {
        throw new Error('供应商账户已被禁用');
      }

      return {
        ...provider,
        contactInfo: this.parseContactInfo(provider.contactInfo)
      };
    } catch (error) {
      logger.error('验证供应商访问权限失败', {
        accessKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 生成供应商ID
   * @returns {string} 供应商ID
   */
  generateProviderId() {
    return `provider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 解析联系信息JSON
   * @param {string} contactInfoStr - 联系信息JSON字符串
   * @returns {Object} 解析后的联系信息对象
   */
  parseContactInfo(contactInfoStr) {
    try {
      return contactInfoStr ? JSON.parse(contactInfoStr) : {};
    } catch (error) {
      logger.warn('解析供应商联系信息失败', {
        contactInfoStr,
        error: error.message
      });
      return {};
    }
  }

  /**
   * 检查供应商名称是否可用
   * @param {string} name - 供应商名称
   * @param {string} excludeProviderId - 排除的供应商ID（用于更新时检查）
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<boolean>} 是否可用
   */
  async isNameAvailable(name, excludeProviderId = null, trx = null) {
    try {
      const existingProvider = await this.findByName(name, trx);
      
      if (!existingProvider) {
        return true;
      }

      // 如果是更新操作，排除当前供应商
      if (excludeProviderId && existingProvider.id === excludeProviderId) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('检查供应商名称可用性失败', {
        name,
        excludeProviderId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取活跃供应商列表
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 活跃供应商列表
   */
  async findActiveProviders(trx = null) {
    try {
      return await this.findMany({ isActive: 1 }, {}, trx);
    } catch (error) {
      logger.error('获取活跃供应商列表失败', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 检查访问密钥是否可用
   * @param {string} accessKey - 访问密钥
   * @param {string} excludeProviderId - 排除的供应商ID（用于更新时检查）
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<boolean>} 是否可用
   */
  async isAccessKeyAvailable(accessKey, excludeProviderId = null, trx = null) {
    try {
      const existingProvider = await this.findByAccessKey(accessKey, trx);

      if (!existingProvider) {
        return true;
      }

      // 如果是更新操作，排除当前供应商
      if (excludeProviderId && existingProvider.id === excludeProviderId) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('检查访问密钥可用性失败', {
        accessKey,
        excludeProviderId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = ProviderRepository;
