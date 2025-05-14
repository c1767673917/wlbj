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
  
  // 绑定报价表单提交事件 (如果原始HTML中存在全局的quote-form)
  // 注意：内联表单的提交已在showQuoteForm中单独处理
  const globalQuoteForm = document.getElementById('quote-form');
  if (globalQuoteForm) {
    globalQuoteForm.addEventListener('submit', function(e) {
      e.preventDefault();
      // submitQuote(); // 这个全局的submitQuote可能需要调整或移除，因为现在是内联表单
    });
  }
});

// 本地存储物流商信息的键
const PROVIDER_INFO_KEY = 'logisticsProviderInfo';
const PAGE_SIZE = 5;

// 可报价订单分页状态
let availableOrdersPaginationState = {
  currentPage: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
  allItems: [],
  // filteredItems: [] // 使用allItems，因为过滤逻辑在loadAvailableOrders中
};

// 历史报价分页状态
let providerHistoryPaginationState = {
  currentPage: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
  allItems: [], // 存储所有历史报价
  allOrders: [] // 存储所有订单信息，用于关联显示
};

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
  const availableTableBody = document.querySelector('#available-orders-table tbody');
  
  if (!providerName) {
    if(availableTableBody) availableTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">请先设置物流商名称</td></tr>';
    // 清理分页
    updatePaginationControls('available-orders-pagination', 'available-orders-pagination-info', availableOrdersPaginationState, displayAvailableOrdersPage);
    return;
  }

  fetch('/api/orders')
    .then(response => response.json())
    .then(orders => {
      const localStorageKey = `${providerName}_quotes`;
      const providerQuotes = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
      const quotedOrderIds = providerQuotes.map(quote => quote.orderId);
      
      const unquotedOrders = orders.filter(order => !quotedOrderIds.includes(order.id))
                                   .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      availableOrdersPaginationState.allItems = unquotedOrders;
      availableOrdersPaginationState.totalItems = unquotedOrders.length;
      availableOrdersPaginationState.totalPages = Math.ceil(unquotedOrders.length / availableOrdersPaginationState.pageSize);
      availableOrdersPaginationState.currentPage = 1; // 重置到第一页

      displayAvailableOrdersPage(1);
      updatePaginationControls('available-orders-pagination', 'available-orders-pagination-info', availableOrdersPaginationState, displayAvailableOrdersPage);
    })
    .catch(error => {
      console.error('加载订单失败:', error);
      if(availableTableBody) availableTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">加载订单失败</td></tr>';
      updatePaginationControls('available-orders-pagination', 'available-orders-pagination-info', availableOrdersPaginationState, displayAvailableOrdersPage);
    });
}

// 显示特定页的可报价订单
function displayAvailableOrdersPage(page) {
  availableOrdersPaginationState.currentPage = page;
  const availableTableBody = document.querySelector('#available-orders-table tbody');
  if (!availableTableBody) return;
  availableTableBody.innerHTML = '';

  const { allItems, currentPage, pageSize } = availableOrdersPaginationState;

  if (allItems.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6" style="text-align: center;">暂无可报价订单或您已为所有订单提供报价</td>';
    availableTableBody.appendChild(emptyRow);
    updatePaginationInfo('available-orders-pagination-info', availableOrdersPaginationState);
    return;
  }
  
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, allItems.length);
  const currentPageItems = allItems.slice(startIndex, endIndex);

  currentPageItems.forEach(order => {
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
  updatePaginationInfo('available-orders-pagination-info', availableOrdersPaginationState);
}

// 显示报价表单
function showQuoteForm(orderId) {
  const buttons = document.querySelectorAll('#available-orders-table button'); // 限定范围
  let orderRow = null;
  
  for (const button of buttons) {
    if (button.getAttribute('onclick') && button.getAttribute('onclick').includes(`showQuoteForm('${orderId}')`)) {
      orderRow = button.closest('tr');
      break;
    }
  }
  
  if (!orderRow) return;
      
  const nextRow = orderRow.nextElementSibling;
  if (nextRow && nextRow.classList.contains('quote-form-row')) {
    nextRow.remove();
    return; 
  }
  
  // 移除其他已打开的表单行
  const existingFormRows = document.querySelectorAll('.quote-form-row');
  existingFormRows.forEach(row => row.remove());

  const formRow = document.createElement('tr');
  formRow.className = 'quote-form-row';
      
  const formTemplate = document.getElementById('inline-quote-form-template');
  if (!formTemplate) {
    console.error('未找到ID为 "inline-quote-form-template" 的模板');
    return;
  }
  const formContent = formTemplate.content.cloneNode(true);
  
  formContent.querySelector('[name="orderId"]').value = orderId;
  
  formContent.querySelector('form').addEventListener('submit', function(e) {
    e.preventDefault();
    submitQuote(this); 
  });
  
  formContent.querySelector('.cancel-btn').addEventListener('click', function() {
    formRow.remove();
  });
  
  const formCell = document.createElement('td');
  formCell.colSpan = 6; 
  formCell.appendChild(formContent);
  formRow.appendChild(formCell);
  
  orderRow.parentNode.insertBefore(formRow, orderRow.nextSibling);
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
  
  if (isNaN(price) || price <= 0) {
    alert('请输入有效的报价金额！');
    return;
  }
  if (!estimatedDelivery.trim()) {
    alert('请输入预计送达时间！');
    return;
  }

  const quoteData = {
    orderId: orderId,
    provider: providerName,
    price: price,
    estimatedDelivery: estimatedDelivery
  };
  
  fetch('/api/quotes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(quoteData)
  })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { throw new Error(err.error || '提交报价失败') });
      }
      return response.json();
    })
    .then(quote => {
      saveQuoteToLocalHistory(quote);
      
      const formRow = form.closest('tr.quote-form-row');
      if (formRow) formRow.remove();
      
      loadAvailableOrders(); 
      loadProviderHistory(); 
      
      alert('报价提交成功！');
    })
    .catch(error => {
      console.error('提交报价失败:', error);
      alert(`提交报价失败: ${error.message}`);
    });
}

// 保存报价到本地历史
function saveQuoteToLocalHistory(quote) {
  const providerName = getProviderName();
  const localStorageKey = `${providerName}_quotes`;
  
  let providerQuotes = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
  // 避免重复添加
  if (!providerQuotes.find(q => q.id === quote.id)) {
    providerQuotes.push(quote);
  }
  localStorage.setItem(localStorageKey, JSON.stringify(providerQuotes));
}

// 加载物流商历史报价
function loadProviderHistory() {
  const providerName = getProviderName();
  const historyTableBody = document.querySelector('#provider-history-table tbody');

  if (!providerName) {
    if(historyTableBody) historyTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">请先设置物流商名称</td></tr>';
    updatePaginationControls('provider-history-pagination', 'provider-history-pagination-info', providerHistoryPaginationState, displayProviderHistoryPage);
    return;
  }
  
  const localStorageKey = `${providerName}_quotes`;
  const providerQuotes = JSON.parse(localStorage.getItem(localStorageKey) || '[]')
                              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  fetch('/api/orders')
    .then(response => response.json())
    .then(orders => {
      providerHistoryPaginationState.allItems = providerQuotes;
      providerHistoryPaginationState.allOrders = orders; // 保存所有订单信息用于查找
      providerHistoryPaginationState.totalItems = providerQuotes.length;
      providerHistoryPaginationState.totalPages = Math.ceil(providerQuotes.length / providerHistoryPaginationState.pageSize);
      providerHistoryPaginationState.currentPage = 1; // 重置到第一页

      displayProviderHistoryPage(1);
      updatePaginationControls('provider-history-pagination', 'provider-history-pagination-info', providerHistoryPaginationState, displayProviderHistoryPage);
    })
    .catch(error => {
      console.error('加载订单失败 (用于历史报价):', error);
      // 即使订单加载失败，也尝试显示本地的报价历史
      providerHistoryPaginationState.allItems = providerQuotes;
      providerHistoryPaginationState.allOrders = [];
      providerHistoryPaginationState.totalItems = providerQuotes.length;
      providerHistoryPaginationState.totalPages = Math.ceil(providerQuotes.length / providerHistoryPaginationState.pageSize);
      providerHistoryPaginationState.currentPage = 1;
      
      displayProviderHistoryPage(1);
      updatePaginationControls('provider-history-pagination', 'provider-history-pagination-info', providerHistoryPaginationState, displayProviderHistoryPage);
    });
}

// 显示特定页的历史报价
function displayProviderHistoryPage(page) {
  providerHistoryPaginationState.currentPage = page;
  const historyTableBody = document.querySelector('#provider-history-table tbody');
  if (!historyTableBody) return;
  historyTableBody.innerHTML = '';

  const { allItems, allOrders, currentPage, pageSize } = providerHistoryPaginationState;

  if (allItems.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6" style="text-align: center;">暂无报价历史</td>';
    historyTableBody.appendChild(emptyRow);
    updatePaginationInfo('provider-history-pagination-info', providerHistoryPaginationState);
    return;
  }

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, allItems.length);
  const currentPageItems = allItems.slice(startIndex, endIndex);
  
  currentPageItems.forEach(quote => {
    const row = document.createElement('tr');
    const order = allOrders.find(o => o.id === quote.orderId);
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
        <td colspan="2">订单信息加载中或不可用</td>
        <td>${quote.price.toFixed(2)}</td>
          <td>${quote.estimatedDelivery}</td>
        <td>${createdDate}</td>
        `;
    }
    historyTableBody.appendChild(row);
  });
  updatePaginationInfo('provider-history-pagination-info', providerHistoryPaginationState);
}

// --- 通用分页逻辑 ---
function updatePaginationInfo(infoElementId, state) {
  const infoElement = document.getElementById(infoElementId);
  if (!infoElement) return;

  if (state.totalItems > 0) {
    const startIndex = (state.currentPage - 1) * state.pageSize + 1;
    const endIndex = Math.min(startIndex + state.pageSize - 1, state.totalItems);
    infoElement.textContent = `显示第 ${startIndex} 到 ${endIndex} 条，共 ${state.totalItems} 条记录`;
  } else {
    infoElement.textContent = '共 0 条记录';
  }
}

function renderPaginationButtons(paginationElement, state, displayPageFunction) {
  paginationElement.innerHTML = ''; // 清空旧按钮

  if (state.totalPages <= 1) {
    return; 
  }
  
  // 上一页按钮
  const prevButton = document.createElement('button');
  prevButton.innerHTML = '&laquo; 上一页';
  prevButton.disabled = state.currentPage === 1;
  prevButton.addEventListener('click', () => {
    if (state.currentPage > 1) {
      displayPageFunction(state.currentPage - 1);
      renderPaginationButtons(paginationElement, state, displayPageFunction); // 重新渲染以更新按钮状态
    }
  });
  paginationElement.appendChild(prevButton);
  
  // 页码按钮 (简化版，可按需扩展为更复杂的页码显示)
  for (let i = 1; i <= state.totalPages; i++) {
    const pageButton = document.createElement('button');
    pageButton.textContent = i;
    pageButton.classList.toggle('active', i === state.currentPage);
    pageButton.addEventListener('click', () => {
      displayPageFunction(i);
      renderPaginationButtons(paginationElement, state, displayPageFunction); // 重新渲染
    });
    paginationElement.appendChild(pageButton);
  }
  
  // 下一页按钮
  const nextButton = document.createElement('button');
  nextButton.innerHTML = '下一页 &raquo;';
  nextButton.disabled = state.currentPage === state.totalPages;
  nextButton.addEventListener('click', () => {
    if (state.currentPage < state.totalPages) {
      displayPageFunction(state.currentPage + 1);
      renderPaginationButtons(paginationElement, state, displayPageFunction); // 重新渲染
    }
  });
  paginationElement.appendChild(nextButton);
}

function updatePaginationControls(paginationElementId, infoElementId, state, displayPageFunction) {
  const paginationElement = document.getElementById(paginationElementId);
  if (paginationElement) {
    renderPaginationButtons(paginationElement, state, displayPageFunction);
  }
  updatePaginationInfo(infoElementId, state);
}

// 获取物流商名称
function getProviderName() {
  const providerInfo = JSON.parse(localStorage.getItem(PROVIDER_INFO_KEY) || '{}');
  return providerInfo.name || '';
}