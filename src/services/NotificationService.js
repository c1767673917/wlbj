/**
 * 通知业务逻辑服务
 * 处理各种通知相关的业务逻辑
 */

const BaseService = require('./BaseService');
const { logger } = require('../config/logger');
const config = require('../config/env');

class NotificationService extends BaseService {
  constructor() {
    super('NotificationService');
    this.webhookUrl = config.wechat?.webhookUrl;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1秒
  }

  /**
   * 发送新订单通知给所有供应商
   * @param {Object} order - 订单信息
   * @param {Array} providers - 供应商列表
   * @returns {Promise<Object>} 通知发送结果
   */
  async notifyProvidersNewOrder(order, providers = []) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ order }, ['order']);
      this.validateRequiredParams(order, ['id', 'warehouse', 'goods', 'deliveryAddress']);

      if (!Array.isArray(providers) || providers.length === 0) {
        this.logOperation('no_providers_to_notify', { orderId: order.id }, 'warn');
        return this.buildResponse(null, '没有可通知的供应商');
      }

      // 使用并发处理优化性能
      const AsyncOptimizer = require('../utils/AsyncOptimizer');

      // 为每个供应商创建通知任务
      const notificationTasks = providers.map(provider => async () => {
        const message = this.generateNewOrderMessage(order, provider);
        const result = await this.sendNotification(message, 'new_order', {
          orderId: order.id,
          provider: provider.name
        });

        return {
          provider: provider.name,
          status: 'sent',
          messageId: result.messageId
        };
      });

      // 并发执行通知任务
      const batchResult = await AsyncOptimizer.executeBatch(notificationTasks, {
        maxConcurrency: 3, // 限制并发数避免过载
        retryAttempts: 2,
        retryDelay: 1000,
        failFast: false // 不因单个失败而停止
      });

      const notifications = batchResult.results;
      const errors = batchResult.errors.map(error => ({
        provider: providers[error.index].name,
        status: 'failed',
        error: error.error
      }));

      this.logOperation('providers_notified', {
        orderId: order.id,
        totalProviders: providers.length,
        successCount: notifications.length,
        errorCount: errors.length
      });

      return this.buildResponse({
        notifications,
        errors,
        summary: {
          total: providers.length,
          success: notifications.length,
          failed: errors.length
        }
      }, '供应商通知发送完成');
    }, 'notifyProvidersNewOrder', { orderId: order.id });
  }

  /**
   * 发送报价通知给用户
   * @param {Object} quote - 报价信息
   * @param {Object} order - 订单信息
   * @param {Object} user - 用户信息
   * @returns {Promise<Object>} 通知发送结果
   */
  async notifyUserNewQuote(quote, order, user) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ quote, order, user }, ['quote', 'order', 'user']);
      this.validateRequiredParams(quote, ['provider', 'price', 'estimatedDelivery']);
      this.validateRequiredParams(order, ['id', 'warehouse', 'goods']);
      this.validateRequiredParams(user, ['id', 'name']);

      const message = this.generateQuoteNotificationMessage(quote, order, user);
      
      const result = await this.sendNotification(message, 'new_quote', {
        orderId: order.id,
        userId: user.id,
        provider: quote.provider,
        price: quote.price
      });

      this.logOperation('user_quote_notification_sent', {
        orderId: order.id,
        userId: user.id,
        provider: quote.provider,
        messageId: result.messageId
      });

      return this.buildResponse(result, '报价通知发送成功');
    }, 'notifyUserNewQuote', { orderId: order.id, userId: user.id });
  }

  /**
   * 发送订单状态变更通知
   * @param {Object} order - 订单信息
   * @param {Object} user - 用户信息
   * @param {string} previousStatus - 之前的状态
   * @returns {Promise<Object>} 通知发送结果
   */
  async notifyOrderStatusChange(order, user, previousStatus) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ order, user, previousStatus }, ['order', 'user', 'previousStatus']);
      this.validateRequiredParams(order, ['id', 'status']);
      this.validateRequiredParams(user, ['id', 'name']);

      const message = this.generateOrderStatusMessage(order, user, previousStatus);
      
      const result = await this.sendNotification(message, 'order_status_change', {
        orderId: order.id,
        userId: user.id,
        newStatus: order.status,
        previousStatus
      });

      this.logOperation('order_status_notification_sent', {
        orderId: order.id,
        userId: user.id,
        newStatus: order.status,
        previousStatus,
        messageId: result.messageId
      });

      return this.buildResponse(result, '订单状态通知发送成功');
    }, 'notifyOrderStatusChange', { orderId: order.id, userId: user.id });
  }

  /**
   * 发送系统通知
   * @param {string} title - 通知标题
   * @param {string} content - 通知内容
   * @param {string} type - 通知类型
   * @param {Object} metadata - 元数据
   * @returns {Promise<Object>} 通知发送结果
   */
  async sendSystemNotification(title, content, type = 'system', metadata = {}) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ title, content }, ['title', 'content']);

      const message = {
        msgtype: 'text',
        text: {
          content: `【系统通知】\n标题：${title}\n内容：${content}\n时间：${new Date().toLocaleString('zh-CN')}`
        }
      };

      const result = await this.sendNotification(message, type, metadata);

      this.logOperation('system_notification_sent', {
        title,
        type,
        messageId: result.messageId,
        ...metadata
      });

      return this.buildResponse(result, '系统通知发送成功');
    }, 'sendSystemNotification', { title, type });
  }

  /**
   * 生成新订单通知消息
   * @param {Object} order - 订单信息
   * @param {Object} provider - 供应商信息
   * @returns {Object} 通知消息
   */
  generateNewOrderMessage(order, provider) {
    const content = `【新订单通知】
供应商：${provider.name}
订单编号：${order.id}
发货仓库：${order.warehouse}
货物信息：${order.goods}
配送地址：${order.deliveryAddress}
创建时间：${new Date(order.createdAt).toLocaleString('zh-CN')}

请及时登录系统查看详情并提供报价。`;

    return {
      msgtype: 'text',
      text: {
        content,
        mentioned_list: provider.mentionUsers || []
      }
    };
  }

  /**
   * 生成报价通知消息
   * @param {Object} quote - 报价信息
   * @param {Object} order - 订单信息
   * @param {Object} user - 用户信息
   * @returns {Object} 通知消息
   */
  generateQuoteNotificationMessage(quote, order, user) {
    const content = `【新报价通知】
用户：${user.name}
订单编号：${order.id}
货物信息：${order.goods}
供应商：${quote.provider}
报价金额：¥${quote.price}
预计送达：${new Date(quote.estimatedDelivery).toLocaleString('zh-CN')}

请登录系统查看详细报价信息。`;

    return {
      msgtype: 'text',
      text: {
        content
      }
    };
  }

  /**
   * 生成订单状态变更消息
   * @param {Object} order - 订单信息
   * @param {Object} user - 用户信息
   * @param {string} previousStatus - 之前的状态
   * @returns {Object} 通知消息
   */
  generateOrderStatusMessage(order, user, previousStatus) {
    const statusMap = {
      active: '活跃',
      confirmed: '已确认',
      completed: '已完成',
      cancelled: '已取消'
    };

    const content = `【订单状态变更】
用户：${user.name}
订单编号：${order.id}
状态变更：${statusMap[previousStatus] || previousStatus} → ${statusMap[order.status] || order.status}
${order.selectedProvider ? `选择供应商：${order.selectedProvider}` : ''}
${order.selectedPrice ? `选择价格：¥${order.selectedPrice}` : ''}
变更时间：${new Date().toLocaleString('zh-CN')}`;

    return {
      msgtype: 'text',
      text: {
        content
      }
    };
  }

  /**
   * 发送通知到企业微信
   * @param {Object} message - 消息内容
   * @param {string} type - 通知类型
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 发送结果
   */
  async sendNotification(message, type, context = {}) {
    if (!this.webhookUrl) {
      this.logOperation('webhook_not_configured', { type, ...context }, 'warn');
      return {
        success: false,
        messageId: null,
        error: 'Webhook URL not configured'
      };
    }

    return await this.retry(async () => {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errcode !== 0) {
        throw new Error(`WeChat API Error: ${result.errmsg} (code: ${result.errcode})`);
      }

      return {
        success: true,
        messageId: result.msgid || `msg_${Date.now()}`,
        response: result
      };
    }, this.retryAttempts, this.retryDelay);
  }

  /**
   * 批量发送通知
   * @param {Array} notifications - 通知列表
   * @returns {Promise<Object>} 批量发送结果
   */
  async sendBatchNotifications(notifications) {
    return await this.handleAsyncOperation(async () => {
      this.validateRequiredParams({ notifications }, ['notifications']);

      if (!Array.isArray(notifications) || notifications.length === 0) {
        throw this.createBusinessError('通知列表不能为空');
      }

      // 使用并发处理优化批量发送性能
      const AsyncOptimizer = require('../utils/AsyncOptimizer');

      // 创建批量通知任务
      const batchTasks = notifications.map(notification => async () => {
        const result = await this.sendNotification(
          notification.message,
          notification.type || 'batch',
          notification.context || {}
        );

        return {
          ...notification,
          result,
          status: 'sent'
        };
      });

      // 并发执行批量任务
      const batchResult = await AsyncOptimizer.executeBatch(batchTasks, {
        maxConcurrency: 5, // 批量发送可以有更高的并发数
        retryAttempts: 3,
        retryDelay: 500,
        failFast: false
      });

      const results = batchResult.results;
      const errors = batchResult.errors.map((error, index) => ({
        ...notifications[error.index],
        error: error.error,
        status: 'failed'
      }));

      this.logOperation('batch_notifications_sent', {
        total: notifications.length,
        success: results.length,
        failed: errors.length
      });

      return this.buildResponse({
        results,
        errors,
        summary: {
          total: notifications.length,
          success: results.length,
          failed: errors.length
        }
      }, '批量通知发送完成');
    }, 'sendBatchNotifications', { count: notifications.length });
  }

  /**
   * 获取通知发送统计
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 统计信息
   */
  async getNotificationStats(filters = {}) {
    return await this.handleAsyncOperation(async () => {
      // 这里可以从日志或数据库中获取统计信息
      // 目前返回模拟数据
      const stats = {
        total: 0,
        success: 0,
        failed: 0,
        byType: {},
        recentActivity: []
      };

      return this.buildResponse(stats, '获取通知统计成功');
    }, 'getNotificationStats', filters);
  }
}

module.exports = NotificationService;
