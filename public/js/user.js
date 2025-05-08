document.addEventListener('DOMContentLoaded', function() {
  // 加载所有订单
  loadOrders();
  
  // 绑定表单提交事件
  document.getElementById('new-order-form').addEventListener('submit', function(e) {
    e.preventDefault();
    submitNewOrder();
  });

  // 绑定AI识别按钮事件
  document.getElementById('ai-recognize-btn').addEventListener('click', function() {
    recognizeWithAI();
  });
});

// SiliconFlow API调用函数
async function callSiliconFlowAPI(content) {
  const apiKey = 'sk-mkwzawhynjmauuhvflpfjhfdijcvmutwswdtunhaoqnsvdos';
  const apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3-14B',
        messages: [
          {
            role: 'system',
            content: '你是一个物流信息提取专家。你需要从用户输入的文本中识别并提取以下信息：\n1. 发货仓库\n2. 货物信息(包括品名和数量)\n3. 收货信息(完整保留地址、联系人、电话、以及所有收货要求等)\n\n请以JSON格式返回结果，格式为{"warehouse": "提取的发货仓库", "goods": "提取的货物信息", "deliveryAddress": "提取的收货信息，包括完整地址、联系人、电话和所有收货要求，尽量保留原文"}'
          },
          {
            role: 'user',
            content: content
          }
        ],
        temperature: 0.2,
        enable_thinking: false  // Qwen3模型特有参数，关闭思考模式
      })
    });

    const endTime = Date.now();
    const timeElapsed = (endTime - startTime) / 1000;
    console.log(`API响应时间: ${timeElapsed.toFixed(2)}秒`);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('调用AI接口出错:', error);
    throw error;
  }
}

// AI识别函数
async function recognizeWithAI() {
  const aiInput = document.getElementById('ai-input').value.trim();
  
  if (!aiInput) {
    alert('请先输入综合物流信息进行识别');
    return;
  }
  
  // 显示加载状态
  const btn = document.getElementById('ai-recognize-btn');
  const originalContent = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span><span>识别中...</span>';
  
  try {
    const response = await callSiliconFlowAPI(aiInput);
    console.log('AI识别结果:', response);
    
    // 尝试从返回内容中提取JSON
    if (response.choices && response.choices.length > 0) {
      const content = response.choices[0].message.content;
      
      // 尝试提取JSON内容
      try {
        // 先尝试直接解析（如果返回的就是纯JSON）
        let jsonData;
        try {
          jsonData = JSON.parse(content);
        } catch (e) {
          // 如果不是纯JSON，尝试从文本中提取JSON部分
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('无法从返回内容中提取JSON');
          }
        }
        
        // 处理提取到的数据
        let warehouseValue = '';
        let goodsValue = '';
        let deliveryAddressValue = '';
        
        // 处理发货仓库
        if (jsonData.warehouse) {
          warehouseValue = jsonData.warehouse;
        }
        
        // 处理货物信息
        if (jsonData.goods) {
          if (Array.isArray(jsonData.goods)) {
            // 数组形式的货物信息
            goodsValue = jsonData.goods.map(item => {
              if (typeof item === 'object') {
                return `${item.name || ''} ${item.quantity || ''}`;
              } else {
                return item;
              }
            }).join('\n');
          } else if (typeof jsonData.goods === 'object') {
            // 对象形式的货物信息
            goodsValue = JSON.stringify(jsonData.goods, null, 2);
          } else {
            // 字符串形式的货物信息
            goodsValue = jsonData.goods;
          }
        }
        
        // 处理收货信息 - 直接使用原始字符串，不进行结构化处理
        if (jsonData.deliveryAddress) {
          if (typeof jsonData.deliveryAddress === 'object') {
            // 如果API返回了结构化对象，转换为纯文本格式
            const addr = jsonData.deliveryAddress;
            // 尝试直接获取原始字符串表示
            deliveryAddressValue = typeof addr === 'string' ? addr : JSON.stringify(addr, null, 2);
          } else {
            // 如果是字符串，直接使用
            deliveryAddressValue = jsonData.deliveryAddress;
          }
        }
        
        // 填充表单
        document.getElementById('warehouse').value = warehouseValue;
        document.getElementById('goods').value = goodsValue;
        document.getElementById('deliveryAddress').value = deliveryAddressValue;
        
        alert('AI识别成功，已自动填写表单');
      } catch (jsonError) {
        console.error('解析JSON失败:', jsonError, content);
        alert('无法解析AI返回的内容，请手动填写表单');
      }
    } else {
      alert('未获取到有效的AI识别结果，请手动填写表单');
    }
  } catch (error) {
    console.error('AI识别出错:', error);
    alert('AI识别过程中出现错误，请手动填写表单');
  } finally {
    // 恢复按钮状态
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
}

// 加载所有订单
function loadOrders() {
  fetch('/api/orders')
    .then(response => response.json())
    .then(orders => {
      displayOrders(orders);
      displayHistoryOrders(orders);
    })
    .catch(error => console.error('加载订单失败:', error));
}

// 提交新订单
function submitNewOrder() {
  const formData = {
    warehouse: document.getElementById('warehouse').value,
    goods: document.getElementById('goods').value,
    deliveryAddress: document.getElementById('deliveryAddress').value
  };
  
  fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  })
    .then(response => response.json())
    .then(order => {
      document.getElementById('new-order-form').reset();
      document.getElementById('ai-input').value = ''; // 清空AI输入框
      loadOrders(); // 重新加载订单列表
      alert('订单创建成功！');
    })
    .catch(error => console.error('创建订单失败:', error));
}

// 显示订单列表
function displayOrders(orders) {
  const ordersTableBody = document.querySelector('#orders-table tbody');
  ordersTableBody.innerHTML = '';
  
  if (orders.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6" style="text-align: center;">暂无订单</td>';
    ordersTableBody.appendChild(emptyRow);
    return;
  }
  
  // 按时间逆序排列，最新的在前面
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  orders.forEach(order => {
    // 创建主行
    const row = document.createElement('tr');
    row.setAttribute('data-order-id', order.id);
    const createdDate = new Date(order.createdAt).toLocaleString('zh-CN');
    
    row.innerHTML = `
      <td>${order.id.substring(0, 8)}</td>
      <td>${order.warehouse}</td>
      <td>${order.goods}</td>
      <td>${order.deliveryAddress}</td>
      <td>${createdDate}</td>
      <td class="action-cell">
        <button class="edit-btn" onclick="editOrder('${order.id}')">编辑</button>
        <button onclick="viewQuotes('${order.id}', this)">查看报价</button>
      </td>
    `;
    
    ordersTableBody.appendChild(row);
    
    // 创建用于显示报价的行（初始隐藏）
    const quoteRow = document.createElement('tr');
    quoteRow.className = 'quote-row';
    quoteRow.style.display = 'none';
    quoteRow.innerHTML = '<td colspan="6" class="quote-row-content"></td>';
    ordersTableBody.appendChild(quoteRow);
  });
}

// 查看某个订单的报价
function viewQuotes(orderId, buttonElement) {
  // 获取当前行和报价行
  const orderRow = buttonElement.closest('tr');
  const quoteRow = orderRow.nextElementSibling;
  const quoteContent = quoteRow.querySelector('.quote-row-content');
  
  // 切换报价行显示状态
  if (quoteRow.style.display === 'none') {
    // 获取订单详情
    fetch(`/api/orders/${orderId}`)
      .then(response => response.json())
      .then(order => {
        // 准备报价容器
        const quoteTemplate = document.getElementById('quotes-display-template');
        const quoteContainer = quoteTemplate.content.cloneNode(true);
        
        // 填充订单详情
        const orderDetails = quoteContainer.querySelector('.order-details');
        const createdDate = new Date(order.createdAt).toLocaleString('zh-CN');
        
        orderDetails.innerHTML = `
          <p><strong>订单 #${order.id.substring(0, 8)}</strong> | ${createdDate}</p>
          <p><strong>发货仓库:</strong> ${order.warehouse}</p>
          <p><strong>货物信息:</strong> ${order.goods}</p>
          <p><strong>收货信息:</strong> ${order.deliveryAddress}</p>
        `;
        
        // 添加到DOM
        quoteContent.innerHTML = '';
        quoteContent.appendChild(quoteContainer);
        
        // 获取该订单的所有报价
        return fetch(`/api/orders/${orderId}/quotes`);
      })
      .then(response => response.json())
      .then(quotes => {
        // 显示报价
        displayQuotesInRow(quotes, quoteRow);
        quoteRow.style.display = 'table-row';
        
        // 修改按钮文本
        buttonElement.textContent = '关闭报价';
      })
      .catch(error => console.error('获取报价失败:', error));
  } else {
    // 隐藏报价行
    quoteRow.style.display = 'none';
    buttonElement.textContent = '查看报价';
  }
}

// 在行内显示报价
function displayQuotesInRow(quotes, quoteRow) {
  const quoteContainer = quoteRow.querySelector('.quote-container');
  if (!quoteContainer) return;
  
  const quotesTableBody = quoteContainer.querySelector('tbody');
  quotesTableBody.innerHTML = '';
  
  if (quotes.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="4" style="text-align: center;">暂无报价</td>';
    quotesTableBody.appendChild(emptyRow);
    return;
  }
  
  // 报价已经按价格升序排列
  quotes.forEach((quote, index) => {
    const row = document.createElement('tr');
    
    // 最低价格高亮显示
    if (index === 0) {
      row.classList.add('best-price-row');
    }
    
    const quoteDate = new Date(quote.createdAt).toLocaleString('zh-CN');
    
    row.innerHTML = `
      <td>${quote.provider}</td>
      <td>¥${quote.price.toFixed(2)}</td>
      <td>${quote.estimatedDelivery}</td>
      <td>${quoteDate}</td>
    `;
    
    quotesTableBody.appendChild(row);
  });
  
  // 显示报价容器
  quoteContainer.style.display = 'block';
}

// 显示订单详情
function displayOrderDetails(order) {
  const orderDetails = document.getElementById('quote-order-details');
  const createdDate = new Date(order.createdAt).toLocaleString('zh-CN');
  
  orderDetails.innerHTML = `
    <h3>订单 #${order.id.substring(0, 8)} 详情</h3>
    <p><strong>发货仓库:</strong> ${order.warehouse}</p>
    <p><strong>货物信息:</strong> ${order.goods}</p>
    <p><strong>收货信息:</strong> ${order.deliveryAddress}</p>
    <p><strong>创建时间:</strong> ${createdDate}</p>
  `;
}

// 编辑订单
function editOrder(orderId) {
  // 获取订单数据
  fetch(`/api/orders/${orderId}`)
    .then(response => response.json())
    .then(order => {
      const orderRow = document.querySelector(`tr[data-order-id="${orderId}"]`);
      if (!orderRow) return;
      
      // 检查是否已经有编辑表单
      const existingForm = orderRow.nextElementSibling;
      if (existingForm && existingForm.classList.contains('edit-form-row')) {
        existingForm.remove();
        return;
      }
      
      // 创建编辑表单行
      const formRow = document.createElement('tr');
      formRow.className = 'edit-form-row';
      
      // 复制编辑表单模板
      const formTemplate = document.getElementById('edit-form-template');
      const formContent = formTemplate.content.cloneNode(true);
      
      // 填充表单内容
      const form = formContent.querySelector('form');
      form.querySelector('[name="orderId"]').value = orderId;
      form.querySelector('[name="warehouse"]').value = order.warehouse;
      form.querySelector('[name="goods"]').value = order.goods;
      form.querySelector('[name="deliveryAddress"]').value = order.deliveryAddress;
      
      // 绑定表单提交事件
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        updateOrder(this);
      });
      
      // 绑定取消按钮事件
      form.querySelector('.cancel-btn').addEventListener('click', function() {
        formRow.remove();
      });
      
      // 添加到DOM
      const formCell = document.createElement('td');
      formCell.colSpan = 6;
      formCell.appendChild(formContent);
      formRow.appendChild(formCell);
      
      // 插入到当前行后面
      const nextSibling = orderRow.nextElementSibling;
      if (nextSibling) {
        orderRow.parentNode.insertBefore(formRow, nextSibling);
      } else {
        orderRow.parentNode.appendChild(formRow);
      }
      
      // 显示表单
      formRow.querySelector('.edit-form').style.display = 'block';
    })
    .catch(error => console.error('获取订单失败:', error));
}

// 更新订单
function updateOrder(form) {
  const orderId = form.querySelector('[name="orderId"]').value;
  const formData = {
    warehouse: form.querySelector('[name="warehouse"]').value,
    goods: form.querySelector('[name="goods"]').value,
    deliveryAddress: form.querySelector('[name="deliveryAddress"]').value
  };
  
  fetch(`/api/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('服务器返回错误');
      }
      return response.json();
    })
    .then(updatedOrder => {
      // 更新表格行数据
      const orderRow = document.querySelector(`tr[data-order-id="${orderId}"]`);
      if (orderRow) {
        orderRow.cells[1].textContent = updatedOrder.warehouse;
        orderRow.cells[2].textContent = updatedOrder.goods;
        orderRow.cells[3].textContent = updatedOrder.deliveryAddress;
      }
      
      // 移除编辑表单
      const formRow = form.closest('tr');
      if (formRow) {
        formRow.remove();
      }
      
      alert('订单更新成功！');
    })
    .catch(error => {
      console.error('更新订单失败:', error);
      alert('更新订单失败，请重试');
    });
}

// 显示历史订单
function displayHistoryOrders(orders) {
  const historyTableBody = document.querySelector('#history-table tbody');
  historyTableBody.innerHTML = '';
  
  if (orders.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="4" style="text-align: center;">暂无历史记录</td>';
    historyTableBody.appendChild(emptyRow);
    return;
  }
  
  // 只显示最近5条
  const recentOrders = orders
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  
  recentOrders.forEach(order => {
    const row = document.createElement('tr');
    row.setAttribute('data-order-id', order.id);
    const createdDate = new Date(order.createdAt).toLocaleString('zh-CN');
    
    row.innerHTML = `
      <td>${order.id.substring(0, 8)}</td>
      <td>${order.warehouse}</td>
      <td>${createdDate}</td>
      <td class="action-cell">
        <button class="edit-btn" onclick="editOrder('${order.id}')">编辑</button>
        <button onclick="viewQuotes('${order.id}', this)">查看报价</button>
      </td>
    `;
    
    historyTableBody.appendChild(row);
    
    // 创建用于显示报价的行（初始隐藏）
    const quoteRow = document.createElement('tr');
    quoteRow.className = 'quote-row';
    quoteRow.style.display = 'none';
    quoteRow.innerHTML = '<td colspan="4" class="quote-row-content"></td>';
    historyTableBody.appendChild(quoteRow);
  });
} 