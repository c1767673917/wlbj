const winston = require('winston');
const path = require('path');

// 创建 logs 目录 (如果不存在)
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs'); // logs 目录在 wlbj/logs
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const { combine, timestamp, printf, colorize, align, json } = winston.format;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS A',
    }),
    align(),
    printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
      ),
    }),
    // 应用日志文件
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      level: 'info', // 只记录 info 及以上级别的日志
      maxsize: 1024 * 1024 * 10, // 10MB
      maxFiles: 5, // 最多保留5个日志文件
      tailable: true,
    }),
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error', // 只记录 error 级别的日志
      handleExceptions: true, // 记录未捕获的异常
      handleRejections: true, // 记录未处理的 Promise rejections
      maxsize: 1024 * 1024 * 10, // 10MB
      maxFiles: 3,
      tailable: true,
    }),
  ],
});

module.exports = logger; 