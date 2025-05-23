const express = require('express');
const router = express.Router();
const config = require('../config/env');
const logger = require('../config/logger');

// AI识别订单信息的端点
router.post('/recognize', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ 
        error: '请提供有效的物流信息内容' 
      });
    }
    
    if (!config.siliconFlowApiKey) {
      logger.error('SiliconFlow API密钥未配置');
      return res.status(500).json({ 
        error: 'AI服务配置错误，请联系管理员' 
      });
    }
    
    const startTime = Date.now();
    
    // 动态导入node-fetch
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.siliconFlowApiKey}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3-14B',
        messages: [
          {
            role: 'system',
            content: '你是一个物流信息提取专家。你需要从用户输入的文本中识别并提取以下信息：\n1. 发货仓库\n2. 货物信息(包括品名和数量)\n3. 收货信息(完整保留地址、联系人、电话、以及所有收货要求等)\n\n请以JSON格式返回结果，格式为{"warehouse": "提取的发货仓库", "goods": "提取的货物信息", "deliveryAddress": "提取的收货信息，包括完整地址、联系人、电话和所有收货要求，尽量保留原文"}'
          },
          {
            role: 'user',
            content: content
          }
        ],
        temperature: 0.2,
        enable_thinking: false
      })
    });

    const endTime = Date.now();
    const timeElapsed = (endTime - startTime) / 1000;
    
    if (!response.ok) {
      logger.error(`SiliconFlow API请求失败: ${response.status} ${response.statusText}`);
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    
    logger.info(`AI识别完成，耗时: ${timeElapsed.toFixed(2)}秒`);
    
    // 返回识别结果
    res.json({
      success: true,
      data: data,
      timeElapsed: timeElapsed
    });

  } catch (error) {
    logger.error('AI识别过程中出错:', { 
      message: error.message, 
      stack: error.stack 
    });
    
    res.status(500).json({ 
      error: '服务器内部错误，请稍后重试',
      success: false
    });
  }
});

module.exports = router; 