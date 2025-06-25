/**
 * Service层统一导出
 * 提供统一的业务逻辑服务接口
 */

const OrderService = require('./OrderService');
const QuoteService = require('./QuoteService');
const UserService = require('./UserService');
const NotificationService = require('./NotificationService');
const OrderIdService = require('./OrderIdService');
const { logger } = require('../config/logger');

class ServiceFactory {
  constructor() {
    this.services = new Map();
    this.initialized = false;
  }

  /**
   * 初始化所有Service
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // 创建Service实例
      this.services.set('order', new OrderService());
      this.services.set('quote', new QuoteService());
      this.services.set('user', new UserService());
      this.services.set('notification', new NotificationService());
      this.services.set('orderId', new OrderIdService());

      this.initialized = true;
      logger.info('Service工厂初始化完成', {
        services: Array.from(this.services.keys())
      });
    } catch (error) {
      logger.error('Service工厂初始化失败', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取Service实例
   * @param {string} name - Service名称
   * @returns {Object} Service实例
   */
  getService(name) {
    if (!this.initialized) {
      this.initialize();
    }

    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' 不存在`);
    }

    return service;
  }

  /**
   * 获取订单Service
   * @returns {OrderService} 订单Service实例
   */
  get order() {
    return this.getService('order');
  }

  /**
   * 获取报价Service
   * @returns {QuoteService} 报价Service实例
   */
  get quote() {
    return this.getService('quote');
  }

  /**
   * 获取用户Service
   * @returns {UserService} 用户Service实例
   */
  get user() {
    return this.getService('user');
  }

  /**
   * 获取通知Service
   * @returns {NotificationService} 通知Service实例
   */
  get notification() {
    return this.getService('notification');
  }

  /**
   * 获取订单ID Service
   * @returns {OrderIdService} 订单ID Service实例
   */
  get orderId() {
    return this.getService('orderId');
  }

  /**
   * 获取所有Service的健康状态
   * @returns {Promise<Object>} 健康状态信息
   */
  async getHealthStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    const status = {
      status: 'healthy',
      services: {},
      timestamp: new Date().toISOString()
    };

    for (const [name, service] of this.services) {
      try {
        // 检查Service是否正常工作
        if (typeof service.buildResponse === 'function') {
          service.buildResponse('test', 'health_check');
          status.services[name] = 'healthy';
        } else {
          status.services[name] = 'unknown';
        }
      } catch (error) {
        status.services[name] = 'unhealthy';
        status.status = 'degraded';
        logger.warn(`Service '${name}' 健康检查失败`, {
          error: error.message
        });
      }
    }

    return status;
  }

  /**
   * 重置所有Service（主要用于测试）
   */
  reset() {
    this.services.clear();
    this.initialized = false;
    logger.info('Service工厂已重置');
  }
}

// 创建全局Service工厂实例
const serviceFactory = new ServiceFactory();

// 便捷的导出方式
module.exports = {
  ServiceFactory,
  serviceFactory,
  
  // 直接导出Service类
  OrderService,
  QuoteService,
  UserService,
  NotificationService,
  OrderIdService,
  
  // 便捷的访问方式
  get orderService() {
    return serviceFactory.order;
  },
  
  get quoteService() {
    return serviceFactory.quote;
  },
  
  get userService() {
    return serviceFactory.user;
  },
  
  get notificationService() {
    return serviceFactory.notification;
  },
  
  get orderIdService() {
    return serviceFactory.orderId;
  }
};
