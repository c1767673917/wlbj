import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { LockIcon } from 'lucide-react';
import api from '../../services/api';
import AuthService from '../../services/auth';

interface LoginPageProps {
  hasError?: boolean;
}

const LoginPage = ({ hasError = false }: LoginPageProps) => {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 如果已经登录，直接跳转到用户页面
    if (AuthService.isAuthenticated()) {
      navigate('/user');
    }

    if (hasError) {
      setError('密码不正确，请重试');
    }
  }, [hasError, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // 验证必填字段
    if (!email.trim()) {
      setError('请输入用户名或邮箱');
      setIsLoading(false);
      return;
    }

    if (!password.trim()) {
      setError('请输入密码');
      setIsLoading(false);
      return;
    }

    try {
      // 使用JWT认证API，必须提供用户名和密码
      const response = await api.auth.login(password, email);

      if (response.accessToken) {
        // 认证成功，跳转到用户页面
        navigate('/user');
      } else {
        setError('登录失败，请重试');
      }
    } catch (error: unknown) {
      setError(error.message || '登录失败，请检查用户名和密码是否正确');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card className="mt-8">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center w-16 h-16 mb-4 bg-blue-100 rounded-full">
            <LockIcon size={24} className="text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">货主端登录</h2>
          <p className="mt-2 text-center text-gray-600">
            请输入用户名和密码以继续操作
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-700">
              用户名/邮箱 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="请输入用户名或邮箱"
              required
              minLength={1}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700">
              密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="请输入密码"
              required
              minLength={4}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isLoading}
            className="mb-4"
          >
            登录
          </Button>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              还没有账户？请联系管理员开通
            </p>
          </div>

          <div className="mt-4 text-sm text-center text-gray-600">
            <p className="mb-2">
              使用JWT认证系统，登录后Token有效期15分钟
            </p>
            <p>
              系统会自动刷新Token，无需频繁登录
            </p>
            <p className="mt-2">
              <Link
                to="/"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                返回首页
              </Link>
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;