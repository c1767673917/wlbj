const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../db/database');
const logger = require('../config/logger');
const { authenticateToken, requireRole, ROLES } = require('../utils/auth');

// 导出活跃订单
router.get('/orders/active', async (req, res) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT
        orders.*,
        quotes_summary.lowestPrice,
        quotes_summary.lowestProvider
      FROM orders
      LEFT JOIN (
        SELECT
          q1.orderId,
          q1.price as lowestPrice,
          q1.provider as lowestProvider
        FROM quotes q1
        INNER JOIN (
          SELECT orderId, MIN(price) as minPrice
          FROM quotes
          GROUP BY orderId
        ) q2 ON q1.orderId = q2.orderId AND q1.price = q2.minPrice
      ) quotes_summary ON orders.id = quotes_summary.orderId
      WHERE orders.status = 'active'
    `;

    const params = [];

    if (search) {
      query += ` AND (
        orders.id LIKE ? OR
        orders.warehouse LIKE ? OR
        orders.goods LIKE ? OR
        orders.deliveryAddress LIKE ?
      )`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY orders.createdAt DESC`;

    db.all(query, params, async (err, orders) => {
      if (err) {
        logger.error('导出活跃订单失败:', err);
        return res.status(500).json({ error: '导出失败' });
      }

      try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('活跃订单');

        // 设置列
        worksheet.columns = [
          { header: '订单ID', key: 'id', width: 20 },
          { header: '发货仓库', key: 'warehouse', width: 20 },
          { header: '货物信息', key: 'goods', width: 30 },
          { header: '收货信息', key: 'deliveryAddress', width: 40 },
          { header: '最低报价物流商', key: 'lowestProvider', width: 20 },
          { header: '最低报价(元)', key: 'lowestPrice', width: 15 },
          { header: '创建时间', key: 'createdAt', width: 20 }
        ];

        // 添加数据
        orders.forEach(order => {
          worksheet.addRow({
            id: order.id, // 显示完整订单ID
            warehouse: order.warehouse,
            goods: order.goods,
            deliveryAddress: order.deliveryAddress,
            lowestProvider: order.lowestProvider || '暂无报价',
            lowestPrice: order.lowestPrice ? order.lowestPrice.toFixed(2) : '0.00',
            createdAt: new Date(order.createdAt).toLocaleString('zh-CN')
          });
        });

        // 设置响应头
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=active-orders-${new Date().toISOString().split('T')[0]}.xlsx`);

        // 发送文件
        await workbook.xlsx.write(res);
        res.end();

        logger.info(`导出了 ${orders.length} 条活跃订单`);
      } catch (excelError) {
        logger.error('生成Excel文件失败:', excelError);
        res.status(500).json({ error: '生成Excel文件失败' });
      }
    });
  } catch (error) {
    logger.error('导出活跃订单出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 导出历史订单
router.get('/orders/closed', async (req, res) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT
        orders.*,
        quotes_summary.lowestPrice,
        quotes_summary.lowestProvider
      FROM orders
      LEFT JOIN (
        SELECT
          q1.orderId,
          q1.price as lowestPrice,
          q1.provider as lowestProvider
        FROM quotes q1
        INNER JOIN (
          SELECT orderId, MIN(price) as minPrice
          FROM quotes
          GROUP BY orderId
        ) q2 ON q1.orderId = q2.orderId AND q1.price = q2.minPrice
      ) quotes_summary ON orders.id = quotes_summary.orderId
      WHERE orders.status = 'closed'
    `;

    const params = [];

    if (search) {
      query += ` AND (
        orders.id LIKE ? OR
        orders.warehouse LIKE ? OR
        orders.goods LIKE ? OR
        orders.deliveryAddress LIKE ?
      )`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY orders.updatedAt DESC`;

    db.all(query, params, async (err, orders) => {
      if (err) {
        logger.error('导出历史订单失败:', err);
        return res.status(500).json({ error: '导出失败' });
      }

      try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('历史订单');

        // 设置列
        worksheet.columns = [
          { header: '订单ID', key: 'id', width: 20 },
          { header: '发货仓库', key: 'warehouse', width: 20 },
          { header: '货物信息', key: 'goods', width: 30 },
          { header: '收货信息', key: 'deliveryAddress', width: 40 },
          { header: '最低报价物流商', key: 'lowestProvider', width: 20 },
          { header: '最低报价(元)', key: 'lowestPrice', width: 15 },
          { header: '创建时间', key: 'createdAt', width: 20 },
          { header: '关闭时间', key: 'updatedAt', width: 20 }
        ];

        // 添加数据
        orders.forEach(order => {
          worksheet.addRow({
            id: order.id, // 显示完整订单ID
            warehouse: order.warehouse,
            goods: order.goods,
            deliveryAddress: order.deliveryAddress,
            lowestProvider: order.lowestProvider || '暂无报价',
            lowestPrice: order.lowestPrice ? order.lowestPrice.toFixed(2) : '0.00',
            createdAt: new Date(order.createdAt).toLocaleString('zh-CN'),
            updatedAt: order.updatedAt ? new Date(order.updatedAt).toLocaleString('zh-CN') : ''
          });
        });

        // 设置响应头
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=closed-orders-${new Date().toISOString().split('T')[0]}.xlsx`);

        // 发送文件
        await workbook.xlsx.write(res);
        res.end();

        logger.info(`导出了 ${orders.length} 条历史订单`);
      } catch (excelError) {
        logger.error('生成Excel文件失败:', excelError);
        res.status(500).json({ error: '生成Excel文件失败' });
      }
    });
  } catch (error) {
    logger.error('导出历史订单出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 供应商端导出可报价订单
router.get('/provider/available-orders', async (req, res) => {
  try {
    const { accessKey, search } = req.query;

    if (!accessKey) {
      return res.status(400).json({ error: '缺少访问密钥' });
    }

    // 验证供应商
    const provider = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM providers WHERE accessKey = ?', [accessKey], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!provider) {
      return res.status(404).json({ error: '无效的访问密钥' });
    }

    let query = `
      SELECT DISTINCT orders.*
      FROM orders
      LEFT JOIN quotes ON orders.id = quotes.orderId AND quotes.provider = ?
      WHERE orders.status = 'active'
      AND quotes.id IS NULL
    `;

    const params = [provider.name];

    if (search) {
      query += ` AND (
        orders.id LIKE ? OR
        orders.warehouse LIKE ? OR
        orders.goods LIKE ? OR
        orders.deliveryAddress LIKE ?
      )`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY orders.createdAt DESC`;

    db.all(query, params, async (err, orders) => {
      if (err) {
        logger.error('供应商导出可报价订单失败:', err);
        return res.status(500).json({ error: '导出失败' });
      }

      try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('可报价订单');

        // 设置列
        worksheet.columns = [
          { header: '订单ID', key: 'id', width: 20 },
          { header: '发货仓库', key: 'warehouse', width: 20 },
          { header: '货物信息', key: 'goods', width: 40 },
          { header: '收货信息', key: 'deliveryAddress', width: 40 },
          { header: '创建时间', key: 'createdAt', width: 20 }
        ];

        // 添加数据
        orders.forEach(order => {
          worksheet.addRow({
            id: order.id, // 显示完整订单ID
            warehouse: order.warehouse,
            goods: order.goods,
            deliveryAddress: order.deliveryAddress,
            createdAt: new Date(order.createdAt).toLocaleString('zh-CN')
          });
        });

        // 设置响应头 - 修复中文文件名编码问题
        const safeFileName = encodeURIComponent(`${provider.name}-available-orders-${new Date().toISOString().split('T')[0]}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFileName}`);

        // 发送文件
        await workbook.xlsx.write(res);
        res.end();

        logger.info(`供应商${provider.name}导出了 ${orders.length} 条可报价订单`);
      } catch (excelError) {
        logger.error('生成Excel文件失败:', excelError);
        res.status(500).json({ error: '生成Excel文件失败' });
      }
    });
  } catch (error) {
    logger.error('供应商导出可报价订单出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 供应商端导出报价历史
router.get('/provider/quote-history', async (req, res) => {
  try {
    const { accessKey, search } = req.query;

    if (!accessKey) {
      return res.status(400).json({ error: '缺少访问密钥' });
    }

    // 验证供应商
    const provider = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM providers WHERE accessKey = ?', [accessKey], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!provider) {
      return res.status(404).json({ error: '无效的访问密钥' });
    }

    let query = `
      SELECT
        quotes.*,
        orders.warehouse as orderWarehouse,
        orders.goods as orderGoods,
        orders.deliveryAddress as orderDeliveryAddress
      FROM quotes
      JOIN orders ON quotes.orderId = orders.id
      WHERE quotes.provider = ?
    `;

    const params = [provider.name];

    if (search) {
      query += ` AND (
        quotes.orderId LIKE ? OR
        orders.warehouse LIKE ? OR
        orders.goods LIKE ? OR
        orders.deliveryAddress LIKE ?
      )`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY quotes.createdAt DESC`;

    db.all(query, params, async (err, quotes) => {
      if (err) {
        logger.error('供应商导出报价历史失败:', err);
        return res.status(500).json({ error: '导出失败' });
      }

      try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('报价历史');

        // 设置列
        worksheet.columns = [
          { header: '订单ID', key: 'orderId', width: 20 },
          { header: '发货仓库', key: 'warehouse', width: 20 },
          { header: '货物信息', key: 'goods', width: 40 },
          { header: '收货信息', key: 'deliveryAddress', width: 40 },
          { header: '我的报价(元)', key: 'price', width: 15 },
          { header: '预计送达时间', key: 'estimatedDelivery', width: 20 },
          { header: '报价时间', key: 'createdAt', width: 20 }
        ];

        // 添加数据
        quotes.forEach(quote => {
          worksheet.addRow({
            orderId: quote.orderId, // 显示完整订单ID
            warehouse: quote.orderWarehouse,
            goods: quote.orderGoods,
            deliveryAddress: quote.orderDeliveryAddress,
            price: quote.price.toFixed(2),
            estimatedDelivery: quote.estimatedDelivery,
            createdAt: new Date(quote.createdAt).toLocaleString('zh-CN')
          });
        });

        // 设置响应头 - 修复中文文件名编码问题
        const safeFileName = encodeURIComponent(`${provider.name}-quote-history-${new Date().toISOString().split('T')[0]}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFileName}`);

        // 发送文件
        await workbook.xlsx.write(res);
        res.end();

        logger.info(`供应商${provider.name}导出了 ${quotes.length} 条报价历史`);
      } catch (excelError) {
        logger.error('生成Excel文件失败:', excelError);
        res.status(500).json({ error: '生成Excel文件失败' });
      }
    });
  } catch (error) {
    logger.error('供应商导出报价历史出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员导出所有数据
router.get('/all-data',
  authenticateToken,
  requireRole(ROLES.ADMIN),
  async (req, res) => {
    try {
      logger.info('管理员开始导出所有数据', { adminId: req.user.id });

      // 创建工作簿
      const workbook = new ExcelJS.Workbook();
      workbook.creator = '物流报价系统';
      workbook.created = new Date();

      // 导出用户数据
      const usersSheet = workbook.addWorksheet('用户数据');
      usersSheet.columns = [
        { header: '用户ID', key: 'id', width: 30 },
        { header: '邮箱', key: 'email', width: 30 },
        { header: '姓名', key: 'name', width: 20 },
        { header: '角色', key: 'role', width: 15 },
        { header: '状态', key: 'isActive', width: 10 },
        { header: '注册时间', key: 'createdAt', width: 20 },
        { header: '更新时间', key: 'updatedAt', width: 20 }
      ];

      const users = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM users ORDER BY createdAt DESC', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      users.forEach(user => {
        usersSheet.addRow({
          ...user,
          isActive: user.isActive ? '活跃' : '禁用',
          createdAt: new Date(user.createdAt).toLocaleString('zh-CN'),
          updatedAt: user.updatedAt ? new Date(user.updatedAt).toLocaleString('zh-CN') : ''
        });
      });

      // 导出订单数据
      const ordersSheet = workbook.addWorksheet('订单数据');
      ordersSheet.columns = [
        { header: '订单号', key: 'id', width: 20 },
        { header: '用户邮箱', key: 'userEmail', width: 30 },
        { header: '用户姓名', key: 'userName', width: 20 },
        { header: '发货仓库', key: 'warehouse', width: 30 },
        { header: '货物信息', key: 'goods', width: 40 },
        { header: '收货地址', key: 'deliveryAddress', width: 40 },
        { header: '状态', key: 'status', width: 15 },
        { header: '选择的物流商', key: 'selectedProvider', width: 20 },
        { header: '选择的价格', key: 'selectedPrice', width: 15 },
        { header: '选择时间', key: 'selectedAt', width: 20 },
        { header: '创建时间', key: 'createdAt', width: 20 },
        { header: '更新时间', key: 'updatedAt', width: 20 }
      ];

      const orders = await new Promise((resolve, reject) => {
        db.all(`
          SELECT o.*, u.email as userEmail, u.name as userName
          FROM orders o
          LEFT JOIN users u ON o.userId = u.id
          ORDER BY o.createdAt DESC
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      orders.forEach(order => {
        ordersSheet.addRow({
          ...order,
          status: order.status === 'active' ? '活跃' : '已关闭',
          selectedAt: order.selectedAt ? new Date(order.selectedAt).toLocaleString('zh-CN') : '',
          createdAt: new Date(order.createdAt).toLocaleString('zh-CN'),
          updatedAt: order.updatedAt ? new Date(order.updatedAt).toLocaleString('zh-CN') : ''
        });
      });

      // 导出物流公司数据
      const providersSheet = workbook.addWorksheet('物流公司数据');
      providersSheet.columns = [
        { header: '公司ID', key: 'id', width: 30 },
        { header: '公司名称', key: 'name', width: 30 },
        { header: '访问密钥', key: 'accessKey', width: 30 },
        { header: '企业微信Webhook', key: 'wechat_webhook_url', width: 50 },
        { header: '创建时间', key: 'createdAt', width: 20 }
      ];

      const providers = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM providers ORDER BY createdAt DESC', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      providers.forEach(provider => {
        providersSheet.addRow({
          ...provider,
          createdAt: new Date(provider.createdAt).toLocaleString('zh-CN')
        });
      });

      // 导出报价数据
      const quotesSheet = workbook.addWorksheet('报价数据');
      quotesSheet.columns = [
        { header: '报价ID', key: 'id', width: 30 },
        { header: '订单号', key: 'orderId', width: 20 },
        { header: '物流公司', key: 'provider', width: 20 },
        { header: '报价金额', key: 'price', width: 15 },
        { header: '预计送达时间', key: 'estimatedDelivery', width: 20 },
        { header: '报价时间', key: 'createdAt', width: 20 }
      ];

      const quotes = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM quotes ORDER BY createdAt DESC', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      quotes.forEach(quote => {
        quotesSheet.addRow({
          ...quote,
          createdAt: new Date(quote.createdAt).toLocaleString('zh-CN')
        });
      });

      // 设置响应头
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=system-backup-${new Date().toISOString().split('T')[0]}.xlsx`);

      // 发送文件
      await workbook.xlsx.write(res);
      res.end();

      logger.info('管理员数据导出完成', {
        adminId: req.user.id,
        usersCount: users.length,
        ordersCount: orders.length,
        providersCount: providers.length,
        quotesCount: quotes.length
      });

    } catch (error) {
      logger.error('管理员数据导出失败:', { error: error.message, adminId: req.user.id });
      res.status(500).json({ error: '数据导出失败' });
    }
  }
);

// 管理员导出订单数据（包含用户信息）
router.get('/orders',
  authenticateToken,
  requireRole(ROLES.ADMIN),
  async (req, res) => {
    try {
      const { search, status } = req.query;

      let query = `
        SELECT o.*, u.email as userEmail, u.name as userName
        FROM orders o
        LEFT JOIN users u ON o.userId = u.id
      `;
      const params = [];
      const conditions = [];

      if (search) {
        conditions.push('(o.id LIKE ? OR o.warehouse LIKE ? OR o.goods LIKE ? OR o.deliveryAddress LIKE ? OR u.email LIKE ? OR u.name LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (status) {
        conditions.push('o.status = ?');
        params.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY o.createdAt DESC';

      db.all(query, params, async (err, orders) => {
        if (err) {
          logger.error('管理员导出订单失败:', err);
          return res.status(500).json({ error: '导出失败' });
        }

        try {
          // 创建工作簿
          const workbook = new ExcelJS.Workbook();
          workbook.creator = '物流报价系统';
          workbook.created = new Date();

          const worksheet = workbook.addWorksheet('订单数据');

          // 设置列
          worksheet.columns = [
            { header: '订单号', key: 'id', width: 20 },
            { header: '用户邮箱', key: 'userEmail', width: 30 },
            { header: '用户姓名', key: 'userName', width: 20 },
            { header: '发货仓库', key: 'warehouse', width: 30 },
            { header: '货物信息', key: 'goods', width: 40 },
            { header: '收货地址', key: 'deliveryAddress', width: 40 },
            { header: '状态', key: 'status', width: 15 },
            { header: '选择的物流商', key: 'selectedProvider', width: 20 },
            { header: '选择的价格', key: 'selectedPrice', width: 15 },
            { header: '选择时间', key: 'selectedAt', width: 20 },
            { header: '创建时间', key: 'createdAt', width: 20 },
            { header: '更新时间', key: 'updatedAt', width: 20 }
          ];

          // 添加数据
          orders.forEach(order => {
            worksheet.addRow({
              ...order,
              status: order.status === 'active' ? '活跃' : '已关闭',
              selectedAt: order.selectedAt ? new Date(order.selectedAt).toLocaleString('zh-CN') : '',
              createdAt: new Date(order.createdAt).toLocaleString('zh-CN'),
              updatedAt: order.updatedAt ? new Date(order.updatedAt).toLocaleString('zh-CN') : ''
            });
          });

          // 设置响应头
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename=admin-orders-${new Date().toISOString().split('T')[0]}.xlsx`);

          // 发送文件
          await workbook.xlsx.write(res);
          res.end();

          logger.info(`管理员导出了 ${orders.length} 条订单数据`, { adminId: req.user.id });
        } catch (excelError) {
          logger.error('生成Excel文件失败:', excelError);
          res.status(500).json({ error: '生成Excel文件失败' });
        }
      });
    } catch (error) {
      logger.error('管理员导出订单出错:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }
);

module.exports = router;