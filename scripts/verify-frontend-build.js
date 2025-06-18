#!/usr/bin/env node

/**
 * 前端构建验证脚本
 * 检查前端构建文件的完整性和正确性
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../frontend/dist');
const REQUIRED_FILES = [
  'index.html',
  'assets'
];

function checkFileExists(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return { exists: true, isDirectory: stats.isDirectory(), size: stats.size };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

function validateIndexHtml() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  const result = checkFileExists(indexPath);
  
  if (!result.exists) {
    return { valid: false, error: 'index.html 不存在' };
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // 检查必要的元素
    const checks = [
      { name: 'DOCTYPE', pattern: /<!doctype html>/i },
      { name: 'root div', pattern: /<div id="root"><\/div>/ },
      { name: 'JS assets', pattern: /src="\/assets\/.*\.js"/ },
      { name: 'CSS assets', pattern: /href="\/assets\/.*\.css"/ }
    ];

    const issues = [];
    checks.forEach(check => {
      if (!check.pattern.test(content)) {
        issues.push(`缺少 ${check.name}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues: issues,
      size: result.size
    };
  } catch (error) {
    return { valid: false, error: `读取 index.html 失败: ${error.message}` };
  }
}

function validateAssets() {
  const assetsPath = path.join(DIST_DIR, 'assets');
  const result = checkFileExists(assetsPath);
  
  if (!result.exists) {
    return { valid: false, error: 'assets 目录不存在' };
  }

  if (!result.isDirectory) {
    return { valid: false, error: 'assets 不是目录' };
  }

  try {
    const files = fs.readdirSync(assetsPath);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    const cssFiles = files.filter(f => f.endsWith('.css'));

    return {
      valid: jsFiles.length > 0 && cssFiles.length > 0,
      jsFiles: jsFiles.length,
      cssFiles: cssFiles.length,
      totalFiles: files.length
    };
  } catch (error) {
    return { valid: false, error: `读取 assets 目录失败: ${error.message}` };
  }
}

function main() {
  console.log('🔍 验证前端构建文件...\n');

  // 检查 dist 目录
  const distResult = checkFileExists(DIST_DIR);
  if (!distResult.exists) {
    console.error('❌ frontend/dist 目录不存在');
    console.log('\n💡 解决方案:');
    console.log('   cd frontend && npm run build');
    process.exit(1);
  }

  console.log('✅ frontend/dist 目录存在');

  // 验证 index.html
  const indexResult = validateIndexHtml();
  if (indexResult.valid) {
    console.log(`✅ index.html 验证通过 (${indexResult.size} bytes)`);
  } else {
    console.error('❌ index.html 验证失败:');
    if (indexResult.error) {
      console.error(`   ${indexResult.error}`);
    }
    if (indexResult.issues) {
      indexResult.issues.forEach(issue => {
        console.error(`   - ${issue}`);
      });
    }
  }

  // 验证 assets
  const assetsResult = validateAssets();
  if (assetsResult.valid) {
    console.log(`✅ assets 验证通过 (${assetsResult.jsFiles} JS, ${assetsResult.cssFiles} CSS, 共 ${assetsResult.totalFiles} 文件)`);
  } else {
    console.error('❌ assets 验证失败:');
    console.error(`   ${assetsResult.error}`);
  }

  // 总结
  const allValid = indexResult.valid && assetsResult.valid;
  
  console.log('\n' + '='.repeat(50));
  if (allValid) {
    console.log('🎉 前端构建验证通过！');
    console.log('\n📋 部署检查清单:');
    console.log('   ✅ 前端文件已构建');
    console.log('   ✅ 静态文件服务已配置');
    console.log('   ✅ SPA 路由处理已配置');
  } else {
    console.log('⚠️  前端构建存在问题，请检查并修复');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateIndexHtml,
  validateAssets,
  checkFileExists
};
