// JWT认证服务
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface User {
  id: string;
  email?: string;
  name?: string;
  role: 'admin' | 'user' | 'provider';
  providerId?: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

class AuthService {
  private static ACCESS_TOKEN_KEY = 'wlbj_access_token';
  private static REFRESH_TOKEN_KEY = 'wlbj_refresh_token';
  private static USER_KEY = 'wlbj_user';

  // 获取存储的tokens
  static getTokens(): AuthTokens | null {
    const accessToken = localStorage.getItem(this.ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    
    if (!accessToken || !refreshToken) {
      return null;
    }
    
    return { accessToken, refreshToken };
  }

  // 获取访问token
  static getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  // 获取刷新token
  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  // 获取当前用户信息
  static getCurrentUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  // 保存认证信息
  static saveAuth(authData: LoginResponse): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, authData.accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, authData.refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(authData.user));
  }

  // 更新访问token
  static updateAccessToken(accessToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
  }

  // 清除认证信息
  static clearAuth(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  // 检查是否已认证
  static isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // 检查token是否过期（简单实现，实际应该解析JWT）
  static isTokenExpired(token: string): boolean {
    try {
      // 解析JWT payload（简单实现，不验证签名）
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // 转换为毫秒
      return Date.now() >= exp;
    } catch {
      return true;
    }
  }

  // 检查是否需要刷新token
  static shouldRefreshToken(): boolean {
    const accessToken = this.getAccessToken();
    if (!accessToken) return false;
    
    // 如果token在5分钟内过期，则刷新
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const exp = payload.exp * 1000;
      const fiveMinutes = 5 * 60 * 1000;
      return (exp - Date.now()) < fiveMinutes;
    } catch {
      return false;
    }
  }

  // 检查用户角色
  static hasRole(requiredRole: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === requiredRole;
  }

  // 检查是否是用户端
  static isUser(): boolean {
    return this.hasRole('user') || this.hasRole('admin');
  }

  // 检查是否是供应商
  static isProvider(): boolean {
    return this.hasRole('provider');
  }

  // 检查是否是管理员
  static isAdmin(): boolean {
    return this.hasRole('admin');
  }
}

export default AuthService;
export type { AuthTokens, User, LoginResponse }; 