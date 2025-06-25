/**
 * 测试环境变量设置
 * 为所有测试设置必要的环境变量
 */

// 设置测试环境
process.env.NODE_ENV = 'test';

// 数据库配置
process.env.DB_TYPE = 'sqlite';
process.env.DB_PATH = ':memory:';

// JWT配置
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
process.env.JWT_EXPIRES_IN = '1h';

// 服务器配置
process.env.PORT = '0'; // 使用随机端口
process.env.HOST = 'localhost';

// 日志配置
process.env.LOG_LEVEL = 'error'; // 减少测试时的日志输出

// 邮件配置（测试模式）
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'test-password';

// 文件上传配置
process.env.UPLOAD_DIR = './tests/temp/uploads';
process.env.MAX_FILE_SIZE = '10485760'; // 10MB

// 缓存配置
process.env.REDIS_URL = 'redis://localhost:6379/15'; // 使用测试数据库

// 安全配置
process.env.BCRYPT_ROUNDS = '4'; // 降低加密轮数以提高测试速度
process.env.RATE_LIMIT_WINDOW = '900000'; // 15分钟
process.env.RATE_LIMIT_MAX = '1000'; // 测试环境放宽限制

// API配置
process.env.API_VERSION = 'v1';
process.env.API_PREFIX = '/api';

// 第三方服务配置（测试模式）
process.env.EXTERNAL_API_TIMEOUT = '5000';
process.env.EXTERNAL_API_RETRIES = '2';

console.log('✅ 测试环境变量设置完成');
