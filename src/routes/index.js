/**
 * 主路由文件
 * 统一管理所有API路由
 */

const express = require('express');
const authRoutes = require('./auth');
const orderRoutes = require('./orders');
const quoteRoutes = require('./quotes');
const userRoutes = require('./users');

const router = express.Router();

// 认证相关路由
router.use('/auth', authRoutes);

// 订单相关路由
router.use('/orders', orderRoutes);

// 报价相关路由
router.use('/quotes', quoteRoutes);

// 用户相关路由
router.use('/users', userRoutes);

module.exports = router;
