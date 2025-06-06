import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Package,
  TruckIcon,
  FileText,
  Settings,
  LogOut,
  BarChart3,
  Shield,
  Database
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { AdminAuthService } from '../../services/auth';
import api from '../../services/api';
import UserManagement from './UserManagement';
import OrderManagement from './OrderManagement';
import SystemSettings from './SystemSettings';
import BackupManagement from './BackupManagement';

interface SystemStats {
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  orders: {
    total: number;
    active: number;
    closed: number;
  };
  providers: {
    total: number;
  };
  quotes: {
    total: number;
  };
}

const AdminPortal = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();

  useEffect(() => {
    // 检查管理员权限和token有效性
    const accessToken = AdminAuthService.getAccessToken();
    const isAuthenticated = AdminAuthService.isAuthenticated();
    const isAdmin = AdminAuthService.isAdmin();

    // 检查token是否过期
    if (accessToken && AdminAuthService.isTokenExpired(accessToken)) {
      console.warn('管理员token已过期，清除认证信息');
      AdminAuthService.clearAuth();
      navigate('/admin/login');
      return;
    }

    if (!isAuthenticated || !isAdmin) {
      navigate('/admin/login');
      return;
    }

    loadStats();
  }, []); // 移除navigate依赖，避免无限循环

  const loadStats = async () => {
    try {
      setLoading(true);
      const accessToken = AdminAuthService.getAccessToken();

      // 检查token是否存在和有效
      if (!accessToken || AdminAuthService.isTokenExpired(accessToken)) {
        console.warn('管理员token无效或已过期，重定向到登录页面');
        AdminAuthService.clearAuth();
        navigate('/admin/login');
        return;
      }

      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.warn('管理员认证失败，重定向到登录页面');
          AdminAuthService.clearAuth();
          navigate('/admin/login');
          return;
        }
        throw new Error('获取统计信息失败');
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('加载统计信息失败:', error);
      // 如果是网络错误或其他错误，不清除认证信息
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    AdminAuthService.clearAuth();
    navigate('/');
  };

  const StatCard = ({ title, value, icon: Icon, color }: {
    title: string;
    value: number;
    icon: any;
    color: string;
  }) => (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-red-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">系统管理后台</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                管理员：{AdminAuthService.getCurrentUser()?.name || '系统管理员'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center"
              >
                <LogOut size={16} className="mr-2" />
                退出登录
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 导航标签 */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'dashboard', name: '仪表板', icon: BarChart3 },
              { id: 'users', name: '用户管理', icon: Users },
              { id: 'orders', name: '订单管理', icon: Package },
              { id: 'backup', name: '备份管理', icon: Database },
              { id: 'settings', name: '系统设置', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === tab.id
                    ? 'bg-red-100 text-red-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={16} className="mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* 仪表板内容 */}
        {activeTab === 'dashboard' && stats && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">系统概览</h2>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="总用户数"
                value={stats.users.total}
                icon={Users}
                color="bg-blue-500"
              />
              <StatCard
                title="活跃用户"
                value={stats.users.active}
                icon={Users}
                color="bg-green-500"
              />
              <StatCard
                title="总订单数"
                value={stats.orders.total}
                icon={Package}
                color="bg-purple-500"
              />
              <StatCard
                title="物流公司"
                value={stats.providers.total}
                icon={TruckIcon}
                color="bg-orange-500"
              />
            </div>

            {/* 详细统计 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">用户统计</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">活跃用户</span>
                    <span className="font-medium text-green-600">{stats.users.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">禁用用户</span>
                    <span className="font-medium text-red-600">{stats.users.inactive}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">总用户数</span>
                    <span className="font-medium">{stats.users.total}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">订单统计</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">活跃订单</span>
                    <span className="font-medium text-blue-600">{stats.orders.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">已完成订单</span>
                    <span className="font-medium text-green-600">{stats.orders.closed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">总订单数</span>
                    <span className="font-medium">{stats.orders.total}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* 用户管理 */}
        {activeTab === 'users' && <UserManagement />}

        {/* 订单管理 */}
        {activeTab === 'orders' && <OrderManagement />}

        {/* 备份管理 */}
        {activeTab === 'backup' && <BackupManagement />}

        {/* 系统设置 */}
        {activeTab === 'settings' && <SystemSettings />}
      </div>
    </div>
  );
};

export default AdminPortal;
