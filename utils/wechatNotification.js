/**
 * 企业微信群机器人通知工具模块
 * 用于向企业微信群发送订单通知消息
 */

// 检查是否有fetch，如果没有则使用node-fetch
let fetch;
try {
  fetch = globalThis.fetch;
} catch (e) {
  // 如果没有全局fetch，尝试使用node-fetch
  try {
    fetch = require('node-fetch');
  } catch (err) {
    console.warn('警告：未找到fetch实现，企业微信通知功能可能无法正常工作');
  }
}

/**
 * 验证企业微信webhook URL格式
 * @param {string} webhookUrl - webhook URL
 * @returns {boolean} 是否为有效的企业微信webhook URL
 */
function validateWechatWebhookUrl(webhookUrl) {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return false;
  }

  // 企业微信群机器人webhook URL格式验证已关闭，只检查基本URL格式
  // const wechatWebhookPattern = /^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[a-zA-Z0-9-_]+$/;
  // return wechatWebhookPattern.test(webhookUrl);

  // 简单检查是否为有效URL格式
  try {
    new URL(webhookUrl);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 生成订单通知消息内容
 * @param {Object} order - 订单信息
 * @param {string} providerName - 物流公司名称
 * @returns {Object} 企业微信消息格式
 */
function generateOrderNotificationMessage(order, providerName) {
  const currentTime = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // 截取货物信息和收货信息，避免消息过长
  const maxLength = 100;
  const goodsInfo =
    order.goods.length > maxLength ? order.goods.substring(0, maxLength) + '...' : order.goods;
  const deliveryInfo =
    order.deliveryAddress.length > maxLength
      ? order.deliveryAddress.substring(0, maxLength) + '...'
      : order.deliveryAddress;

  const content = `📦 **新订单报价提醒**

**订单编号**: ${order.id}
**发货仓库**: ${order.warehouse}
**货物信息**: ${goodsInfo}
**收货信息**: ${deliveryInfo}
**发布时间**: ${new Date(order.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

💰 **请及时登录系统提交报价！**
⏰ **通知时间**: ${currentTime}

---
*物流报价系统自动通知*`;

  return {
    msgtype: 'markdown',
    markdown: {
      content: content,
    },
  };
}

/**
 * 发送企业微信通知消息
 * @param {string} webhookUrl - 企业微信webhook URL
 * @param {Object} message - 消息内容
 * @returns {Promise<Object>} 发送结果
 */
async function sendWechatNotification(webhookUrl, message) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (response.ok && result.errcode === 0) {
      return {
        success: true,
        message: '消息发送成功',
        data: result,
      };
    } else {
      return {
        success: false,
        message: `消息发送失败: ${result.errmsg || '未知错误'}`,
        error: result,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `网络请求失败: ${error.message}`,
      error: error,
    };
  }
}

/**
 * 向指定物流公司发送订单通知
 * @param {Object} order - 订单信息
 * @param {string} providerName - 物流公司名称
 * @param {string} webhookUrl - 企业微信webhook URL
 * @returns {Promise<Object>} 发送结果
 */
async function notifyProviderNewOrder(order, providerName, webhookUrl) {
  // 验证webhook URL
  if (!validateWechatWebhookUrl(webhookUrl)) {
    return {
      success: false,
      message: '无效的企业微信webhook URL格式',
    };
  }

  // 生成消息内容
  const message = generateOrderNotificationMessage(order, providerName);

  // 发送消息
  return await sendWechatNotification(webhookUrl, message);
}

/**
 * 批量向多个物流公司发送订单通知
 * @param {Object} order - 订单信息
 * @param {Array} providers - 物流公司列表，包含name和wechat_webhook_url
 * @returns {Promise<Array>} 发送结果列表
 */
async function notifyAllProvidersNewOrder(order, providers) {
  const results = [];

  for (const provider of providers) {
    if (provider.wechat_webhook_url) {
      try {
        const result = await notifyProviderNewOrder(
          order,
          provider.name,
          provider.wechat_webhook_url
        );
        results.push({
          providerName: provider.name,
          ...result,
        });
      } catch (error) {
        results.push({
          providerName: provider.name,
          success: false,
          message: `发送失败: ${error.message}`,
          error: error,
        });
      }
    } else {
      results.push({
        providerName: provider.name,
        success: false,
        message: '未配置企业微信webhook URL',
      });
    }
  }

  return results;
}

/**
 * 生成用户报价通知消息内容
 * @param {Object} order - 订单信息
 * @param {Object} quote - 报价信息
 * @param {Object} user - 用户信息
 * @returns {Object} 企业微信消息格式
 */
function generateUserQuoteNotificationMessage(order, quote, user) {
  const currentTime = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // 截取货物信息，避免消息过长
  const maxLength = 80;
  const goodsInfo =
    order.goods.length > maxLength ? order.goods.substring(0, maxLength) + '...' : order.goods;

  const content = `💰 **新报价通知**

**订单编号**: ${order.id}
**货物信息**: ${goodsInfo}
**物流公司**: ${quote.provider}
**报价金额**: ¥${quote.price}
**预计送达**: ${quote.estimatedDelivery}
**报价时间**: ${currentTime}

🔔 **请登录系统查看详细报价信息**

---
*物流报价系统自动通知*`;

  return {
    msgtype: 'markdown',
    markdown: {
      content: content,
    },
  };
}

module.exports = {
  validateWechatWebhookUrl,
  generateOrderNotificationMessage,
  generateUserQuoteNotificationMessage,
  sendWechatNotification,
  notifyProviderNewOrder,
  notifyAllProvidersNewOrder,
};
