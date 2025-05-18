let currentProviderAccessKey = null;
let currentProviderName = '未知物流商'; // Default name

document.addEventListener('DOMContentLoaded', () => {
    const pathParts = window.location.pathname.split('/');
    const accessKeyFromUrl = pathParts[pathParts.length - 1];

    if (accessKeyFromUrl && pathParts[pathParts.length - 2] === 'provider') {
        currentProviderAccessKey = accessKeyFromUrl;
        console.log('Provider Access Key:', currentProviderAccessKey);
        fetchProviderDetails(currentProviderAccessKey);
        // Initialize fetching data once access key is confirmed
        // (Assuming functions like fetchAvailableOrders and fetchMyQuotes exist and will be updated)
        // fetchAvailableOrders(1); 
        // fetchMyQuotes(1);
    } else {
        console.error('Access Key not found in URL or URL structure is incorrect.');
        const displayElement = document.getElementById('providerNameDisplay');
        if (displayElement) {
            displayElement.innerHTML = '物流公司: <span style="font-weight: bold; color: red;">无效访问链接</span>';
        }
        // Optionally, disable UI elements or redirect
        alert('错误：无效的物流供应商访问链接。请检查链接是否正确。');
        // Hide main content or redirect
        const mainContent = document.querySelector('main');
        if(mainContent) mainContent.style.display = 'none';
    }

    // Remove or adapt old provider name submission logic if any
    // const providerInfoForm = document.getElementById('provider-info-form');
    // if (providerInfoForm) {
    //     providerInfoForm.addEventListener('submit', function(event) {
    //         event.preventDefault();
    //         // This form is no longer used for initial auth, might be repurposed or removed
    //     });
    // }
});

async function fetchProviderDetails(accessKey) {
    const displayElement = document.getElementById('providerNameDisplay');
    try {
        // This API endpoint /api/provider-details?accessKey=KEY needs to be created in app.js
        const response = await fetch(`/api/providers/details?accessKey=${accessKey}`);
        if (!response.ok) {
            if (response.status === 404) {
                currentProviderName = '未知物流商 (无效Key)';
                if (displayElement) displayElement.innerHTML = `物流公司: <span style="font-weight: bold; color: red;">${currentProviderName}</span>`;
                alert('错误：无法验证物流公司信息，请确保链接有效。');
                const mainContent = document.querySelector('main');
                if(mainContent) mainContent.style.display = 'none';
            } else {
                throw new Error(`Failed to fetch provider details: ${response.status}`);
            }
    return;
  }
        const provider = await response.json();
        currentProviderName = provider.name;
        if (displayElement) {
            displayElement.innerHTML = `物流公司: <span style="font-weight: bold;">${currentProviderName}</span>`;
        }
        // After successfully fetching provider details, load their data
        // These functions need to be adapted to use currentProviderAccessKey
        fetchAvailableOrders(1); // Example: Load first page of available orders
        fetchMyQuotes(1);      // Example: Load first page of own quotes

    } catch (error) {
        console.error('Error fetching provider details:', error);
        if (displayElement) displayElement.innerHTML = '物流公司: <span style="font-weight: bold; color: red;">信息加载失败</span>';
        // Optionally disable UI further
    }
}

// --- MOCKUP/ADAPTATION of existing functions (assuming structure from a typical provider.js) ---
// Replace these with actual functions from the existing provider.js and modify them.

let currentPageAvailable = 1;
let currentPageMyQuotes = 1;
const pageSize = 10; // Assuming a page size

// Adapt fetchAvailableOrders
async function fetchAvailableOrders(page) {
    if (!currentProviderAccessKey) return;
    currentPageAvailable = page;
    const response = await fetch(`/api/orders/available?accessKey=${currentProviderAccessKey}&page=${page}&pageSize=${pageSize}`);
    const data = await response.json();
    renderTable(data.items, 'available-orders-table', true);
    updatePaginationControls('available', data.totalPages, data.currentPage);
    // Store providerName from response if it's useful (already in currentProviderName)
}

// Adapt function to open quote modal (if it takes orderId)
let orderIdToQuote = null;
function openQuoteModal(orderId) {
    orderIdToQuote = orderId;
    document.getElementById('quoteOrderId').textContent = orderId;
    document.getElementById('quoteModal').style.display = 'block';
    document.getElementById('price').value = '';
    document.getElementById('estimatedDelivery').value = '';
    document.getElementById('quoteStatus').textContent = '';
}

function closeQuoteModal() {
    document.getElementById('quoteModal').style.display = 'none';
}

// Adapt submitQuote
async function submitQuote() {
    if (!currentProviderAccessKey || !orderIdToQuote) return;

    const price = document.getElementById('price').value;
    const estimatedDelivery = document.getElementById('estimatedDelivery').value;
    const statusP = document.getElementById('quoteStatus');

    if (!price || !estimatedDelivery) {
        statusP.textContent = '价格和预计送达时间不能为空。';
        statusP.style.color = 'red';
    return;
  }
  
    statusP.textContent = '正在提交...';
    statusP.style.color = 'blue';

    try {
        const response = await fetch('/api/quotes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                orderId: orderIdToQuote,
                price: parseFloat(price),
                estimatedDelivery: estimatedDelivery,
                accessKey: currentProviderAccessKey // Include accessKey
            }),
        });
        const result = await response.json();
        if (response.ok) {
            statusP.textContent = '报价成功提交！';
            statusP.style.color = 'green';
            closeQuoteModal();
            fetchAvailableOrders(currentPageAvailable); // Refresh available orders
            fetchMyQuotes(currentPageMyQuotes); // Refresh my quotes
        } else {
            statusP.textContent = `提交失败: ${result.error || '未知错误'}`;
            statusP.style.color = 'red';
        }
    } catch (error) {
        console.error('Error submitting quote:', error);
        statusP.textContent = '提交报价时出错。';
        statusP.style.color = 'red';
    }
}

// Adapt fetchMyQuotes
async function fetchMyQuotes(page) {
    if (!currentProviderAccessKey) return;
    currentPageMyQuotes = page;
    const response = await fetch(`/api/quotes?accessKey=${currentProviderAccessKey}&page=${page}&pageSize=${pageSize}`);
    const data = await response.json();
    renderTable(data.items, 'provider-history-table', false);
    updatePaginationControls('myquotes', data.totalPages, data.currentPage);
}

// Corrected renderTable function
function renderTable(items, tableId, showActionButton) {
    const tableElement = document.getElementById(tableId);
    if (!tableElement) {
        console.error(`renderTable Error: Table with id "${tableId}" not found.`);
        return;
    }
    const tableBody = tableElement.getElementsByTagName('tbody')[0];
    if (!tableBody) {
        console.error(`renderTable Error: tbody not found in table "${tableId}".`);
        return;
    }

    tableBody.innerHTML = ''; // Clear existing rows
    if (!items || items.length === 0) {
        let colspan = 6; // Default colspan
        const thead = tableElement.getElementsByTagName('thead')[0];
        if (thead && thead.rows.length > 0 && thead.rows[0].cells.length > 0) {
            colspan = thead.rows[0].cells.length;
        }
        tableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;">无数据</td></tr>`;
        return; 
    }

    items.forEach(item => {
        const row = tableBody.insertRow();
        let cell;

        if (tableId === 'available-orders-table') {
            // 订单编号
            cell = row.insertCell();
            cell.textContent = item.id ? item.id.substring(0, 8) : 'N/A';
            cell.setAttribute('data-label', '订单编号:');

            // 发货仓库
            cell = row.insertCell();
            cell.textContent = item.warehouse;
            cell.setAttribute('data-label', '发货仓库:');

            // 货物信息 - Needs span for full-width layout
            cell = row.insertCell();
            cell.setAttribute('data-label', '货物信息:');
            cell.style.whiteSpace = 'pre-wrap'; 
            const goodsSpan = document.createElement('span');
            goodsSpan.className = 'content-value';
            goodsSpan.textContent = item.goods;
            cell.appendChild(goodsSpan);

            // 收货信息 - Needs span for full-width layout
            cell = row.insertCell();
            cell.setAttribute('data-label', '收货信息:');
            cell.style.whiteSpace = 'pre-wrap'; 
            const deliveryAddressSpan = document.createElement('span');
            deliveryAddressSpan.className = 'content-value';
            deliveryAddressSpan.textContent = item.deliveryAddress;
            cell.appendChild(deliveryAddressSpan);

            // 发布时间
            cell = row.insertCell();
            cell.textContent = new Date(item.createdAt).toLocaleString();
            cell.setAttribute('data-label', '发布时间:');

            if (showActionButton) {
                cell = row.insertCell();
                cell.setAttribute('data-label', '操作:'); 
                cell.classList.add('action-cell'); 
                const button = document.createElement('button');
                button.textContent = '报价';
                button.onclick = () => showQuoteFormForRow(item.id, button.closest('tr'));
                cell.appendChild(button);
            }
        } else { // Logic for 'provider-history-table'
            // 订单编号
            cell = row.insertCell();
            cell.textContent = item.orderId ? item.orderId.substring(0,8) : 'N/A';
            cell.setAttribute('data-label', '订单编号:');

            // 发货仓库 
            cell = row.insertCell();
            cell.textContent = item.orderWarehouse || 'N/A'; 
            cell.setAttribute('data-label', '发货仓库:');

            // 收货信息 - Needs span for full-width layout
            cell = row.insertCell();
            cell.setAttribute('data-label', '收货信息:');
            cell.style.whiteSpace = 'pre-wrap'; 
            const historyDeliveryAddressSpan = document.createElement('span');
            historyDeliveryAddressSpan.className = 'content-value';
            historyDeliveryAddressSpan.textContent = item.orderDeliveryAddress || 'N/A';
            cell.appendChild(historyDeliveryAddressSpan);

            // 报价(元)
            cell = row.insertCell();
            cell.textContent = item.price != null ? item.price.toFixed(2) : 'N/A';
            cell.setAttribute('data-label', '我的报价 (元):');

            // 预计送达时间
            cell = row.insertCell();
            cell.textContent = item.estimatedDelivery;
            cell.setAttribute('data-label', '预计送达:');

            // 报价时间
            cell = row.insertCell();
            cell.textContent = new Date(item.createdAt).toLocaleString();
            cell.setAttribute('data-label', '报价时间:');
        }
    });
}

// Placeholder for showQuoteFormForRow - this needs to be implemented
function showQuoteFormForRow(orderId, orderRow) {
    console.log(`Attempting to show quote form for order ${orderId}. Clicked order row content:`, orderRow.textContent);
  const existingFormRows = document.querySelectorAll('.quote-form-row');
    existingFormRows.forEach(row => {
        console.log("Removing existing form row:", row);
        row.remove();
    });

    if (!orderRow) {
        console.error("Order row not found for showing quote form.");
        return;
    }
      
  const formTemplate = document.getElementById('inline-quote-form-template');
  if (!formTemplate) {
        console.error("'inline-quote-form-template' not found!");
    return;
  }

    const newFormRow = document.createElement('tr');
    newFormRow.className = 'quote-form-row';
    const cell = newFormRow.insertCell(0);

    const mainTable = orderRow.closest('table');
    const colCount = mainTable.getElementsByTagName('thead')[0]?.rows[0]?.cells.length || 6;
    console.log("Calculated colspan:", colCount); // Log colspan
    cell.colSpan = colCount;
    if (colCount <= 0) {
        console.error("Error: Calculated colspan is not positive, form might not render correctly.");
    }

  const formContent = formTemplate.content.cloneNode(true);
    const formElement = formContent.querySelector('.quote-inline-form');
    formElement.querySelector('[name="orderId"]').value = orderId;
  
    formElement.addEventListener('submit', async function(event) {
        event.preventDefault();
        const price = this.querySelector('[name="price"]').value;
        const estimatedDelivery = this.querySelector('[name="estimatedDelivery"]').value;
        await submitInlineQuote(orderId, price, estimatedDelivery, currentProviderAccessKey, newFormRow);
  });
  
  formContent.querySelector('.cancel-btn').addEventListener('click', function() {
        newFormRow.remove();
  });
  
    cell.appendChild(formContent);
    orderRow.after(newFormRow);
    newFormRow.style.display = 'table-row'; // Explicitly set display style
    console.log("New form row inserted and display style set. Form row element:", newFormRow);
}

async function submitInlineQuote(orderId, price, estimatedDelivery, accessKey, formRowElement) {
    if (!accessKey || !orderId) return;
  
    if (!price || !estimatedDelivery) {
        alert('价格和预计送达时间不能为空。');
    return;
  }
    // Add a status indicator within the form if needed

    try {
        const response = await fetch('/api/quotes', {
    method: 'POST',
    headers: {
                'Content-Type': 'application/json',
    },
            body: JSON.stringify({
                orderId: orderId,
                price: parseFloat(price),
                estimatedDelivery: estimatedDelivery,
                accessKey: accessKey 
            }),
        });
        const result = await response.json();
        if (response.ok) {
            alert('报价成功提交！');
            if(formRowElement) formRowElement.remove();
            fetchAvailableOrders(currentPageAvailable); 
            fetchMyQuotes(currentPageMyQuotes); 
        } else {
            alert(`提交失败: ${result.error || '未知错误'}`);
        }
    } catch (error) {
        console.error('Error submitting inline quote:', error);
        alert('提交报价时出错。');
    }
}

// Adapt updatePaginationControls (simplified placeholder)
function updatePaginationControls(type, totalPages, currentPage) {
    const pageInfoId = type === 'available' ? 'availablePageInfo' : 'myQuotesPageInfo';
    const pageInfoElement = document.getElementById(pageInfoId);
    if (pageInfoElement) {
        pageInfoElement.textContent = `第 ${currentPage} / ${totalPages || 1} 页`;
}

    // Corrected query selectors for pagination buttons
    const prevButton = document.querySelector(".pagination-controls button[onclick^='prevPage(" + type + ")']");
    const nextButton = document.querySelector(".pagination-controls button[onclick^='nextPage(" + type + ")']");

    if(prevButton) {
        prevButton.disabled = currentPage <= 1;
    }
    if(nextButton) {
        nextButton.disabled = currentPage >= totalPages;
    }
}

// Adapt prevPage / nextPage (simplified placeholders)
function prevPage(type) {
    if (type === 'available' && currentPageAvailable > 1) {
        fetchAvailableOrders(currentPageAvailable - 1);
    } else if (type === 'myquotes' && currentPageMyQuotes > 1) {
        fetchMyQuotes(currentPageMyQuotes - 1);
  }
}

function nextPage(type) {
    // Assuming totalPages is known or checked before incrementing
    // This needs to be more robust by checking against totalPages from last fetch
    if (type === 'available') {
        // Check if currentPageAvailable < totalPagesAvailable (you'd need to store totalPages)
        fetchAvailableOrders(currentPageAvailable + 1);
    } else if (type === 'myquotes') {
        // Check if currentPageMyQuotes < totalPagesMyQuotes
        fetchMyQuotes(currentPageMyQuotes + 1);
    }
}

// Make sure to include any other necessary utility functions or event listeners from the original provider.js