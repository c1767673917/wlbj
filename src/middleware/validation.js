/**
 * 输入验证中间件
 * 提供通用的输入验证逻辑和规则
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * 处理验证结果的中间件
 * 检查验证错误并返回统一的错误响应
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - Express下一个中间件函数
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      details: errors.array()
    });
  }
  next();
};

/**
 * 用户注册验证规则
 */
const validateUserRegistration = [
  body('email')
    .isEmail()
    .withMessage('邮箱格式无效')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('密码长度至少8位')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('密码必须包含大小写字母、数字和特殊字符'),
  body('username')
    .isLength({ min: 2, max: 50 })
    .withMessage('用户名长度必须在2-50字符之间')
    .trim(),
  handleValidationErrors
];

/**
 * 用户登录验证规则
 */
const validateUserLogin = [
  body('email')
    .isEmail()
    .withMessage('邮箱格式无效')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('密码不能为空'),
  handleValidationErrors
];

/**
 * 密码修改验证规则
 */
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('当前密码不能为空'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('新密码长度至少8位')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('新密码必须包含大小写字母、数字和特殊字符'),
  handleValidationErrors
];

/**
 * 订单创建验证规则
 */
const validateOrderCreation = [
  body('warehouse')
    .notEmpty()
    .withMessage('仓库信息不能为空')
    .isLength({ min: 2, max: 100 })
    .withMessage('仓库名称长度必须在2-100字符之间')
    .trim(),
  body('goods')
    .notEmpty()
    .withMessage('货物信息不能为空')
    .isLength({ min: 2, max: 500 })
    .withMessage('货物描述长度必须在2-500字符之间')
    .trim(),
  body('deliveryAddress')
    .notEmpty()
    .withMessage('配送地址不能为空')
    .isLength({ min: 5, max: 200 })
    .withMessage('配送地址长度必须在5-200字符之间')
    .trim(),
  handleValidationErrors
];

/**
 * 订单ID验证规则
 */
const validateOrderId = [
  param('id')
    .matches(/^ORD-\d{8}-\d{3}$/)
    .withMessage('订单ID格式无效'),
  handleValidationErrors
];

/**
 * 报价提交验证规则
 */
const validateQuoteSubmission = [
  param('orderId')
    .matches(/^ORD-\d{8}-\d{3}$/)
    .withMessage('订单ID格式无效'),
  body('price')
    .isNumeric()
    .withMessage('价格格式无效')
    .custom(value => {
      if (parseFloat(value) <= 0) {
        throw new Error('价格必须大于0');
      }
      return true;
    }),
  body('estimatedDelivery')
    .isISO8601()
    .withMessage('日期格式无效')
    .custom(value => {
      const deliveryDate = new Date(value);
      if (deliveryDate <= new Date()) {
        throw new Error('预计送达时间必须晚于当前时间');
      }
      return true;
    }),
  body('remarks')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('备注长度不能超过1000字符')
    .trim(),
  handleValidationErrors
];

/**
 * 分页参数验证规则
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('页码必须是大于0的整数'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('每页数量必须是1-100之间的整数'),
  handleValidationErrors
];

/**
 * 搜索参数验证规则
 */
const validateSearch = [
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('搜索关键词长度必须在1-100字符之间')
    .trim(),
  query('status')
    .optional()
    .isIn(['active', 'completed', 'cancelled'])
    .withMessage('状态值无效'),
  handleValidationErrors
];

/**
 * 排序参数验证规则
 */
const validateSorting = [
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'status', 'price'])
    .withMessage('排序字段无效'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('排序方向无效'),
  handleValidationErrors
];

/**
 * 通用字段长度验证
 * @param {string} field - 字段名
 * @param {number} min - 最小长度
 * @param {number} max - 最大长度
 * @returns {Array} 验证规则数组
 */
const validateFieldLength = (field, min, max) => [
  body(field)
    .isLength({ min, max })
    .withMessage(`${field}长度必须在${min}-${max}字符之间`)
    .trim(),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validatePasswordChange,
  validateOrderCreation,
  validateOrderId,
  validateQuoteSubmission,
  validatePagination,
  validateSearch,
  validateSorting,
  validateFieldLength
};
