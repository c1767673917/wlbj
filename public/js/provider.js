document.addEventListener('DOMContentLoaded', function() {
  // 加载物流商信息
  loadProviderInfo();
  
  // 加载可报价订单
  loadAvailableOrders();
  
  // 加载历史报价
  loadProviderHistory();
  
  // 绑定物流商信息表单提交事件
  document.getElementById('provider-info-form').addEventListener('submit', function(e) {
    e.preventDefault();
    saveProviderInfo();
  });
  
  // 绑定报价表单提交事件
  document.getElementById('quote-form').addEventListener('submit', function(e) {
    e.preventDefault();
    submitQuote();
  });
});

// 本地存储物流商信息的键
const PROVIDER_INFO_KEY = 'logisticsProviderInfo';

// 加载物流商信息
function loadProviderInfo() {
  const providerInfo = JSON.parse(localStorage.getItem(PROVIDER_INFO_KEY) || '{}');
  
  if (providerInfo.name) {
    document.getElementById('providerName').value = providerInfo.name;
  }
}

// 保存物流商信息
function saveProviderInfo() {
  const providerName = document.getElementById('providerName').value;
  
  const providerInfo = { name: providerName };
  localStorage.setItem(PROVIDER_INFO_KEY, JSON.stringify(providerInfo));
  
  alert('物流商信息保存成功！');
  
  // 刷新可报价订单和历史
  loadAvailableOrders();
  loadProviderHistory();
}

// 加载可报价订单
function loadAvailableOrders() {
  fetch('/api/orders')
    .then(response => response.json())
    .then(orders => {
      displayAvailableOrders(orders);
    })
    .catch(error => console.error('加载订单失败:', error));
}

// 显示可报价订单
function displayAvailableOrders(orders) {
  const ordersTableBody = document.querySelector('#available-orders-table tbody');
  ordersTableBody.innerHTML = '';
  
  if (orders.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6" style="text-align: center;">暂无可报价订单</td>';
    ordersTableBody.appendChild(emptyRow);
    return;
  }
  
  // 按时间排序，最新的在前面
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // 获取已经提交过报价的订单ID
  const providerName = getProviderName();
  let quotedOrderIds = [];
  
  if (providerName) {
    const quotes = JSON.parse(localStorage.getItem(`${providerName}_quotes`) || '[]');
    quotedOrderIds = quotes.map(quote => quote.orderId);
  }
  
  // 过滤掉已经报价过的订单
  const availableOrders = orders.filter(order => !quotedOrderIds.includes(order.id));
  
  if (availableOrders.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6" style="text-align: center;">暂无可报价订单或您已为所有订单提供报价</td>';
    ordersTableBody.appendChild(emptyRow);
    return;
  }
  
  availableOrders.forEach(order => {
    const row = document.createElement('tr');
    const createdDate = new Date(order.createdAt).toLocaleString('zh-CN');
    
    row.innerHTML = `
      <td>${order.id.substring(0, 8)}</td>
      <td>${order.warehouse}</td>
      <td>${order.goods}</td>
      <td>${order.deliveryAddress}</td>
      <td>${createdDate}</td>
      <td class="action-cell">
        <button onclick="showQuoteForm('${order.id}')">提交报价</button>
      </td>
    `;
    
    ordersTableBody.appendChild(row);
  });
}

// 显示报价表单
function showQuoteForm(orderId) {
  // 获取订单详情
  fetch(`/api/orders/${orderId}`)
    .then(response => response.json())
    .then(order => {
      displayOrderDetailsForQuote(order);
      
      // 显示报价表单
      document.getElementById('quote-form-container').style.display = 'block';
      document.getElementById('quoteOrderId').value = order.id;
      
      // 滚动到表单位置
      document.getElementById('quote-form-container').scrollIntoView({ behavior: 'smooth' });
    })
    .catch(error => console.error('获取订单详情失败:', error));
}

// 显示订单详情(用于报价)
function displayOrderDetailsForQuote(order) {
  const orderDetails = document.getElementById('quote-order-details');
  const createdDate = new Date(order.createdAt).toLocaleString('zh-CN');
  
  orderDetails.innerHTML = `
    <h3>订单 #${order.id.substring(0, 8)} 详情</h3>
    <p><strong>发货仓库:</strong> ${order.warehouse}</p>
    <p><strong>货物信息:</strong> ${order.goods}</p>
    <p><strong>收货信息:</strong> ${order.deliveryAddress}</p>
    <p><strong>发布时间:</strong> ${createdDate}</p>
  `;
}

// 提交报价
function submitQuote() {
  const providerName = getProviderName();
  
  if (!providerName) {
    alert('请先填写并保存物流商名称！');
    return;
  }
  
  const quoteData = {
    orderId: document.getElementById('quoteOrderId').value,
    provider: providerName,
    price: parseFloat(document.getElementById('price').value),
    estimatedDelivery: document.getElementById('estimatedDelivery').value
  };
  
  // 提交到服务器
  fetch('/api/quotes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(quoteData)
  })
    .then(response => response.json())
    .then(quote => {
      // 保存到本地历史
      saveQuoteToLocalHistory(quote);
      
      // 重置表单
      document.getElementById('quote-form').reset();
      document.getElementById('quote-form-container').style.display = 'none';
      
      // 刷新订单列表和历史
      loadAvailableOrders();
      loadProviderHistory();
      
      alert('报价提交成功！');
    })
    .catch(error => console.error('提交报价失败:', error));
}

// 保存报价到本地历史
function saveQuoteToLocalHistory(quote) {
  const providerName = getProviderName();
  const localStorageKey = `${providerName}_quotes`;
  
  let providerQuotes = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
  providerQuotes.push(quote);
  
  localStorage.setItem(localStorageKey, JSON.stringify(providerQuotes));
}

// 加载物流商历史报价
function loadProviderHistory() {
  const providerName = getProviderName();
  
  if (!providerName) {
    const historyTableBody = document.querySelector('#provider-history-table tbody');
    historyTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">请先设置物流商名称</td></tr>';
    return;
  }
  
  const localStorageKey = `${providerName}_quotes`;
  const providerQuotes = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
  
  displayProviderHistory(providerQuotes);
}

// 显示物流商历史报价
function displayProviderHistory(quotes) {
  const historyTableBody = document.querySelector('#provider-history-table tbody');
  historyTableBody.innerHTML = '';
  
  if (quotes.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6" style="text-align: center;">暂无报价历史</td>';
    historyTableBody.appendChild(emptyRow);
    return;
  }
  
  // 按时间排序，最新的在前面
  quotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // 创建一个队列，用于跟踪加载中的数据
  const loadingQueue = [];
  
  quotes.forEach(quote => {
    // 添加到加载队列
    const loadingPromise = fetch(`/api/orders/${quote.orderId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('订单不存在');
        }
        return response.json();
      })
      .then(order => {
        const row = document.createElement('tr');
        const quoteDate = new Date(quote.createdAt).toLocaleString('zh-CN');
        
        row.innerHTML = `
          <td>${quote.orderId.substring(0, 8)}</td>
          <td>${order.warehouse}</td>
          <td>${order.deliveryAddress}</td>
          <td>¥${quote.price.toFixed(2)}</td>
          <td>${quote.estimatedDelivery}</td>
          <td>${quoteDate}</td>
        `;
        
        historyTableBody.appendChild(row);
      })
      .catch(error => {
        console.error(`无法加载订单 ${quote.orderId} 的详情:`, error);
      });
    
    loadingQueue.push(loadingPromise);
  });
  
  // 如果所有请求都失败
  Promise.all(loadingQueue).catch(() => {
    if (historyTableBody.children.length === 0) {
      const errorRow = document.createElement('tr');
      errorRow.innerHTML = '<td colspan="6" style="text-align: center;">加载报价历史时出错</td>';
      historyTableBody.appendChild(errorRow);
    }
  });
}

// 获取物流商名称
function getProviderName() {
  const providerInfo = JSON.parse(localStorage.getItem(PROVIDER_INFO_KEY) || '{}');
  return providerInfo.name || '';
} 