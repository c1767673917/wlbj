document.addEventListener('DOMContentLoaded', function() {
  // 加载活跃订单和历史订单
  loadActiveOrders();
  loadHistoryOrders();
  // 新增: 页面加载时获取并显示物流公司列表
  fetchAndDisplayProviders();

  // 绑定表单提交事件
  document.getElementById('new-order-form').addEventListener('submit', function(e) {
    e.preventDefault();
    submitNewOrder();
  });

  // 绑定AI识别按钮事件
  document.getElementById('ai-recognize-btn').addEventListener('click', function() {
    recognizeWithAI();
  });

  // 绑定搜索按钮事件
  document.getElementById('search-button').addEventListener('click', function() {
    searchOrders();
  });

  // 绑定重置搜索按钮事件
  document.getElementById('reset-search').addEventListener('click', function() {
    resetSearch();
  });

  // 绑定导出按钮事件
  document.getElementById('export-xlsx').addEventListener('click', function() {
    exportToExcel('active');
  });

  // 绑定历史搜索按钮事件
  document.getElementById('history-search-button').addEventListener('click', function() {
    searchHistoryOrders();
  });

  // 绑定历史重置按钮事件
  document.getElementById('history-reset-search').addEventListener('click', function() {
    resetHistorySearch();
  });

  // 绑定历史导出按钮事件
  document.getElementById('history-export-xlsx').addEventListener('click', function() {
    exportToExcel('closed');
  });

  // 监听搜索框按回车事件
  document.getElementById('search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      searchOrders();
    }
  });

  // 监听历史搜索框按回车事件
  document.getElementById('history-search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      searchHistoryOrders();
    }
  });
// Tab navigation logic
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');

  // Function to activate a tab
  function activateTab(tabId) {
    tabLinks.forEach(innerLink => {
      innerLink.classList.toggle('active', innerLink.getAttribute('data-tab') === tabId);
    });
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === tabId);
    });
    localStorage.setItem('activeUserTab', tabId); // Save active tab to localStorage
  }

  tabLinks.forEach(link => {
    link.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      activateTab(tabId);
    });
  });

  // Restore active tab from localStorage on page load
  const savedTabId = localStorage.getItem('activeUserTab');
  if (savedTabId) {
    // Check if the saved tab still exists in the DOM
    const savedTabLink = document.querySelector(`.tab-link[data-tab="${savedTabId}"]`);
    const savedTabContent = document.getElementById(savedTabId);
    if (savedTabLink && savedTabContent) {
        // Deactivate default active tab (which might be hardcoded in HTML or the first one)
        const defaultActiveLink = document.querySelector('.tab-link.active');
        const defaultActiveContent = document.querySelector('.tab-content.active');
        if (defaultActiveLink) defaultActiveLink.classList.remove('active');
        if (defaultActiveContent) defaultActiveContent.classList.remove('active');

        activateTab(savedTabId); // Activate the saved tab
        } else {
        // Saved tab ID is invalid or element doesn't exist, remove it from storage
        localStorage.removeItem('activeUserTab');
        // Optionally, activate the default first tab if no valid saved tab
        // if (tabLinks.length > 0) activateTab(tabLinks[0].getAttribute('data-tab'));
        // Or let the default HTML active class take precedence if that's how it's set up
    }
  } else {
    // No saved tab, ensure the default one (usually first with .active class in HTML) is shown
    // Or explicitly activate the first tab if none are marked active in HTML
    const currentActiveLink = document.querySelector('.tab-link.active');
    if (!currentActiveLink && tabLinks.length > 0) {
        activateTab(tabLinks[0].getAttribute('data-tab'));
    }
  }
});

// 显示自定义Toast提示
function showToast(message) {
  const toastElement = document.getElementById('custom-toast');
  if (toastElement) {
    toastElement.textContent = message;
    toastElement.classList.add('show');

    // 1.5秒后开始淡出
    setTimeout(() => {
      toastElement.classList.remove('show');
      toastElement.classList.add('fadeout');
      // 动画结束后彻底隐藏
      setTimeout(() => {
        toastElement.classList.remove('fadeout');
      }, 500); // 这里的500ms对应CSS中的transition时间
    }, 1500); // 修改此处为1.5秒
  }
}

// 活跃订单分页状态
let paginationState = {
  currentPage: 1,
  pageSize: 10,
  totalOrders: 0,
  totalPages: 1,
  allOrders: [],
  filteredOrders: [],
  searchQuery: ''
};

// 历史订单分页状态
let historyPaginationState = {
  currentPage: 1,
  pageSize: 10,
  totalOrders: 0,
  totalPages: 1,
  allOrders: [],
  filteredOrders: [],
  searchQuery: ''
};

// SiliconFlow API调用函数 - 直接调用AI API
async function callSiliconFlowAPI(content) {
  try {
    const startTime = Date.now();

    // 固定的API密钥
    const apiKey = 'sk-mkwzawhynjmauuhvflpfjhfdijcvmutwswdtunhaoqnsvdos';

    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
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
        enable_thinking: false
      })
    });

    const endTime = Date.now();
    const timeElapsed = (endTime - startTime) / 1000;
    console.log(`API响应时间: ${timeElapsed.toFixed(2)}秒`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API错误响应:', errorText);
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.choices || result.choices.length === 0) {
      throw new Error('AI服务返回了无效的响应');
    }

    return result;
  } catch (error) {
    console.error('调用AI接口出错:', error);
    throw error;
  }
}

// AI识别函数
async function recognizeWithAI() {
  const aiInput = document.getElementById('ai-input').value.trim();

  if (!aiInput) {
    showToast('请先输入综合物流信息进行识别');
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

        showToast('AI识别成功，已自动填写表单');
      } catch (jsonError) {
        console.error('解析JSON失败:', jsonError, content);
        showToast('无法解析AI返回的内容，请手动填写表单');
      }
    } else {
      showToast('未获取到有效的AI识别结果，请手动填写表单');
    }
  } catch (error) {
    console.error('AI识别出错:', error);
    showToast('AI识别过程中出现错误，请手动填写表单');
  } finally {
    // 恢复按钮状态
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
}

// 加载活跃订单（优化版本）
function loadActiveOrders() {
  const { currentPage, pageSize, searchQuery } = paginationState;
  let apiUrl = `/api/orders?status=active&page=${currentPage}&pageSize=${pageSize}`;

  // 添加搜索参数支持
  if (searchQuery && searchQuery.trim()) {
    apiUrl += `&search=${encodeURIComponent(searchQuery.trim())}`;
  }

  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      paginationState.allOrders = data.items;
      paginationState.filteredOrders = data.items; // 后端已处理搜索，无需前端过滤
      paginationState.totalOrders = data.totalItems;
      paginationState.totalPages = data.totalPages;

      // 批量获取最低报价
      if (data.items && data.items.length > 0) {
        const orderIds = data.items.map(order => order.id);
        fetchLowestQuotesBatch(orderIds)
          .then(lowestQuotes => {
            // 将最低报价数据附加到订单数据
            paginationState.filteredOrders = data.items.map(order => ({
              ...order,
              lowestQuote: lowestQuotes[order.id] || null
            }));
            _renderActiveOrdersPage();
          })
          .catch(error => {
            console.error('批量获取最低报价失败:', error);
            // 即使获取报价失败，也显示订单
            _renderActiveOrdersPage();
          });
      } else {
        _renderActiveOrdersPage();
      }

      // 更新分页控件
      renderPagination();
    })
    .catch(error => {
      console.error('加载活跃订单失败:', error);
      const ordersTableBody = document.querySelector('#orders-table tbody');
      if (ordersTableBody) ordersTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">加载订单失败</td></tr>';
      paginationState.totalOrders = 0;
      paginationState.totalPages = 1;
      renderPagination();
    });
}

// 加载历史订单
function loadHistoryOrders() {
  const { currentPage, pageSize, searchQuery } = historyPaginationState;
  let apiUrl = `/api/orders?status=closed&page=${currentPage}&pageSize=${pageSize}`;
  // if (searchQuery) { apiUrl += `&q=${encodeURIComponent(searchQuery)}`; } // Backend search support needed for accuracy

  fetch(apiUrl)
    .then(response => response.json())
    .then(data => { // data is { items: [], totalItems, totalPages, currentPage, pageSize }
      historyPaginationState.allOrders = data.items; // allOrders now stores current page's items

      if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        historyPaginationState.filteredOrders = data.items.filter(order =>
          order.id.toLowerCase().includes(lowerCaseQuery) ||
          order.warehouse.toLowerCase().includes(lowerCaseQuery) ||
          order.goods.toLowerCase().includes(lowerCaseQuery) ||
          order.deliveryAddress.toLowerCase().includes(lowerCaseQuery)
        );
      } else {
        historyPaginationState.filteredOrders = data.items;
      }

      historyPaginationState.totalOrders = data.totalItems;
      historyPaginationState.totalPages = data.totalPages;

      _renderHistoryOrdersPage(); // Call new render-only function
      renderHistoryPagination();
    })
    .catch(error => {
      console.error('加载历史订单失败:', error);
      const historyTableBody = document.querySelector('#history-orders-table tbody');
      if (historyTableBody) historyTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">加载历史订单失败</td></tr>';
      historyPaginationState.totalOrders = 0;
      historyPaginationState.totalPages = 1;
      renderHistoryPagination();
    });
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
      loadActiveOrders(); // 重新加载订单列表
      showToast('订单创建成功！');
    })
    .catch(error => console.error('创建订单失败:', error));
}

// Actual rendering function for active orders
function _renderActiveOrdersPage() {
  const ordersTableBody = document.querySelector('#orders-table tbody');
  ordersTableBody.innerHTML = ''; // Clear previous items

  // filteredOrders now contains the items for the current page after potential client-side search filtering
  const currentPageOrdersToDisplay = paginationState.filteredOrders;

  if (currentPageOrdersToDisplay.length === 0) {
    const emptyRow = document.createElement('tr');
    if (paginationState.searchQuery) {
      emptyRow.innerHTML = '<td colspan="7" style="text-align: center;">没有找到匹配的订单</td>';
    } else if (paginationState.totalOrders === 0) { // Check if there are no orders at all
      emptyRow.innerHTML = '<td colspan="7" style="text-align: center;">暂无活跃订单</td>';
    } else { // Orders exist, but not on this page (or filtered out)
      emptyRow.innerHTML = '<td colspan="7" style="text-align: center;">当前页没有订单</td>';
    }
    ordersTableBody.appendChild(emptyRow);
    updatePaginationInfo(); // Update "Showing X to Y of Z"
    return;
  }

  // 直接渲染，使用批量获取的最低报价数据
  currentPageOrdersToDisplay.forEach(order => {
    const row = document.createElement('tr');
    row.setAttribute('data-order-id', order.id);
    const createdDate = new Date(order.createdAt).toLocaleString('zh-CN');

    // 使用已获取的最低报价数据（在loadActiveOrders中批量获取）
    const lowestQuote = order.lowestQuote;
    const lowestQuoteHtml = lowestQuote
      ? `${lowestQuote.provider}: ¥${lowestQuote.price.toFixed(2)}`
      : '暂无报价';

    row.innerHTML = `
      <td>${order.id.substring(0, 8)}</td>
      <td class="warehouse-column" title="${order.warehouse}" style="width:90px; max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-left:4px; padding-right:4px;">${order.warehouse}</td>
      <td>${order.goods}</td>
      <td>${order.deliveryAddress}</td>
      <td>${lowestQuoteHtml}</td>
      <td>${createdDate}</td>
      <td class="action-cell">
        <div class="button-row">
          <button class="close-order-btn" onclick="closeOrder('${order.id}')">关闭</button>
          <button class="edit-btn" onclick="editOrder('${order.id}')">编辑</button>
        </div>
        <div class="button-row">
          <button class="view-quotes-btn" onclick="viewQuotes('${order.id}', this)">查看报价</button>
        </div>
      </td>
    `;

    ordersTableBody.appendChild(row);

    // 创建用于显示报价的行（初始隐藏）
    const quoteRow = document.createElement('tr');
    quoteRow.className = 'quote-row';
    quoteRow.style.display = 'none';
    quoteRow.innerHTML = '<td colspan="7" class="quote-row-content"></td>';
    ordersTableBody.appendChild(quoteRow);
  });

  // 更新分页信息
  updatePaginationInfo();
}

// This function is called by pagination buttons. It sets the new page and triggers data loading.
function displayOrdersPage(page) {
  if (paginationState.currentPage !== page || paginationState.searchQuery) { // Reload if page changes or if there was a search (to reset to non-searched page)
    paginationState.currentPage = page;
    // paginationState.searchQuery = ''; // Optionally reset search when changing page via main pagination
    // document.getElementById('search-input').value = ''; // Optionally clear search input
    loadActiveOrders(); // Fetches and then renders the new page via _renderActiveOrdersPage
  } else {
    // If page is the same, and data is already loaded, re-render (e.g., after a sort or filter on current page if implemented)
    _renderActiveOrdersPage();
  }
}

// 更新分页信息
function updatePaginationInfo() {
  const startIndex = (paginationState.currentPage - 1) * paginationState.pageSize + 1;
  const endIndex = Math.min(startIndex + paginationState.pageSize - 1, paginationState.totalOrders);

  const paginationInfoElement = document.getElementById('pagination-info');
  if (paginationState.totalOrders > 0) {
    paginationInfoElement.textContent = `显示第 ${startIndex} 到 ${endIndex} 条，共 ${paginationState.totalOrders} 条记录`;
  } else {
    paginationInfoElement.textContent = '';
  }
}

// 渲染分页控件
function renderPagination() {
  const paginationElement = document.getElementById('pagination');
  paginationElement.innerHTML = '';

  if (paginationState.totalPages <= 1) {
    return; // 只有一页或没有数据时不显示分页
  }

  // 上一页按钮
  const prevButton = document.createElement('button');
  prevButton.innerHTML = '&laquo; 上一页';
  prevButton.disabled = paginationState.currentPage === 1;
  prevButton.addEventListener('click', () => {
    if (paginationState.currentPage > 1) {
      displayOrdersPage(paginationState.currentPage - 1);
      renderPagination();
    }
  });
  paginationElement.appendChild(prevButton);

  // 页码按钮
  const maxPageButtons = 5; // 最多显示的页码按钮数
  let startPage = Math.max(1, paginationState.currentPage - Math.floor(maxPageButtons / 2));
  let endPage = Math.min(paginationState.totalPages, startPage + maxPageButtons - 1);

  // 调整startPage，确保显示maxPageButtons个按钮
  if (endPage - startPage + 1 < maxPageButtons && startPage > 1) {
    startPage = Math.max(1, endPage - maxPageButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageButton = document.createElement('button');
    pageButton.textContent = i;
    pageButton.classList.toggle('active', i === paginationState.currentPage);
    pageButton.addEventListener('click', () => {
      displayOrdersPage(i);
      renderPagination();
    });
    paginationElement.appendChild(pageButton);
  }

  // 下一页按钮
  const nextButton = document.createElement('button');
  nextButton.innerHTML = '下一页 &raquo;';
  nextButton.disabled = paginationState.currentPage === paginationState.totalPages;
  nextButton.addEventListener('click', () => {
    if (paginationState.currentPage < paginationState.totalPages) {
      displayOrdersPage(paginationState.currentPage + 1);
      renderPagination();
    }
  });
  paginationElement.appendChild(nextButton);
}

// 批量获取最低报价（性能优化）
async function fetchLowestQuotesBatch(orderIds) {
  if (!orderIds || orderIds.length === 0) {
    return {};
  }

  try {
    const orderIdsParam = orderIds.join(',');
    const response = await fetch(`/api/quotes/lowest-batch?orderIds=${encodeURIComponent(orderIdsParam)}`);
    const lowestQuotes = await response.json();
    return lowestQuotes || {};
  } catch (error) {
    console.error('批量获取最低报价失败:', error);
    return {};
  }
}

// 获取订单的最低报价（保留兼容性）
async function fetchLowestQuote(orderId) {
  try {
    const response = await fetch(`/api/quotes/lowest/${orderId}`);
    const lowestQuote = await response.json();
    return lowestQuote;
  } catch (error) {
    console.error('获取最低报价失败:', error);
    return null;
  }
}

// 查看某个订单的报价
function viewQuotes(orderId, buttonElement) {
  // 获取当前行和报价行
  const orderRow = buttonElement.closest('tr');
  const quoteRow = orderRow.nextElementSibling;
  const quoteContent = quoteRow.querySelector('.quote-row-content');

  // 切换报价行显示状态
  if (quoteRow.style.display === 'none') {
        // 准备报价容器
        const quoteTemplate = document.getElementById('quotes-display-template');
        const quoteContainer = quoteTemplate.content.cloneNode(true);

        // 添加到DOM
        quoteContent.innerHTML = '';
        quoteContent.appendChild(quoteContainer);

        // 获取该订单的所有报价
    fetch(`/api/orders/${orderId}/quotes`)
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

  // 获取订单ID和判断是否为历史订单
  const orderRow = quoteRow.previousElementSibling;
  const orderId = orderRow.getAttribute('data-order-id');
  const isHistoryOrder = orderRow.closest('#history-orders-table') !== null;

  if (quotes.length === 0) {
    const emptyRow = document.createElement('tr');
    const colspan = isHistoryOrder ? '4' : '5'; // 历史订单不显示操作列
    emptyRow.innerHTML = `<td colspan="${colspan}" style="text-align: center;">暂无报价</td>`;
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

    if (isHistoryOrder) {
      // 历史订单：不显示选择按钮
      row.innerHTML = `
        <td>${quote.provider}</td>
        <td>¥${quote.price.toFixed(2)}</td>
        <td>${quote.estimatedDelivery}</td>
        <td>${quoteDate}</td>
      `;
    } else {
      // 活跃订单：显示选择按钮
      row.innerHTML = `
        <td>${quote.provider}</td>
        <td>¥${quote.price.toFixed(2)}</td>
        <td>${quote.estimatedDelivery}</td>
        <td>${quoteDate}</td>
        <td>
          <button class="select-provider-btn"
                  onclick="selectProvider('${orderId}', '${quote.provider}', ${quote.price})"
                  style="background-color: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
            选择
          </button>
        </td>
      `;
    }

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
      formCell.colSpan = 7;
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
      // 更新本地数据
      const orderIndex = paginationState.allOrders.findIndex(o => o.id === orderId);
      if (orderIndex !== -1) {
        paginationState.allOrders[orderIndex] = updatedOrder;
      }

      // 更新表格行数据
      const orderRow = document.querySelector(`tr[data-order-id="${orderId}"]`);
      if (orderRow) {
        orderRow.cells[1].textContent = updatedOrder.warehouse;
        orderRow.cells[1].title = updatedOrder.warehouse;
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

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 搜索订单（优化版本 - 使用后端搜索）
function searchOrders() {
  const searchInput = document.getElementById('search-input').value.trim();
  paginationState.searchQuery = searchInput;
  paginationState.currentPage = 1; // 重置到第一页

  // 重新加载数据（后端会处理搜索）
  loadActiveOrders();
}

// 防抖搜索函数
const debouncedSearch = debounce(searchOrders, 300);

// 实时搜索（在输入时触发）
function onSearchInput() {
  debouncedSearch();
}

// 重置搜索
function resetSearch() {
  document.getElementById('search-input').value = '';
  paginationState.searchQuery = '';
  paginationState.filteredOrders = paginationState.allOrders;
  paginationState.totalOrders = paginationState.allOrders.length;
  paginationState.totalPages = Math.ceil(paginationState.allOrders.length / paginationState.pageSize);

  displayOrdersPage(1);
  renderPagination();
}

// 导出Excel文件
function exportToExcel(type) {
  const searchQuery = type === 'active'
    ? paginationState.searchQuery
    : historyPaginationState.searchQuery;

  const params = new URLSearchParams();
  if (searchQuery) {
    params.append('search', searchQuery);
  }

  const endpoint = type === 'active'
    ? '/api/export/orders/active'
    : '/api/export/orders/closed';

  const url = `${endpoint}?${params.toString()}`;

  // 创建一个临时的链接来下载文件
  const link = document.createElement('a');
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`${type === 'active' ? '活跃' : '历史'}订单导出已开始下载`);
}

// 搜索历史订单
function searchHistoryOrders() {
  const searchInput = document.getElementById('history-search-input').value.toLowerCase().trim();
  historyPaginationState.searchQuery = searchInput;

  if (!searchInput) {
    resetHistorySearch();
    return;
  }

  // 在所有字段中搜索关键词
  const filteredOrders = historyPaginationState.allOrders.filter(order => {
    return (
      order.id.toLowerCase().includes(searchInput) ||
      order.warehouse.toLowerCase().includes(searchInput) ||
      order.goods.toLowerCase().includes(searchInput) ||
      order.deliveryAddress.toLowerCase().includes(searchInput) ||
      new Date(order.createdAt).toLocaleString('zh-CN').toLowerCase().includes(searchInput)
    );
  });

  historyPaginationState.filteredOrders = filteredOrders;
  historyPaginationState.totalOrders = filteredOrders.length;
  historyPaginationState.totalPages = Math.ceil(filteredOrders.length / historyPaginationState.pageSize);
  historyPaginationState.currentPage = 1;

  displayHistoryOrdersPage(1);
  renderHistoryPagination();
}

// 重置历史搜索
function resetHistorySearch() {
  document.getElementById('history-search-input').value = '';
  historyPaginationState.searchQuery = '';
  historyPaginationState.filteredOrders = historyPaginationState.allOrders;
  historyPaginationState.totalOrders = historyPaginationState.allOrders.length;
  historyPaginationState.totalPages = Math.ceil(historyPaginationState.allOrders.length / historyPaginationState.pageSize);

  displayHistoryOrdersPage(1);
  renderHistoryPagination();
}

// Actual rendering function for history orders (was part of displayHistoryOrdersPage)
// Note: The 'fetchLowestQuote' logic is removed from history orders as it's usually not relevant for closed/historical orders.
// If it IS relevant, it needs to be added back, similar to _renderActiveOrdersPage.
// For simplicity and common use case, I am assuming historical orders don't need to show current lowest quote.
function _renderHistoryOrdersPage() {
  const historyTableBody = document.querySelector('#history-orders-table tbody');
  historyTableBody.innerHTML = ''; // Clear previous items

  const currentPageHistoryOrdersToDisplay = historyPaginationState.filteredOrders;

  if (currentPageHistoryOrdersToDisplay.length === 0) {
    const emptyRow = document.createElement('tr');
    if (historyPaginationState.searchQuery) {
      emptyRow.innerHTML = '<td colspan="7" style="text-align: center;">没有找到匹配的历史订单</td>';
    } else if (historyPaginationState.totalOrders === 0) {
      emptyRow.innerHTML = '<td colspan="7" style="text-align: center;">暂无历史订单</td>';
    } else {
      emptyRow.innerHTML = '<td colspan="7" style="text-align: center;">当前页没有历史订单</td>';
    }
    historyTableBody.appendChild(emptyRow);
    updateHistoryPaginationInfo(); // Update "Showing X to Y of Z"
    return;
  }

  currentPageHistoryOrdersToDisplay.forEach(order => {
    const row = document.createElement('tr');
    row.setAttribute('data-order-id', order.id); // Keep data-order-id for viewQuotes
    const createdDate = new Date(order.createdAt).toLocaleString('zh-CN');
    // const updatedAt = order.updatedAt ? new Date(order.updatedAt).toLocaleString('zh-CN') : 'N/A'; // No longer displayed directly in the main row

    // 显示选择的报价信息，如果没有选择则显示最低报价
    const selectedQuoteHtml = order.selectedProvider && order.selectedPrice
      ? `${order.selectedProvider}: ¥${order.selectedPrice.toFixed(2)}`
      : null;

    if (selectedQuoteHtml) {
      // 如果有选择的报价，直接显示
      row.innerHTML = `
        <td>${order.id.substring(0,8)}</td>
        <td class="warehouse-column" title="${order.warehouse}" style="width:90px; max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-left:4px; padding-right:4px;">${order.warehouse}</td>
        <td>${order.goods}</td>
        <td>${order.deliveryAddress}</td>
        <td>${selectedQuoteHtml}</td>
        <td>${createdDate}</td>
        <td class="action-cell">
          <div class="button-row">
            <button class="view-quotes-btn" onclick="viewQuotes('${order.id}', this)">查看报价</button>
          </div>
        </td>
      `;
    } else {
      // 如果没有选择的报价，显示最低报价
      fetchLowestQuote(order.id)
        .then(lowestQuote => {
          const lowestQuoteHtml = lowestQuote
            ? `${lowestQuote.provider}: ¥${lowestQuote.price.toFixed(2)}`
            : '暂无报价';

          row.innerHTML = `
            <td>${order.id.substring(0,8)}</td>
            <td class="warehouse-column" title="${order.warehouse}" style="width:90px; max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-left:4px; padding-right:4px;">${order.warehouse}</td>
            <td>${order.goods}</td>
            <td>${order.deliveryAddress}</td>
            <td>${lowestQuoteHtml}</td>
            <td>${createdDate}</td>
            <td class="action-cell">
              <div class="button-row">
                <button class="view-quotes-btn" onclick="viewQuotes('${order.id}', this)">查看报价</button>
              </div>
            </td>
          `;
        })
        .catch(error => {
          console.error(`获取订单 ${order.id} 的最低报价失败:`, error);
          row.innerHTML = `
            <td>${order.id.substring(0,8)}</td>
            <td class="warehouse-column" title="${order.warehouse}" style="width:90px; max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-left:4px; padding-right:4px;">${order.warehouse}</td>
            <td>${order.goods}</td>
            <td>${order.deliveryAddress}</td>
            <td>获取报价失败</td>
            <td>${createdDate}</td>
            <td class="action-cell">
              <div class="button-row">
                <button class="view-quotes-btn" onclick="viewQuotes('${order.id}', this)">查看报价</button>
              </div>
            </td>
          `;
        });
    }

    historyTableBody.appendChild(row);

    // Create the quote display row (initially hidden), similar to active orders
    const quoteRow = document.createElement('tr');
    quoteRow.className = 'quote-row'; // Ensure this class is styled if not already
    quoteRow.style.display = 'none';
    quoteRow.innerHTML = `<td colspan="7" class="quote-row-content"></td>`; // Colspan should match number of columns
    historyTableBody.appendChild(quoteRow);
  });

  updateHistoryPaginationInfo();
}


// This function is called by pagination buttons for history orders.
function displayHistoryOrdersPage(page) {
  if (historyPaginationState.currentPage !== page || historyPaginationState.searchQuery) { // Reload if page changes or if there was a search
    historyPaginationState.currentPage = page;
    // historyPaginationState.searchQuery = ''; // Optionally reset search
    // document.getElementById('history-search-input').value = ''; // Optionally clear search input
    loadHistoryOrders(); // Fetches and then renders the new page via _renderHistoryOrdersPage
  } else {
    // If page is the same, and data is already loaded, re-render
    _renderHistoryOrdersPage();
  }
}

// 更新历史分页信息
function updateHistoryPaginationInfo() {
  const startIndex = (historyPaginationState.currentPage - 1) * historyPaginationState.pageSize + 1;
  const endIndex = Math.min(startIndex + historyPaginationState.pageSize - 1, historyPaginationState.totalOrders);

  const paginationInfoElement = document.getElementById('history-pagination-info');
  if (historyPaginationState.totalOrders > 0) {
    paginationInfoElement.textContent = `显示第 ${startIndex} 到 ${endIndex} 条，共 ${historyPaginationState.totalOrders} 条记录`;
  } else {
    paginationInfoElement.textContent = '';
  }
}

// 渲染历史分页控件
function renderHistoryPagination() {
  const paginationElement = document.getElementById('history-pagination');
  paginationElement.innerHTML = '';

  if (historyPaginationState.totalPages <= 1) {
    return; // 只有一页或没有数据时不显示分页
  }

  // 上一页按钮
  const prevButton = document.createElement('button');
  prevButton.innerHTML = '&laquo; 上一页';
  prevButton.disabled = historyPaginationState.currentPage === 1;
  prevButton.addEventListener('click', () => {
    if (historyPaginationState.currentPage > 1) {
      displayHistoryOrdersPage(historyPaginationState.currentPage - 1);
      renderHistoryPagination();
    }
  });
  paginationElement.appendChild(prevButton);

  // 页码按钮
  const maxPageButtons = 5; // 最多显示的页码按钮数
  let startPage = Math.max(1, historyPaginationState.currentPage - Math.floor(maxPageButtons / 2));
  let endPage = Math.min(historyPaginationState.totalPages, startPage + maxPageButtons - 1);

  // 调整startPage，确保显示maxPageButtons个按钮
  if (endPage - startPage + 1 < maxPageButtons && startPage > 1) {
    startPage = Math.max(1, endPage - maxPageButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageButton = document.createElement('button');
    pageButton.textContent = i;
    pageButton.classList.toggle('active', i === historyPaginationState.currentPage);
    pageButton.addEventListener('click', () => {
      displayHistoryOrdersPage(i);
      renderHistoryPagination();
    });
    paginationElement.appendChild(pageButton);
  }

  // 下一页按钮
  const nextButton = document.createElement('button');
  nextButton.innerHTML = '下一页 &raquo;';
  nextButton.disabled = historyPaginationState.currentPage === historyPaginationState.totalPages;
  nextButton.addEventListener('click', () => {
    if (historyPaginationState.currentPage < historyPaginationState.totalPages) {
      displayHistoryOrdersPage(historyPaginationState.currentPage + 1);
      renderHistoryPagination();
    }
  });
  paginationElement.appendChild(nextButton);
}

// 关闭订单
function closeOrder(orderId) {
  if (!confirm('确定要关闭这个订单吗？关闭后将移至历史订单。')) {
    return;
  }

  fetch(`/api/orders/${orderId}/close`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('服务器返回错误');
      }
      return response.json();
    })
    .then(closedOrder => {
      // 不再手动过滤本地列表，而是直接重新加载订单
      // 重新加载活跃订单和历史订单
      loadActiveOrders(); // 从服务器重新获取活跃订单
      loadHistoryOrders(); // 从服务器重新获取历史订单

      alert('订单已成功关闭');
    })
    .catch(error => {
      console.error('关闭订单失败:', error);
      alert('关闭订单失败，请重试');
    });
}

// 将editOrder函数暴露到全局范围
window.editOrder = editOrder;

// 将viewQuotes函数暴露到全局范围
window.viewQuotes = viewQuotes;

// 将closeOrder函数暴露到全局范围
window.closeOrder = closeOrder;

// 选择物流商
function selectProvider(orderId, provider, price) {
  // 显示确认对话框
  const confirmMessage = `确定选择 ${provider} 的报价 ¥${price.toFixed(2)} 吗？\n\n选择后订单将自动关闭并移至历史订单。`;

  if (!confirm(confirmMessage)) {
    return;
  }

  // 发送选择请求
  fetch(`/api/orders/${orderId}/select-provider`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      provider: provider,
      price: price
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('服务器返回错误');
      }
      return response.json();
    })
    .then(result => {
      // 重新加载活跃订单和历史订单
      loadActiveOrders();
      loadHistoryOrders();
    })
    .catch(error => {
      console.error('选择物流商失败:', error);
      alert('选择物流商失败，请重试');
    });
}

// 将selectProvider函数暴露到全局范围
window.selectProvider = selectProvider;

// --- 新增: 物流公司管理功能 ---
// 验证企业微信webhook URL格式
function validateWechatWebhookUrl(url) {
    if (!url) return true; // 空值是允许的
    const pattern = /^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[a-zA-Z0-9-_]+$/;
    return pattern.test(url);
}

async function addProvider() {
    const nameInput = document.getElementById('providerNameInput');
    const accessKeyInput = document.getElementById('providerAccessKeyInput'); // 获取新输入框
    const webhookInput = document.getElementById('providerWebhookInput'); // 获取webhook输入框
    const providerName = nameInput.value.trim();
    const providerAccessKey = accessKeyInput.value.trim(); // 获取自定义链接名
    const wechatWebhookUrl = webhookInput.value.trim(); // 获取企业微信webhook URL
    const statusElement = document.getElementById('addProviderStatus');

    if (!providerName) {
        statusElement.textContent = '请输入物流公司名称。';
        statusElement.style.color = 'red';
        return;
    }

    // 对自定义链接名进行前端校验 (与后端校验规则一致或更宽松，后端会做最终校验)
    if (providerAccessKey && !/^[a-zA-Z0-9_-]+$/.test(providerAccessKey)) {
        statusElement.textContent = '自定义链接名只能包含字母、数字、下划线和中划线。';
        statusElement.style.color = 'red';
        return;
    }
    if (providerAccessKey && providerAccessKey.includes(' ')) {
        statusElement.textContent = '自定义链接名不能包含空格。';
        statusElement.style.color = 'red';
        return;
    }

    // 验证企业微信webhook URL格式
    if (wechatWebhookUrl && !validateWechatWebhookUrl(wechatWebhookUrl)) {
        statusElement.textContent = '企业微信webhook URL格式不正确，应为：https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY';
        statusElement.style.color = 'red';
        return;
    }

    statusElement.textContent = '正在添加...';
    statusElement.style.color = 'blue';

    const requestBody = { name: providerName };
    if (providerAccessKey) {
        requestBody.customAccessKey = providerAccessKey;
    }
    if (wechatWebhookUrl) {
        requestBody.wechatWebhookUrl = wechatWebhookUrl;
    }

    try {
        const response = await fetch('/api/providers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody), // 使用包含自定义链接名的请求体
        });

        const result = await response.json();

        if (response.ok) {
            statusElement.textContent = `物流公司 "${result.name}" 添加成功！专属链接已生成。`;
            statusElement.style.color = 'green';
            nameInput.value = ''; // 清空输入框
            accessKeyInput.value = ''; // 清空自定义链接名输入框
            webhookInput.value = ''; // 清空webhook输入框
            fetchAndDisplayProviders(); // 刷新列表
        } else {
            statusElement.textContent = `添加失败: ${result.error || response.statusText}`;
            statusElement.style.color = 'red';
        }
    } catch (error) {
        console.error('添加物流公司时发生错误:', error);
        statusElement.textContent = '添加过程中发生网络或服务器错误。';
        statusElement.style.color = 'red';
    }
}

async function fetchAndDisplayProviders() {
    const providersListBody = document.getElementById('providersList');
    // const statusElement = document.getElementById('addProviderStatus'); // 通常用于添加操作的状态，列表加载可以有自己的状态显示或静默失败

    try {
        const response = await fetch('/api/providers');
        if (!response.ok) {
            // 修改错误处理逻辑
            let errorMsg = `加载物流公司列表失败，状态码: ${response.status}`;
            try {
                const errData = await response.json();
                errorMsg = errData.error || errorMsg;
            } catch (e) { /* 忽略解析错误，使用上面的状态码错误 */ }
            console.error('Error fetching providers list:', errorMsg);
            providersListBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">${errorMsg}</td></tr>`; // 更新 colspan
            return;
        }

        const data = await response.json();
        const providers = Array.isArray(data) ? data : data.providers;

        providersListBody.innerHTML = ''; // 清空现有列表

        if (providers && providers.length > 0) {
            providers.forEach(provider => {
                const row = providersListBody.insertRow();
                row.setAttribute('data-provider-id', provider.id); // 为行添加 provider id，方便操作
                row.insertCell().textContent = provider.name;

                const linkCell = row.insertCell();
                const accessLink = `${window.location.origin}/provider/${provider.accessKey}`;
                const linkElement = document.createElement('a');
                linkElement.href = accessLink;
                linkElement.textContent = accessLink;
                linkElement.target = '_blank'; // 在新标签页打开
                linkCell.appendChild(linkElement);

                const copyButton = document.createElement('button');
                copyButton.textContent = '复制';
                copyButton.style.marginLeft = '10px';
                copyButton.onclick = () => {
                    navigator.clipboard.writeText(accessLink)
                        .then(() => showToast('链接已复制到剪贴板！')) // 使用 showToast 替换 alert
                        .catch(err => {
                            console.error('复制失败: ', err);
                            showToast('复制失败，请手动复制。');
                        });
                };
                linkCell.appendChild(copyButton);

                // 企业微信通知状态列
                const wechatCell = row.insertCell();
                if (provider.wechat_webhook_url) {
                    wechatCell.innerHTML = '<span style="color: green;">✓ 已配置</span>';
                    const editWebhookBtn = document.createElement('button');
                    editWebhookBtn.textContent = '编辑';
                    editWebhookBtn.style.marginLeft = '5px';
                    editWebhookBtn.style.padding = '2px 6px';
                    editWebhookBtn.style.fontSize = '12px';
                    editWebhookBtn.onclick = () => editWebhookUrl(provider.id, provider.wechat_webhook_url);
                    wechatCell.appendChild(editWebhookBtn);
                } else {
                    wechatCell.innerHTML = '<span style="color: #999;">未配置</span>';
                    const addWebhookBtn = document.createElement('button');
                    addWebhookBtn.textContent = '配置';
                    addWebhookBtn.style.marginLeft = '5px';
                    addWebhookBtn.style.padding = '2px 6px';
                    addWebhookBtn.style.fontSize = '12px';
                    addWebhookBtn.onclick = () => editWebhookUrl(provider.id, '');
                    wechatCell.appendChild(addWebhookBtn);
                }

                row.insertCell().textContent = new Date(provider.createdAt).toLocaleString('zh-CN');

                // 新增操作单元格
                const actionCell = row.insertCell();
                const editLinkButton = document.createElement('button');
                editLinkButton.textContent = '修改链接';
                editLinkButton.style.padding = '5px 10px';
                editLinkButton.style.backgroundColor = '#2196F3'; // 蓝色背景
                editLinkButton.style.color = 'white';
                editLinkButton.style.border = 'none';
                editLinkButton.style.borderRadius = '4px';
                editLinkButton.style.cursor = 'pointer';
                editLinkButton.onclick = () => showEditAccessKeyModal(provider.id, provider.accessKey);
                actionCell.appendChild(editLinkButton);

                // 新增删除按钮
                const deleteButton = document.createElement('button');
                deleteButton.textContent = '删除';
                deleteButton.style.padding = '5px 10px';
                deleteButton.style.backgroundColor = '#f44336'; // 红色背景
                deleteButton.style.color = 'white';
                deleteButton.style.border = 'none';
                deleteButton.style.borderRadius = '4px';
                deleteButton.style.cursor = 'pointer';
                deleteButton.style.marginLeft = '5px'; // 与修改按钮的间距
                deleteButton.onclick = () => confirmDeleteProvider(provider.id, provider.name);
                actionCell.appendChild(deleteButton);
            });
        } else {
            providersListBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">暂无物流公司。请在上方添加。</td></tr>'; // 更新 colspan
        }
    } catch (error) {
        console.error('获取物流公司列表时发生错误:', error);
        providersListBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">获取物流公司列表时发生网络或未知错误。</td></tr>';// 更新 colspan
    }
}

// --- 以下是新增的函数 ---
// 编辑企业微信webhook URL
function editWebhookUrl(providerId, currentWebhookUrl) {
    const newWebhookUrl = prompt(
        '请输入企业微信群机器人webhook URL:\n(格式: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY)\n留空则删除配置',
        currentWebhookUrl || ''
    );

    if (newWebhookUrl === null) { // 用户点击了取消
        return;
    }

    const trimmedWebhookUrl = newWebhookUrl.trim();

    // 验证URL格式（如果不为空）
    if (trimmedWebhookUrl && !validateWechatWebhookUrl(trimmedWebhookUrl)) {
        showToast('企业微信webhook URL格式不正确，应为：https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY');
        return;
    }

    if (trimmedWebhookUrl === currentWebhookUrl) {
        showToast('webhook URL未发生变化。');
        return;
    }

    updateProviderWebhookUrl(providerId, trimmedWebhookUrl);
}

// 更新物流公司的企业微信webhook URL
async function updateProviderWebhookUrl(providerId, webhookUrl) {
    try {
        const response = await fetch(`/api/providers/${providerId}/webhook`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ wechatWebhookUrl: webhookUrl }),
        });

        const result = await response.json();

        if (response.ok) {
            showToast(result.message || '企业微信webhook URL更新成功！');
            fetchAndDisplayProviders(); // 刷新列表
        } else {
            showToast(`更新失败: ${result.error || response.statusText}`);
        }
    } catch (error) {
        console.error('更新webhook URL时发生错误:', error);
        showToast('更新webhook URL过程中发生网络或服务器错误。');
    }
}

function showEditAccessKeyModal(providerId, currentAccessKey) {
    const newAccessKey = prompt('请输入新的自定义链接名 (accessKey):\n(仅支持字母、数字、下划线和中划线，不能为空)', currentAccessKey);

    if (newAccessKey === null) { // 用户点击了取消
        return;
    }

    const trimmedNewAccessKey = newAccessKey.trim();

    if (trimmedNewAccessKey === '') {
        showToast('新的链接名不能为空。');
        return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedNewAccessKey)) {
        showToast('新的链接名只能包含字母、数字、下划线和中划线。');
        return;
    }

    if (trimmedNewAccessKey.includes(' ')) {
        showToast('新的链接名不能包含空格。');
        return;
    }

    if (trimmedNewAccessKey === currentAccessKey) {
        showToast('新的链接名与当前链接名相同，未做修改。');
        return;
    }

    updateProviderAccessKey(providerId, trimmedNewAccessKey);
}

async function updateProviderAccessKey(providerId, newAccessKey) {
    try {
        const response = await fetch(`/api/providers/${providerId}/access-key`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ newAccessKey: newAccessKey }),
        });

        const result = await response.json();

        if (response.ok) {
            showToast(result.message || '链接名更新成功！');
            fetchAndDisplayProviders(); // 刷新列表
        } else {
            showToast(`更新失败: ${result.error || response.statusText}`);
        }
    } catch (error) {
        console.error('更新链接名时发生错误:', error);
        showToast('更新链接名过程中发生网络或服务器错误。');
    }
}

// --- 新增删除相关函数 ---
function confirmDeleteProvider(providerId, providerName) {
    if (confirm(`确定要删除物流公司 "${providerName}" 吗？此操作不可撤销。`)) {
        deleteProvider(providerId);
    }
}

async function deleteProvider(providerId) {
    try {
        const response = await fetch(`/api/providers/${providerId}`, {
            method: 'DELETE',
        });

        const result = await response.json();

        if (response.ok) {
            showToast(result.message || '物流公司删除成功！');
            fetchAndDisplayProviders(); // 刷新列表
        } else {
            showToast(`删除失败: ${result.error || response.statusText}`);
        }
    } catch (error) {
        console.error('删除物流公司时发生错误:', error);
        showToast('删除过程中发生网络或服务器错误。');
    }
}