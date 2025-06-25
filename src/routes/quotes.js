/**
 * 报价相关路由
 * 处理供应商报价的提交和查询功能
 */

const express = require('express');
const { auth, validation, security } = require('../middleware');
const { quoteController } = require('../controllers');

const router = express.Router();

// 供应商提交报价
router.post('/orders/:orderId',
  auth.authenticateProvider,
  validation.validateQuoteSubmission,
  quoteController.submitQuote
);

// 获取订单的所有报价（用户查看）
router.get('/orders/:orderId',
  auth.authenticateToken,
  validation.validateOrderId,
  validation.validateSorting,
  quoteController.getQuotesByOrderId
);

// 获取报价详情
router.get('/:id',
  auth.authenticateToken,
  quoteController.getQuoteById
);

// 用户选择报价
router.post('/:id/select',
  auth.authenticateToken,
  quoteController.selectQuote
);

// 供应商更新报价
router.patch('/:id',
  auth.authenticateProvider,
  quoteController.updateQuote
);

// 供应商撤回报价
router.delete('/:id',
  auth.authenticateProvider,
  quoteController.withdrawQuote
);

// 管理员专用路由

// 获取所有报价（管理员）
router.get('/admin/all',
  auth.authenticateToken,
  auth.requireAdmin,
  validation.validatePagination,
  validation.validateSorting,
  quoteController.getAllQuotes
);

// 获取报价统计信息（管理员）
router.get('/admin/stats',
  auth.authenticateToken,
  auth.requireAdmin,
  quoteController.getQuoteStatsAdmin
);

module.exports = router;
