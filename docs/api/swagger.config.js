module.exports = {
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
