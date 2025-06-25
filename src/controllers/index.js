/**
 * Controller层统一导出
 * 提供统一的控制器接口
 */

const OrderController = require('./OrderController');
const QuoteController = require('./QuoteController');
const UserController = require('./UserController');
const { logger } = require('../config/logger');

class ControllerFactory {
  constructor() {
    this.controllers = new Map();
    this.initialized = false;
  }

  /**
   * 初始化所有Controller
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // 创建Controller实例
      this.controllers.set('order', new OrderController());
      this.controllers.set('quote', new QuoteController());
      this.controllers.set('user', new UserController());

      this.initialized = true;
      logger.info('Controller工厂初始化完成', {
        controllers: Array.from(this.controllers.keys())
      });
    } catch (error) {
      logger.error('Controller工厂初始化失败', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取Controller实例
   * @param {string} name - Controller名称
   * @returns {Object} Controller实例
   */
  getController(name) {
    if (!this.initialized) {
      this.initialize();
    }

    const controller = this.controllers.get(name);
    if (!controller) {
      throw new Error(`Controller '${name}' 不存在`);
    }

    return controller;
  }

  /**
   * 获取订单Controller
   * @returns {OrderController} 订单Controller实例
   */
  get order() {
    return this.getController('order');
  }

  /**
   * 获取报价Controller
   * @returns {QuoteController} 报价Controller实例
   */
  get quote() {
    return this.getController('quote');
  }

  /**
   * 获取用户Controller
   * @returns {UserController} 用户Controller实例
   */
  get user() {
    return this.getController('user');
  }

  /**
   * 获取所有Controller的健康状态
   * @returns {Object} 健康状态信息
   */
  getHealthStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    const status = {
      status: 'healthy',
      controllers: {},
      timestamp: new Date().toISOString()
    };

    for (const [name, controller] of this.controllers) {
      try {
        // 检查Controller是否正常工作
        if (typeof controller.sendSuccess === 'function') {
          status.controllers[name] = 'healthy';
        } else {
          status.controllers[name] = 'unknown';
        }
      } catch (error) {
        status.controllers[name] = 'unhealthy';
        status.status = 'degraded';
        logger.warn(`Controller '${name}' 健康检查失败`, {
          error: error.message
        });
      }
    }

    return status;
  }

  /**
   * 重置所有Controller（主要用于测试）
   */
  reset() {
    this.controllers.clear();
    this.initialized = false;
    logger.info('Controller工厂已重置');
  }
}

// 创建全局Controller工厂实例
const controllerFactory = new ControllerFactory();

// 便捷的导出方式
module.exports = {
  ControllerFactory,
  controllerFactory,
  
  // 直接导出Controller类
  OrderController,
  QuoteController,
  UserController,
  
  // 便捷的访问方式
  get orderController() {
    return controllerFactory.order;
  },
  
  get quoteController() {
    return controllerFactory.quote;
  },
  
  get userController() {
    return controllerFactory.user;
  }
};
