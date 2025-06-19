/**
 * CORS配置修复脚本
 *
 * 功能：
 * 1. 修复app.js中过于宽松的CORS配置
 * 2. 添加环境变量控制的CORS域名白名单
 * 3. 增强安全性验证
 * 4. 验证修复效果
 */

const fs = require('fs');
const path = require('path');

class CORSConfigFixer {
  constructor() {
    this.projectRoot = path.join(__dirname, '../..');
    this.appPath = path.join(this.projectRoot, 'app.js');
    this.envPath = path.join(this.projectRoot, '.env');
    this.envExamplePath = path.join(this.projectRoot, 'env.example');
    this.configPath = path.join(this.projectRoot, 'config/env.js');
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

  // 更新环境变量配置
  updateEnvFile() {
    this.log('更新.env文件中的CORS配置...');

    let envContent = '';
    if (fs.existsSync(this.envPath)) {
      envContent = fs.readFileSync(this.envPath, 'utf8');
    } else if (fs.existsSync(this.envExamplePath)) {
      // 如果.env不存在，从env.example复制
      envContent = fs.readFileSync(this.envExamplePath, 'utf8');
      this.log('从env.example创建.env文件');
    }

    // 更新或添加CORS_ORIGIN
    const corsOriginRegex = /^CORS_ORIGIN=.*$/m;
    const defaultCorsOrigin = 'http://localhost:5173,http://localhost:3000';

    if (corsOriginRegex.test(envContent)) {
      // 检查当前值是否为通配符
      const currentMatch = envContent.match(corsOriginRegex);
      if (currentMatch && currentMatch[0].includes('*')) {
        envContent = envContent.replace(corsOriginRegex, `CORS_ORIGIN=${defaultCorsOrigin}`);
        this.log('已将CORS_ORIGIN从通配符更新为具体域名');
      } else {
        this.log('CORS_ORIGIN已存在且不是通配符，保持不变');
      }
    } else {
      envContent += `\n# CORS配置（生产环境建议限制）\nCORS_ORIGIN=${defaultCorsOrigin}\n`;
      this.log('已添加新的CORS_ORIGIN配置');
    }

    fs.writeFileSync(this.envPath, envContent);
    this.log('✅ .env文件更新完成');
  }

  // 修复app.js中的CORS配置
  fixAppJsCORS() {
    this.log('修复app.js中的CORS配置...');

    if (!fs.existsSync(this.appPath)) {
      this.log('app.js文件不存在', 'error');
      return false;
    }

    this.backupFile(this.appPath);
    let content = fs.readFileSync(this.appPath, 'utf8');

    // 查找现有的CORS配置
    const corsPattern = /\/\/ 添加CORS支持[\s\S]*?next\(\);\s*}\);/;

    const newCorsCode = `// 添加CORS支持
app.use((req, res, next) => {
  const allowedOrigins = process.env.CORS_ORIGIN ? 
    process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
    (config.isProduction() ? [] : ['http://localhost:5173', 'http://localhost:3000']);
  
  const origin = req.headers.origin;
  
  // 检查请求来源是否在允许列表中
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!config.isProduction() && !origin) {
    // 开发环境允许无来源的请求（如Postman）
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (config.isProduction() && allowedOrigins.length === 0) {
    // 生产环境未配置允许域名时的警告
    logger.warn('生产环境未配置CORS_ORIGIN，拒绝跨域请求', { origin });
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24小时预检缓存

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
});`;

    if (corsPattern.test(content)) {
      content = content.replace(corsPattern, newCorsCode);
      this.log('已更新现有的CORS配置');
    } else {
      // 如果没找到现有配置，查找插入位置
      const insertPattern = /app\.use\(sanitizeMiddleware\);/;
      if (insertPattern.test(content)) {
        content = content.replace(
          insertPattern,
          `app.use(sanitizeMiddleware);

${newCorsCode}`
        );
        this.log('已添加新的CORS配置');
      } else {
        this.log('未找到合适的插入位置，请手动添加CORS配置', 'warn');
        return false;
      }
    }

    fs.writeFileSync(this.appPath, content);
    this.log('✅ app.js CORS配置修复完成');
    return true;
  }

  // 更新config/env.js添加CORS验证
  updateConfigValidation() {
    this.log('更新config/env.js添加CORS验证...');

    if (!fs.existsSync(this.configPath)) {
      this.log('config/env.js文件不存在，跳过验证更新', 'warn');
      return;
    }

    this.backupFile(this.configPath);
    let content = fs.readFileSync(this.configPath, 'utf8');

    // 添加CORS配置到config对象
    const configPattern = /\/\/ 代理配置\s*trustProxy: process\.env\.TRUST_PROXY \|\| 'auto',/;
    if (configPattern.test(content)) {
      const corsConfigCode = `// 代理配置
  trustProxy: process.env.TRUST_PROXY || 'auto', // auto, true, false, loopback, 或具体IP

  // CORS配置
  corsOrigin: process.env.CORS_ORIGIN || '',`;

      content = content.replace(configPattern, corsConfigCode);
      this.log('已添加CORS配置到config对象');
    }

    // 添加CORS验证到validate函数
    const validateFunctionRegex = /validate:\s*\(\)\s*=>\s*{([\s\S]*?)}/;
    const match = content.match(validateFunctionRegex);

    if (match) {
      const validateBody = match[1];

      // 检查是否已经有CORS验证
      if (!validateBody.includes('CORS_ORIGIN')) {
        const corsValidation = `
    // CORS配置验证
    if (config.isProduction() && (!config.corsOrigin || config.corsOrigin === '*')) {
      errors.push('CORS_ORIGIN must be configured with specific domains in production');
    }
    
    if (config.corsOrigin && config.corsOrigin !== '*') {
      const origins = config.corsOrigin.split(',').map(o => o.trim());
      const invalidOrigins = origins.filter(origin => {
        try {
          new URL(origin);
          return false;
        } catch {
          return true;
        }
      });
      
      if (invalidOrigins.length > 0) {
        errors.push(\`Invalid CORS origins: \${invalidOrigins.join(', ')}\`);
      }
    }`;

        const newValidateBody = validateBody + corsValidation;
        content = content.replace(validateFunctionRegex, `validate: () => {${newValidateBody}}`);
        this.log('已添加CORS配置验证');
      }
    }

    fs.writeFileSync(this.configPath, content);
    this.log('✅ config/env.js CORS验证更新完成');
  }

  // 创建CORS测试脚本
  createCORSTestScript() {
    this.log('创建CORS测试脚本...');

    const testScriptPath = path.join(__dirname, 'test-cors-config.js');
    const testScript = `#!/usr/bin/env node

/**
 * CORS配置测试脚本
 */

const http = require('http');

class CORSConfigTester {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.testOrigins = [
      'http://localhost:5173',
      'http://localhost:3000', 
      'https://evil-site.com',
      null // 无来源请求
    ];
  }

  async testCORS() {
    console.log('开始CORS配置测试...\\n');

    for (const origin of this.testOrigins) {
      await this.testOrigin(origin);
    }

    console.log('\\nCORS配置测试完成');
  }

  async testOrigin(origin) {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/orders/active',
        method: 'OPTIONS',
        headers: origin ? { 'Origin': origin } : {}
      };

      const req = http.request(options, (res) => {
        const allowOrigin = res.headers['access-control-allow-origin'];
        const status = res.statusCode;

        console.log(\`测试来源: \${origin || '无来源'}\`);
        console.log(\`  状态码: \${status}\`);
        console.log(\`  允许来源: \${allowOrigin || '未设置'}\`);
        
        if (origin && allowOrigin === origin) {
          console.log('  结果: ✅ 允许访问');
        } else if (!origin && allowOrigin === '*') {
          console.log('  结果: ✅ 允许无来源访问（开发环境）');
        } else if (origin && !allowOrigin) {
          console.log('  结果: ❌ 拒绝访问');
        } else {
          console.log('  结果: ⚠️  未知状态');
        }
        console.log('');
        
        resolve();
      });

      req.on('error', (err) => {
        console.log(\`测试来源: \${origin || '无来源'}\`);
        console.log(\`  错误: \${err.message}\`);
        console.log('');
        resolve();
      });

      req.end();
    });
  }
}

if (require.main === module) {
  const tester = new CORSConfigTester();
  tester.testCORS();
}

module.exports = CORSConfigTester;`;

    fs.writeFileSync(testScriptPath, testScript);
    fs.chmodSync(testScriptPath, '755');
    this.log(`✅ CORS测试脚本已创建: ${testScriptPath}`);
  }

  // 验证修复效果
  async verifyFix() {
    this.log('验证CORS配置修复效果...');

    try {
      // 检查app.js是否不再包含通配符CORS
      if (fs.existsSync(this.appPath)) {
        const appContent = fs.readFileSync(this.appPath, 'utf8');

        // 检查是否还有简单的通配符设置
        if (
          appContent.includes("setHeader('Access-Control-Allow-Origin', '*')") &&
          !appContent.includes('!config.isProduction()')
        ) {
          this.log('验证失败：app.js中仍存在无条件的通配符CORS设置', 'error');
          return false;
        }

        // 检查是否包含新的安全配置
        if (!appContent.includes('allowedOrigins') || !appContent.includes('CORS_ORIGIN')) {
          this.log('验证失败：app.js中缺少新的CORS安全配置', 'error');
          return false;
        }

        this.log('✅ app.js CORS配置验证通过');
      }

      // 检查环境变量配置
      if (fs.existsSync(this.envPath)) {
        const envContent = fs.readFileSync(this.envPath, 'utf8');

        if (!envContent.includes('CORS_ORIGIN=')) {
          this.log('验证失败：.env文件中缺少CORS_ORIGIN配置', 'error');
          return false;
        }

        this.log('✅ 环境变量CORS配置验证通过');
      }

      // 检查配置验证
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf8');

        if (!configContent.includes('CORS_ORIGIN must be configured')) {
          this.log('验证警告：config/env.js中缺少CORS验证逻辑', 'warn');
        } else {
          this.log('✅ 配置验证逻辑验证通过');
        }
      }

      this.log('✅ CORS配置修复验证成功');
      return true;
    } catch (error) {
      this.log(`验证过程出错：${error.message}`, 'error');
      return false;
    }
  }

  // 生成修复报告
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      action: 'CORS Configuration Fix',
      changes: [
        {
          file: '.env',
          action: 'Added CORS_ORIGIN configuration with specific domains',
        },
        {
          file: 'app.js',
          action: 'Replaced wildcard CORS with domain whitelist',
        },
        {
          file: 'config/env.js',
          action: 'Added CORS configuration validation',
        },
        {
          file: 'scripts/test-cors-config.js',
          action: 'Created CORS testing script',
        },
      ],
      securityImprovements: [
        '移除了允许所有来源的通配符CORS配置',
        '添加了基于环境变量的域名白名单',
        '增强了生产环境的CORS安全验证',
        '添加了预检请求缓存以提高性能',
      ],
      recommendations: [
        '在生产环境中设置CORS_ORIGIN为具体的域名列表',
        '定期审查和更新允许的域名列表',
        '使用CORS测试脚本验证配置是否正确',
        '监控CORS相关的错误日志',
      ],
    };

    const reportPath = path.join(__dirname, '../backups', `cors-fix-report-${Date.now()}.json`);

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
    this.log('开始CORS配置修复...');

    try {
      // 1. 更新环境变量配置
      this.updateEnvFile();

      // 2. 修复app.js中的CORS配置
      const appFixed = this.fixAppJsCORS();
      if (!appFixed) {
        this.log('app.js修复失败', 'error');
        return false;
      }

      // 3. 更新配置验证
      this.updateConfigValidation();

      // 4. 创建测试脚本
      this.createCORSTestScript();

      // 5. 验证修复效果
      const isValid = await this.verifyFix();
      if (!isValid) {
        this.log('修复验证失败，请检查错误信息', 'error');
        return false;
      }

      // 6. 生成修复报告
      const report = this.generateReport();

      this.log('🎉 CORS配置修复完成！');
      this.log('');
      this.log('重要提醒：');
      this.log('1. 请重启应用服务器以使新配置生效');
      this.log('2. 在生产环境中设置CORS_ORIGIN为具体的域名列表');
      this.log('3. 使用 node scripts/test-cors-config.js 测试CORS配置');
      this.log('4. 监控应用日志以确保CORS配置正常工作');

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
  const fixer = new CORSConfigFixer();
  fixer.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = CORSConfigFixer;
