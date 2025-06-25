/**
 * 数据库索引管理器
 * 优化数据库索引创建的竞态条件问题
 * 使用事务和锁机制确保索引创建的原子性
 */

const { db, transactionManager } = require('../config/database');
const { logger } = require('../config/logger');
const { lockManager, LOCK_KEYS } = require('./LockManager');

class IndexManager {
  constructor() {
    this.indexDefinitions = new Map();
    this.createdIndexes = new Set();
    this.initializeIndexDefinitions();
  }

  /**
   * 初始化索引定义
   */
  initializeIndexDefinitions() {
    // 用户表索引
    this.addIndexDefinition('idx_users_email', {
      table: 'users',
      columns: ['email'],
      unique: true,
      description: '用户邮箱唯一索引，用于登录查询'
    });

    this.addIndexDefinition('idx_users_role', {
      table: 'users',
      columns: ['role'],
      description: '用户角色索引，用于权限查询'
    });

    this.addIndexDefinition('idx_users_active', {
      table: 'users',
      columns: ['isActive'],
      description: '用户状态索引，用于筛选活跃用户'
    });

    // 订单表索引
    this.addIndexDefinition('idx_orders_status', {
      table: 'orders',
      columns: ['status'],
      description: '订单状态索引，用于状态筛选'
    });

    this.addIndexDefinition('idx_orders_created_at', {
      table: 'orders',
      columns: ['createdAt'],
      order: 'DESC',
      description: '订单创建时间索引，用于时间排序'
    });

    this.addIndexDefinition('idx_orders_user_id', {
      table: 'orders',
      columns: ['userId'],
      description: '订单用户ID索引，用于数据隔离'
    });

    this.addIndexDefinition('idx_orders_user_status', {
      table: 'orders',
      columns: ['userId', 'status'],
      description: '订单用户状态复合索引，优化用户订单查询'
    });

    // 报价表索引
    this.addIndexDefinition('idx_quotes_order_id', {
      table: 'quotes',
      columns: ['orderId'],
      description: '报价订单ID索引，用于订单报价查询'
    });

    this.addIndexDefinition('idx_quotes_order_provider', {
      table: 'quotes',
      columns: ['orderId', 'provider'],
      unique: true,
      description: '报价订单供应商复合唯一索引，防止重复报价'
    });

    this.addIndexDefinition('idx_quotes_price', {
      table: 'quotes',
      columns: ['price'],
      description: '报价价格索引，用于价格排序'
    });

    // 物流公司表索引
    this.addIndexDefinition('idx_providers_access_key', {
      table: 'providers',
      columns: ['accessKey'],
      unique: true,
      description: '物流公司访问密钥唯一索引'
    });

    this.addIndexDefinition('idx_providers_active', {
      table: 'providers',
      columns: ['isActive'],
      description: '物流公司状态索引'
    });

    // 序列表索引
    this.addIndexDefinition('idx_order_sequences_date', {
      table: 'order_sequences',
      columns: ['date'],
      unique: true,
      description: '订单序列日期唯一索引'
    });
  }

  /**
   * 添加索引定义
   * @param {string} name - 索引名称
   * @param {Object} definition - 索引定义
   */
  addIndexDefinition(name, definition) {
    this.indexDefinitions.set(name, {
      name,
      ...definition,
      created: false
    });
  }

  /**
   * 创建所有索引
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 创建结果
   */
  async createAllIndexes(options = {}) {
    const { 
      force = false, 
      parallel = false, 
      skipExisting = true 
    } = options;

    const lockKey = 'index_creation_global';
    
    return await lockManager.withLock(lockKey, async () => {
      const results = {
        created: [],
        skipped: [],
        failed: [],
        total: this.indexDefinitions.size
      };

      logger.info('开始创建数据库索引', { 
        total: results.total, 
        force, 
        parallel 
      });

      if (parallel) {
        // 并行创建（谨慎使用）
        const promises = Array.from(this.indexDefinitions.values()).map(
          indexDef => this.createSingleIndex(indexDef, { force, skipExisting })
            .then(result => ({ ...result, indexName: indexDef.name }))
            .catch(error => ({ 
              success: false, 
              error: error.message, 
              indexName: indexDef.name 
            }))
        );

        const parallelResults = await Promise.all(promises);
        
        parallelResults.forEach(result => {
          if (result.success) {
            if (result.created) {
              results.created.push(result.indexName);
            } else {
              results.skipped.push(result.indexName);
            }
          } else {
            results.failed.push({ name: result.indexName, error: result.error });
          }
        });
      } else {
        // 串行创建（推荐）
        for (const indexDef of this.indexDefinitions.values()) {
          try {
            const result = await this.createSingleIndex(indexDef, { force, skipExisting });
            
            if (result.created) {
              results.created.push(indexDef.name);
            } else {
              results.skipped.push(indexDef.name);
            }
          } catch (error) {
            results.failed.push({ name: indexDef.name, error: error.message });
            logger.error('索引创建失败', { 
              indexName: indexDef.name, 
              error: error.message 
            });
          }
        }
      }

      logger.info('索引创建完成', results);
      return results;
    }, {
      timeout: 300000, // 5分钟超时
      maxWait: 10000
    });
  }

  /**
   * 创建单个索引
   * @param {Object} indexDef - 索引定义
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 创建结果
   */
  async createSingleIndex(indexDef, options = {}) {
    const { force = false, skipExisting = true } = options;
    const { name, table, columns, unique = false, order } = indexDef;

    return await transactionManager.executeWithRetry(async (trx) => {
      // 检查索引是否已存在
      if (!force && skipExisting) {
        const exists = await this.indexExists(name, trx);
        if (exists) {
          logger.debug('索引已存在，跳过创建', { indexName: name });
          this.createdIndexes.add(name);
          return { success: true, created: false, exists: true };
        }
      }

      // 检查表是否存在
      const tableExists = await trx.schema.hasTable(table);
      if (!tableExists) {
        throw new Error(`表 ${table} 不存在`);
      }

      // 构建索引创建SQL
      const sql = this.buildIndexSQL(indexDef);
      
      logger.debug('创建索引', { indexName: name, sql });
      
      // 执行索引创建
      await trx.raw(sql);
      
      this.createdIndexes.add(name);
      
      logger.info('索引创建成功', { 
        indexName: name, 
        table, 
        columns: columns.join(', '),
        unique 
      });

      return { success: true, created: true, exists: false };
    });
  }

  /**
   * 构建索引创建SQL
   * @param {Object} indexDef - 索引定义
   * @returns {string} SQL语句
   */
  buildIndexSQL(indexDef) {
    const { name, table, columns, unique = false, order, where } = indexDef;
    
    let sql = `CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${name} ON ${table}`;
    
    // 添加列定义
    const columnDefs = columns.map(col => {
      if (typeof col === 'string') {
        return order ? `${col} ${order}` : col;
      }
      return col;
    });
    
    sql += ` (${columnDefs.join(', ')})`;
    
    // 添加WHERE条件（部分索引）
    if (where) {
      sql += ` WHERE ${where}`;
    }
    
    return sql;
  }

  /**
   * 检查索引是否存在
   * @param {string} indexName - 索引名称
   * @param {Object} trx - 事务对象
   * @returns {Promise<boolean>} 是否存在
   */
  async indexExists(indexName, trx = db) {
    try {
      const result = await trx.raw(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name = ?
      `, [indexName]);
      
      return result && result.length > 0;
    } catch (error) {
      logger.error('检查索引存在性失败', { indexName, error: error.message });
      return false;
    }
  }

  /**
   * 删除索引
   * @param {string} indexName - 索引名称
   * @returns {Promise<boolean>} 是否成功
   */
  async dropIndex(indexName) {
    const lockKey = `index_drop_${indexName}`;
    
    return await lockManager.withLock(lockKey, async () => {
      try {
        await db.raw(`DROP INDEX IF EXISTS ${indexName}`);
        this.createdIndexes.delete(indexName);
        
        logger.info('索引删除成功', { indexName });
        return true;
      } catch (error) {
        logger.error('索引删除失败', { indexName, error: error.message });
        return false;
      }
    });
  }

  /**
   * 重建索引
   * @param {string} indexName - 索引名称
   * @returns {Promise<boolean>} 是否成功
   */
  async rebuildIndex(indexName) {
    const indexDef = this.indexDefinitions.get(indexName);
    if (!indexDef) {
      throw new Error(`未找到索引定义: ${indexName}`);
    }

    const lockKey = `index_rebuild_${indexName}`;
    
    return await lockManager.withLock(lockKey, async () => {
      try {
        // 先删除再创建
        await this.dropIndex(indexName);
        const result = await this.createSingleIndex(indexDef, { force: true });
        
        logger.info('索引重建成功', { indexName });
        return result.success;
      } catch (error) {
        logger.error('索引重建失败', { indexName, error: error.message });
        return false;
      }
    });
  }

  /**
   * 获取索引统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getIndexStats() {
    try {
      const allIndexes = await db.raw(`
        SELECT name, tbl_name, sql 
        FROM sqlite_master 
        WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);

      const stats = {
        total: allIndexes.length,
        defined: this.indexDefinitions.size,
        created: this.createdIndexes.size,
        indexes: allIndexes.map(idx => ({
          name: idx.name,
          table: idx.tbl_name,
          sql: idx.sql,
          managed: this.indexDefinitions.has(idx.name)
        }))
      };

      return stats;
    } catch (error) {
      logger.error('获取索引统计信息失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 验证索引完整性
   * @returns {Promise<Object>} 验证结果
   */
  async validateIndexes() {
    const results = {
      valid: [],
      invalid: [],
      missing: []
    };

    for (const [name, indexDef] of this.indexDefinitions) {
      try {
        const exists = await this.indexExists(name);
        
        if (exists) {
          // 可以添加更多验证逻辑，比如检查索引结构
          results.valid.push(name);
        } else {
          results.missing.push(name);
        }
      } catch (error) {
        results.invalid.push({ name, error: error.message });
      }
    }

    logger.info('索引验证完成', {
      valid: results.valid.length,
      invalid: results.invalid.length,
      missing: results.missing.length
    });

    return results;
  }
}

// 创建全局索引管理器实例
const indexManager = new IndexManager();

module.exports = {
  IndexManager,
  indexManager,
};
