import { AdminAuthService } from './auth';

const API_BASE_URL = '/api';

// 管理员专用API请求函数
async function adminApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // 获取管理员认证token
  const accessToken = AdminAuthService.getAccessToken();

  // 检查token是否存在和有效
  if (!accessToken || AdminAuthService.isTokenExpired(accessToken)) {
    console.warn('管理员token无效或已过期，重定向到登录页面');
    AdminAuthService.clearAuth();
    window.location.href = '/admin/login';
    throw new Error('需要重新登录');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // 添加管理员认证头
  headers['Authorization'] = `Bearer ${accessToken}`;

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    let response = await fetch(url, config);

    // 如果返回401且有刷新token，尝试刷新token
    if (response.status === 401) {
      const refreshToken = AdminAuthService.getRefreshToken();
      if (refreshToken) {
        try {
          const refreshResponse = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResponse.ok) {
            const refreshed = await refreshResponse.json();
            AdminAuthService.updateAccessToken(refreshed.accessToken);
            headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
            response = await fetch(url, { ...config, headers });
          }
        } catch (error) {
          console.error('管理员Token刷新失败:', error);
        }
      }
    }

    // 如果仍然是401或403，清除认证信息并跳转到管理员登录页
    if (response.status === 401 || response.status === 403) {
      console.warn('管理员认证失败，重定向到登录页面');
      AdminAuthService.clearAuth();
      window.location.href = '/admin/login';
      throw new Error('需要重新登录');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('管理员API请求失败:', error);
    throw error;
  }
}

// 管理员相关API
export const adminAPI = {
  // 管理员登录
  login: async (password: string) => {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '登录失败');
    }

    const result = await response.json();

    // 保存管理员认证信息
    if (result.accessToken && result.refreshToken) {
      AdminAuthService.saveAuth(result);
    }

    return result;
  },

  // 更新管理员密码
  updatePassword: (currentPassword: string, newPassword: string) =>
    adminApiRequest<any>('/admin/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // 获取所有用户
  getUsers: () => adminApiRequest<any[]>('/admin/users'),

  // 创建用户
  createUser: (userData: { email: string; password: string; name?: string }) =>
    adminApiRequest<any>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  // 更新用户
  updateUser: (userId: string, userData: any) =>
    adminApiRequest<any>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),

  // 删除用户
  deleteUser: (userId: string) =>
    adminApiRequest<any>(`/admin/users/${userId}`, {
      method: 'DELETE',
    }),

  // 重置用户密码
  resetUserPassword: (userId: string, newPassword: string) =>
    adminApiRequest<any>(`/admin/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    }),

  // 获取系统统计信息
  getStats: () => adminApiRequest<any>('/admin/stats'),

  // 备份相关
  getBackupConfig: () => adminApiRequest<any>('/admin/backup/config'),
  updateBackupConfig: (config: any) =>
    adminApiRequest<any>('/admin/backup/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  createBackup: () => adminApiRequest<any>('/admin/backup/create', { method: 'POST' }),
  getBackupHistory: () => adminApiRequest<any[]>('/admin/backup/history'),

  // 登出
  logout: async () => {
    try {
      await adminApiRequest('/admin/logout', { method: 'POST' });
    } finally {
      AdminAuthService.clearAuth();
      window.location.href = '/';
    }
  },
};

export default adminAPI;
