#!/usr/bin/env node

/**
 * 物流报价系统状态验证脚本
 * 验证系统的基本功能和配置是否正常
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始验证物流报价系统状态...\n');

// 验证项目结构
function verifyProjectStructure() {
  console.log('📁 验证项目结构...');
  
  const requiredFiles = [
    'package.json',
    'app.js',
    'db/database.js',
    'frontend/package.json',
    'frontend/src/App.tsx',
    'start-dev.sh',
    'build-prod.sh'
  ];
  
  const requiredDirs = [
    'routes',
    'config',
    'utils',
    'frontend/src',
    'data'
  ];
  
  let allFilesExist = true;
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} - 缺失`);
      allFilesExist = false;
    }
  });
  
  requiredDirs.forEach(dir => {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      console.log(`  ✅ ${dir}/`);
    } else {
      console.log(`  ❌ ${dir}/ - 缺失`);
      allFilesExist = false;
    }
  });
  
  return allFilesExist;
}

// 验证配置文件
function verifyConfiguration() {
  console.log('\n⚙️  验证配置文件...');
  
  let configStatus = true;
  
  // 检查package.json
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`  ✅ package.json - 版本: ${pkg.version}`);
  } catch (error) {
    console.log(`  ❌ package.json - 读取失败: ${error.message}`);
    configStatus = false;
  }
  
  // 检查前端package.json
  try {
    const frontendPkg = JSON.parse(fs.readFileSync('frontend/package.json', 'utf8'));
    console.log(`  ✅ frontend/package.json - 正常`);
  } catch (error) {
    console.log(`  ❌ frontend/package.json - 读取失败: ${error.message}`);
    configStatus = false;
  }
  
  // 检查.env文件
  if (fs.existsSync('.env')) {
    console.log('  ✅ .env - 存在');
  } else {
    console.log('  ⚠️  .env - 不存在 (需要手动创建)');
  }
  
  // 检查auth_config.json
  if (fs.existsSync('auth_config.json')) {
    console.log('  ✅ auth_config.json - 存在');
  } else {
    console.log('  ⚠️  auth_config.json - 不存在 (需要手动创建)');
  }
  
  return configStatus;
}

// 验证数据库
function verifyDatabase() {
  console.log('\n🗄️  验证数据库...');
  
  if (fs.existsSync('data/logistics.db')) {
    const stats = fs.statSync('data/logistics.db');
    console.log(`  ✅ SQLite数据库存在 - 大小: ${(stats.size / 1024).toFixed(2)} KB`);
    return true;
  } else {
    console.log('  ❌ SQLite数据库不存在');
    return false;
  }
}

// 验证依赖安装
function verifyDependencies() {
  console.log('\n📦 验证依赖安装...');
  
  let depsStatus = true;
  
  // 检查后端依赖
  if (fs.existsSync('node_modules')) {
    console.log('  ✅ 后端依赖已安装');
  } else {
    console.log('  ❌ 后端依赖未安装 - 运行: npm install');
    depsStatus = false;
  }
  
  // 检查前端依赖
  if (fs.existsSync('frontend/node_modules')) {
    console.log('  ✅ 前端依赖已安装');
  } else {
    console.log('  ❌ 前端依赖未安装 - 运行: cd frontend && npm install');
    depsStatus = false;
  }
  
  return depsStatus;
}

// 主验证函数
async function main() {
  const results = {
    structure: verifyProjectStructure(),
    config: verifyConfiguration(),
    database: verifyDatabase(),
    dependencies: verifyDependencies()
  };
  
  console.log('\n📊 验证结果汇总:');
  console.log('==================');
  
  Object.entries(results).forEach(([key, status]) => {
    const statusText = status ? '✅ 正常' : '❌ 有问题';
    const keyText = {
      structure: '项目结构',
      config: '配置文件',
      database: '数据库',
      dependencies: '依赖安装'
    }[key];
    
    console.log(`${keyText}: ${statusText}`);
  });
  
  const allGood = Object.values(results).every(status => status);
  
  console.log('\n🎯 总体状态:');
  if (allGood) {
    console.log('✅ 系统状态良好，可以正常运行！');
    console.log('\n🚀 启动建议:');
    console.log('  开发环境: ./start-dev.sh');
    console.log('  生产环境: ./build-prod.sh && NODE_ENV=production node app.js');
  } else {
    console.log('⚠️  系统存在问题，请根据上述提示进行修复');
  }
  
  console.log('\n📚 更多信息请查看 README.md');
}

// 运行验证
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { verifyProjectStructure, verifyConfiguration, verifyDatabase, verifyDependencies };
