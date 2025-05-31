import { Navigate } from 'react-router-dom';
import AuthService from '../../services/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  // 检查是否已认证
  if (!AuthService.isAuthenticated()) {
    return <Navigate to="/login-user-page" replace />;
  }

  // 检查角色权限
  if (requiredRole) {
    const user = AuthService.getCurrentUser();
    if (!user || user.role !== requiredRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

 