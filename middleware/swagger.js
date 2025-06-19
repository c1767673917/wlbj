/**
 * Swagger API文档中间件
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerConfig = require('../docs/api/swagger.config');

// 生成Swagger规范
let specs;
try {
  specs = swaggerJsdoc(swaggerConfig);
  console.log('✅ Swagger规范生成成功');
} catch (error) {
  console.error('❌ Swagger规范生成失败:', error.message);
  specs = {
    openapi: '3.0.0',
    info: {
      title: '物流报价系统 API',
      version: '2.0.0',
      description: '物流报价系统的RESTful API文档',
    },
    paths: {},
  };
}

// Swagger UI选项
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
  },
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
  specs,
};
