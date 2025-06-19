/**
 * 主修复脚本 - 协调执行所有安全修复
 *
 * 功能：
 * 1. 按优先级顺序执行所有修复脚本
 * 2. 提供交互式修复选择
 * 3. 生成综合修复报告
 * 4. 提供回滚选项
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 导入修复脚本
const JWTSecurityFixer = require('./fix-jwt-security');
const SensitiveDataEncryptor = require('./encrypt-sensitive-data');
const CORSConfigFixer = require('./update-cors-config');
const ForeignKeyEnabler = require('./enable-foreign-keys');

class MasterSecurityFixer {
  constructor() {
    this.projectRoot = path.join(__dirname, '../..');
    this.backupDir = path.join(__dirname, '../backups');
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.fixes = [
      {
        id: 'jwt',
        name: 'JWT密钥安全修复',
        priority: 'P0',
        description: '修复默认JWT密钥，使用强随机密钥',
        estimatedTime: '30分钟',
        fixer: JWTSecurityFixer,
      },
      {
        id: 'cors',
        name: 'CORS配置修复',
        priority: 'P0',
        description: '修复过于宽松的CORS配置，添加域名白名单',
        estimatedTime: '1小时',
        fixer: CORSConfigFixer,
      },
      {
        id: 'encryption',
        name: '敏感数据加密',
        priority: 'P0',
        description: '加密存储敏感信息（API密钥等）',
        estimatedTime: '2小时',
        fixer: SensitiveDataEncryptor,
      },
      {
        id: 'foreign-keys',
        name: '外键约束启用',
        priority: 'P1',
        description: '启用SQLite外键约束，确保数据完整性',
        estimatedTime: '2小时',
        fixer: ForeignKeyEnabler,
      },
    ];

    this.results = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix =
      type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'success' ? '🎉' : '✅';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  // 显示欢迎信息
  showWelcome() {
    console.log('\n' + '='.repeat(60));
    console.log('🔒 物流管理系统安全修复工具');
    console.log('='.repeat(60));
    console.log('');
    console.log('本工具将帮助您修复代码审查中发现的安全问题。');
    console.log('');
    console.log('⚠️  重要提醒：');
    console.log('1. 修复前会自动创建备份');
    console.log('2. 建议在测试环境中先行验证');
    console.log('3. 修复完成后需要重启应用服务器');
    console.log('4. 如有问题可使用备份文件回滚');
    console.log('');
  }

  // 显示可用修复选项
  showFixOptions() {
    console.log('可用的安全修复：');
    console.log('');

    this.fixes.forEach((fix, index) => {
      console.log(`${index + 1}. [${fix.priority}] ${fix.name}`);
      console.log(`   描述：${fix.description}`);
      console.log(`   预估时间：${fix.estimatedTime}`);
      console.log('');
    });

    console.log('0. 退出');
    console.log('a. 执行所有P0级修复（推荐）');
    console.log('b. 执行所有修复');
    console.log('');
  }

  // 获取用户选择
  async getUserChoice() {
    return new Promise(resolve => {
      this.rl.question('请选择要执行的修复（输入数字、字母或回车执行所有P0修复）: ', answer => {
        resolve(answer.trim() || 'a');
      });
    });
  }

  // 确认执行
  async confirmExecution(selectedFixes) {
    console.log('\n即将执行以下修复：');
    selectedFixes.forEach(fix => {
      console.log(`- ${fix.name} (${fix.priority})`);
    });

    const totalTime = selectedFixes.reduce((total, fix) => {
      const time = parseInt(fix.estimatedTime);
      return total + (isNaN(time) ? 60 : time); // 默认60分钟
    }, 0);

    console.log(`\n预估总时间：${Math.ceil(totalTime / 60)}小时`);
    console.log('');

    return new Promise(resolve => {
      this.rl.question('确认执行？(y/N): ', answer => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  // 创建系统备份
  async createSystemBackup() {
    this.log('创建系统备份...');

    // 确保备份目录存在
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const backupTimestamp = Date.now();
    const backupInfo = {
      timestamp: new Date().toISOString(),
      backupId: backupTimestamp,
      files: [],
    };

    // 备份关键文件
    const criticalFiles = [
      'app.js',
      'config/env.js',
      'utils/auth.js',
      'routes/backupRoutes.js',
      'scripts/qiniu-backup.js',
      'db/database.js',
      '.env',
    ];

    criticalFiles.forEach(file => {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        const backupPath = path.join(
          this.backupDir,
          `${file.replace(/[/\\]/g, '_')}.backup.${backupTimestamp}`
        );

        // 确保备份文件的目录存在
        const backupFileDir = path.dirname(backupPath);
        if (!fs.existsSync(backupFileDir)) {
          fs.mkdirSync(backupFileDir, { recursive: true });
        }

        fs.copyFileSync(filePath, backupPath);
        backupInfo.files.push({
          original: file,
          backup: path.basename(backupPath),
        });
      }
    });

    // 备份数据库
    const dbPath = path.join(this.projectRoot, 'data/logistics.db');
    if (fs.existsSync(dbPath)) {
      const dbBackupPath = path.join(this.backupDir, `logistics.db.backup.${backupTimestamp}`);
      fs.copyFileSync(dbPath, dbBackupPath);
      backupInfo.files.push({
        original: 'data/logistics.db',
        backup: path.basename(dbBackupPath),
      });
    }

    // 保存备份信息
    const backupInfoPath = path.join(this.backupDir, `backup-info-${backupTimestamp}.json`);
    fs.writeFileSync(backupInfoPath, JSON.stringify(backupInfo, null, 2));

    this.log(`✅ 系统备份完成，备份ID: ${backupTimestamp}`);
    return backupTimestamp;
  }

  // 执行单个修复
  async executeFix(fix) {
    this.log(`开始执行：${fix.name}`);

    const startTime = Date.now();
    let success = false;
    let error = null;

    try {
      const fixer = new fix.fixer();
      success = await fixer.run();
    } catch (err) {
      error = err.message;
      this.log(`修复执行出错：${error}`, 'error');
    }

    const duration = Date.now() - startTime;
    const result = {
      fixId: fix.id,
      name: fix.name,
      priority: fix.priority,
      success: success,
      error: error,
      duration: duration,
      timestamp: new Date().toISOString(),
    };

    this.results.push(result);

    if (success) {
      this.log(`✅ ${fix.name} 修复完成 (${Math.round(duration / 1000)}秒)`, 'success');
    } else {
      this.log(`❌ ${fix.name} 修复失败`, 'error');
    }

    return success;
  }

  // 生成综合报告
  generateMasterReport(backupId) {
    const report = {
      timestamp: new Date().toISOString(),
      backupId: backupId,
      totalFixes: this.results.length,
      successfulFixes: this.results.filter(r => r.success).length,
      failedFixes: this.results.filter(r => !r.success).length,
      totalDuration: this.results.reduce((total, r) => total + r.duration, 0),
      results: this.results,
      nextSteps: [
        '重启应用服务器以使所有配置生效',
        '验证所有功能正常工作',
        '运行安全测试确认问题已修复',
        '更新部署文档和操作手册',
        '通知团队成员配置变更',
      ],
      rollbackInstructions: [
        `使用备份ID ${backupId} 进行回滚`,
        '运行 node scripts/rollback.js 脚本',
        '或手动恢复备份文件',
        '重启应用服务器',
      ],
    };

    const reportPath = path.join(this.backupDir, `master-fix-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return { report, reportPath };
  }

  // 显示修复结果
  showResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 修复执行完成');
    console.log('='.repeat(60));
    console.log('');

    this.results.forEach(result => {
      const status = result.success ? '✅ 成功' : '❌ 失败';
      const duration = Math.round(result.duration / 1000);
      console.log(`${status} ${result.name} (${duration}秒)`);
      if (result.error) {
        console.log(`   错误：${result.error}`);
      }
    });

    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;

    console.log('');
    console.log(`总计：${successCount}/${totalCount} 个修复成功`);

    if (successCount === totalCount) {
      console.log('🎉 所有修复都已成功完成！');
    } else {
      console.log('⚠️  部分修复失败，请检查错误信息');
    }
  }

  // 主执行流程
  async run() {
    try {
      this.showWelcome();
      this.showFixOptions();

      const choice = await this.getUserChoice();

      let selectedFixes = [];

      switch (choice) {
        case '0':
          console.log('退出修复工具');
          this.rl.close();
          return;

        case 'a':
        case '':
          selectedFixes = this.fixes.filter(fix => fix.priority === 'P0');
          break;

        case 'b':
          selectedFixes = this.fixes;
          break;

        default: {
          const index = parseInt(choice) - 1;
          if (index >= 0 && index < this.fixes.length) {
            selectedFixes = [this.fixes[index]];
          } else {
            console.log('无效选择，退出');
            this.rl.close();
            return;
          }
          break;
        }
      }

      if (selectedFixes.length === 0) {
        console.log('未选择任何修复，退出');
        this.rl.close();
        return;
      }

      const confirmed = await this.confirmExecution(selectedFixes);
      if (!confirmed) {
        console.log('用户取消执行');
        this.rl.close();
        return;
      }

      // 创建系统备份
      const backupId = await this.createSystemBackup();

      // 执行修复
      console.log('\n开始执行修复...\n');

      for (const fix of selectedFixes) {
        await this.executeFix(fix);
        console.log(''); // 添加空行分隔
      }

      // 生成报告
      const { report, reportPath } = this.generateMasterReport(backupId);

      // 显示结果
      this.showResults();

      console.log('');
      console.log(`📋 详细报告已保存：${reportPath}`);
      console.log('');
      console.log('🔄 下一步操作：');
      console.log('1. 重启应用服务器');
      console.log('2. 验证所有功能正常工作');
      console.log('3. 运行安全测试');
      console.log('');

      this.rl.close();
    } catch (error) {
      this.log(`执行过程出错：${error.message}`, 'error');
      this.rl.close();
      process.exit(1);
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const masterFixer = new MasterSecurityFixer();
  masterFixer.run();
}

module.exports = MasterSecurityFixer;
