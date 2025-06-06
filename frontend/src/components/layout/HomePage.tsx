import { TruckIcon, LogIn, Shield, AlertCircle, Phone } from 'lucide-react';
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

      {/* 联系管理员信息 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-2xl mx-auto mb-8">
        <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mx-auto mb-4">
          <Phone size={24} className="text-yellow-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">联系管理员</h3>
        <p className="text-gray-700 mb-2">
          使用本系统请联系管理员开通账户
        </p>
        <p className="text-sm text-gray-600">
          用户注册功能已关闭，所有用户账户由管理员统一创建和管理
        </p>
      </div>

      {/* 系统入口 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 max-w-3xl">
        {/* 用户登录 */}
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4">
            <LogIn size={24} className="text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">用户登录</h3>
          <p className="text-gray-600 mb-4">登录访问您的订单和报价信息</p>
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

      {/* 系统说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto mt-8">
        <div className="flex items-center justify-center mb-2">
          <AlertCircle size={20} className="text-blue-600 mr-2" />
          <span className="text-sm font-medium text-blue-800">系统说明</span>
        </div>
        <p className="text-sm text-blue-700">
          本系统采用管理员统一管理模式，用户注册功能已关闭。如需使用系统，请联系管理员为您开通账户。
        </p>
      </div>

      <div className="text-sm text-gray-500 mt-8">
        <p>多用户系统 | 数据隔离 | 安全可靠</p>
      </div>
    </div>
  );
}

export default HomePage;
