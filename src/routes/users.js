/**
 * 用户相关路由
 * 处理用户信息管理功能
 */

const express = require('express');
const { auth, validation, security } = require('../middleware');
const { userController } = require('../controllers');

const router = express.Router();

// 获取用户个人信息
router.get('/profile',
  auth.authenticateToken,
  userController.getProfile
);

// 更新用户个人信息
router.patch('/profile',
  auth.authenticateToken,
  userController.updateProfile
);

// 管理员专用路由

// 获取所有用户列表（管理员）
router.get('/admin/all',
  auth.authenticateToken,
  auth.requireAdmin,
  validation.validatePagination,
  validation.validateSearch,
  userController.getAllUsers
);

// 获取用户详情（管理员）
router.get('/admin/:id',
  auth.authenticateToken,
  auth.requireAdmin,
  userController.getUserById
);

// 更新用户状态（管理员）
router.patch('/admin/:id/status',
  auth.authenticateToken,
  auth.requireAdmin,
  userController.updateUserStatus
);

// 重置用户密码（管理员）
router.post('/admin/:id/reset-password',
  auth.authenticateToken,
  auth.requireAdmin,
  userController.resetUserPassword
);

// 获取用户统计信息（管理员）
router.get('/admin/stats',
  auth.authenticateToken,
  auth.requireAdmin,
  userController.getUserStats
);

module.exports = router;
