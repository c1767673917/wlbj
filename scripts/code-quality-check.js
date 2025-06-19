/**
 * 代码质量检查脚本
 * 运行ESLint、Prettier、复杂度分析和重复代码检测
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix =
    type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function runQualityChecks() {
  log('🔍 开始代码质量检查...');

  const checks = [
    {
      name: 'ESLint检查',
      command: 'npm run lint',
      required: true,
    },
    {
      name: 'Prettier格式检查',
      command: 'npm run format:check',
      required: true,
    },
    {
      name: '代码复杂度分析',
      command: 'npm run complexity',
      required: false,
    },
    {
      name: '重复代码检测',
      command: 'npm run duplicate',
      required: false,
    },
  ];

  let allPassed = true;
  const results = [];

  for (const check of checks) {
    log(`运行: ${check.name}...`);

    try {
      execSync(check.command, { stdio: 'inherit' });
      log(`✅ ${check.name} 通过`, 'success');
      results.push({ name: check.name, status: 'passed' });
    } catch (error) {
      const message = `❌ ${check.name} 失败`;
      log(message, 'error');
      results.push({ name: check.name, status: 'failed', error: error.message });

      if (check.required) {
        allPassed = false;
      }
    }
  }

  // 生成报告
  const report = {
    timestamp: new Date().toISOString(),
    overall: allPassed ? 'passed' : 'failed',
    results: results,
  };

  const reportPath = path.join(__dirname, '../reports/quality-check-report.json');
  const reportDir = path.dirname(reportPath);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log(`📋 质量检查报告已保存: ${reportPath}`);

  if (allPassed) {
    log('🎉 所有必需的代码质量检查都通过了！', 'success');
  } else {
    log('⚠️ 部分代码质量检查失败，请修复后重试', 'warn');
  }

  return allPassed;
}

if (require.main === module) {
  const success = runQualityChecks();
  process.exit(success ? 0 : 1);
}

module.exports = { runQualityChecks };
