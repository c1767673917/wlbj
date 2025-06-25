/**
 * 集成测试环境变量设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// 数据库配置
process.env.TEST_DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.TEST_DB_PORT = process.env.TEST_DB_PORT || '5432';
process.env.TEST_DB_NAME = process.env.TEST_DB_NAME || 'wlbj_test';
process.env.TEST_DB_USER = process.env.TEST_DB_USER || 'postgres';
process.env.TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'password';

// JWT配置
process.env.TEST_JWT_SECRET = process.env.TEST_JWT_SECRET || 'test-jwt-secret-key';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-integration-testing';

// 服务器配置
process.env.TEST_SERVER_HOST = process.env.TEST_SERVER_HOST || 'localhost';
process.env.TEST_SERVER_PORT = process.env.TEST_SERVER_PORT || '3001';

// 应用配置
process.env.DB_CLIENT = 'sqlite3';
process.env.DB_FILENAME = ':memory:'; // 使用内存数据库
process.env.BCRYPT_ROUNDS = '4'; // 降低加密轮数以加快测试
process.env.RATE_LIMIT_WINDOW_MS = '60000'; // 1分钟
process.env.RATE_LIMIT_MAX_REQUESTS = '1000'; // 测试环境放宽限制

// 禁用不必要的服务
process.env.DISABLE_EMAIL_SERVICE = 'true';
process.env.DISABLE_NOTIFICATION_SERVICE = 'true';
process.env.ENABLE_METRICS = 'false';
process.env.BACKUP_ENABLED = 'false';

console.log('✅ 集成测试环境变量设置完成');
