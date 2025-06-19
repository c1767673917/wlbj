/**
 * JWT安全修复脚本
 *
 * 功能：
 * 1. 生成强随机JWT密钥
 * 2. 更新环境变量配置
 * 3. 修复代码中的默认值
 * 4. 验证修复效果
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class JWTSecurityFixer {
  constructor() {
    this.projectRoot = path.join(__dirname, '../..');
    this.envPath = path.join(this.projectRoot, '.env');
    this.envExamplePath = path.join(this.projectRoot, 'env.example');
    this.configPath = path.join(this.projectRoot, 'config/env.js');
    this.authUtilPath = path.join(this.projectRoot, 'utils/auth.js');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '✅';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  // 生成强随机JWT密钥
  generateSecureJWTSecret() {
    // 生成64字节（512位）的随机密钥
    const secret = crypto.randomBytes(64).toString('hex');
    this.log(`生成新的JWT密钥: ${secret.substring(0, 16)}...（已截断显示）`);
    return secret;
  }

  // 备份原始文件
  backupFile(filePath) {
    if (fs.existsSync(filePath)) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      this.log(`已备份文件: ${path.basename(filePath)} -> ${path.basename(backupPath)}`);
      return backupPath;
    }
    return null;
  }

  // 更新.env文件
  updateEnvFile(newSecret) {
    this.log('更新.env文件中的JWT_SECRET...');

    let envContent = '';
    if (fs.existsSync(this.envPath)) {
      envContent = fs.readFileSync(this.envPath, 'utf8');
    } else if (fs.existsSync(this.envExamplePath)) {
      // 如果.env不存在，从env.example复制
      envContent = fs.readFileSync(this.envExamplePath, 'utf8');
      this.log('从env.example创建.env文件');
    }

    // 更新或添加JWT_SECRET
    const jwtSecretRegex = /^JWT_SECRET=.*$/m;
    if (jwtSecretRegex.test(envContent)) {
      envContent = envContent.replace(jwtSecretRegex, `JWT_SECRET=${newSecret}`);
      this.log('已更新现有的JWT_SECRET');
    } else {
      envContent += `\n# JWT配置\nJWT_SECRET=${newSecret}\n`;
      this.log('已添加新的JWT_SECRET');
    }

    fs.writeFileSync(this.envPath, envContent);
    this.log('✅ .env文件更新完成');
  }

  // 修复config/env.js中的默认值
  fixConfigFile() {
    this.log('修复config/env.js中的默认值...');

    if (!fs.existsSync(this.configPath)) {
      this.log('config/env.js文件不存在，跳过修复', 'warn');
      return;
    }

    this.backupFile(this.configPath);
    let content = fs.readFileSync(this.configPath, 'utf8');

    // 替换默认的JWT密钥配置
    const oldPattern = /jwtSecret:\s*process\.env\.JWT_SECRET\s*\|\|\s*['"`][^'"`]*['"`]/;
    const newPattern = `jwtSecret: process.env.JWT_SECRET || (() => {
    if (config.isProduction()) {
      throw new Error('JWT_SECRET must be set in production environment');
    }
    return 'dev-only-secret-' + Date.now();
  })()`;

    if (oldPattern.test(content)) {
      content = content.replace(oldPattern, newPattern);
      this.log('已修复config/env.js中的JWT密钥配置');
    }

    // 添加更严格的验证
    const validateFunctionRegex = /validate:\s*\(\)\s*=>\s*{([\s\S]*?)}/;
    const match = content.match(validateFunctionRegex);

    if (match) {
      const validateBody = match[1];

      // 检查是否已经有JWT密钥验证
      if (!validateBody.includes('JWT_SECRET')) {
        const additionalValidation = `
    // JWT密钥安全验证
    if (config.jwtSecret.includes('default') || config.jwtSecret.includes('change')) {
      errors.push('JWT_SECRET contains default values, must be changed');
    }
    if (config.jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }`;

        const newValidateBody = validateBody + additionalValidation;
        content = content.replace(validateFunctionRegex, `validate: () => {${newValidateBody}}`);
        this.log('已添加JWT密钥安全验证');
      }
    }

    fs.writeFileSync(this.configPath, content);
    this.log('✅ config/env.js修复完成');
  }

  // 修复utils/auth.js中的默认值
  fixAuthUtilFile() {
    this.log('修复utils/auth.js中的默认值...');

    if (!fs.existsSync(this.authUtilPath)) {
      this.log('utils/auth.js文件不存在，跳过修复', 'warn');
      return;
    }

    this.backupFile(this.authUtilPath);
    let content = fs.readFileSync(this.authUtilPath, 'utf8');

    // 替换直接定义的JWT_SECRET
    const oldSecretPattern =
      /const\s+JWT_SECRET\s*=\s*process\.env\.JWT_SECRET\s*\|\|\s*['"`][^'"`]*['"`]/;
    const newSecretPattern = `const config = require('../config/env');
const JWT_SECRET = config.jwtSecret`;

    if (oldSecretPattern.test(content)) {
      content = content.replace(oldSecretPattern, newSecretPattern);

      // 确保导入了config模块
      if (!content.includes("require('../config/env')")) {
        const requirePattern = /const\s+\w+\s*=\s*require\([^)]+\);?\s*$/m;
        const lastRequire = content.match(requirePattern);
        if (lastRequire) {
          content = content.replace(
            lastRequire[0],
            lastRequire[0] + "\nconst config = require('../config/env');"
          );
        }
      }

      this.log('已修复utils/auth.js中的JWT密钥配置');
    }

    fs.writeFileSync(this.authUtilPath, content);
    this.log('✅ utils/auth.js修复完成');
  }

  // 验证修复效果
  async verifyFix() {
    this.log('验证修复效果...');

    try {
      // 清除require缓存
      delete require.cache[require.resolve(this.configPath)];

      // 重新加载配置
      const config = require(this.configPath);

      // 检查JWT密钥
      if (
        !config.jwtSecret ||
        config.jwtSecret.includes('default') ||
        config.jwtSecret.includes('change')
      ) {
        this.log('验证失败：JWT密钥仍然包含默认值', 'error');
        return false;
      }

      if (config.jwtSecret.length < 32) {
        this.log('验证失败：JWT密钥长度不足32字符', 'error');
        return false;
      }

      // 测试配置验证函数
      try {
        config.validate();
        this.log('✅ 配置验证通过');
      } catch (error) {
        this.log(`验证失败：${error.message}`, 'error');
        return false;
      }

      this.log('✅ JWT安全修复验证成功');
      return true;
    } catch (error) {
      this.log(`验证过程出错：${error.message}`, 'error');
      return false;
    }
  }

  // 生成修复报告
  generateReport(newSecret) {
    const report = {
      timestamp: new Date().toISOString(),
      action: 'JWT Security Fix',
      changes: [
        {
          file: '.env',
          action: 'Updated JWT_SECRET with secure random value',
        },
        {
          file: 'config/env.js',
          action: 'Removed default JWT secret, added validation',
        },
        {
          file: 'utils/auth.js',
          action: 'Updated to use centralized config',
        },
      ],
      newSecretLength: newSecret.length,
      recommendations: [
        '重启应用服务器以使新配置生效',
        '所有现有的JWT令牌将失效，用户需要重新登录',
        '确保生产环境的JWT_SECRET环境变量已正确设置',
        '定期轮换JWT密钥以提高安全性',
      ],
    };

    const reportPath = path.join(__dirname, '../backups', `jwt-fix-report-${Date.now()}.json`);

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
    this.log('开始JWT安全修复...');

    try {
      // 1. 生成新的JWT密钥
      const newSecret = this.generateSecureJWTSecret();

      // 2. 更新.env文件
      this.updateEnvFile(newSecret);

      // 3. 修复配置文件
      this.fixConfigFile();

      // 4. 修复工具文件
      this.fixAuthUtilFile();

      // 5. 验证修复效果
      const isValid = await this.verifyFix();

      if (!isValid) {
        this.log('修复验证失败，请检查错误信息', 'error');
        return false;
      }

      // 6. 生成修复报告
      const report = this.generateReport(newSecret);

      this.log('🎉 JWT安全修复完成！');
      this.log('');
      this.log('重要提醒：');
      this.log('1. 请重启应用服务器以使新配置生效');
      this.log('2. 所有现有的JWT令牌将失效，用户需要重新登录');
      this.log('3. 确保生产环境的JWT_SECRET环境变量已正确设置');

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
  const fixer = new JWTSecurityFixer();
  fixer.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = JWTSecurityFixer;
