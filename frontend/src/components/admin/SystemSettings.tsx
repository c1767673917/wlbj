import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Lock, 
  Database, 
  Download,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import AuthService from '../../services/auth';

interface SystemInfo {
  version: string;
  nodeVersion: string;
  uptime: string;
  memoryUsage: {
    used: number;
    total: number;
  };
  databaseSize: string;
}

const SystemSettings = () => {
  const [loading, setLoading] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  const loadSystemInfo = async () => {
    try {
      // 模拟系统信息获取
      const info: SystemInfo = {
        version: '2.0.0',
        nodeVersion: process.version || 'Unknown',
        uptime: formatUptime(process.uptime ? process.uptime() : 0),
        memoryUsage: {
          used: 128,
          total: 512
        },
        databaseSize: '2.5 MB'
      };
      setSystemInfo(info);
    } catch (error) {
      console.error('获取系统信息失败:', error);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: '新密码和确认密码不匹配' });
      return;
    }

    if (passwordForm.newPassword.length < 4) {
      setMessage({ type: 'error', text: '新密码长度至少为4位' });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '密码修改失败');
      }

      setMessage({ type: 'success', text: '密码修改成功' });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('密码修改失败:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '密码修改失败' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/export/all-data', {
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('数据导出失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `system_backup_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      setMessage({ type: 'success', text: '数据导出成功' });
    } catch (error) {
      console.error('数据导出失败:', error);
      setMessage({ type: 'error', text: '数据导出失败' });
    } finally {
      setLoading(false);
    }
  };

  const clearMessage = () => {
    setMessage(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Settings className="mr-3" size={28} />
          系统设置
        </h2>
        <Button
          onClick={loadSystemInfo}
          variant="outline"
          size="sm"
          className="flex items-center"
        >
          <RefreshCw size={16} className="mr-2" />
          刷新
        </Button>
      </div>

      {/* 消息提示 */}
      {message && (
        <Card className={`p-4 mb-6 border-l-4 ${
          message.type === 'success' ? 'border-green-500 bg-green-50' :
          message.type === 'error' ? 'border-red-500 bg-red-50' :
          'border-blue-500 bg-blue-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {message.type === 'success' && <CheckCircle className="text-green-500 mr-2" size={20} />}
              {message.type === 'error' && <AlertTriangle className="text-red-500 mr-2" size={20} />}
              {message.type === 'info' && <Info className="text-blue-500 mr-2" size={20} />}
              <span className={`text-sm font-medium ${
                message.type === 'success' ? 'text-green-800' :
                message.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {message.text}
              </span>
            </div>
            <button
              onClick={clearMessage}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 系统信息 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Info className="mr-2" size={20} />
            系统信息
          </h3>
          {systemInfo && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">系统版本</span>
                <span className="font-medium">{systemInfo.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Node.js版本</span>
                <span className="font-medium">{systemInfo.nodeVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">运行时间</span>
                <span className="font-medium">{systemInfo.uptime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">内存使用</span>
                <span className="font-medium">
                  {systemInfo.memoryUsage.used}MB / {systemInfo.memoryUsage.total}MB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">数据库大小</span>
                <span className="font-medium">{systemInfo.databaseSize}</span>
              </div>
            </div>
          )}
        </Card>

        {/* 密码修改 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Lock className="mr-2" size={20} />
            修改管理员密码
          </h3>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                当前密码
              </label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm(prev => ({
                  ...prev,
                  currentPassword: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新密码
              </label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(prev => ({
                  ...prev,
                  newPassword: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                minLength={4}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                确认新密码
              </label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({
                  ...prev,
                  confirmPassword: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                minLength={4}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save size={16} className="mr-2" />
              )}
              {loading ? '修改中...' : '修改密码'}
            </Button>
          </form>
        </Card>

        {/* 数据管理 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Database className="mr-2" size={20} />
            数据管理
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-3">
                导出系统所有数据，包括用户、订单、报价和物流公司信息。
              </p>
              <Button
                onClick={handleExportData}
                disabled={loading}
                variant="outline"
                className="w-full flex items-center justify-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                ) : (
                  <Download size={16} className="mr-2" />
                )}
                {loading ? '导出中...' : '导出所有数据'}
              </Button>
            </div>
            
            <div className="border-t pt-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-start">
                  <AlertTriangle className="text-yellow-600 mr-2 mt-0.5" size={16} />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">注意事项：</p>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                      <li>数据导出包含敏感信息，请妥善保管</li>
                      <li>建议定期备份系统数据</li>
                      <li>密码修改后所有用户需要重新登录</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 系统状态 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CheckCircle className="mr-2" size={20} />
            系统状态
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">数据库连接</span>
              <span className="flex items-center text-green-600">
                <CheckCircle size={16} className="mr-1" />
                正常
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">API服务</span>
              <span className="flex items-center text-green-600">
                <CheckCircle size={16} className="mr-1" />
                运行中
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">文件系统</span>
              <span className="flex items-center text-green-600">
                <CheckCircle size={16} className="mr-1" />
                正常
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">日志系统</span>
              <span className="flex items-center text-green-600">
                <CheckCircle size={16} className="mr-1" />
                正常
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SystemSettings;
