// API服务配置
const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3000/api';

// 通用API请求函数
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// 订单相关API
export const ordersAPI = {
  // 获取所有订单（管理员用）
  getAll: async () => {
    const response = await apiRequest<any>('/orders?pageSize=1000');
    return response.items || response;
  },

  // 获取活跃订单（用户端）
  getActiveOrders: async () => {
    const response = await apiRequest<any>('/orders/active?pageSize=1000');
    return response.items || response;
  },

  // 获取历史订单（用户端）
  getClosedOrders: async () => {
    const response = await apiRequest<any>('/orders/closed?pageSize=1000');
    return response.items || response;
  },

  // 创建新订单
  create: (orderData: {
    warehouse: string;
    goods: string;
    destination: string;
  }) => apiRequest<any>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      warehouse: orderData.warehouse,
      goods: orderData.goods,
      deliveryAddress: orderData.destination, // 后端期望的字段名
    }),
  }),

  // 获取单个订单
  getById: (id: string) => apiRequest<any>(`/orders/${id}`),

  // 更新订单
  update: (id: string, data: any) => apiRequest<any>(`/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // 关闭订单
  close: (id: string) => apiRequest<any>(`/orders/${id}/close`, {
    method: 'PUT',
  }),
};

// 报价相关API
export const quotesAPI = {
  // 获取订单的所有报价
  getByOrderId: (orderId: string) => apiRequest<any[]>(`/orders/${orderId}/quotes`),

  // 获取单个订单的最低报价
  getLowestByOrderId: (orderId: string) => apiRequest<any>(`/quotes/lowest/${orderId}`),

  // 批量获取最低报价
  getLowestBatch: (orderIds: string[]) => {
    const orderIdsParam = orderIds.join(',');
    return apiRequest<any>(`/quotes/lowest-batch?orderIds=${encodeURIComponent(orderIdsParam)}`);
  },

  // 创建报价
  create: (quoteData: {
    orderId: string;
    providerId: string;
    price: number;
    notes?: string;
  }) => apiRequest<any>('/quotes', {
    method: 'POST',
    body: JSON.stringify(quoteData),
  }),

  // 物流商提交报价 (通过accessKey)
  submitByProvider: (quoteData: {
    orderId: string;
    price: number;
    estimatedDelivery: string;
    accessKey: string;
  }) => apiRequest<any>('/quotes', {
    method: 'POST',
    body: JSON.stringify(quoteData),
  }),

  // 选择报价
  select: (orderId: string, provider: string, price: number) => apiRequest<any>(`/orders/${orderId}/select-provider`, {
    method: 'PUT',
    body: JSON.stringify({ provider, price }),
  }),
};

// 供应商相关API
export const providersAPI = {
  // 获取所有供应商
  getAll: () => apiRequest<any[]>('/providers'),

  // 创建供应商
  create: (providerData: {
    name: string;
    customAccessKey?: string;
    wechatWebhookUrl?: string;
  }) => apiRequest<any>('/providers', {
    method: 'POST',
    body: JSON.stringify(providerData),
  }),

  // 删除供应商
  delete: (providerId: number) => apiRequest<any>(`/providers/${providerId}`, {
    method: 'DELETE',
  }),

  // 更新供应商webhook
  updateWebhook: (providerId: number, wechatWebhookUrl: string) => apiRequest<any>(`/providers/${providerId}/webhook`, {
    method: 'PUT',
    body: JSON.stringify({ wechatWebhookUrl }),
  }),

  // 获取供应商信息（通过accessKey）
  getByAccessKey: (accessKey: string) => apiRequest<any>(`/providers/details?accessKey=${accessKey}`),

  // 获取供应商的可用订单
  getAvailableOrders: (accessKey: string) => apiRequest<any>(`/providers/${accessKey}/available-orders`),

  // 获取供应商的报价历史
  getQuoteHistory: (accessKey: string) => apiRequest<any>(`/providers/${accessKey}/quote-history`),
};

// 导出相关API
export const exportAPI = {
  // 导出活跃订单
  exportActiveOrders: (searchQuery?: string) => {
    const params = new URLSearchParams();
    if (searchQuery) {
      params.append('search', searchQuery);
    }
    const url = `${API_BASE_URL}/export/orders/active?${params.toString()}`;

    // 创建临时链接下载文件
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // 导出历史订单
  exportClosedOrders: (searchQuery?: string) => {
    const params = new URLSearchParams();
    if (searchQuery) {
      params.append('search', searchQuery);
    }
    const url = `${API_BASE_URL}/export/orders/closed?${params.toString()}`;

    // 创建临时链接下载文件
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // 导出供应商可报价订单
  exportProviderAvailableOrders: (accessKey: string, searchQuery?: string) => {
    const params = new URLSearchParams();
    params.append('accessKey', accessKey);
    if (searchQuery) {
      params.append('search', searchQuery);
    }
    const url = `${API_BASE_URL}/export/provider/available-orders?${params.toString()}`;

    // 创建临时链接下载文件
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // 导出供应商报价历史
  exportProviderQuoteHistory: (accessKey: string, searchQuery?: string) => {
    const params = new URLSearchParams();
    params.append('accessKey', accessKey);
    if (searchQuery) {
      params.append('search', searchQuery);
    }
    const url = `${API_BASE_URL}/export/provider/quote-history?${params.toString()}`;

    // 创建临时链接下载文件
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

// AI相关API - 直接调用SiliconFlow API
export const aiAPI = {
  // AI文本识别
  recognizeText: async (text: string) => {
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
              content: text
            }
          ],
          temperature: 0.2,
          enable_thinking: false
        })
      });

      const endTime = Date.now();
      const timeElapsed = (endTime - startTime) / 1000;
      console.log(`AI识别响应时间: ${timeElapsed.toFixed(2)}秒`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API错误响应:', errorText);
        throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.choices || result.choices.length === 0) {
        throw new Error('AI服务返回了无效的响应');
      }

      // 解析AI返回的内容
      const content = result.choices[0].message.content;
      console.log('AI识别原始结果:', content);

      // 尝试提取JSON内容
      let jsonData;
      try {
        // 先尝试直接解析（如果返回的就是纯JSON）
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
      const warehouse = jsonData.warehouse || '';

      // 处理货物信息 - 如果是数组则转换为字符串
      let goods = '';
      if (jsonData.goods) {
        if (Array.isArray(jsonData.goods)) {
          // 数组形式的货物信息
          goods = jsonData.goods.map((item: any) => {
            if (typeof item === 'object' && item.name && item.quantity) {
              return `${item.name} ${item.quantity}`;
            } else {
              return item;
            }
          }).join('\n');
        } else if (typeof jsonData.goods === 'object') {
          // 对象形式的货物信息
          goods = JSON.stringify(jsonData.goods, null, 2);
        } else {
          // 字符串形式的货物信息
          goods = jsonData.goods;
        }
      }

      const destination = jsonData.deliveryAddress || '';

      return {
        warehouse,
        goods,
        destination,
      };

    } catch (error) {
      console.error('AI识别出错:', error);
      throw error;
    }
  },
};

export default {
  orders: ordersAPI,
  quotes: quotesAPI,
  providers: providersAPI,
  export: exportAPI,
  ai: aiAPI,
};
