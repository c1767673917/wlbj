import AuthService from './auth';

// API服务配置
const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3000/api';

// 认证API端点（不需要token）
const PUBLIC_ENDPOINTS = ['/auth/login', '/auth/login/provider', '/auth/refresh'];

// 通用API请求函数
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // 检查是否需要添加认证头
  const needsAuth = !PUBLIC_ENDPOINTS.some(publicEndpoint => endpoint.startsWith(publicEndpoint));
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 复制原有headers（如果有）
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, options.headers);
    }
  }

  // 添加JWT认证头
  if (needsAuth) {
    const accessToken = AuthService.getAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    let response = await fetch(url, config);

    // 如果返回401且有刷新token，尝试刷新token
    if (response.status === 401 && needsAuth) {
      const refreshToken = AuthService.getRefreshToken();
      if (refreshToken) {
        const refreshed = await authAPI.refresh(refreshToken);
        if (refreshed) {
          // 更新访问token并重试请求
          AuthService.updateAccessToken(refreshed.accessToken);
          headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
          response = await fetch(url, { ...config, headers });
        }
      }
    }

    // 如果仍然是401，清除认证信息并跳转到登录页
    if (response.status === 401 && needsAuth) {
      AuthService.clearAuth();
      window.location.href = '/login-user-page';
      throw new Error('需要重新登录');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// 认证相关API
export const authAPI = {
  // 用户登录
  login: async (password: string, email?: string) => {
    const response = await apiRequest<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password, email }),
    });
    
    // 保存认证信息
    if (response.accessToken && response.refreshToken) {
      AuthService.saveAuth(response);
    }
    
    return response;
  },

  // 供应商登录
  loginProvider: async (accessKey: string) => {
    const response = await apiRequest<any>('/auth/login/provider', {
      method: 'POST',
      body: JSON.stringify({ accessKey }),
    });
    
    // 保存认证信息
    if (response.accessToken && response.refreshToken) {
      AuthService.saveAuth(response);
    }
    
    return response;
  },

  // 刷新token
  refresh: async (refreshToken: string) => {
    try {
      return await apiRequest<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch (error) {
      // 刷新失败，清除认证信息
      AuthService.clearAuth();
      return null;
    }
  },

  // 登出
  logout: async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      AuthService.clearAuth();
      window.location.href = '/';
    }
  },

  // 获取当前用户信息
  getMe: () => apiRequest<any>('/auth/me'),
};

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

// 导出相关API - 需要添加认证头
export const exportAPI = {
  // 导出活跃订单
  exportActiveOrders: (searchQuery?: string) => {
    const params = new URLSearchParams();
    if (searchQuery) {
      params.append('search', searchQuery);
    }
    const url = `${API_BASE_URL}/export/orders/active?${params.toString()}`;

    // 添加认证头
    const accessToken = AuthService.getAccessToken();
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // 使用fetch下载文件
    fetch(url, { headers })
      .then(response => {
        if (!response.ok) throw new Error('Export failed');
        return response.blob();
      })
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `active-orders-${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch(error => {
        console.error('Export failed:', error);
        alert('导出失败，请重试');
      });
  },

  // 导出历史订单
  exportClosedOrders: (searchQuery?: string) => {
    const params = new URLSearchParams();
    if (searchQuery) {
      params.append('search', searchQuery);
    }
    const url = `${API_BASE_URL}/export/orders/closed?${params.toString()}`;

    // 添加认证头
    const accessToken = AuthService.getAccessToken();
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // 使用fetch下载文件
    fetch(url, { headers })
      .then(response => {
        if (!response.ok) throw new Error('Export failed');
        return response.blob();
      })
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `closed-orders-${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch(error => {
        console.error('Export failed:', error);
        alert('导出失败，请重试');
      });
  },

  // 导出供应商可报价订单
  exportProviderAvailableOrders: (accessKey: string, searchQuery?: string) => {
    const params = new URLSearchParams();
    params.append('accessKey', accessKey);
    if (searchQuery) {
      params.append('search', searchQuery);
    }
    const url = `${API_BASE_URL}/export/provider/available-orders?${params.toString()}`;

    // 添加认证头
    const accessToken = AuthService.getAccessToken();
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // 使用fetch下载文件
    fetch(url, { headers })
      .then(response => {
        if (!response.ok) throw new Error('Export failed');
        return response.blob();
      })
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `available-orders-${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch(error => {
        console.error('Export failed:', error);
        alert('导出失败，请重试');
      });
  },

  // 导出供应商报价历史
  exportProviderQuoteHistory: (accessKey: string, searchQuery?: string) => {
    const params = new URLSearchParams();
    params.append('accessKey', accessKey);
    if (searchQuery) {
      params.append('search', searchQuery);
    }
    const url = `${API_BASE_URL}/export/provider/quote-history?${params.toString()}`;

    // 添加认证头
    const accessToken = AuthService.getAccessToken();
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // 使用fetch下载文件
    fetch(url, { headers })
      .then(response => {
        if (!response.ok) throw new Error('Export failed');
        return response.blob();
      })
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `quote-history-${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch(error => {
        console.error('Export failed:', error);
        alert('导出失败，请重试');
      });
  },
};

// AI相关API - 直接调用SiliconFlow API
export const aiAPI = {
  // AI文本识别
  recognizeText: async (text: string) => {
    try {
      const startTime = Date.now();

      // 固定的API密钥 - 注意：这应该从后端获取
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
  auth: authAPI,
  orders: ordersAPI,
  quotes: quotesAPI,
  providers: providersAPI,
  export: exportAPI,
  ai: aiAPI,
}; 