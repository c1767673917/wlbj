import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockIcon } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { AdminAuthService } from '../../services/auth';
import api from '../../services/api';

interface AdminLoginPageProps {
  hasError?: boolean;
}

const AdminLoginPage = ({ hasError = false }: AdminLoginPageProps) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 如果已经是管理员登录，直接跳转到管理员页面
    if (AdminAuthService.isAuthenticated() && AdminAuthService.isAdmin()) {
      navigate('/admin');
    }

    if (hasError) {
      setError('密码不正确，请重试');
    }
  }, [hasError, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 使用管理员登录API
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '登录失败');
      }

      const result = await response.json();

      if (result.accessToken) {
        // 保存管理员认证信息
        AdminAuthService.saveAuth(result);
        // 认证成功，跳转到管理员页面
        navigate('/admin');
      } else {
        setError('登录失败，请重试');
      }
    } catch (error: unknown) {
      setError(error.message || '登录失败，请检查密码是否正确');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card className="mt-8">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center w-16 h-16 mb-4 bg-red-100 rounded-full">
            <LockIcon size={24} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">管理员登录</h2>
          <p className="mt-2 text-center text-gray-600">
            请输入管理员密码以访问系统管理功能
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700">
              管理员密码
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
              placeholder="请输入管理员密码"
              required
              minLength={4}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isLoading}
            className="mb-4 bg-red-600 hover:bg-red-700"
          >
            登录管理后台
          </Button>

          <div className="mt-4 text-sm text-center text-gray-600">
            <p className="mb-2">
              管理员可以查看所有用户数据和系统统计信息
            </p>
            <p>
              <a
                href="/"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                返回首页
              </a>
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AdminLoginPage;
