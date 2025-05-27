const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { validateWechatWebhookUrl } = require('../utils/wechatNotification');

// POST /api/providers - 添加新的物流公司
router.post('/', (req, res) => {
  const { name, customAccessKey, wechatWebhookUrl } = req.body;
  if (!name) {
    return res.status(400).json({ error: '物流公司名称是必填的' });
  }

  // 验证企业微信webhook URL（如果提供）
  if (wechatWebhookUrl && !validateWechatWebhookUrl(wechatWebhookUrl)) {
    return res.status(400).json({ error: '企业微信webhook URL格式不正确' });
  }

  let accessKeyToUse = customAccessKey;
  if (customAccessKey) {
    if (/\s/.test(customAccessKey) || customAccessKey.length === 0) {
      return res.status(400).json({ error: '自定义链接名不能包含空格且不能为空' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(customAccessKey)) {
        return res.status(400).json({ error: '自定义链接名只能包含字母、数字、下划线和中划线' });
    }
  } else {
    accessKeyToUse = uuidv4();
  }

  const newProvider = {
    id: uuidv4(),
    name: name,
    accessKey: accessKeyToUse,
    createdAt: new Date().toISOString(),
    wechatWebhookUrl: wechatWebhookUrl || null
  };

  db.run(
    'INSERT INTO providers (id, name, accessKey, createdAt, wechat_webhook_url) VALUES (?, ?, ?, ?, ?)',
    [newProvider.id, newProvider.name, newProvider.accessKey, newProvider.createdAt, newProvider.wechatWebhookUrl],
    function(err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed: providers.name')) {
          return res.status(409).json({ error: '该物流公司名称已存在' });
        }
        if (err.message && err.message.includes('UNIQUE constraint failed: providers.accessKey')) {
          const message = customAccessKey ? '自定义链接名已被使用，请更换一个。' : '生成专属链接失败，请重试。';
          return res.status(409).json({ error: message });
        }
        console.error(err);
        return res.status(500).json({ error: '添加物流公司失败' });
      }
      res.status(201).json({
        id: newProvider.id,
        name: newProvider.name,
        accessKey: newProvider.accessKey,
        createdAt: newProvider.createdAt,
        wechatWebhookUrl: newProvider.wechatWebhookUrl
      });
    }
  );
});

// GET /api/providers - 获取所有物流公司
router.get('/', (req, res) => {
  db.all('SELECT id, name, accessKey, createdAt, wechat_webhook_url FROM providers ORDER BY createdAt DESC', [], (err, providers) => {
    if (err) {
      console.error("Error fetching providers:", err);
      return res.status(500).json({ error: '获取物流公司列表失败' });
    }
    res.json(providers);
  });
});

// PUT /api/providers/:id/access-key - 修改供应商的 accessKey
router.put('/:id/access-key', (req, res) => {
  const providerId = req.params.id;
  const { newAccessKey } = req.body;

  if (!newAccessKey || typeof newAccessKey !== 'string' || newAccessKey.trim() === '') {
    return res.status(400).json({ error: '新的链接名不能为空' });
  }

  const trimmedNewAccessKey = newAccessKey.trim();

  if (/\s/.test(trimmedNewAccessKey)) {
    return res.status(400).json({ error: '新的链接名不能包含空格' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedNewAccessKey)) {
    return res.status(400).json({ error: '新的链接名只能包含字母、数字、下划线和中划线' });
  }

  db.get('SELECT id FROM providers WHERE accessKey = ? AND id != ?', [trimmedNewAccessKey, providerId], (err, existingProvider) => {
    if (err) {
      console.error("Error checking accessKey uniqueness:", err);
      return res.status(500).json({ error: '检查链接名唯一性失败' });
    }
    if (existingProvider) {
      return res.status(409).json({ error: '该链接名已被其他供应商使用，请选择其他名称' });
    }

    db.run('UPDATE providers SET accessKey = ? WHERE id = ?', [trimmedNewAccessKey, providerId], function(err) {
      if (err) {
        console.error("Error updating accessKey:", err);
        return res.status(500).json({ error: '更新链接名失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '未找到指定ID的物流公司' });
      }
      res.json({ message: '链接名更新成功', newAccessKey: trimmedNewAccessKey });
    });
  });
});

// DELETE /api/providers/:id - 删除指定ID的物流公司
router.delete('/:id', (req, res) => {
  const providerId = req.params.id;

  db.run('DELETE FROM providers WHERE id = ?', [providerId], function(err) {
    if (err) {
      console.error("Error deleting provider:", err);
      return res.status(500).json({ error: '删除物流公司失败' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '未找到指定ID的物流公司' });
    }
    res.json({ message: '物流公司删除成功' });
  });
});

// PUT /api/providers/:id/webhook - 更新物流公司的企业微信webhook URL
router.put('/:id/webhook', (req, res) => {
  const providerId = req.params.id;
  const { wechatWebhookUrl } = req.body;

  // 验证webhook URL格式（如果提供）
  if (wechatWebhookUrl && !validateWechatWebhookUrl(wechatWebhookUrl)) {
    return res.status(400).json({ error: '企业微信webhook URL格式不正确' });
  }

  db.run(
    'UPDATE providers SET wechat_webhook_url = ? WHERE id = ?',
    [wechatWebhookUrl || null, providerId],
    function(err) {
      if (err) {
        console.error("Error updating provider webhook:", err);
        return res.status(500).json({ error: '更新webhook URL失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '未找到指定ID的物流公司' });
      }
      res.json({
        message: '企业微信webhook URL更新成功',
        wechatWebhookUrl: wechatWebhookUrl || null
      });
    }
  );
});

// GET /api/providers/details - 根据 accessKey 获取单个物流公司详细信息
router.get('/details', (req, res) => {
  const accessKey = req.query.accessKey;
  if (!accessKey) {
    return res.status(400).json({ error: '必须提供 accessKey' });
  }
  db.get('SELECT id, name, accessKey, createdAt, wechat_webhook_url FROM providers WHERE accessKey = ?', [accessKey], (err, provider) => {
    if (err) {
      console.error("Error fetching provider details by accessKey:", err);
      return res.status(500).json({ error: '查询物流公司信息失败' });
    }
    if (!provider) {
      return res.status(404).json({ error: '找不到具有指定 accessKey 的物流公司' });
    }
    res.json(provider);
  });
});

// GET /api/providers/:accessKey/available-orders - 获取物流商可报价的订单
router.get('/:accessKey/available-orders', (req, res) => {
  const accessKey = req.params.accessKey;
  const search = req.query.search;
  const page = parseInt(req.query.page) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 1000);
  const offset = (page - 1) * pageSize;

  if (!accessKey) {
    return res.status(400).json({ error: '必须提供 accessKey' });
  }

  // 首先验证accessKey并获取物流商名称
  db.get('SELECT name FROM providers WHERE accessKey = ?', [accessKey], (err, providerRow) => {
    if (err) {
      console.error("Error fetching provider by accessKey:", err);
      return res.status(500).json({ error: '查询物流商信息失败' });
    }
    if (!providerRow) {
      return res.status(404).json({ error: '无效的 accessKey 或物流商不存在' });
    }
    const providerName = providerRow.name;

    let queryParams = [providerName, 'active'];
    let countParams = [providerName, 'active'];
    let whereClauses = [
      `id NOT IN (SELECT orderId FROM quotes WHERE provider = ?)`,
      `status = ?`
    ];

    // 添加搜索过滤
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereClauses.push('(id LIKE ? OR warehouse LIKE ? OR goods LIKE ? OR deliveryAddress LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereString = ' WHERE ' + whereClauses.join(' AND ');
    let countQuery = 'SELECT COUNT(*) as total FROM orders' + whereString;
    let dataQuery = 'SELECT id, warehouse, goods, deliveryAddress, createdAt, updatedAt, status FROM orders' + whereString;

    dataQuery += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    queryParams.push(pageSize, offset);

    db.get(countQuery, countParams, (err, countRow) => {
      if (err) {
        console.error("Count query error (available orders):", err);
        return res.status(500).json({ error: '获取可报价订单总数失败' });
      }
      const totalItems = countRow ? countRow.total : 0;
      const totalPages = Math.ceil(totalItems / pageSize);

      db.all(dataQuery, queryParams, (err, items) => {
        if (err) {
          console.error("Data query error (available orders):", err);
          return res.status(500).json({ error: '获取可报价订单失败' });
        }
        res.json({
          items: items || [],
          totalItems,
          totalPages,
          currentPage: page,
          pageSize,
          providerName,
          hasSearch: !!search
        });
      });
    });
  });
});

// GET /api/providers/:accessKey/quote-history - 获取物流商的报价历史
router.get('/:accessKey/quote-history', (req, res) => {
  const accessKey = req.params.accessKey;
  const search = req.query.search;
  const page = parseInt(req.query.page) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 1000);
  const offset = (page - 1) * pageSize;

  if (!accessKey) {
    return res.status(400).json({ error: '必须提供 accessKey' });
  }

  // 首先验证accessKey并获取物流商名称
  db.get('SELECT name FROM providers WHERE accessKey = ?', [accessKey], (err, providerRow) => {
    if (err) {
      console.error("Error fetching provider by accessKey:", err);
      return res.status(500).json({ error: '查询物流商信息失败' });
    }
    if (!providerRow) {
      return res.status(404).json({ error: '无效的 accessKey 或物流商不存在' });
    }
    const providerName = providerRow.name;

    let queryParams = [providerName];
    let countParams = [providerName];
    let whereClauses = ['q.provider = ?'];

    // 添加搜索过滤
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereClauses.push('(o.id LIKE ? OR o.warehouse LIKE ? OR o.goods LIKE ? OR o.deliveryAddress LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereString = ' WHERE ' + whereClauses.join(' AND ');
    let countQuery = `SELECT COUNT(*) as total FROM quotes q
                      JOIN orders o ON q.orderId = o.id` + whereString;

    let dataQuery = `SELECT q.*, o.warehouse as warehouse, o.goods, o.deliveryAddress as deliveryAddress, o.status as orderStatus,
                            CASE WHEN o.selectedProvider = q.provider THEN 1 ELSE 0 END as selected
                     FROM quotes q
                     JOIN orders o ON q.orderId = o.id` + whereString;

    dataQuery += ' ORDER BY q.createdAt DESC LIMIT ? OFFSET ?';
    queryParams.push(pageSize, offset);

    db.get(countQuery, countParams, (err, countRow) => {
      if (err) {
        console.error("Count query error (quote history):", err);
        return res.status(500).json({ error: '获取报价历史总数失败' });
      }
      const totalItems = countRow ? countRow.total : 0;
      const totalPages = Math.ceil(totalItems / pageSize);

      db.all(dataQuery, queryParams, (err, items) => {
        if (err) {
          console.error("Data query error (quote history):", err);
          return res.status(500).json({ error: '获取报价历史失败' });
        }
        res.json({
          items: items || [],
          totalItems,
          totalPages,
          currentPage: page,
          pageSize,
          providerName,
          hasSearch: !!search
        });
      });
    });
  });
});

module.exports = router;