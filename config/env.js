// 环境变量配置模块
require('dotenv').config();

const config = {
  // 应用基础配置
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // API密钥配置
  siliconFlowApiKey: process.env.SILICON_FLOW_API_KEY || '',
  
  // 数据库配置
  databaseUrl: process.env.DATABASE_URL || '',
  
  // 安全配置
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_change_in_production',
  appPassword: process.env.APP_PASSWORD || '',
  
  // 开发模式检查
  isDevelopment: () => config.nodeEnv === 'development',
  isProduction: () => config.nodeEnv === 'production',
  
  // 验证必需的环境变量
  validate: () => {
    const errors = [];
    
    if (!config.siliconFlowApiKey && config.isProduction()) {
      errors.push('SILICON_FLOW_API_KEY is required in production');
    }
    
    if (!config.appPassword && config.isProduction()) {
      errors.push('APP_PASSWORD is required in production');
    }
    
    if (config.jwtSecret === 'default_jwt_secret_change_in_production' && config.isProduction()) {
      errors.push('JWT_SECRET must be changed in production');
    }
    
    if (errors.length > 0) {
      throw new Error('Environment validation failed:\n' + errors.join('\n'));
    }
    
    return true;
  }
};

module.exports = config; 