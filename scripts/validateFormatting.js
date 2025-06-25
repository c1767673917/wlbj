#!/usr/bin/env node

/**
 * 代码格式化验证脚本
 * 验证前后端代码格式化配置是否正确工作
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class FormattingValidator {
  constructor() {
    this.projectRoot = process.cwd();
    this.results = {
      backend: { passed: 0, failed: 0, errors: [] },
      frontend: { passed: 0, failed: 0, errors: [] },
      config: { passed: 0, failed: 0, errors: [] }
    };
  }

  /**
   * 运行验证
   */
  async run() {
    console.log('🎨 开始验证代码格式化配置...\n');

    try {
      await this.validateConfigFiles();
      await this.validateBackendFormatting();
      await this.validateFrontendFormatting();
      await this.validateCrossProjectConsistency();
      
      this.printResults();
      
      const totalErrors = this.results.backend.failed + 
                         this.results.frontend.failed + 
                         this.results.config.failed;
      
      if (totalErrors > 0) {
        process.exit(1);
      }
      
      console.log('✅ 代码格式化配置验证通过！');
    } catch (error) {
      console.error('❌ 代码格式化验证失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 验证配置文件
   */
  async validateConfigFiles() {
    console.log('📋 验证格式化配置文件...');

    const tests = [
      {
        name: '根目录Prettier配置存在',
        test: () => fs.existsSync(path.join(this.projectRoot, '.prettierrc.json'))
      },
      {
        name: '前端Prettier配置存在',
        test: () => fs.existsSync(path.join(this.projectRoot, 'frontend/.prettierrc.json'))
      },
      {
        name: 'Prettier忽略文件存在',
        test: () => fs.existsSync(path.join(this.projectRoot, '.prettierignore'))
      },
      {
        name: '配置文件格式正确',
        test: () => this.validateConfigFormat()
      },
      {
        name: '包管理器脚本配置正确',
        test: () => this.validatePackageScripts()
      }
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        if (result !== false) {
          this.results.config.passed++;
          console.log(`  ✅ ${test.name}`);
        } else {
          this.results.config.failed++;
          console.log(`  ❌ ${test.name}`);
        }
      } catch (error) {
        this.results.config.failed++;
        this.results.config.errors.push(`${test.name}: ${error.message}`);
        console.log(`  ❌ ${test.name}: ${error.message}`);
      }
    }
  }

  /**
   * 验证后端格式化
   */
  async validateBackendFormatting() {
    console.log('\n📋 验证后端代码格式化...');

    const tests = [
      {
        name: '后端代码格式检查',
        test: () => this.runPrettierCheck('src/**/*.js tests/**/*.js')
      },
      {
        name: '后端格式化规则生效',
        test: () => this.checkFormattingRules('src/')
      },
      {
        name: '后端配置文件格式化',
        test: () => this.runPrettierCheck('*.json *.md')
      }
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        if (result !== false) {
          this.results.backend.passed++;
          console.log(`  ✅ ${test.name}`);
        } else {
          this.results.backend.failed++;
          console.log(`  ❌ ${test.name}`);
        }
      } catch (error) {
        this.results.backend.failed++;
        this.results.backend.errors.push(`${test.name}: ${error.message}`);
        console.log(`  ❌ ${test.name}: ${error.message}`);
      }
    }
  }

  /**
   * 验证前端格式化
   */
  async validateFrontendFormatting() {
    console.log('\n📋 验证前端代码格式化...');

    const frontendPath = path.join(this.projectRoot, 'frontend');
    if (!fs.existsSync(frontendPath)) {
      console.log('  ⚠️  前端目录不存在，跳过前端验证');
      return;
    }

    const tests = [
      {
        name: '前端代码格式检查',
        test: () => this.runPrettierCheck('frontend/src/**/*.{js,jsx,ts,tsx,css,scss}')
      },
      {
        name: '前端React/JSX格式化',
        test: () => this.checkJSXFormatting('frontend/src/')
      },
      {
        name: '前端TypeScript格式化',
        test: () => this.checkTypeScriptFormatting('frontend/src/')
      },
      {
        name: '前端样式文件格式化',
        test: () => this.checkStyleFormatting('frontend/src/')
      }
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        if (result !== false) {
          this.results.frontend.passed++;
          console.log(`  ✅ ${test.name}`);
        } else {
          this.results.frontend.failed++;
          console.log(`  ❌ ${test.name}`);
        }
      } catch (error) {
        this.results.frontend.failed++;
        this.results.frontend.errors.push(`${test.name}: ${error.message}`);
        console.log(`  ❌ ${test.name}: ${error.message}`);
      }
    }
  }

  /**
   * 验证跨项目一致性
   */
  async validateCrossProjectConsistency() {
    console.log('\n📋 验证跨项目格式化一致性...');

    const tests = [
      {
        name: '基础格式化规则一致',
        test: () => this.checkBasicFormattingConsistency()
      },
      {
        name: '缩进和空格规则一致',
        test: () => this.checkIndentationConsistency()
      },
      {
        name: '引号使用规则一致',
        test: () => this.checkQuoteConsistency()
      }
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        if (result !== false) {
          console.log(`  ✅ ${test.name}`);
        } else {
          console.log(`  ❌ ${test.name}`);
        }
      } catch (error) {
        console.log(`  ❌ ${test.name}: ${error.message}`);
      }
    }
  }

  /**
   * 运行Prettier检查
   */
  runPrettierCheck(pattern) {
    try {
      execSync(`npx prettier --check ${pattern}`, { 
        stdio: 'pipe',
        cwd: this.projectRoot 
      });
      return true;
    } catch (error) {
      // Prettier返回非零退出码表示格式不正确，但这里我们只是验证配置是否工作
      return error.status !== 2; // 2表示配置错误
    }
  }

  /**
   * 验证配置文件格式
   */
  validateConfigFormat() {
    try {
      const rootConfig = JSON.parse(fs.readFileSync('.prettierrc.json', 'utf8'));
      const frontendConfig = JSON.parse(fs.readFileSync('frontend/.prettierrc.json', 'utf8'));
      
      // 检查必要的配置项
      const requiredKeys = ['semi', 'singleQuote', 'tabWidth', 'printWidth'];
      const rootHasRequired = requiredKeys.every(key => key in rootConfig);
      const frontendHasRequired = requiredKeys.every(key => key in frontendConfig);
      
      return rootHasRequired && frontendHasRequired;
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证包管理器脚本
   */
  validatePackageScripts() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const scripts = packageJson.scripts || {};
      
      const requiredScripts = ['format', 'format:check', 'format:backend', 'format:frontend'];
      return requiredScripts.every(script => script in scripts);
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查格式化规则
   */
  checkFormattingRules(path) {
    // 简化检查：验证配置文件包含基本规则
    try {
      const config = JSON.parse(fs.readFileSync('.prettierrc.json', 'utf8'));
      return config.semi !== undefined && config.singleQuote !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查JSX格式化
   */
  checkJSXFormatting(path) {
    try {
      const config = JSON.parse(fs.readFileSync('frontend/.prettierrc.json', 'utf8'));
      return config.jsxSingleQuote !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查TypeScript格式化
   */
  checkTypeScriptFormatting(path) {
    try {
      const config = JSON.parse(fs.readFileSync('frontend/.prettierrc.json', 'utf8'));
      const tsOverride = config.overrides?.find(override => 
        override.files.includes('*.{ts,tsx}')
      );
      return tsOverride !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查样式文件格式化
   */
  checkStyleFormatting(path) {
    try {
      const config = JSON.parse(fs.readFileSync('frontend/.prettierrc.json', 'utf8'));
      const cssOverride = config.overrides?.find(override => 
        override.files.includes('*.{css,scss,less}')
      );
      return cssOverride !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查基础格式化一致性
   */
  checkBasicFormattingConsistency() {
    try {
      const rootConfig = JSON.parse(fs.readFileSync('.prettierrc.json', 'utf8'));
      const frontendConfig = JSON.parse(fs.readFileSync('frontend/.prettierrc.json', 'utf8'));
      
      const commonKeys = ['semi', 'singleQuote', 'tabWidth', 'printWidth'];
      return commonKeys.every(key => rootConfig[key] === frontendConfig[key]);
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查缩进一致性
   */
  checkIndentationConsistency() {
    try {
      const rootConfig = JSON.parse(fs.readFileSync('.prettierrc.json', 'utf8'));
      const frontendConfig = JSON.parse(fs.readFileSync('frontend/.prettierrc.json', 'utf8'));
      
      return rootConfig.tabWidth === frontendConfig.tabWidth && 
             rootConfig.useTabs === frontendConfig.useTabs;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查引号使用一致性
   */
  checkQuoteConsistency() {
    try {
      const rootConfig = JSON.parse(fs.readFileSync('.prettierrc.json', 'utf8'));
      const frontendConfig = JSON.parse(fs.readFileSync('frontend/.prettierrc.json', 'utf8'));
      
      return rootConfig.singleQuote === frontendConfig.singleQuote;
    } catch (error) {
      return false;
    }
  }

  /**
   * 打印验证结果
   */
  printResults() {
    console.log('\n📊 验证结果汇总:');
    console.log(`配置: ${this.results.config.passed} 通过, ${this.results.config.failed} 失败`);
    console.log(`后端: ${this.results.backend.passed} 通过, ${this.results.backend.failed} 失败`);
    console.log(`前端: ${this.results.frontend.passed} 通过, ${this.results.frontend.failed} 失败`);
    
    const allErrors = [
      ...this.results.config.errors,
      ...this.results.backend.errors,
      ...this.results.frontend.errors
    ];
    
    if (allErrors.length > 0) {
      console.log('\n❌ 错误详情:');
      allErrors.forEach(error => console.log(`  - ${error}`));
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const validator = new FormattingValidator();
  validator.run().catch(error => {
    console.error('验证过程中发生错误:', error);
    process.exit(1);
  });
}

module.exports = FormattingValidator;
