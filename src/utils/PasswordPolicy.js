/**
 * 密码策略管理工具
 * 提供强密码验证、密码历史记录、定期更换提醒等功能
 */

const bcrypt = require('bcryptjs');
const { logger } = require('../config/logger');

class PasswordPolicy {
  constructor() {
    // 密码策略配置
    this.config = {
      minLength: 12, // 最小长度增加到12位
      maxLength: 128, // 最大长度
      requireUppercase: true, // 需要大写字母
      requireLowercase: true, // 需要小写字母
      requireNumbers: true, // 需要数字
      requireSpecialChars: true, // 需要特殊字符
      minSpecialChars: 2, // 最少特殊字符数量
      forbiddenPatterns: [
        /(.)\1{2,}/, // 禁止连续相同字符（3个或以上）
        /123456|654321|abcdef|qwerty|password|admin|root/i, // 常见弱密码模式
        /^[a-zA-Z]+$/, // 纯字母
        /^[0-9]+$/, // 纯数字
        /^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/ // 纯特殊字符
      ],
      passwordHistoryCount: 5, // 记住最近5个密码
      passwordExpiryDays: 90, // 密码90天过期
      warningDays: 7, // 过期前7天开始警告
      maxFailedAttempts: 5, // 最大失败尝试次数
      lockoutDuration: 30 * 60 * 1000, // 锁定30分钟
      specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };

    // 密码强度等级
    this.strengthLevels = {
      VERY_WEAK: 0,
      WEAK: 1,
      FAIR: 2,
      GOOD: 3,
      STRONG: 4,
      VERY_STRONG: 5
    };
  }

  /**
   * 验证密码强度
   * @param {string} password - 密码
   * @param {Object} userInfo - 用户信息（用于检查个人信息）
   * @returns {Object} 验证结果
   */
  validatePassword(password, userInfo = {}) {
    const result = {
      isValid: false,
      strength: this.strengthLevels.VERY_WEAK,
      score: 0,
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (!password || typeof password !== 'string') {
      result.errors.push('密码不能为空');
      return result;
    }

    // 基本长度检查
    if (password.length < this.config.minLength) {
      result.errors.push(`密码长度至少需要${this.config.minLength}个字符`);
    }

    if (password.length > this.config.maxLength) {
      result.errors.push(`密码长度不能超过${this.config.maxLength}个字符`);
    }

    // 字符类型检查
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = new RegExp(`[${this.escapeRegex(this.config.specialChars)}]`).test(password);
    const specialCharCount = (password.match(new RegExp(`[${this.escapeRegex(this.config.specialChars)}]`, 'g')) || []).length;

    if (this.config.requireUppercase && !hasUppercase) {
      result.errors.push('密码必须包含至少一个大写字母');
    }

    if (this.config.requireLowercase && !hasLowercase) {
      result.errors.push('密码必须包含至少一个小写字母');
    }

    if (this.config.requireNumbers && !hasNumbers) {
      result.errors.push('密码必须包含至少一个数字');
    }

    if (this.config.requireSpecialChars && !hasSpecialChars) {
      result.errors.push(`密码必须包含至少一个特殊字符 (${this.config.specialChars})`);
    }

    if (specialCharCount < this.config.minSpecialChars) {
      result.errors.push(`密码必须包含至少${this.config.minSpecialChars}个特殊字符`);
    }

    // 禁止模式检查
    for (const pattern of this.config.forbiddenPatterns) {
      if (pattern.test(password)) {
        result.errors.push('密码包含不安全的模式，请使用更复杂的密码');
        break;
      }
    }

    // 个人信息检查
    if (userInfo.name && password.toLowerCase().includes(userInfo.name.toLowerCase())) {
      result.errors.push('密码不能包含用户名');
    }

    if (userInfo.email) {
      const emailParts = userInfo.email.split('@')[0];
      if (password.toLowerCase().includes(emailParts.toLowerCase())) {
        result.errors.push('密码不能包含邮箱地址的一部分');
      }
    }

    // 计算密码强度分数
    result.score = this.calculatePasswordScore(password);
    result.strength = this.getStrengthLevel(result.score);

    // 生成建议
    result.suggestions = this.generateSuggestions(password, result);

    // 如果没有错误，则密码有效
    result.isValid = result.errors.length === 0 && result.strength >= this.strengthLevels.GOOD;

    return result;
  }

  /**
   * 计算密码强度分数
   * @param {string} password - 密码
   * @returns {number} 分数 (0-100)
   */
  calculatePasswordScore(password) {
    let score = 0;

    // 长度分数 (最多30分)
    score += Math.min(password.length * 2, 30);

    // 字符类型多样性 (最多40分)
    const charTypes = [
      /[a-z]/.test(password), // 小写字母
      /[A-Z]/.test(password), // 大写字母
      /[0-9]/.test(password), // 数字
      new RegExp(`[${this.escapeRegex(this.config.specialChars)}]`).test(password) // 特殊字符
    ];
    score += charTypes.filter(Boolean).length * 10;

    // 字符分布 (最多20分)
    const uniqueChars = new Set(password).size;
    score += Math.min(uniqueChars * 2, 20);

    // 复杂模式 (最多10分)
    if (password.length >= 16) score += 5;
    if (/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/.test(password)) score += 5;

    return Math.min(score, 100);
  }

  /**
   * 获取强度等级
   * @param {number} score - 分数
   * @returns {number} 强度等级
   */
  getStrengthLevel(score) {
    if (score >= 90) return this.strengthLevels.VERY_STRONG;
    if (score >= 75) return this.strengthLevels.STRONG;
    if (score >= 60) return this.strengthLevels.GOOD;
    if (score >= 40) return this.strengthLevels.FAIR;
    if (score >= 20) return this.strengthLevels.WEAK;
    return this.strengthLevels.VERY_WEAK;
  }

  /**
   * 生成密码改进建议
   * @param {string} password - 密码
   * @param {Object} result - 验证结果
   * @returns {Array} 建议列表
   */
  generateSuggestions(password, result) {
    const suggestions = [];

    if (password.length < 16) {
      suggestions.push('考虑使用更长的密码（16个字符或以上）');
    }

    if (result.score < 75) {
      suggestions.push('增加密码的复杂性，混合使用不同类型的字符');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      suggestions.push('添加更多特殊字符以增强安全性');
    }

    const uniqueChars = new Set(password).size;
    if (uniqueChars < password.length * 0.7) {
      suggestions.push('避免重复字符，使用更多不同的字符');
    }

    return suggestions;
  }

  /**
   * 生成强密码
   * @param {number} length - 密码长度
   * @returns {string} 生成的密码
   */
  generateStrongPassword(length = 16) {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const specialChars = this.config.specialChars;

    let password = '';
    let charPool = '';

    // 确保包含每种类型的字符
    password += this.getRandomChar(lowercase);
    password += this.getRandomChar(uppercase);
    password += this.getRandomChar(numbers);
    password += this.getRandomChar(specialChars);

    // 构建字符池
    charPool = lowercase + uppercase + numbers + specialChars;

    // 填充剩余长度
    for (let i = password.length; i < length; i++) {
      password += this.getRandomChar(charPool);
    }

    // 打乱密码字符顺序
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * 检查密码是否需要更新
   * @param {Date} lastPasswordChange - 上次密码更改时间
   * @returns {Object} 检查结果
   */
  checkPasswordExpiry(lastPasswordChange) {
    if (!lastPasswordChange) {
      return {
        isExpired: true,
        daysUntilExpiry: 0,
        shouldWarn: true,
        message: '密码从未更改，请立即更新密码'
      };
    }

    const now = new Date();
    const changeDate = new Date(lastPasswordChange);
    const daysSinceChange = Math.floor((now - changeDate) / (1000 * 60 * 60 * 24));
    const daysUntilExpiry = this.config.passwordExpiryDays - daysSinceChange;

    const isExpired = daysUntilExpiry <= 0;
    const shouldWarn = daysUntilExpiry <= this.config.warningDays && daysUntilExpiry > 0;

    let message = '';
    if (isExpired) {
      message = `密码已过期${Math.abs(daysUntilExpiry)}天，请立即更新`;
    } else if (shouldWarn) {
      message = `密码将在${daysUntilExpiry}天后过期，建议尽快更新`;
    }

    return {
      isExpired,
      daysUntilExpiry,
      shouldWarn,
      message,
      daysSinceChange
    };
  }

  /**
   * 验证密码历史
   * @param {string} newPassword - 新密码
   * @param {Array} passwordHistory - 密码历史记录（已哈希）
   * @returns {Promise<boolean>} 是否与历史密码重复
   */
  async checkPasswordHistory(newPassword, passwordHistory = []) {
    if (!passwordHistory || passwordHistory.length === 0) {
      return false;
    }

    for (const oldPasswordHash of passwordHistory) {
      const isMatch = await bcrypt.compare(newPassword, oldPasswordHash);
      if (isMatch) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取随机字符
   * @param {string} chars - 字符集
   * @returns {string} 随机字符
   */
  getRandomChar(chars) {
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }

  /**
   * 转义正则表达式特殊字符
   * @param {string} string - 字符串
   * @returns {string} 转义后的字符串
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 获取密码强度描述
   * @param {number} strength - 强度等级
   * @returns {string} 描述
   */
  getStrengthDescription(strength) {
    const descriptions = {
      [this.strengthLevels.VERY_WEAK]: '非常弱',
      [this.strengthLevels.WEAK]: '弱',
      [this.strengthLevels.FAIR]: '一般',
      [this.strengthLevels.GOOD]: '良好',
      [this.strengthLevels.STRONG]: '强',
      [this.strengthLevels.VERY_STRONG]: '非常强'
    };
    return descriptions[strength] || '未知';
  }
}

module.exports = new PasswordPolicy();
