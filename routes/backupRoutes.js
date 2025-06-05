const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { body, validationResult } = require('express-validator');
const logger = require('../config/logger');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 获取备份配置
router.get('/config', (req, res) => {
  db.get('SELECT * FROM backup_config WHERE id = 1', (err, row) => {
    if (err) {
      logger.error('获取备份配置失败:', err.message);
      return res.status(500).json({ error: '获取备份配置失败' });
    }

    if (!row) {
      // 如果没有配置，返回默认配置
      return res.json({
        id: 1,
        qiniu_access_key: '',
        qiniu_secret_key: '',
        qiniu_bucket: '',
        qiniu_zone: 'z0',
        backup_frequency: 'daily',
        auto_backup_enabled: false,
        last_backup_time: null,
        last_backup_status: null,
        last_backup_size: null,
        retention_days: 30,
        wechat_webhook_url: '',
        notification_enabled: true
      });
    }

    // 隐藏敏感信息
    const config = {
      ...row,
      qiniu_secret_key: row.qiniu_secret_key ? '***已配置***' : '',
      auto_backup_enabled: Boolean(row.auto_backup_enabled),
      notification_enabled: Boolean(row.notification_enabled)
    };

    res.json(config);
  });
});

// 更新备份配置
router.put('/config', [
  body('qiniu_access_key').optional().isLength({ min: 1 }).withMessage('AccessKey不能为空'),
  body('qiniu_bucket').optional().isLength({ min: 1 }).withMessage('存储空间名称不能为空'),
  body('qiniu_zone').isIn(['z0', 'z1', 'z2', 'na0', 'as0']).withMessage('存储区域无效'),
  body('backup_frequency').isIn(['hourly', 'daily', 'weekly']).withMessage('备份频率无效'),
  body('retention_days').isInt({ min: 1, max: 365 }).withMessage('保留天数必须在1-365之间'),
  body('auto_backup_enabled').isBoolean().withMessage('自动备份设置无效'),
  body('notification_enabled').isBoolean().withMessage('通知设置无效')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    qiniu_access_key,
    qiniu_secret_key,
    qiniu_bucket,
    qiniu_zone,
    backup_frequency,
    auto_backup_enabled,
    retention_days,
    wechat_webhook_url,
    notification_enabled
  } = req.body;

  // 构建更新SQL
  let updateFields = [];
  let updateValues = [];

  if (qiniu_access_key !== undefined) {
    updateFields.push('qiniu_access_key = ?');
    updateValues.push(qiniu_access_key);
  }

  if (qiniu_secret_key !== undefined && qiniu_secret_key !== '***已配置***') {
    updateFields.push('qiniu_secret_key = ?');
    updateValues.push(qiniu_secret_key);
  }

  if (qiniu_bucket !== undefined) {
    updateFields.push('qiniu_bucket = ?');
    updateValues.push(qiniu_bucket);
  }

  updateFields.push('qiniu_zone = ?', 'backup_frequency = ?', 'auto_backup_enabled = ?', 
                   'retention_days = ?', 'notification_enabled = ?', 'updated_at = ?');
  updateValues.push(qiniu_zone, backup_frequency, auto_backup_enabled ? 1 : 0, 
                   retention_days, notification_enabled ? 1 : 0, new Date().toISOString());

  if (wechat_webhook_url !== undefined) {
    updateFields.push('wechat_webhook_url = ?');
    updateValues.push(wechat_webhook_url);
  }

  const sql = `UPDATE backup_config SET ${updateFields.join(', ')} WHERE id = 1`;

  db.run(sql, updateValues, function(err) {
    if (err) {
      logger.error('更新备份配置失败:', err.message);
      return res.status(500).json({ error: '更新备份配置失败' });
    }

    if (this.changes === 0) {
      // 如果没有更新任何行，说明配置不存在，需要插入
      const now = new Date().toISOString();
      const insertSql = `
        INSERT INTO backup_config (
          qiniu_access_key, qiniu_secret_key, qiniu_bucket, qiniu_zone,
          backup_frequency, auto_backup_enabled, retention_days,
          wechat_webhook_url, notification_enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.run(insertSql, [
        qiniu_access_key || '', qiniu_secret_key || '', qiniu_bucket || '', qiniu_zone,
        backup_frequency, auto_backup_enabled ? 1 : 0, retention_days,
        wechat_webhook_url || '', notification_enabled ? 1 : 0, now, now
      ], (err) => {
        if (err) {
          logger.error('创建备份配置失败:', err.message);
          return res.status(500).json({ error: '创建备份配置失败' });
        }
        
        logger.info('备份配置创建成功');
        res.json({ message: '备份配置保存成功' });
      });
    } else {
      logger.info('备份配置更新成功');
      res.json({ message: '备份配置保存成功' });
    }
  });
});

// 测试七牛云连接
router.post('/test-connection', (req, res) => {
  db.get('SELECT qiniu_access_key, qiniu_secret_key, qiniu_bucket FROM backup_config WHERE id = 1', (err, row) => {
    if (err || !row || !row.qiniu_access_key || !row.qiniu_secret_key || !row.qiniu_bucket) {
      return res.status(400).json({ error: '请先配置七牛云参数' });
    }

    // 创建临时配置文件
    const tempConfigPath = path.join(__dirname, '../temp_qiniu_config.json');
    const config = {
      access_key: row.qiniu_access_key,
      secret_key: row.qiniu_secret_key,
      bucket: row.qiniu_bucket
    };

    fs.writeFileSync(tempConfigPath, JSON.stringify(config));

    // 执行测试脚本
    const testScript = path.join(__dirname, '../scripts/test-qiniu-connection.js');
    const child = spawn('node', [testScript, tempConfigPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      // 清理临时文件
      try {
        fs.unlinkSync(tempConfigPath);
      } catch (e) {
        // 忽略清理错误
      }

      if (code === 0) {
        res.json({ success: true, message: '七牛云连接测试成功' });
      } else {
        logger.error('七牛云连接测试失败:', errorOutput);
        res.status(400).json({ 
          success: false, 
          error: '七牛云连接测试失败',
          details: errorOutput || output
        });
      }
    });
  });
});

// 手动执行备份
router.post('/execute', (req, res) => {
  db.get('SELECT * FROM backup_config WHERE id = 1', (err, row) => {
    if (err || !row || !row.qiniu_access_key || !row.qiniu_secret_key || !row.qiniu_bucket) {
      return res.status(400).json({ error: '请先配置七牛云参数' });
    }

    // 更新备份状态为进行中
    const now = new Date().toISOString();
    db.run(
      'UPDATE backup_config SET last_backup_time = ?, last_backup_status = ? WHERE id = 1',
      [now, 'running'],
      (err) => {
        if (err) {
          logger.error('更新备份状态失败:', err.message);
        }
      }
    );

    // 执行备份脚本
    const backupScript = path.join(__dirname, '../scripts/qiniu-backup.js');
    const child = spawn('node', [backupScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        QINIU_ACCESS_KEY: row.qiniu_access_key,
        QINIU_SECRET_KEY: row.qiniu_secret_key,
        QINIU_BUCKET: row.qiniu_bucket,
        QINIU_ZONE: row.qiniu_zone,
        WECHAT_WEBHOOK_URL: row.wechat_webhook_url || ''
      }
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      const status = code === 0 ? 'success' : 'failed';
      const backupSize = extractBackupSize(output);
      
      // 更新备份结果
      db.run(
        'UPDATE backup_config SET last_backup_status = ?, last_backup_size = ? WHERE id = 1',
        [status, backupSize],
        (err) => {
          if (err) {
            logger.error('更新备份结果失败:', err.message);
          }
        }
      );

      if (code === 0) {
        logger.info('手动备份执行成功');
        res.json({ 
          success: true, 
          message: '备份执行成功',
          size: backupSize
        });
      } else {
        logger.error('手动备份执行失败:', errorOutput);
        res.status(500).json({ 
          success: false, 
          error: '备份执行失败',
          details: errorOutput || output
        });
      }
    });

    // 立即返回响应，备份在后台执行
    res.json({ message: '备份任务已启动，请稍后查看结果' });
  });
});

// 获取备份历史
router.get('/history', (req, res) => {
  // 这里可以扩展为从日志文件或专门的历史表中获取备份历史
  db.get('SELECT last_backup_time, last_backup_status, last_backup_size FROM backup_config WHERE id = 1', (err, row) => {
    if (err) {
      logger.error('获取备份历史失败:', err.message);
      return res.status(500).json({ error: '获取备份历史失败' });
    }

    const history = [];
    if (row && row.last_backup_time) {
      history.push({
        time: row.last_backup_time,
        status: row.last_backup_status,
        size: row.last_backup_size
      });
    }

    res.json(history);
  });
});

// 辅助函数：从输出中提取备份大小
function extractBackupSize(output) {
  const sizeMatch = output.match(/备份大小[：:]\s*([^\n\r]+)/);
  return sizeMatch ? sizeMatch[1].trim() : null;
}

module.exports = router;
