#!/usr/bin/env node

/**
 * 数据库初始化脚本
 * 运行迁移、创建索引、初始化数据
 */

const path = require('path');
const { db, testConnection, closeConnection } = require('../src/config/database');
const { logger } = require('../src/config/logger');
const { indexManager } = require('../src/utils/IndexManager');

class DatabaseInitializer {
  constructor() {
    this.options = {
      runMigrations: !process.argv.includes('--skip-migrations'),
      createIndexes: !process.argv.includes('--skip-indexes'),
      seedData: process.argv.includes('--seed'),
      force: process.argv.includes('--force'),
      verbose: process.argv.includes('--verbose')
    };
  }

  /**
   * 执行数据库初始化
   */
  async run() {
    try {
      logger.info('开始数据库初始化', this.options);
      
      // 测试数据库连接
      await this.testConnection();
      
      // 运行迁移
      if (this.options.runMigrations) {
        await this.runMigrations();
      }
      
      // 创建索引
      if (this.options.createIndexes) {
        await this.createIndexes();
      }
      
      // 种子数据
      if (this.options.seedData) {
        await this.seedData();
      }
      
      // 验证数据库状态
      await this.validateDatabase();
      
      logger.info('数据库初始化完成');
      
    } catch (error) {
      logger.error('数据库初始化失败', { error: error.message });
      throw error;
    } finally {
      await closeConnection();
    }
  }

  /**
   * 测试数据库连接
   */
  async testConnection() {
    logger.info('测试数据库连接...');
    
    try {
      await testConnection();
      logger.info('数据库连接成功');
    } catch (error) {
      logger.error('数据库连接失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 运行数据库迁移
   */
  async runMigrations() {
    logger.info('运行数据库迁移...');
    
    try {
      // 使用Knex运行迁移
      const [batchNo, migrations] = await db.migrate.latest();
      
      if (migrations.length === 0) {
        logger.info('没有需要运行的迁移');
      } else {
        logger.info('迁移运行完成', { 
          batchNo, 
          migrations: migrations.map(m => path.basename(m))
        });
      }
    } catch (error) {
      logger.error('运行迁移失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 创建数据库索引
   */
  async createIndexes() {
    logger.info('创建数据库索引...');
    
    try {
      const results = await indexManager.createAllIndexes({
        force: this.options.force,
        parallel: false, // 串行创建更安全
        skipExisting: !this.options.force
      });

      if (results.failed.length > 0) {
        logger.warn('部分索引创建失败', { failed: results.failed });
      }

      logger.info('索引创建完成', {
        created: results.created.length,
        skipped: results.skipped.length,
        failed: results.failed.length
      });

      if (this.options.verbose) {
        logger.info('索引创建详情', results);
      }
    } catch (error) {
      logger.error('创建索引失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 运行种子数据
   */
  async seedData() {
    logger.info('运行种子数据...');
    
    try {
      const [seedFiles] = await db.seed.run();
      
      if (seedFiles.length === 0) {
        logger.info('没有种子文件需要运行');
      } else {
        logger.info('种子数据运行完成', { 
          files: seedFiles.map(f => path.basename(f))
        });
      }
    } catch (error) {
      logger.error('运行种子数据失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 验证数据库状态
   */
  async validateDatabase() {
    logger.info('验证数据库状态...');
    
    try {
      // 检查表是否存在
      const tables = await this.checkTables();
      
      // 验证索引
      const indexValidation = await indexManager.validateIndexes();
      
      // 检查数据完整性
      const dataIntegrity = await this.checkDataIntegrity();
      
      const validation = {
        tables,
        indexes: indexValidation,
        dataIntegrity
      };

      if (this.options.verbose) {
        logger.info('数据库验证详情', validation);
      }

      // 检查是否有严重问题
      const hasIssues = indexValidation.invalid.length > 0 || 
                       indexValidation.missing.length > 0 ||
                       !dataIntegrity.valid;

      if (hasIssues) {
        logger.warn('数据库验证发现问题', validation);
      } else {
        logger.info('数据库验证通过');
      }

      return validation;
    } catch (error) {
      logger.error('数据库验证失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 检查必需的表是否存在
   */
  async checkTables() {
    const requiredTables = [
      'users',
      'orders', 
      'quotes',
      'providers',
      'order_sequences'
    ];

    const results = {
      existing: [],
      missing: []
    };

    for (const table of requiredTables) {
      const exists = await db.schema.hasTable(table);
      if (exists) {
        results.existing.push(table);
      } else {
        results.missing.push(table);
      }
    }

    if (results.missing.length > 0) {
      logger.warn('缺少必需的表', { missing: results.missing });
    }

    return results;
  }

  /**
   * 检查数据完整性
   */
  async checkDataIntegrity() {
    try {
      // 检查外键约束
      await db.raw('PRAGMA foreign_key_check');
      
      // 检查序列表是否有今天的记录
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const todaySequence = await db('order_sequences')
        .where('date', today)
        .first();

      return {
        valid: true,
        foreignKeyCheck: 'passed',
        sequenceTable: todaySequence ? 'initialized' : 'empty'
      };
    } catch (error) {
      logger.error('数据完整性检查失败', { error: error.message });
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats() {
    try {
      const stats = {};
      
      // 表统计
      const tables = ['users', 'orders', 'quotes', 'providers', 'order_sequences'];
      for (const table of tables) {
        try {
          const count = await db(table).count('* as count').first();
          stats[table] = parseInt(count.count, 10);
        } catch (error) {
          stats[table] = 'error';
        }
      }

      // 索引统计
      const indexStats = await indexManager.getIndexStats();
      stats.indexes = indexStats;

      return stats;
    } catch (error) {
      logger.error('获取数据库统计信息失败', { error: error.message });
      return { error: error.message };
    }
  }
}

// 主函数
async function main() {
  const initializer = new DatabaseInitializer();
  
  try {
    await initializer.run();
    
    // 显示统计信息
    if (initializer.options.verbose) {
      const stats = await initializer.getDatabaseStats();
      console.log('\n=== 数据库统计信息 ===');
      console.log(JSON.stringify(stats, null, 2));
      console.log('=====================\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('初始化失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  // 显示使用说明
  if (process.argv.includes('--help')) {
    console.log(`
使用方法: node initDatabase.js [选项]

选项:
  --skip-migrations    跳过数据库迁移
  --skip-indexes       跳过索引创建
  --seed              运行种子数据
  --force             强制重新创建索引
  --verbose           显示详细信息
  --help              显示此帮助信息

示例:
  node initDatabase.js --verbose
  node initDatabase.js --seed --force
  node initDatabase.js --skip-migrations --skip-indexes
    `);
    process.exit(0);
  }
  
  main();
}

module.exports = DatabaseInitializer;
