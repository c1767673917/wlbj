/**
 * 外键约束启用脚本
 *
 * 功能：
 * 1. 启用SQLite外键约束
 * 2. 检查和清理现有孤立数据
 * 3. 验证外键约束是否正常工作
 * 4. 创建数据完整性检查工具
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class ForeignKeyEnabler {
  constructor() {
    this.projectRoot = path.join(__dirname, '../..');
    this.dbPath = path.join(this.projectRoot, 'data/logistics.db');
    this.databaseJsPath = path.join(this.projectRoot, 'db/database.js');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '✅';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  // 备份文件
  backupFile(filePath) {
    if (fs.existsSync(filePath)) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      this.log(`已备份文件: ${path.basename(filePath)} -> ${path.basename(backupPath)}`);
      return backupPath;
    }
    return null;
  }

  // 备份数据库
  async backupDatabase() {
    this.log('备份数据库...');

    if (!fs.existsSync(this.dbPath)) {
      this.log('数据库文件不存在，跳过备份', 'warn');
      return null;
    }

    const backupPath = `${this.dbPath}.backup.${Date.now()}`;
    fs.copyFileSync(this.dbPath, backupPath);
    this.log(`数据库已备份到: ${backupPath}`);
    return backupPath;
  }

  // 检查数据完整性
  async checkDataIntegrity() {
    this.log('检查数据完整性...');

    if (!fs.existsSync(this.dbPath)) {
      this.log('数据库文件不存在', 'error');
      return { hasIssues: false, issues: [] };
    }

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY);
      const issues = [];

      db.serialize(() => {
        // 检查孤立的报价记录
        db.all(
          `
          SELECT q.id, q.orderId 
          FROM quotes q 
          LEFT JOIN orders o ON q.orderId = o.id 
          WHERE o.id IS NULL
        `,
          (err, orphanQuotes) => {
            if (err) {
              this.log(`检查孤立报价失败: ${err.message}`, 'error');
              reject(err);
              return;
            }

            if (orphanQuotes.length > 0) {
              this.log(`发现 ${orphanQuotes.length} 条孤立报价记录`, 'warn');
              issues.push({
                type: 'orphan_quotes',
                count: orphanQuotes.length,
                records: orphanQuotes,
              });
            } else {
              this.log('✅ 未发现孤立报价记录');
            }

            // 检查孤立的订单记录（引用不存在的用户）
            db.all(
              `
            SELECT o.id, o.userId 
            FROM orders o 
            LEFT JOIN users u ON o.userId = u.id 
            WHERE o.userId IS NOT NULL AND u.id IS NULL
          `,
              (err, orphanOrders) => {
                if (err) {
                  this.log(`检查孤立订单失败: ${err.message}`, 'error');
                  reject(err);
                  return;
                }

                if (orphanOrders.length > 0) {
                  this.log(`发现 ${orphanOrders.length} 条孤立订单记录`, 'warn');
                  issues.push({
                    type: 'orphan_orders',
                    count: orphanOrders.length,
                    records: orphanOrders,
                  });
                } else {
                  this.log('✅ 未发现孤立订单记录');
                }

                db.close();
                resolve({
                  hasIssues: issues.length > 0,
                  issues: issues,
                });
              }
            );
          }
        );
      });
    });
  }

  // 清理孤立数据
  async cleanupOrphanData(issues) {
    if (!issues.hasIssues) {
      this.log('无需清理孤立数据');
      return true;
    }

    this.log('开始清理孤立数据...');

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);

      db.serialize(() => {
        let cleanupCount = 0;
        const totalCleanups = issues.issues.length;

        issues.issues.forEach(issue => {
          if (issue.type === 'orphan_quotes') {
            // 删除孤立的报价记录
            db.run(
              `
              DELETE FROM quotes 
              WHERE orderId NOT IN (SELECT id FROM orders)
            `,
              function (err) {
                if (err) {
                  this.log(`清理孤立报价失败: ${err.message}`, 'error');
                  reject(err);
                  return;
                }
                this.log(`清理了 ${this.changes} 条孤立报价记录`);

                cleanupCount++;
                if (cleanupCount === totalCleanups) {
                  db.close();
                  resolve(true);
                }
              }.bind(this)
            );
          } else if (issue.type === 'orphan_orders') {
            // 清理无效的用户ID引用（设置为NULL而不是删除订单）
            db.run(
              `
              UPDATE orders 
              SET userId = NULL 
              WHERE userId IS NOT NULL 
              AND userId NOT IN (SELECT id FROM users)
            `,
              function (err) {
                if (err) {
                  this.log(`清理无效用户ID失败: ${err.message}`, 'error');
                  reject(err);
                  return;
                }
                this.log(`清理了 ${this.changes} 条无效用户ID引用`);

                cleanupCount++;
                if (cleanupCount === totalCleanups) {
                  db.close();
                  resolve(true);
                }
              }.bind(this)
            );
          }
        });
      });
    });
  }

  // 修复database.js以启用外键约束
  fixDatabaseJs() {
    this.log('修复database.js以启用外键约束...');

    if (!fs.existsSync(this.databaseJsPath)) {
      this.log('database.js文件不存在', 'error');
      return false;
    }

    this.backupFile(this.databaseJsPath);
    let content = fs.readFileSync(this.databaseJsPath, 'utf8');

    // 在optimizeDatabase函数中添加外键约束启用
    const optimizeFunctionPattern = /function optimizeDatabase\(\) {([\s\S]*?)}/;
    const match = content.match(optimizeFunctionPattern);

    if (match) {
      const functionBody = match[1];

      // 检查是否已经有外键约束设置
      if (!functionBody.includes('PRAGMA foreign_keys')) {
        const foreignKeyCode = `
  // 启用外键约束
  db.run('PRAGMA foreign_keys = ON', (err) => {
    if (err) {
      logger.error('启用外键约束失败:', err.message);
    } else {
      logger.info('SQLite外键约束已启用');
    }
  });

  // 验证外键约束是否启用
  db.get('PRAGMA foreign_keys', (err, row) => {
    if (err) {
      logger.error('检查外键约束状态失败:', err.message);
    } else {
      logger.info('外键约束状态:', row.foreign_keys ? '已启用' : '未启用');
    }
  });`;

        const newFunctionBody = foreignKeyCode + functionBody;
        content = content.replace(
          optimizeFunctionPattern,
          `function optimizeDatabase() {${newFunctionBody}}`
        );
        this.log('已在optimizeDatabase函数中添加外键约束启用代码');
      } else {
        this.log('外键约束代码已存在，跳过添加');
      }
    } else {
      this.log('未找到optimizeDatabase函数，手动添加外键约束代码', 'warn');

      // 在数据库连接后添加外键约束
      const dbConnectionPattern = /console\.log\('Connected to the SQLite database\.'\);/;
      if (dbConnectionPattern.test(content)) {
        const foreignKeyCode = `
    // 启用外键约束
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) {
        console.error('启用外键约束失败:', err.message);
      } else {
        console.log('SQLite外键约束已启用');
      }
    });`;

        content = content.replace(
          dbConnectionPattern,
          `console.log('Connected to the SQLite database.');${foreignKeyCode}`
        );
        this.log('已在数据库连接后添加外键约束启用代码');
      }
    }

    fs.writeFileSync(this.databaseJsPath, content);
    this.log('✅ database.js修复完成');
    return true;
  }

  // 验证外键约束是否生效
  async verifyForeignKeys() {
    this.log('验证外键约束是否生效...');

    if (!fs.existsSync(this.dbPath)) {
      this.log('数据库文件不存在', 'error');
      return false;
    }

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);

      db.serialize(() => {
        // 启用外键约束
        db.run('PRAGMA foreign_keys = ON', err => {
          if (err) {
            this.log(`启用外键约束失败: ${err.message}`, 'error');
            reject(err);
            return;
          }

          // 检查外键约束状态
          db.get('PRAGMA foreign_keys', (err, row) => {
            if (err) {
              this.log(`检查外键约束状态失败: ${err.message}`, 'error');
              reject(err);
              return;
            }

            if (!row.foreign_keys) {
              this.log('外键约束未启用', 'error');
              resolve(false);
              return;
            }

            this.log('✅ 外键约束已启用');

            // 测试外键约束是否工作
            const testOrderId = 'test-order-' + Date.now();

            // 尝试插入一个引用不存在订单的报价
            db.run(
              `
              INSERT INTO quotes (id, orderId, provider, price, estimatedDelivery, createdAt) 
              VALUES (?, ?, 'test-provider', 100, '2024-01-01', ?)
            `,
              [testOrderId + '-quote', testOrderId, new Date().toISOString()],
              function (err) {
                if (err && err.message.includes('FOREIGN KEY constraint failed')) {
                  this.log('✅ 外键约束测试通过：成功阻止了违反外键约束的插入');
                  db.close();
                  resolve(true);
                } else if (err) {
                  this.log(`外键约束测试出现意外错误: ${err.message}`, 'error');
                  db.close();
                  resolve(false);
                } else {
                  this.log('外键约束测试失败：应该阻止违反外键约束的插入', 'error');

                  // 清理测试数据
                  db.run('DELETE FROM quotes WHERE id = ?', [testOrderId + '-quote'], () => {
                    db.close();
                    resolve(false);
                  });
                }
              }.bind(this)
            );
          });
        });
      });
    });
  }

  // 创建数据完整性检查脚本
  createIntegrityCheckScript() {
    this.log('创建数据完整性检查脚本...');

    const scriptPath = path.join(__dirname, 'check-data-integrity.js');
    const scriptContent = `#!/usr/bin/env node

/**
 * 数据完整性检查脚本
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DataIntegrityChecker {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/logistics.db');
  }

  async checkIntegrity() {
    console.log('开始数据完整性检查...\\n');

    if (!require('fs').existsSync(this.dbPath)) {
      console.error('❌ 数据库文件不存在');
      return false;
    }

    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY);
      let allChecksPass = true;

      db.serialize(() => {
        // 检查外键约束状态
        db.get('PRAGMA foreign_keys', (err, row) => {
          if (err) {
            console.error('❌ 检查外键约束状态失败:', err.message);
            allChecksPass = false;
          } else {
            console.log(\`外键约束状态: \${row.foreign_keys ? '✅ 已启用' : '❌ 未启用'}\`);
            if (!row.foreign_keys) allChecksPass = false;
          }

          // 检查孤立数据
          this.checkOrphanData(db, () => {
            // 检查数据库完整性
            db.get('PRAGMA integrity_check', (err, row) => {
              if (err) {
                console.error('❌ 数据库完整性检查失败:', err.message);
                allChecksPass = false;
              } else {
                console.log(\`数据库完整性: \${row.integrity_check === 'ok' ? '✅ 正常' : '❌ 异常'}\`);
                if (row.integrity_check !== 'ok') allChecksPass = false;
              }

              db.close();
              console.log(\`\\n总体结果: \${allChecksPass ? '✅ 所有检查通过' : '❌ 发现问题'}\`);
              resolve(allChecksPass);
            });
          });
        });
      });
    });
  }

  checkOrphanData(db, callback) {
    let checksCompleted = 0;
    const totalChecks = 2;

    // 检查孤立报价
    db.all(\`
      SELECT COUNT(*) as count 
      FROM quotes q 
      LEFT JOIN orders o ON q.orderId = o.id 
      WHERE o.id IS NULL
    \`, (err, rows) => {
      if (err) {
        console.error('❌ 检查孤立报价失败:', err.message);
      } else {
        const count = rows[0].count;
        console.log(\`孤立报价记录: \${count === 0 ? '✅ 无' : \`❌ \${count} 条\`}\`);
      }

      checksCompleted++;
      if (checksCompleted === totalChecks) callback();
    });

    // 检查孤立订单
    db.all(\`
      SELECT COUNT(*) as count 
      FROM orders o 
      LEFT JOIN users u ON o.userId = u.id 
      WHERE o.userId IS NOT NULL AND u.id IS NULL
    \`, (err, rows) => {
      if (err) {
        console.error('❌ 检查孤立订单失败:', err.message);
      } else {
        const count = rows[0].count;
        console.log(\`孤立订单记录: \${count === 0 ? '✅ 无' : \`❌ \${count} 条\`}\`);
      }

      checksCompleted++;
      if (checksCompleted === totalChecks) callback();
    });
  }
}

if (require.main === module) {
  const checker = new DataIntegrityChecker();
  checker.checkIntegrity().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = DataIntegrityChecker;`;

    fs.writeFileSync(scriptPath, scriptContent);
    fs.chmodSync(scriptPath, '755');
    this.log(`✅ 数据完整性检查脚本已创建: ${scriptPath}`);
  }

  // 生成修复报告
  generateReport(integrityResult) {
    const report = {
      timestamp: new Date().toISOString(),
      action: 'Foreign Key Constraints Enablement',
      dataIntegrityBefore: integrityResult,
      changes: [
        {
          file: 'db/database.js',
          action: 'Added PRAGMA foreign_keys = ON to enable foreign key constraints',
        },
        {
          database: 'logistics.db',
          action: 'Cleaned up orphan data to ensure referential integrity',
        },
        {
          file: 'scripts/check-data-integrity.js',
          action: 'Created data integrity checking script',
        },
      ],
      improvements: [
        '启用了SQLite外键约束以确保数据完整性',
        '清理了现有的孤立数据',
        '添加了外键约束状态验证',
        '创建了数据完整性检查工具',
      ],
      recommendations: [
        '定期运行数据完整性检查脚本',
        '在数据迁移前后验证外键约束',
        '监控应用日志中的外键约束错误',
        '在开发环境中测试数据操作以确保符合外键约束',
      ],
    };

    const reportPath = path.join(
      __dirname,
      '../backups',
      `foreign-keys-fix-report-${Date.now()}.json`
    );

    // 确保备份目录存在
    const backupDir = path.dirname(reportPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`修复报告已保存: ${reportPath}`);

    return report;
  }

  // 主修复流程
  async run() {
    this.log('开始外键约束启用修复...');

    try {
      // 1. 备份数据库
      await this.backupDatabase();

      // 2. 检查数据完整性
      const integrityResult = await this.checkDataIntegrity();

      // 3. 清理孤立数据
      const cleanupSuccess = await this.cleanupOrphanData(integrityResult);
      if (!cleanupSuccess) {
        this.log('孤立数据清理失败', 'error');
        return false;
      }

      // 4. 修复database.js
      const dbFixed = this.fixDatabaseJs();
      if (!dbFixed) {
        this.log('database.js修复失败', 'error');
        return false;
      }

      // 5. 验证外键约束
      const constraintsWork = await this.verifyForeignKeys();
      if (!constraintsWork) {
        this.log('外键约束验证失败', 'error');
        return false;
      }

      // 6. 创建检查脚本
      this.createIntegrityCheckScript();

      // 7. 生成修复报告
      const report = this.generateReport(integrityResult);

      this.log('🎉 外键约束启用修复完成！');
      this.log('');
      this.log('重要提醒：');
      this.log('1. 请重启应用服务器以使新配置生效');
      this.log('2. 使用 node scripts/check-data-integrity.js 定期检查数据完整性');
      this.log('3. 监控应用日志中的外键约束错误');
      this.log('4. 在数据操作前确保符合外键约束要求');

      return true;
    } catch (error) {
      this.log(`修复过程出错：${error.message}`, 'error');
      this.log('请检查错误信息并手动修复', 'error');
      return false;
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const enabler = new ForeignKeyEnabler();
  enabler.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = ForeignKeyEnabler;
