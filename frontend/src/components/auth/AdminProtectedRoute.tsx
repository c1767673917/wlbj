import { Navigate } from 'react-router-dom';
import { AdminAuthService } from '../../services/auth';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

const AdminProtectedRoute = ({ children }: AdminProtectedRouteProps) => {
  // 检查管理员是否已认证
  const isAuthenticated = AdminAuthService.isAuthenticated();
  const user = AdminAuthService.getCurrentUser();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // 检查是否是管理员角色
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminProtectedRoute;
