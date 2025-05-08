const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保数据文件夹存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const ordersFile = path.join(dataDir, 'orders.json');
const quotesFile = path.join(dataDir, 'quotes.json');

// 如果数据文件不存在，创建它们
if (!fs.existsSync(ordersFile)) {
  fs.writeFileSync(ordersFile, JSON.stringify([]));
}
if (!fs.existsSync(quotesFile)) {
  fs.writeFileSync(quotesFile, JSON.stringify([]));
}

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 添加CORS支持
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// 路由 - 获取所有订单
app.get('/api/orders', (req, res) => {
  const orders = JSON.parse(fs.readFileSync(ordersFile));
  res.json(orders);
});

// 提交新订单
app.post('/api/orders', (req, res) => {
  const orders = JSON.parse(fs.readFileSync(ordersFile));
  const newOrder = {
    id: Date.now().toString(),
    warehouse: req.body.warehouse,
    goods: req.body.goods,
    deliveryAddress: req.body.deliveryAddress,
    createdAt: new Date().toISOString()
  };
  
  orders.push(newOrder);
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
  res.status(201).json(newOrder);
});

// 获取单个订单
app.get('/api/orders/:id', (req, res) => {
  const orders = JSON.parse(fs.readFileSync(ordersFile));
  const order = orders.find(o => o.id === req.params.id);
  
  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ message: '订单未找到' });
  }
});

// 获取订单的报价
app.get('/api/orders/:id/quotes', (req, res) => {
  const quotes = JSON.parse(fs.readFileSync(quotesFile));
  const orderQuotes = quotes.filter(q => q.orderId === req.params.id);
  
  // 按价格排序
  orderQuotes.sort((a, b) => a.price - b.price);
  
  res.json(orderQuotes);
});

// 提交新报价
app.post('/api/quotes', (req, res) => {
  const quotes = JSON.parse(fs.readFileSync(quotesFile));
  const newQuote = {
    id: Date.now().toString(),
    orderId: req.body.orderId,
    provider: req.body.provider,
    price: parseFloat(req.body.price),
    estimatedDelivery: req.body.estimatedDelivery,
    createdAt: new Date().toISOString()
  };
  
  quotes.push(newQuote);
  fs.writeFileSync(quotesFile, JSON.stringify(quotes, null, 2));
  res.status(201).json(newQuote);
});

// 前端路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/provider', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'provider.html'));
});

// 更新订单
app.put('/api/orders/:id', (req, res) => {
  try {
    const orderId = req.params.id;
    const { warehouse, goods, deliveryAddress } = req.body;
    
    // 简单验证
    if (!warehouse || !goods || !deliveryAddress) {
      return res.status(400).json({ error: '所有字段都是必填的' });
    }
    
    // 读取订单文件
    const ordersFile = path.join(dataDir, 'orders.json');
    if (!fs.existsSync(ordersFile)) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    let orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    const orderIndex = orders.findIndex(o => o.id === orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    // 更新订单信息，保留其他字段不变
    orders[orderIndex] = {
      ...orders[orderIndex],
      warehouse,
      goods,
      deliveryAddress,
      updatedAt: new Date().toISOString()
    };
    
    // 保存回文件
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
    
    res.json(orders[orderIndex]);
  } catch (error) {
    console.error('更新订单失败:', error);
    res.status(500).json({ error: '更新订单失败' });
  }
});

// 为订单添加报价
app.post('/api/orders/:id/quotes', (req, res) => {
  try {
    const orderId = req.params.id;
    const { provider, price, estimatedDelivery } = req.body;
    
    // 简单验证
    if (!provider || !price || !estimatedDelivery) {
      return res.status(400).json({ error: '所有字段都是必填的' });
    }
    
    const quote = {
      id: uuidv4(),
      orderId,
      provider,
      price: parseFloat(price),
      estimatedDelivery,
      createdAt: new Date().toISOString()
    };
    
    // 保存到文件
    const quotesFile = path.join(dataDir, 'quotes.json');
    let quotes = [];
    
    if (fs.existsSync(quotesFile)) {
      quotes = JSON.parse(fs.readFileSync(quotesFile, 'utf8'));
    }
    
    quotes.push(quote);
    fs.writeFileSync(quotesFile, JSON.stringify(quotes, null, 2));
    
    res.status(201).json(quote);
  } catch (error) {
    console.error('创建报价失败:', error);
    res.status(500).json({ error: '创建报价失败' });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 