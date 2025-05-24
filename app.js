const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // uuid is still used for generating IDs in routes
const db = require('./db/database'); // Import the database instance
const fs = require('fs'); // 文件系统模块
const morgan = require('morgan'); // HTTP request logger
const logger = require('./config/logger'); // Winston logger
const config = require('./config/env'); // 环境变量配置

// 验证环境变量
try {
  config.validate();
} catch (error) {
  logger.error('环境变量验证失败:', error.message);
  if (config.isProduction()) {
    process.exit(1);
  }
}

const app = express();
const PORT = config.port;

// --- HTTP Request Logging with Morgan and Winston ---
// Morgan stream to Winston
const morganStream = {
  write: (message) => {
    logger.info(message.trim()); // Log HTTP requests at info level
  },
};
// Setup morgan to use the stream with 'combined' format for detailed logs
// or use 'dev' for colorized concise output during development
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream: morganStream }));
// --- End HTTP Request Logging ---

// --- 新增：认证相关配置 ---
const AUTH_CONFIG_PATH = path.join(__dirname, 'auth_config.json');
const IP_WHITELIST_PATH = path.join(__dirname, 'ip_whitelist.json');

let currentPassword = null;
let ipWhitelist = {
  passwordAtWhitelisting: '',
  ips: []
};

// 加载认证配置
function loadAuthConfig() {
  try {
    if (fs.existsSync(AUTH_CONFIG_PATH)) {
      const rawConfig = fs.readFileSync(AUTH_CONFIG_PATH);
      const config = JSON.parse(rawConfig);
      if (config.password) {
        currentPassword = config.password;
        logger.info("用户认证密码已加载。");
      } else {
        logger.error("错误：auth_config.json 文件中未找到 'password' 字段。用户认证功能将无法正常工作。");
        // 在这种情况下，我们可能不应该启动，或者让认证始终失败
        currentPassword = uuidv4(); // 设置一个几乎不可能匹配的密码
      }
    } else {
      logger.error(`错误：认证配置文件 ${AUTH_CONFIG_PATH} 未找到。请创建该文件并设置密码，例如: {"password": "your_secure_password"}`);
      // 可以选择在这里退出应用 process.exit(1); 或设置一个默认的安全机制
      fs.writeFileSync(AUTH_CONFIG_PATH, JSON.stringify({ password: "changeme_please_ASAP_!" }, null, 2));
      currentPassword = "changeme_please_ASAP_!";
      logger.info("已生成默认 auth_config.json，请立即修改密码！");
    }
  } catch (error) {
    logger.error('加载 auth_config.json 失败:', { message: error.message, stack: error.stack });
    currentPassword = uuidv4(); // 安全回退
  }
}

// 加载和校验IP白名单
function loadAndValidateIpWhitelist() {
  try {
    if (fs.existsSync(IP_WHITELIST_PATH)) {
      const rawWhitelist = fs.readFileSync(IP_WHITELIST_PATH);
      ipWhitelist = JSON.parse(rawWhitelist);
    } else {
      // 白名单文件不存在，初始化
      ipWhitelist = { passwordAtWhitelisting: currentPassword, ips: [] };
      fs.writeFileSync(IP_WHITELIST_PATH, JSON.stringify(ipWhitelist, null, 2));
      logger.info('IP白名单文件不存在，已创建新的白名单。');
    }

    // 检查密码是否已更改
    if (currentPassword && ipWhitelist.passwordAtWhitelisting !== currentPassword) {
      logger.info('主密码已更改，清空IP白名单。');
      ipWhitelist.ips = [];
      ipWhitelist.passwordAtWhitelisting = currentPassword;
      fs.writeFileSync(IP_WHITELIST_PATH, JSON.stringify(ipWhitelist, null, 2));
    }
  } catch (error) {
    logger.error('加载或校验IP白名单失败:', { message: error.message, stack: error.stack });
    // 如果加载失败，为了安全起见，可以清空内存中的白名单
    ipWhitelist = { passwordAtWhitelisting: currentPassword, ips: [] };
     // 尝试重新写入一个干净的文件
    try {
        fs.writeFileSync(IP_WHITELIST_PATH, JSON.stringify(ipWhitelist, null, 2));
    } catch (writeError) {
        logger.error('无法写入新的IP白名单文件:', { message: writeError.message, stack: writeError.stack });
    }
  }
}

loadAuthConfig(); // 应用启动时加载密码
if (currentPassword !== "changeme_please_ASAP_!" && currentPassword !== null) { // 仅在密码有效时加载白名单
    loadAndValidateIpWhitelist(); // 然后加载和校验IP白名单
}


// 用户认证中间件
function userAuthMiddleware(req, res, next) {
  if (!currentPassword || currentPassword === "changeme_please_ASAP_!") {
      logger.warn("警告：用户认证密码未正确配置或仍为默认值。请检查 auth_config.json。", { path: req.path, ip: req.ip });
      // 考虑是否应该完全阻止访问，或者显示更严重的服务不可用页面
      return res.status(503).send('系统认证服务暂不可用，请联系管理员。');
  }
  const clientIp = req.ip; // Express 会处理 X-Forwarded-For (如果 trust proxy 设置了)

  if (ipWhitelist.ips.includes(clientIp)) {
    logger.debug(`IP白名单用户访问: ${clientIp} -> ${req.path}`);
    return next(); // IP在白名单中，允许访问
  } else {
    // IP不在白名单中，重定向到登录页面
    // 可以将会话或查询参数用于登录成功后的重定向，但简单起见直接重定向
    logger.info(`非白名单IP ${clientIp} 尝试访问 ${req.path}，重定向到登录页。`);
    res.redirect('/login-user-page');
  }
}
// --- 认证相关配置结束 ---

// 中间件
// 注意：如果你打算在 Nginx 等反向代理后面运行此应用，请确保设置 'trust proxy'
// 例如: app.set('trust proxy', true); 或者 app.set('trust proxy', 'loopback');
// 这对于 req.ip 正确解析客户端真实IP地址很重要。
// app.set('trust proxy', true); // 根据您的部署环境取消注释并配置

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// app.use('/xlsx', express.static(path.join(__dirname, 'node_modules/xlsx/dist'))); // 已移除xlsx库

// 添加CORS支持
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// API Routes
const ordersRoutes = require('./routes/ordersRoutes');
const quotesRoutes = require('./routes/quotesRoutes');
const providersRoutes = require('./routes/providersRoutes');
// app.use('/api/ai', aiRoutes); // AI路由已迁移到前端直接调用
const exportRoutes = require('./routes/exportRoutes'); // 导出路由

app.use('/api/orders', ordersRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/quotes', require('./routes/quotesOptimized')); // 优化的报价路由
app.use('/api/providers', providersRoutes);
app.use('/api/export', exportRoutes); // 添加导出路由

// 前端路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

// 用户端登录页面
app.get('/login-user-page', (req, res) => {
  // 可以传递错误信息给登录页面
  const errorMessage = req.query.error || '';
  // 为了简单，直接发送HTML文件，或者使用模板引擎渲染错误信息
  res.sendFile(path.join(__dirname, 'views', 'login_user.html'));
});

// 用户认证接口
app.post('/authenticate-user', (req, res) => {
  const submittedPassword = req.body.password;
  const clientIp = req.ip;

  if (!currentPassword) {
      logger.error('用户认证失败：认证服务配置错误。', { ip: clientIp });
      return res.status(500).send('认证服务配置错误。');
  }

  if (submittedPassword === currentPassword) {
    if (!ipWhitelist.ips.includes(clientIp)) {
      ipWhitelist.ips.push(clientIp);
      ipWhitelist.passwordAtWhitelisting = currentPassword; // 确保这个也更新
      try {
        fs.writeFileSync(IP_WHITELIST_PATH, JSON.stringify(ipWhitelist, null, 2));
        logger.info(`IP ${clientIp} 已添加到白名单。`);
      } catch (error) {
        logger.error('保存IP白名单失败:', { ip: clientIp, message: error.message, stack: error.stack });
        // 即使保存失败，也应该允许本次登录（已经在内存中），但记录错误
      }
    }
    logger.info(`用户 ${clientIp} 认证成功，重定向到 /user`);
    res.redirect('/user');
  } else {
    // 密码错误，重定向回登录页并带上错误提示
    // 注意：在URL中传递错误信息可能不是最安全的方式，但对于内部系统是可接受的。
    // 更健壮的方法是使用会话和 flash 消息。
    // 为了避免密码直接出现在URL中，我们这里使用一个通用的错误标识
    logger.warn(`用户 ${clientIp} 密码错误尝试登录。`);
    res.redirect('/login-user-page?error=1');
  }
});


// 修改后的 /user 路由，应用认证中间件
app.get('/user', userAuthMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/provider/:accessKey', (req, res) => {
  const accessKey = req.params.accessKey;
  db.get('SELECT id, name FROM providers WHERE accessKey = ?', [accessKey], (err, provider) => {
    if (err) {
      logger.error('校验供应商 accessKey 失败:', { accessKey, message: err.message, stack: err.stack });
      return res.status(500).send('服务器错误');
    }
    if (!provider) {
      logger.warn('无效的供应商 accessKey 尝试访问:', { accessKey, ip: req.ip });
      return res.status(404).send('页面未找到或无效的访问链接。请确保链接正确，或联系管理员。');
    }
    logger.debug(`供应商 ${provider.name} (${accessKey}) 访问页面。`);
  res.sendFile(path.join(__dirname, 'views', 'provider.html'));
  });
});

// The routes for PUT /api/orders/:id, PUT /api/orders/:id/close,
// and POST /api/orders/:id/quotes have been moved to wlbj/routes/ordersRoutes.js

// 全局错误处理中间件 (示例)
app.use((err, req, res, next) => {
  logger.error('未捕获的服务器错误:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  res.status(500).send('服务器内部错误，请稍后重试。');
});

// 关闭应用时关闭数据库连接
process.on('SIGINT', () => {
  logger.info('收到 SIGINT 信号，准备关闭应用...');
  db.close((err) => {
    if (err) {
      logger.error('关闭数据库连接失败:', { message: err.message, stack: err.stack });
      process.exit(1); // 带错误码退出
    }
    logger.info('数据库连接已关闭。');
    process.exit(0);
  });
});

// 启动服务器
app.listen(PORT, () => {
  logger.info(`服务器运行在 http://localhost:${PORT}`);
  if (currentPassword === "changeme_please_ASAP_!") {
    logger.warn(`安全警告：请立即修改 ${AUTH_CONFIG_PATH} 中的默认密码！`);
  }
});