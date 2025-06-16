import { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { SaveIcon, BellIcon, CheckCircleIcon, AlertCircleIcon } from 'lucide-react';
import api from '../../services/api';

interface WechatConfig {
  wechat_webhook_url: string;
  wechat_notification_enabled: boolean;
}

const UserSettings = () => {
  const [config, setConfig] = useState<WechatConfig>({
    wechat_webhook_url: '',
    wechat_notification_enabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 加载用户企业微信配置
  const loadConfig = async () => {
    try {
      setLoading(true);
      console.log('开始加载企业微信配置...');

      const response = await api.users.getWechatConfig();
      console.log('加载配置响应:', response);

      setConfig(response);
    } catch (error: any) {
      console.error('加载企业微信配置失败:', error);
      console.error('错误详情:', {
        message: error?.message,
        status: error?.status,
        response: error?.response
      });

      let errorMessage = '加载配置失败，请刷新页面重试';
      if (error?.response?.status === 401) {
        errorMessage = '登录已过期，请重新登录';
      } else if (error?.message) {
        errorMessage = `加载失败: ${error.message}`;
      }

      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // 保存配置
  const saveConfig = async () => {
    try {
      setSaving(true);
      setMessage(null);

      console.log('开始保存企业微信配置:', config);
      console.log('发送的数据类型:', {
        wechat_webhook_url: typeof config.wechat_webhook_url,
        wechat_notification_enabled: typeof config.wechat_notification_enabled
      });

      const response = await api.users.updateWechatConfig(config);

      console.log('保存配置响应:', response);

      setMessage({ type: 'success', text: '企业微信配置保存成功！' });

      // 3秒后清除成功消息
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error: any) {
      console.error('保存企业微信配置失败:', error);
      console.error('错误详情:', {
        message: error?.message,
        status: error?.status,
        response: error?.response,
        stack: error?.stack
      });

      let errorMessage = '保存失败，请检查网络连接';

      if (error?.response) {
        try {
          const errorData = await error.response.json();
          if (errorData.errors && Array.isArray(errorData.errors)) {
            errorMessage = `验证错误: ${errorData.errors.map(e => e.msg).join(', ')}`;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          console.error('解析错误响应失败:', parseError);
          errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  // 处理输入变化
  const handleInputChange = (field: keyof WechatConfig, value: string | boolean) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 验证webhook URL格式
  const isValidWebhookUrl = (url: string) => {
    if (!url || url.trim() === '') return true; // 空值是允许的

    // 检查是否是企业微信webhook URL格式
    if (url.includes('qyapi.weixin.qq.com') && url.includes('webhook/send')) {
      return true;
    }

    // 也允许其他有效的URL格式
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">加载配置中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="p-6">
          <div className="flex items-center mb-6">
            <BellIcon size={24} className="text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">通知设置</h2>
          </div>

          {/* 消息提示 */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-center ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircleIcon size={20} className="mr-2" />
              ) : (
                <AlertCircleIcon size={20} className="mr-2" />
              )}
              {message.text}
            </div>
          )}

          <div className="space-y-6">
            {/* 企业微信通知开关 */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.wechat_notification_enabled}
                  onChange={(e) => handleInputChange('wechat_notification_enabled', e.target.checked)}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  启用企业微信通知
                </span>
              </label>
              <p className="mt-1 text-xs text-gray-500 ml-7">
                开启后，当您的订单有新报价时会收到企业微信通知
              </p>
            </div>

            {/* 企业微信Webhook URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                企业微信Webhook URL
              </label>
              <input
                type="url"
                value={config.wechat_webhook_url}
                onChange={(e) => handleInputChange('wechat_webhook_url', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                  config.wechat_webhook_url && !isValidWebhookUrl(config.wechat_webhook_url)
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
                placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                disabled={!config.wechat_notification_enabled}
              />

              {config.wechat_webhook_url && !isValidWebhookUrl(config.wechat_webhook_url) && (
                <p className="mt-1 text-sm text-red-600">
                  请输入有效的企业微信webhook URL
                </p>
              )}

              <p className="mt-2 text-xs text-gray-500">
                在企业微信群中添加机器人后获取的Webhook地址，用于接收订单报价通知
              </p>
            </div>

            {/* 配置说明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">企业微信配置说明：</h4>
              <ol className="text-xs text-blue-700 list-decimal list-inside space-y-1">
                <li>在企业微信中创建群聊或使用现有群聊</li>
                <li>点击群设置 → 群机器人 → 添加机器人</li>
                <li>创建机器人后，复制Webhook URL</li>
                <li>将URL粘贴到上方输入框中并保存</li>
                <li>配置完成后，您的订单有新报价时会自动发送通知到群聊</li>
              </ol>
            </div>

            {/* 保存按钮 */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="primary"
                icon={<SaveIcon size={16} />}
                onClick={saveConfig}
                disabled={saving || (config.wechat_webhook_url && !isValidWebhookUrl(config.wechat_webhook_url))}
              >
                {saving ? '保存中...' : '保存配置'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default UserSettings;
