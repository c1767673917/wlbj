/**
 * 用户数据访问层
 * 处理用户相关的数据库操作
 */

const BaseRepository = require('./BaseRepository');
const { logger } = require('../config/logger');
const bcrypt = require('bcryptjs');

class UserRepository extends BaseRepository {
  constructor() {
    super('users', 'id');
  }

  /**
   * 根据邮箱查找用户
   * @param {string} email - 用户邮箱
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 用户对象或null
   */
  async findByEmail(email, trx = null) {
    try {
      return await this.findOne({ email: email.toLowerCase() }, trx);
    } catch (error) {
      logger.error('根据邮箱查找用户失败', {
        email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 创建的用户对象
   */
  async createUser(userData, trx = null) {
    try {
      const { email, password, name, role = 'user' } = userData;

      // 检查邮箱是否已存在
      const existingUser = await this.findByEmail(email, trx);
      if (existingUser) {
        throw new Error('邮箱已被注册');
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = {
        id: this.generateUserId(),
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role,
        isActive: 1
      };

      const createdUser = await this.create(newUser, trx);
      
      // 返回用户信息时不包含密码
      const { password: _, ...userWithoutPassword } = createdUser;
      return userWithoutPassword;
    } catch (error) {
      logger.error('创建用户失败', {
        email: userData.email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 验证用户密码
   * @param {string} email - 用户邮箱
   * @param {string} password - 密码
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 验证成功返回用户对象，失败返回null
   */
  async validateUser(email, password, trx = null) {
    try {
      const user = await this.findByEmail(email, trx);
      if (!user) {
        return null;
      }

      // 检查用户是否激活
      if (!user.isActive) {
        throw new Error('用户账户已被禁用');
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return null;
      }

      // 返回用户信息时不包含密码
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      logger.error('验证用户失败', {
        email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 更新用户密码
   * @param {string} userId - 用户ID
   * @param {string} newPassword - 新密码
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updatePassword(userId, newPassword, trx = null) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      const updatedUser = await this.updateById(userId, {
        password: hashedPassword
      }, trx);

      return !!updatedUser;
    } catch (error) {
      logger.error('更新用户密码失败', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 更新用户信息
   * @param {string} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 更新后的用户对象
   */
  async updateUser(userId, updateData, trx = null) {
    try {
      // 过滤掉不允许直接更新的字段
      const { password, id, created_at, ...allowedData } = updateData;

      // 如果更新邮箱，需要检查是否重复
      if (allowedData.email) {
        allowedData.email = allowedData.email.toLowerCase();
        const existingUser = await this.findByEmail(allowedData.email, trx);
        if (existingUser && existingUser.id !== userId) {
          throw new Error('邮箱已被其他用户使用');
        }
      }

      const updatedUser = await this.updateById(userId, allowedData, trx);
      
      if (updatedUser) {
        // 返回用户信息时不包含密码
        const { password: _, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
      }

      return null;
    } catch (error) {
      logger.error('更新用户信息失败', {
        userId,
        updateData,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 激活/禁用用户
   * @param {string} userId - 用户ID
   * @param {boolean} isActive - 是否激活
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object|null>} 更新后的用户对象
   */
  async setUserActive(userId, isActive, trx = null) {
    try {
      const updatedUser = await this.updateById(userId, {
        isActive: isActive ? 1 : 0
      }, trx);

      if (updatedUser) {
        const { password: _, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
      }

      return null;
    } catch (error) {
      logger.error('设置用户状态失败', {
        userId,
        isActive,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 根据角色查找用户
   * @param {string} role - 用户角色
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 用户数组
   */
  async findByRole(role, options = {}, trx = null) {
    try {
      const {
        isActive = null,
        limit = null,
        offset = null,
        orderBy = [{ column: 'created_at', direction: 'desc' }]
      } = options;

      const conditions = { role };
      if (isActive !== null) {
        conditions.isActive = isActive ? 1 : 0;
      }

      const users = await this.findMany(conditions, {
        orderBy,
        limit,
        offset,
        select: ['id', 'email', 'name', 'role', 'isActive', 'created_at', 'updated_at']
      }, trx);

      return users;
    } catch (error) {
      logger.error('根据角色查找用户失败', {
        role,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取活跃用户列表
   * @param {Object} options - 查询选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 活跃用户数组
   */
  async getActiveUsers(options = {}, trx = null) {
    try {
      const {
        role = null,
        limit = null,
        offset = null,
        orderBy = [{ column: 'created_at', direction: 'desc' }]
      } = options;

      const conditions = { isActive: 1 };
      if (role) {
        conditions.role = role;
      }

      return await this.findMany(conditions, {
        orderBy,
        limit,
        offset,
        select: ['id', 'email', 'name', 'role', 'isActive', 'created_at', 'updated_at']
      }, trx);
    } catch (error) {
      logger.error('获取活跃用户列表失败', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 搜索用户
   * @param {string} searchTerm - 搜索关键词
   * @param {Object} options - 搜索选项
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 搜索结果
   */
  async searchUsers(searchTerm, options = {}, trx = null) {
    try {
      const {
        role = null,
        isActive = null,
        limit = 50,
        offset = 0
      } = options;

      let query = this.query(trx)
        .select(['id', 'email', 'name', 'role', 'isActive', 'created_at', 'updated_at'])
        .where(function() {
          this.where('email', 'like', `%${searchTerm}%`)
            .orWhere('name', 'like', `%${searchTerm}%`);
        });

      if (role) {
        query = query.where('role', role);
      }

      if (isActive !== null) {
        query = query.where('isActive', isActive ? 1 : 0);
      }

      return await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);
    } catch (error) {
      logger.error('搜索用户失败', {
        searchTerm,
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取用户统计信息
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Object>} 统计信息
   */
  async getUserStats(trx = null) {
    try {
      const stats = await this.query(trx)
        .select('role', 'isActive')
        .count('* as count')
        .groupBy('role', 'isActive');

      const result = {
        total: 0,
        active: 0,
        inactive: 0,
        byRole: {}
      };

      stats.forEach(stat => {
        const count = parseInt(stat.count, 10);
        result.total += count;
        
        if (stat.isActive) {
          result.active += count;
        } else {
          result.inactive += count;
        }

        if (!result.byRole[stat.role]) {
          result.byRole[stat.role] = { active: 0, inactive: 0, total: 0 };
        }
        
        if (stat.isActive) {
          result.byRole[stat.role].active += count;
        } else {
          result.byRole[stat.role].inactive += count;
        }
        result.byRole[stat.role].total += count;
      });

      return result;
    } catch (error) {
      logger.error('获取用户统计信息失败', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 生成用户ID
   * @returns {string} 用户ID
   */
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 检查邮箱是否可用
   * @param {string} email - 邮箱
   * @param {string} excludeUserId - 排除的用户ID（用于更新时检查）
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<boolean>} 是否可用
   */
  async isEmailAvailable(email, excludeUserId = null, trx = null) {
    try {
      const existingUser = await this.findByEmail(email, trx);
      
      if (!existingUser) {
        return true;
      }

      // 如果是更新操作，排除当前用户
      if (excludeUserId && existingUser.id === excludeUserId) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('检查邮箱可用性失败', {
        email,
        excludeUserId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取用于导出的用户数据
   * @param {Object} filters - 过滤条件
   * @param {Object} trx - 可选的事务对象
   * @returns {Promise<Array>} 用户数组
   */
  async findForExport(filters = {}, trx = null) {
    try {
      const {
        role = null,
        isActive = null,
        startDate = null,
        endDate = null
      } = filters;

      let query = this.query(trx)
        .select([
          'id',
          'email',
          'name',
          'role',
          'isActive',
          'created_at',
          'updated_at',
          'last_login_at'
        ]);

      if (role) {
        query = query.where('role', role);
      }

      if (isActive !== null) {
        query = query.where('isActive', isActive);
      }

      if (startDate && endDate) {
        query = query.whereBetween('created_at', [startDate, endDate]);
      } else if (startDate) {
        query = query.where('created_at', '>=', startDate);
      } else if (endDate) {
        query = query.where('created_at', '<=', endDate);
      }

      return await query.orderBy('created_at', 'desc');
    } catch (error) {
      logger.error('获取导出用户数据失败', {
        filters,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = UserRepository;
