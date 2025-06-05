import { TruckIcon, UserPlus, LogIn, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 space-y-6 text-center">
      <div className="flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full">
        <TruckIcon size={36} className="text-white" />
      </div>
      <h1 className="text-3xl font-bold text-gray-800">物流报价平台</h1>
      <p className="max-w-2xl text-lg text-gray-600">
        欢迎使用我们的物流报价平台，连接货主与物流供应商的桥梁。
      </p>

      {/* 用户入口 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-4xl">
        {/* 用户注册 */}
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto mb-4">
            <UserPlus size={24} className="text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">新用户注册</h3>
          <p className="text-gray-600 mb-4">创建账户开始使用物流报价服务</p>
          <Link to="/register">
            <Button variant="primary" fullWidth className="bg-green-600 hover:bg-green-700">
              立即注册
            </Button>
          </Link>
        </div>

        {/* 用户登录 */}
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4">
            <LogIn size={24} className="text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">用户登录</h3>
          <p className="text-gray-600 mb-4">已有账户？登录访问您的订单</p>
          <Link to="/login-user-page">
            <Button variant="primary" fullWidth>
              用户登录
            </Button>
          </Link>
        </div>

        {/* 管理员入口 */}
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
            <Shield size={24} className="text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">管理员入口</h3>
          <p className="text-gray-600 mb-4">系统管理和用户管理功能</p>
          <Link to="/admin/login">
            <Button variant="outline" fullWidth className="border-red-600 text-red-600 hover:bg-red-50">
              管理员登录
            </Button>
          </Link>
        </div>
      </div>

      <div className="text-sm text-gray-500 mt-8">
        <p>多用户系统 | 数据隔离 | 安全可靠</p>
      </div>
    </div>
  );
}

export default HomePage;
