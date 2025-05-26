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

module.exports = router;