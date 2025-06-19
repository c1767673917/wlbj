/**
 * P2级代码质量改进脚本
 *
 * 功能：
 * 1. 配置ESLint和Prettier
 * 2. 设置Git Hooks
 * 3. 添加代码复杂度分析
 * 4. 创建代码质量检查脚本
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CodeQualityImprover {
  constructor() {
    this.projectRoot = path.join(__dirname, '../..');
    this.backupDir = path.join(__dirname, '../backups');
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix =
      type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  // 检查Node.js和npm版本
  checkPrerequisites() {
    this.log('检查系统环境...');

    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();

      this.log(`Node.js版本: ${nodeVersion}`);
      this.log(`npm版本: ${npmVersion}`);

      // 检查Node.js版本是否支持（需要14+）
      const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
      if (majorVersion < 14) {
        throw new Error(`Node.js版本过低，需要14+，当前版本: ${nodeVersion}`);
      }

      return true;
    } catch (error) {
      this.log(`环境检查失败: ${error.message}`, 'error');
      return false;
    }
  }

  // 安装代码质量工具依赖
  async installDependencies() {
    this.log('安装代码质量工具依赖...');

    const devDependencies = [
      'eslint@^8.57.0',
      'prettier@^3.0.0',
      'eslint-config-prettier@^9.0.0',
      'eslint-plugin-prettier@^5.0.0',
      'eslint-plugin-node@^11.1.0',
      'husky@^8.0.0',
      'lint-staged@^15.0.0',
      'eslint-plugin-complexity@^1.0.2',
      'jscpd@^3.5.0',
    ];

    try {
      this.log('正在安装开发依赖...');
      const installCommand = `npm install --save-dev ${devDependencies.join(' ')}`;
      execSync(installCommand, {
        cwd: this.projectRoot,
        stdio: 'inherit',
      });

      this.log('✅ 依赖安装完成', 'success');
      return true;
    } catch (error) {
      this.log(`依赖安装失败: ${error.message}`, 'error');
      return false;
    }
  }

  // 创建ESLint配置
  createESLintConfig() {
    this.log('创建ESLint配置...');

    const eslintConfig = {
      env: {
        node: true,
        es2021: true,
        jest: true,
      },
      extends: ['eslint:recommended', 'plugin:node/recommended', 'prettier'],
      plugins: ['prettier'],
      parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module',
      },
      rules: {
        'prettier/prettier': 'error',
        'no-console': 'warn',
        'no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
          },
        ],
        'prefer-const': 'error',
        'no-var': 'error',
        'no-undef': 'error',
        'no-unreachable': 'error',
        'no-duplicate-imports': 'error',
        'no-useless-return': 'error',
        'consistent-return': 'error',
        curly: ['error', 'all'],
        eqeqeq: ['error', 'always'],
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-script-url': 'error',
        'node/no-missing-import': 'off',
        'node/no-unpublished-require': 'off',
      },
      ignorePatterns: [
        'node_modules/',
        'dist/',
        'build/',
        'frontend/dist/',
        'frontend/node_modules/',
        'logs/',
        'data/',
        'backup/',
        'uploads/',
      ],
    };

    const configPath = path.join(this.projectRoot, '.eslintrc.json');
    fs.writeFileSync(configPath, JSON.stringify(eslintConfig, null, 2));

    this.log('✅ ESLint配置创建完成', 'success');
    return true;
  }

  // 创建Prettier配置
  createPrettierConfig() {
    this.log('创建Prettier配置...');

    const prettierConfig = {
      semi: true,
      trailingComma: 'es5',
      singleQuote: true,
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      bracketSpacing: true,
      arrowParens: 'avoid',
      endOfLine: 'lf',
      quoteProps: 'as-needed',
    };

    const configPath = path.join(this.projectRoot, '.prettierrc.json');
    fs.writeFileSync(configPath, JSON.stringify(prettierConfig, null, 2));

    // 创建.prettierignore文件
    const prettierIgnore = [
      'node_modules/',
      'dist/',
      'build/',
      'frontend/dist/',
      'frontend/node_modules/',
      'logs/',
      'data/',
      'backup/',
      'uploads/',
      '*.log',
      '*.db',
      '*.db-*',
      'package-lock.json',
    ].join('\n');

    const ignorePath = path.join(this.projectRoot, '.prettierignore');
    fs.writeFileSync(ignorePath, prettierIgnore);

    this.log('✅ Prettier配置创建完成', 'success');
    return true;
  }

  // 设置Git Hooks
  setupGitHooks() {
    this.log('设置Git Hooks...');

    try {
      // 初始化husky
      execSync('npx husky install', {
        cwd: this.projectRoot,
        stdio: 'inherit',
      });

      // 创建pre-commit hook
      const preCommitHook = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged`;

      const hooksDir = path.join(this.projectRoot, '.husky');
      if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
      }

      const preCommitPath = path.join(hooksDir, 'pre-commit');
      fs.writeFileSync(preCommitPath, preCommitHook);

      // 设置执行权限
      try {
        execSync(`chmod +x "${preCommitPath}"`);
      } catch (error) {
        // Windows系统可能不支持chmod，忽略错误
        this.log('注意：无法设置Git Hook执行权限（Windows系统正常）', 'warn');
      }

      this.log('✅ Git Hooks设置完成', 'success');
      return true;
    } catch (error) {
      this.log(`Git Hooks设置失败: ${error.message}`, 'error');
      return false;
    }
  }

  // 更新package.json脚本
  updatePackageScripts() {
    this.log('更新package.json脚本...');

    const packagePath = path.join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    // 添加新的脚本
    packageJson.scripts = {
      ...packageJson.scripts,
      lint: 'eslint . --ext .js',
      'lint:fix': 'eslint . --ext .js --fix',
      format: 'prettier --write "**/*.{js,json,md}"',
      'format:check': 'prettier --check "**/*.{js,json,md}"',
      'quality:check': 'npm run lint && npm run format:check',
      'quality:fix': 'npm run lint:fix && npm run format',
      complexity:
        'eslint --ext .js --format json --output-file complexity-report.json routes/ utils/ middleware/ || true',
      duplicate: 'npx jscpd --threshold 5 --reporters html,console .',
      'quality:full': 'npm run quality:check && npm run complexity && npm run duplicate',
      prepare: 'husky install',
    };

    // 添加lint-staged配置
    packageJson['lint-staged'] = {
      '*.js': ['eslint --fix', 'prettier --write'],
      '*.{json,md}': ['prettier --write'],
    };

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

    this.log('✅ package.json脚本更新完成', 'success');
    return true;
  }

  // 创建代码质量检查脚本
  createQualityCheckScript() {
    this.log('创建代码质量检查脚本...');

    const scriptContent = `#!/usr/bin/env node

/**
 * 代码质量检查脚本
 * 运行ESLint、Prettier、复杂度分析和重复代码检测
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
  console.log(\`[\${timestamp}] \${prefix} \${message}\`);
}

function runQualityChecks() {
  log('🔍 开始代码质量检查...');

  const checks = [
    {
      name: 'ESLint检查',
      command: 'npm run lint',
      required: true
    },
    {
      name: 'Prettier格式检查',
      command: 'npm run format:check',
      required: true
    },
    {
      name: '代码复杂度分析',
      command: 'npm run complexity',
      required: false
    },
    {
      name: '重复代码检测',
      command: 'npm run duplicate',
      required: false
    }
  ];

  let allPassed = true;
  const results = [];

  for (const check of checks) {
    log(\`运行: \${check.name}...\`);

    try {
      execSync(check.command, { stdio: 'inherit' });
      log(\`✅ \${check.name} 通过\`, 'success');
      results.push({ name: check.name, status: 'passed' });
    } catch (error) {
      const message = \`❌ \${check.name} 失败\`;
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
    results: results
  };

  const reportPath = path.join(__dirname, '../reports/quality-check-report.json');
  const reportDir = path.dirname(reportPath);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log(\`📋 质量检查报告已保存: \${reportPath}\`);

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

module.exports = { runQualityChecks };`;

    const scriptPath = path.join(this.projectRoot, 'scripts/code-quality-check.js');
    const scriptsDir = path.dirname(scriptPath);

    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    fs.writeFileSync(scriptPath, scriptContent);

    this.log('✅ 代码质量检查脚本创建完成', 'success');
    return true;
  }

  // 主执行方法
  async run() {
    this.log('🚀 开始P2级代码质量改进...');

    try {
      // 检查环境
      if (!this.checkPrerequisites()) {
        throw new Error('环境检查失败');
      }

      // 安装依赖
      if (!(await this.installDependencies())) {
        throw new Error('依赖安装失败');
      }

      // 创建配置文件
      this.createESLintConfig();
      this.createPrettierConfig();

      // 设置Git Hooks
      this.setupGitHooks();

      // 更新package.json
      this.updatePackageScripts();

      // 创建质量检查脚本
      this.createQualityCheckScript();

      const duration = Date.now() - this.startTime;
      this.log(`🎉 代码质量改进完成！用时: ${Math.round(duration / 1000)}秒`, 'success');

      this.log('');
      this.log('📋 下一步操作：');
      this.log('1. 运行 npm run quality:check 检查代码质量');
      this.log('2. 运行 npm run quality:fix 自动修复问题');
      this.log('3. 运行 npm run quality:full 完整质量分析');
      this.log('4. Git提交时会自动运行代码检查');

      return true;
    } catch (error) {
      this.log(`代码质量改进失败: ${error.message}`, 'error');
      return false;
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const improver = new CodeQualityImprover();
  improver.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = CodeQualityImprover;
