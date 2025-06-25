/**
 * 订单相关路由
 * 处理订单的创建、查询、更新等功能
 */

const express = require('express');
const { auth, validation, security } = require('../middleware');
const { orderController } = require('../controllers');

const router = express.Router();

// 获取订单列表（用户自己的订单）
router.get('/',
  auth.authenticateToken,
  validation.validatePagination,
  validation.validateSearch,
  validation.validateSorting,
  orderController.getUserOrders
);

// 创建订单
router.post('/',
  auth.authenticateToken,
  validation.validateOrderCreation,
  orderController.createOrder
);

// 获取订单详情
router.get('/:id',
  auth.authenticateToken,
  validation.validateOrderId,
  orderController.getOrderById
);

// 更新订单状态
router.patch('/:id/status',
  auth.authenticateToken,
  validation.validateOrderId,
  orderController.updateOrderStatus
);

// 删除订单
router.delete('/:id',
  auth.authenticateToken,
  validation.validateOrderId,
  orderController.deleteOrder
);

// 管理员专用路由

// 获取所有待处理订单（管理员）
router.get('/admin/pending',
  auth.authenticateToken,
  auth.requireAdmin,
  validation.validatePagination,
  orderController.getPendingOrders
);

// 批量操作订单（管理员）
router.post('/admin/batch',
  auth.authenticateToken,
  auth.requireAdmin,
  orderController.batchOperateOrders
);

// 导出订单数据（管理员）
router.get('/admin/export',
  auth.authenticateToken,
  auth.requireAdmin,
  orderController.exportOrders
);

// 获取订单统计信息（管理员）
router.get('/admin/stats',
  auth.authenticateToken,
  auth.requireAdmin,
  orderController.getOrderStats
);

module.exports = router;
