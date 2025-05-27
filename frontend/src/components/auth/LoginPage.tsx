import { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { LockIcon } from 'lucide-react';

interface LoginPageProps {
  hasError?: boolean;
}

const LoginPage = ({ hasError = false }: LoginPageProps) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (hasError) {
      setError('密码不正确，请重试');
    }
  }, [hasError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/authenticate-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        // 认证成功，后端会重定向到用户页面
        window.location.href = '/user';
      } else {
        setError('密码不正确，请重试');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
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
            请输入访问密码以继续操作
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700">
              访问密码
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="请输入密码"
              required
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

          <p className="text-sm text-center text-gray-600">
            首次登录成功后，您的IP将被添加到白名单，后续访问无需再次输入密码。
          </p>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;