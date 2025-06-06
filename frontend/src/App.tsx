import { BrowserRouter as Router, Routes, Route, useParams, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import UserPortal from './components/user/UserPortal';
import ProviderPortal from './components/provider/ProviderPortal';
import LoginPage from './components/auth/LoginPage';
import AdminLoginPage from './components/admin/AdminLoginPage';
import AdminPortal from './components/admin/AdminPortal';
import HomePage from './components/layout/HomePage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminProtectedRoute from './components/auth/AdminProtectedRoute';
import AuthService from './services/auth';
import api from './services/api';

// 供应商页面组件
function ProviderPage() {
  const { accessKey } = useParams<{ accessKey: string }>();

  useEffect(() => {
    // 供应商页面通过accessKey自动登录
    const autoLogin = async () => {
      if (accessKey && !AuthService.isAuthenticated()) {
        try {
          await api.auth.loginProvider(accessKey);
        } catch (error) {
          console.error('供应商自动登录失败:', error);
        }
      }
    };

    autoLogin();
  }, [accessKey]);

  return <ProviderPortal providerKey={accessKey || ''} />;
}

// 用户页面组件
function UserPage() {
  return <UserPortal />;
}

// 用户登录页面组件
function LoginUserPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hasError = searchParams.get('error') === '1';

  return <LoginPage hasError={hasError} />;
}

// 管理员登录页面组件
function AdminLoginPageWrapper() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hasError = searchParams.get('error') === '1';

  return <AdminLoginPage hasError={hasError} />;
}

function App() {
  useEffect(() => {
    // 设置定时器检查是否需要刷新token
    const checkTokenRefresh = async () => {
      if (AuthService.isAuthenticated() && AuthService.shouldRefreshToken()) {
        const refreshToken = AuthService.getRefreshToken();
        if (refreshToken) {
          try {
            const response = await api.auth.refresh(refreshToken);
            if (response?.accessToken) {
              AuthService.updateAccessToken(response.accessToken);
            }
          } catch (error) {
            console.error('Token刷新失败:', error);
          }
        }
      }
    };

    // 初始检查
    checkTokenRefresh();

    // 每分钟检查一次
    const interval = setInterval(checkTokenRefresh, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login-user-page" element={<LoginUserPage />} />
            <Route path="/admin/login" element={<AdminLoginPageWrapper />} />
            <Route
              path="/user"
              element={
                <ProtectedRoute requiredRole="user">
                  <UserPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminProtectedRoute>
                  <AdminPortal />
                </AdminProtectedRoute>
              }
            />
            <Route path="/provider/:accessKey" element={<ProviderPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;