const db = require('../db/database');
const logger = require('../config/logger');

/**
 * 数据加载器 - 用于缓存预热
 */
class DataLoader {
  /**
   * 加载活跃订单
   */
  async loadActiveOrders() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT o.*, 
               COUNT(DISTINCT q.provider) as quoteCount,
               MIN(q.price) as lowestPrice
        FROM orders o
        LEFT JOIN quotes q ON o.id = q.orderId
        WHERE o.status = 'active'
        GROUP BY o.id
        ORDER BY o.createdAt DESC
        LIMIT 100
      `;

      db.all(query, (err, rows) => {
        if (err) {
          logger.error('加载活跃订单失败', { error: err.message });
          reject(err);
        } else {
          logger.info('成功加载活跃订单', { count: rows.length });
          resolve(rows);
        }
      });
    });
  }

  /**
   * 加载供应商列表
   */
  async loadProviders() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT p.*,
               COUNT(DISTINCT q.orderId) as totalQuotes,
               AVG(q.price) as avgPrice
        FROM providers p
        LEFT JOIN quotes q ON p.name = q.provider
        GROUP BY p.id
        ORDER BY p.name
      `;

      db.all(query, (err, rows) => {
        if (err) {
          logger.error('加载供应商列表失败', { error: err.message });
          reject(err);
        } else {
          logger.info('成功加载供应商列表', { count: rows.length });
          resolve(rows);
        }
      });
    });
  }

  /**
   * 加载最近的报价
   */
  async loadRecentQuotes() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT q.*,
               o.warehouse,
               o.goods,
               o.deliveryAddress
        FROM quotes q
        JOIN orders o ON q.orderId = o.id
        WHERE q.createdAt > datetime('now', '-1 day')
        ORDER BY q.createdAt DESC
        LIMIT 200
      `;

      db.all(query, (err, rows) => {
        if (err) {
          logger.error('加载最近报价失败', { error: err.message });
          reject(err);
        } else {
          logger.info('成功加载最近报价', { count: rows.length });
          resolve(rows);
        }
      });
    });
  }

  /**
   * 加载热门路线
   */
  async loadPopularRoutes() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT warehouse, 
               deliveryAddress,
               COUNT(*) as orderCount,
               AVG(CAST(q.price AS REAL)) as avgPrice
        FROM orders o
        LEFT JOIN quotes q ON o.id = q.orderId
        WHERE o.createdAt > datetime('now', '-30 days')
        GROUP BY warehouse, deliveryAddress
        ORDER BY orderCount DESC
        LIMIT 50
      `;

      db.all(query, (err, rows) => {
        if (err) {
          logger.error('加载热门路线失败', { error: err.message });
          reject(err);
        } else {
          logger.info('成功加载热门路线', { count: rows.length });
          resolve(rows);
        }
      });
    });
  }

  /**
   * 加载供应商性能数据
   */
  async loadProviderPerformance() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT q.provider,
               COUNT(DISTINCT q.orderId) as totalQuotes,
               COUNT(DISTINCT CASE WHEN o.selectedProvider = q.provider THEN o.id END) as wonOrders,
               AVG(q.price) as avgPrice,
               MIN(q.price) as minPrice,
               MAX(q.price) as maxPrice
        FROM quotes q
        JOIN orders o ON q.orderId = o.id
        WHERE q.createdAt > datetime('now', '-30 days')
        GROUP BY q.provider
        ORDER BY wonOrders DESC
      `;

      db.all(query, (err, rows) => {
        if (err) {
          logger.error('加载供应商性能数据失败', { error: err.message });
          reject(err);
        } else {
          logger.info('成功加载供应商性能数据', { count: rows.length });
          resolve(rows);
        }
      });
    });
  }

  /**
   * 批量加载订单的最低报价
   */
  async loadLowestQuotesForOrders(orderIds) {
    if (!orderIds || orderIds.length === 0) {
      return {};
    }

    return new Promise((resolve, reject) => {
      const placeholders = orderIds.map(() => '?').join(',');
      const query = `
        SELECT orderId,
               MIN(price) as lowestPrice,
               provider as lowestProvider,
               estimatedDelivery
        FROM quotes
        WHERE orderId IN (${placeholders})
        GROUP BY orderId
        HAVING price = MIN(price)
      `;

      db.all(query, orderIds, (err, rows) => {
        if (err) {
          logger.error('批量加载最低报价失败', { error: err.message });
          reject(err);
        } else {
          // 转换为对象格式便于查找
          const lowestQuotesMap = {};
          rows.forEach(row => {
            lowestQuotesMap[row.orderId] = {
              price: row.lowestPrice,
              provider: row.lowestProvider,
              estimatedDelivery: row.estimatedDelivery,
            };
          });

          logger.info('成功批量加载最低报价', { count: rows.length });
          resolve(lowestQuotesMap);
        }
      });
    });
  }
}

// 创建单例实例
const dataLoader = new DataLoader();

module.exports = dataLoader;
