#!/usr/bin/env node

/**
 * P2级API文档集成脚本
 *
 * 功能：
 * 1. 安装Swagger相关依赖
 * 2. 配置Swagger UI和OpenAPI规范
 * 3. 创建API文档结构
 * 4. 生成路由文档模板
 * 5. 设置自动文档生成
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ApiDocsSetup {
  constructor() {
    this.projectRoot = path.join(__dirname, '../..');
    this.docsDir = path.join(this.projectRoot, 'docs/api');
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix =
      type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  // 安装Swagger依赖
  async installSwaggerDependencies() {
    this.log('安装Swagger相关依赖...');

    const swaggerDependencies = [
      'swagger-ui-express@^5.0.0',
      'swagger-jsdoc@^6.2.8',
      'yamljs@^0.3.0',
      '@apidevtools/swagger-parser@^10.1.0',
    ];

    try {
      this.log('正在安装Swagger依赖...');
      const installCommand = `npm install ${swaggerDependencies.join(' ')}`;
      execSync(installCommand, {
        cwd: this.projectRoot,
        stdio: 'inherit',
      });

      this.log('✅ Swagger依赖安装完成', 'success');
      return true;
    } catch (error) {
      this.log(`Swagger依赖安装失败: ${error.message}`, 'error');
      return false;
    }
  }

  // 创建文档目录结构
  createDocsDirectories() {
    this.log('创建API文档目录结构...');

    const directories = [
      'docs/api',
      'docs/api/schemas',
      'docs/api/examples',
      'docs/api/routes',
      'docs/api/components',
    ];

    directories.forEach(dir => {
      const fullPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        this.log(`创建目录: ${dir}`);
      }
    });

    this.log('✅ API文档目录结构创建完成', 'success');
    return true;
  }

  // 创建Swagger配置
  createSwaggerConfig() {
    this.log('创建Swagger配置...');

    const swaggerConfig = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: '物流报价系统 API',
          version: '2.0.0',
          description: '物流报价系统的RESTful API文档',
          contact: {
            name: 'API支持',
            email: 'support@logistics-quote.com',
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT',
          },
        },
        servers: [
          {
            url: 'http://localhost:3000',
            description: '开发环境',
          },
          {
            url: 'https://api.logistics-quote.com',
            description: '生产环境',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
          schemas: {
            Error: {
              type: 'object',
              properties: {
                error: {
                  type: 'string',
                  description: '错误消息',
                },
                code: {
                  type: 'string',
                  description: '错误代码',
                },
              },
            },
            User: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: '用户ID',
                },
                username: {
                  type: 'string',
                  description: '用户名',
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: '邮箱地址',
                },
                role: {
                  type: 'string',
                  enum: ['admin', 'user', 'provider'],
                  description: '用户角色',
                },
                created_at: {
                  type: 'string',
                  format: 'date-time',
                  description: '创建时间',
                },
              },
            },
            Order: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: '订单ID',
                },
                user_id: {
                  type: 'integer',
                  description: '用户ID',
                },
                provider_id: {
                  type: 'integer',
                  description: '供应商ID',
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'quoted', 'confirmed', 'completed', 'cancelled'],
                  description: '订单状态',
                },
                details: {
                  type: 'object',
                  description: '订单详情',
                },
                created_at: {
                  type: 'string',
                  format: 'date-time',
                  description: '创建时间',
                },
              },
            },
            Provider: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: '供应商ID',
                },
                name: {
                  type: 'string',
                  description: '供应商名称',
                },
                api_url: {
                  type: 'string',
                  format: 'uri',
                  description: 'API地址',
                },
                status: {
                  type: 'string',
                  enum: ['active', 'inactive'],
                  description: '状态',
                },
              },
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      apis: ['./routes/*.js', './docs/api/routes/*.yaml'],
    };

    const configPath = path.join(this.projectRoot, 'docs/api/swagger.config.js');
    const configContent = `module.exports = ${JSON.stringify(swaggerConfig, null, 2)};`;

    fs.writeFileSync(configPath, configContent);

    this.log('✅ Swagger配置创建完成', 'success');
    return true;
  }

  // 创建Swagger中间件
  createSwaggerMiddleware() {
    this.log('创建Swagger中间件...');

    const middlewareContent = `/**
 * Swagger API文档中间件
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerConfig = require('../docs/api/swagger.config');

// 生成Swagger规范
const specs = swaggerJsdoc(swaggerConfig);

// Swagger UI选项
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true
  }
};

/**
 * 设置Swagger文档路由
 * @param {Express} app - Express应用实例
 */
function setupSwagger(app) {
  // API文档JSON端点
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Swagger UI界面
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(specs, swaggerUiOptions));

  console.log('📚 API文档已启用:');
  console.log('   - Swagger UI: http://localhost:3000/api-docs');
  console.log('   - OpenAPI JSON: http://localhost:3000/api-docs.json');
}

module.exports = {
  setupSwagger,
  specs
};`;

    const middlewarePath = path.join(this.projectRoot, 'middleware/swagger.js');
    fs.writeFileSync(middlewarePath, middlewareContent);

    this.log('✅ Swagger中间件创建完成', 'success');
    return true;
  }

  // 创建路由文档模板
  createRouteDocTemplates() {
    this.log('创建路由文档模板...');

    // 认证路由文档
    const authDocsContent = `# 认证相关API

## 用户登录
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 用户登录
 *     tags: [认证]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户名
 *               password:
 *                 type: string
 *                 description: 密码
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT访问令牌
 *                 refreshToken:
 *                   type: string
 *                   description: 刷新令牌
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: 认证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

## 用户注册
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 用户注册
 *     tags: [认证]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户名
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 邮箱地址
 *               password:
 *                 type: string
 *                 description: 密码
 *     responses:
 *       201:
 *         description: 注册成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */`;

    const authDocsPath = path.join(this.docsDir, 'routes/auth.yaml');
    fs.writeFileSync(authDocsPath, authDocsContent);

    this.log('✅ 路由文档模板创建完成', 'success');
    return true;
  }

  // 主执行方法
  async run() {
    this.log('🚀 开始API文档集成...');

    try {
      // 安装Swagger依赖
      if (!(await this.installSwaggerDependencies())) {
        throw new Error('Swagger依赖安装失败');
      }

      // 创建目录和配置
      this.createDocsDirectories();
      this.createSwaggerConfig();
      this.createSwaggerMiddleware();
      this.createRouteDocTemplates();

      const duration = Date.now() - this.startTime;
      this.log(`🎉 API文档集成完成！用时: ${Math.round(duration / 1000)}秒`, 'success');

      this.log('');
      this.log('📋 下一步操作：');
      this.log('1. 在app.js中引入Swagger中间件');
      this.log('2. 访问 http://localhost:3000/api-docs 查看文档');
      this.log('3. 在路由文件中添加JSDoc注释');
      this.log('4. 在docs/api/routes/目录下添加YAML文档');

      return true;
    } catch (error) {
      this.log(`API文档集成失败: ${error.message}`, 'error');
      return false;
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const setup = new ApiDocsSetup();
  setup.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = ApiDocsSetup;
