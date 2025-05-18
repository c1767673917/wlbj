const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // uuid is still used for generating IDs in routes
const db = require('./db/database'); // Import the database instance

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/xlsx', express.static(path.join(__dirname, 'node_modules/xlsx/dist')));

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

app.use('/api/orders', ordersRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/providers', providersRoutes);

// 前端路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/provider/:accessKey', (req, res) => {
  const accessKey = req.params.accessKey;
  db.get('SELECT id, name FROM providers WHERE accessKey = ?', [accessKey], (err, provider) => {
    if (err) {
      console.error('Error validating accessKey:', err);
      return res.status(500).send('服务器错误');
    }
    if (!provider) {
      return res.status(404).send('页面未找到或无效的访问链接。请确保链接正确，或联系管理员。');
    }
  res.sendFile(path.join(__dirname, 'views', 'provider.html'));
  });
});

// The routes for PUT /api/orders/:id, PUT /api/orders/:id/close,
// and POST /api/orders/:id/quotes have been moved to wlbj/routes/ordersRoutes.js

// 关闭应用时关闭数据库连接
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      return console.error('Error closing database:', err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 