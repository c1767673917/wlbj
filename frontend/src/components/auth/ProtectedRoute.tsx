import { Navigate } from 'react-router-dom';
import AuthService from '../../services/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  // 检查是否已认证
  const isAuthenticated = AuthService.isAuthenticated();
  const user = AuthService.getCurrentUser();

  if (!isAuthenticated) {
    return <Navigate to="/login-user-page" replace />;
  }

  // 检查角色权限
  if (requiredRole) {
    if (!user || user.role !== requiredRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

