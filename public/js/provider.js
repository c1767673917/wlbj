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
  const providerName = getProviderName();
  
  if (!providerName) {
    const availableTableBody = document.querySelector('#available-orders-table tbody');
    availableTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">请先设置物流商名称</td></tr>';
    return;
  }

  // 获取所有订单
  fetch('/api/orders')
    .then(response => response.json())
    .then(orders => {
      // 获取该物流商已经报价的订单ID
      const localStorageKey = `${providerName}_quotes`;
      const providerQuotes = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
      const quotedOrderIds = providerQuotes.map(quote => quote.orderId);
      
      // 过滤出未报价订单
      const unquotedOrders = orders.filter(order => !quotedOrderIds.includes(order.id));
      displayUnquotedOrders(unquotedOrders);
    })
    .catch(error => console.error('加载订单失败:', error));
}

// 显示未报价订单列表
function displayUnquotedOrders(orders) {
  const availableTableBody = document.querySelector('#available-orders-table tbody');
  availableTableBody.innerHTML = '';
  
  if (orders.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6" style="text-align: center;">暂无可报价订单或您已为所有订单提供报价</td>';
    availableTableBody.appendChild(emptyRow);
    return;
  }
  
  // 按时间逆序排列，最新的在前面
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  orders.forEach(order => {
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
    
    availableTableBody.appendChild(row);
  });
}

// 显示报价表单
function showQuoteForm(orderId) {
  // 获取当前行（因为CSS :has选择器可能不被所有浏览器支持）
  const buttons = document.querySelectorAll('button');
  let orderRow = null;
  
  // 查找包含该orderID的按钮所在的行
  for (const button of buttons) {
    if (button.getAttribute('onclick') && button.getAttribute('onclick').includes(orderId)) {
      orderRow = button.closest('tr');
      break;
    }
  }
  
  if (!orderRow) return;
  
  // 检查是否已经有报价表单行
  const nextRow = orderRow.nextElementSibling;
  if (nextRow && nextRow.classList.contains('quote-form-row')) {
    nextRow.remove();
    return;
  }
  
  // 创建报价表单行
  const formRow = document.createElement('tr');
  formRow.className = 'quote-form-row';
  
  // 复制报价表单模板
  const formTemplate = document.getElementById('inline-quote-form-template');
  const formContent = formTemplate.content.cloneNode(true);
  
  // 设置订单ID
  formContent.querySelector('[name="orderId"]').value = orderId;
  
  // 绑定表单提交事件
  formContent.querySelector('form').addEventListener('submit', function(e) {
    e.preventDefault();
    submitQuote(this);
  });
  
  // 绑定取消按钮事件
  formContent.querySelector('.cancel-btn').addEventListener('click', function() {
    formRow.remove();
  });
  
  // 添加到DOM
  const formCell = document.createElement('td');
  formCell.colSpan = 6;
  formCell.appendChild(formContent);
  formRow.appendChild(formCell);
  
  // 插入到当前行后面
  orderRow.parentNode.insertBefore(formRow, orderRow.nextSibling);
  
  // 显示表单行
  formRow.style.display = 'table-row';
}

// 提交报价
function submitQuote(form) {
  const providerName = getProviderName();
  
  if (!providerName) {
    alert('请先填写并保存物流商名称！');
    return;
  }
  
  const orderId = form.querySelector('[name="orderId"]').value;
  const price = parseFloat(form.querySelector('[name="price"]').value);
  const estimatedDelivery = form.querySelector('[name="estimatedDelivery"]').value;
  
  const quoteData = {
    orderId: orderId,
    provider: providerName,
    price: price,
    estimatedDelivery: estimatedDelivery
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
      
      // 移除表单行
      const formRow = form.closest('tr');
      if (formRow) formRow.remove();
      
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
  
  if (providerQuotes.length === 0) {
    const historyTableBody = document.querySelector('#provider-history-table tbody');
    historyTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">暂无报价历史</td></tr>';
    return;
  }
  
  // 获取所有订单信息以便展示完整的报价历史
  fetch('/api/orders')
    .then(response => response.json())
    .then(orders => {
      displayProviderHistory(providerQuotes, orders);
    })
    .catch(error => {
      console.error('加载订单失败:', error);
      displayProviderHistory(providerQuotes, []);
    });
}

// 显示历史报价
function displayProviderHistory(quotes, orders) {
  const historyTableBody = document.querySelector('#provider-history-table tbody');
  
  // 检查物流商名称是否设置
  const providerName = getProviderName();
  if (!providerName) {
    historyTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">请先设置物流商名称</td></tr>';
    return;
  }
  
  // 按最新时间排序
  quotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  if (quotes.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6" style="text-align: center;">暂无报价历史</td>';
    historyTableBody.appendChild(emptyRow);
    return;
  }
  
  historyTableBody.innerHTML = '';
  
  quotes.forEach(quote => {
    const row = document.createElement('tr');
    const order = orders.find(o => o.id === quote.orderId);
    const createdDate = new Date(quote.createdAt).toLocaleString('zh-CN');
    
    if (order) {
      row.innerHTML = `
        <td>${order.id.substring(0, 8)}</td>
        <td>${order.warehouse}</td>
        <td>${order.deliveryAddress}</td>
        <td>${quote.price.toFixed(2)}</td>
        <td>${quote.estimatedDelivery}</td>
        <td>${createdDate}</td>
      `;
    } else {
      row.innerHTML = `
        <td>${quote.orderId.substring(0, 8)}</td>
        <td colspan="2">订单信息不可用</td>
        <td>${quote.price.toFixed(2)}</td>
        <td>${quote.estimatedDelivery}</td>
        <td>${createdDate}</td>
      `;
    }
    
    historyTableBody.appendChild(row);
  });
}

// 获取物流商名称
function getProviderName() {
  const providerInfo = JSON.parse(localStorage.getItem(PROVIDER_INFO_KEY) || '{}');
  return providerInfo.name || '';
} 