const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../db/database');
const logger = require('../config/logger');

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
          { header: '订单ID', key: 'id', width: 15 },
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
            id: order.id.substring(0, 8),
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
          { header: '订单ID', key: 'id', width: 15 },
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
            id: order.id.substring(0, 8),
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
          { header: '订单ID', key: 'id', width: 15 },
          { header: '发货仓库', key: 'warehouse', width: 20 },
          { header: '货物信息', key: 'goods', width: 40 },
          { header: '收货信息', key: 'deliveryAddress', width: 40 },
          { header: '创建时间', key: 'createdAt', width: 20 }
        ];
        
        // 添加数据
        orders.forEach(order => {
          worksheet.addRow({
            id: order.id.substring(0, 8),
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
          { header: '订单ID', key: 'orderId', width: 15 },
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
            orderId: quote.orderId.substring(0, 8),
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

module.exports = router;