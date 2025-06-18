#!/usr/bin/env node

/**
 * 部署前检查脚本
 * 验证所有部署相关的配置和文件
 */

const fs = require('fs');
const path = require('path');
const { validateIndexHtml, validateAssets } = require('./verify-frontend-build');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvironmentVariables() {
  const requiredEnvVars = [
    { name: 'NODE_ENV', required: true, production: 'production' },
    { name: 'JWT_SECRET', required: true, shouldNotBe: 'default_jwt_secret_change_in_production' },
    { name: 'APP_PASSWORD', required: true, shouldNotBe: 'your_secure_admin_password_here_change_this' }
  ];

  const optionalEnvVars = [
    { name: 'PORT', default: '3000' },
    { name: 'TRUST_PROXY', default: 'auto' },
    { name: 'REDIS_HOST', default: 'localhost' },
    { name: 'REDIS_PORT', default: '6379' }
  ];

  const issues = [];
  const warnings = [];

  // 检查必需的环境变量
  requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar.name];
    
    if (!value) {
      issues.push(`缺少必需的环境变量: ${envVar.name}`);
    } else if (envVar.shouldNotBe && value === envVar.shouldNotBe) {
      issues.push(`${envVar.name} 仍使用默认值，生产环境必须修改`);
    } else if (envVar.production && value !== envVar.production) {
      warnings.push(`${envVar.name} 不是生产环境值: ${value}`);
    }
  });

  // 检查可选的环境变量
  optionalEnvVars.forEach(envVar => {
    const value = process.env[envVar.name];
    if (!value) {
      warnings.push(`未设置 ${envVar.name}，将使用默认值: ${envVar.default}`);
    }
  });

  return { issues, warnings };
}

function checkDatabaseFiles() {
  const dbPath = path.join(__dirname, '../data/logistics.db');
  const issues = [];

  try {
    const stats = fs.statSync(dbPath);
    if (stats.size === 0) {
      issues.push('数据库文件为空');
    }
  } catch (error) {
    issues.push(`数据库文件不存在或无法访问: ${error.message}`);
  }

  return { issues };
}

function checkNodeModules() {
  const nodeModulesPath = path.join(__dirname, '../node_modules');
  const packageJsonPath = path.join(__dirname, '../package.json');
  const issues = [];

  try {
    fs.statSync(nodeModulesPath);
  } catch (error) {
    issues.push('node_modules 目录不存在，请运行 npm install');
    return { issues };
  }

  // 检查关键依赖
  const criticalDeps = ['express', 'sqlite3', 'express-rate-limit', 'helmet'];
  criticalDeps.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    try {
      fs.statSync(depPath);
    } catch (error) {
      issues.push(`关键依赖缺失: ${dep}`);
    }
  });

  return { issues };
}

function checkLogDirectory() {
  const logDir = path.join(__dirname, '../logs');
  const issues = [];

  try {
    const stats = fs.statSync(logDir);
    if (!stats.isDirectory()) {
      issues.push('logs 路径存在但不是目录');
    }
  } catch (error) {
    // 尝试创建日志目录
    try {
      fs.mkdirSync(logDir, { recursive: true });
      log('yellow', '已创建 logs 目录');
    } catch (createError) {
      issues.push(`无法创建 logs 目录: ${createError.message}`);
    }
  }

  return { issues };
}

function checkTrustProxyConfig() {
  const trustProxy = process.env.TRUST_PROXY || 'auto';
  const nodeEnv = process.env.NODE_ENV;
  const warnings = [];

  if (nodeEnv === 'production') {
    if (trustProxy === 'true') {
      warnings.push('生产环境不建议设置 TRUST_PROXY=true，存在安全风险');
    } else if (trustProxy === 'false') {
      warnings.push('生产环境建议配置 TRUST_PROXY 以支持反向代理');
    }
  }

  return { warnings };
}

function main() {
  log('blue', '🚀 开始部署前检查...\n');

  let totalIssues = 0;
  let totalWarnings = 0;

  // 1. 检查环境变量
  log('blue', '1. 检查环境变量配置');
  const envCheck = checkEnvironmentVariables();
  if (envCheck.issues.length === 0) {
    log('green', '   ✅ 环境变量配置正确');
  } else {
    envCheck.issues.forEach(issue => log('red', `   ❌ ${issue}`));
    totalIssues += envCheck.issues.length;
  }
  if (envCheck.warnings.length > 0) {
    envCheck.warnings.forEach(warning => log('yellow', `   ⚠️  ${warning}`));
    totalWarnings += envCheck.warnings.length;
  }

  // 2. 检查前端构建
  log('blue', '\n2. 检查前端构建文件');
  const indexResult = validateIndexHtml();
  const assetsResult = validateAssets();
  
  if (indexResult.valid && assetsResult.valid) {
    log('green', '   ✅ 前端构建文件正确');
  } else {
    if (!indexResult.valid) {
      log('red', `   ❌ index.html 问题: ${indexResult.error || indexResult.issues?.join(', ')}`);
      totalIssues++;
    }
    if (!assetsResult.valid) {
      log('red', `   ❌ assets 问题: ${assetsResult.error}`);
      totalIssues++;
    }
  }

  // 3. 检查数据库
  log('blue', '\n3. 检查数据库文件');
  const dbCheck = checkDatabaseFiles();
  if (dbCheck.issues.length === 0) {
    log('green', '   ✅ 数据库文件正常');
  } else {
    dbCheck.issues.forEach(issue => log('red', `   ❌ ${issue}`));
    totalIssues += dbCheck.issues.length;
  }

  // 4. 检查依赖
  log('blue', '\n4. 检查 Node.js 依赖');
  const depsCheck = checkNodeModules();
  if (depsCheck.issues.length === 0) {
    log('green', '   ✅ 依赖安装正确');
  } else {
    depsCheck.issues.forEach(issue => log('red', `   ❌ ${issue}`));
    totalIssues += depsCheck.issues.length;
  }

  // 5. 检查日志目录
  log('blue', '\n5. 检查日志目录');
  const logCheck = checkLogDirectory();
  if (logCheck.issues.length === 0) {
    log('green', '   ✅ 日志目录正常');
  } else {
    logCheck.issues.forEach(issue => log('red', `   ❌ ${issue}`));
    totalIssues += logCheck.issues.length;
  }

  // 6. 检查代理配置
  log('blue', '\n6. 检查代理配置');
  const proxyCheck = checkTrustProxyConfig();
  if (proxyCheck.warnings.length === 0) {
    log('green', '   ✅ 代理配置合理');
  } else {
    proxyCheck.warnings.forEach(warning => log('yellow', `   ⚠️  ${warning}`));
    totalWarnings += proxyCheck.warnings.length;
  }

  // 总结
  console.log('\n' + '='.repeat(60));
  if (totalIssues === 0) {
    log('green', '🎉 部署前检查通过！');
    log('blue', '\n📋 启动命令:');
    console.log('   NODE_ENV=production node app.js');
  } else {
    log('red', `❌ 发现 ${totalIssues} 个问题需要修复`);
    process.exit(1);
  }

  if (totalWarnings > 0) {
    log('yellow', `⚠️  有 ${totalWarnings} 个警告，建议检查`);
  }
}

if (require.main === module) {
  main();
}
