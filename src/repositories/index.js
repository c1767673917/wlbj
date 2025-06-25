/**
 * Repository工厂和统一导出
 * 提供统一的数据访问层接口
 */

const OrderRepository = require('./OrderRepository');
const QuoteRepository = require('./QuoteRepository');
const UserRepository = require('./UserRepository');
const ProviderRepository = require('./ProviderRepository');
const { logger } = require('../config/logger');

class RepositoryFactory {
  constructor() {
    this.repositories = new Map();
    this.initialized = false;
  }

  /**
   * 初始化所有Repository
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // 创建Repository实例
      this.repositories.set('order', new OrderRepository());
      this.repositories.set('quote', new QuoteRepository());
      this.repositories.set('user', new UserRepository());
      this.repositories.set('provider', new ProviderRepository());

      this.initialized = true;
      logger.info('Repository工厂初始化完成', {
        repositories: Array.from(this.repositories.keys())
      });
    } catch (error) {
      logger.error('Repository工厂初始化失败', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取Repository实例
   * @param {string} name - Repository名称
   * @returns {Object} Repository实例
   */
  getRepository(name) {
    if (!this.initialized) {
      this.initialize();
    }

    const repository = this.repositories.get(name);
    if (!repository) {
      throw new Error(`Repository '${name}' 不存在`);
    }

    return repository;
  }

  /**
   * 获取订单Repository
   * @returns {OrderRepository} 订单Repository实例
   */
  get order() {
    return this.getRepository('order');
  }

  /**
   * 获取报价Repository
   * @returns {QuoteRepository} 报价Repository实例
   */
  get quote() {
    return this.getRepository('quote');
  }

  /**
   * 获取用户Repository
   * @returns {UserRepository} 用户Repository实例
   */
  get user() {
    return this.getRepository('user');
  }

  /**
   * 获取供应商Repository
   * @returns {ProviderRepository} 供应商Repository实例
   */
  get provider() {
    return this.getRepository('provider');
  }

  /**
   * 获取所有Repository的健康状态
   * @returns {Promise<Object>} 健康状态信息
   */
  async getHealthStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    const status = {
      status: 'healthy',
      repositories: {},
      timestamp: new Date().toISOString()
    };

    for (const [name, repository] of this.repositories) {
      try {
        // 尝试执行一个简单的查询来检查Repository健康状态
        await repository.count();
        status.repositories[name] = 'healthy';
      } catch (error) {
        status.repositories[name] = 'unhealthy';
        status.status = 'degraded';
        logger.warn(`Repository '${name}' 健康检查失败`, {
          error: error.message
        });
      }
    }

    return status;
  }

  /**
   * 重置所有Repository（主要用于测试）
   */
  reset() {
    this.repositories.clear();
    this.initialized = false;
    logger.info('Repository工厂已重置');
  }
}

// 创建全局Repository工厂实例
const repositoryFactory = new RepositoryFactory();

// 便捷的导出方式
module.exports = {
  RepositoryFactory,
  repositoryFactory,
  
  // 直接导出Repository类
  OrderRepository,
  QuoteRepository,
  UserRepository,
  ProviderRepository,
  
  // 便捷的访问方式
  get orderRepo() {
    return repositoryFactory.order;
  },
  
  get quoteRepo() {
    return repositoryFactory.quote;
  },
  
  get userRepo() {
    return repositoryFactory.user;
  },
  
  get providerRepo() {
    return repositoryFactory.provider;
  }
};
