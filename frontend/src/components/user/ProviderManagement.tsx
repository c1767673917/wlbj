import { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { PlusIcon, CopyIcon, WrenchIcon, TrashIcon, CheckIcon, XIcon } from 'lucide-react';
import api from '../../services/api';

interface ProviderManagementProps {
  providers?: any[];
  onRefresh?: () => void;
}

const ProviderManagement = ({ providers: externalProviders, onRefresh }: ProviderManagementProps) => {
  const [providers, setProviders] = useState<any[]>(externalProviders || []);
  const [loading, setLoading] = useState(!externalProviders);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [newProviderData, setNewProviderData] = useState({
    name: '',
    webhookUrl: ''
  });
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // 如果没有外部传入的providers，则自己加载
  useEffect(() => {
    if (!externalProviders) {
      loadProviders();
    } else {
      setProviders(externalProviders);
    }
  }, [externalProviders]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await api.providers.getAll();
      setProviders(data || []);
    } catch (error) {
      console.error('加载物流公司失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (accessKey: string, id: number) => {
    navigator.clipboard.writeText(`${window.location.origin}/provider/${accessKey}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddProvider = async () => {
    try {
      await api.providers.create({
        name: newProviderData.name,
        wechatWebhookUrl: newProviderData.webhookUrl || undefined
      });

      setIsModalOpen(false);
      setNewProviderData({ name: '', webhookUrl: '' });

      // 刷新数据
      if (onRefresh) {
        onRefresh();
      } else {
        loadProviders();
      }
    } catch (error) {
      console.error('添加物流公司失败:', error);
      alert('添加物流公司失败，请重试');
    }
  };

  const handleDeleteProvider = async () => {
    if (!selectedProvider) return;

    try {
      await api.providers.delete(selectedProvider);

      setIsDeleteModalOpen(false);
      setSelectedProvider(null);

      // 刷新数据
      if (onRefresh) {
        onRefresh();
      } else {
        loadProviders();
      }
    } catch (error) {
      console.error('删除物流公司失败:', error);
      alert('删除物流公司失败，请重试');
    }
  };

  const handleUpdateWebhook = async () => {
    if (!selectedProvider) return;

    try {
      await api.providers.updateWebhook(selectedProvider, webhookUrl);

      setIsWebhookModalOpen(false);
      setSelectedProvider(null);
      setWebhookUrl('');

      // 刷新数据
      if (onRefresh) {
        onRefresh();
      } else {
        loadProviders();
      }
    } catch (error) {
      console.error('更新webhook失败:', error);
      alert('更新webhook失败，请重试');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-800">物流公司管理</h2>
        <Button
          variant="primary"
          icon={<PlusIcon size={16} />}
          onClick={() => setIsModalOpen(true)}
        >
          添加物流公司
        </Button>
      </div>

      <Card>
        {providers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">暂无物流公司数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    公司名称
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    访问密钥
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    企业微信通知
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {providers.map((provider) => (
                  <tr key={provider.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{provider.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{provider.accessKey}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {provider.wechat_webhook_url ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckIcon size={12} className="mr-1" />
                          已配置
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <XIcon size={12} className="mr-1" />
                          未配置
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<CopyIcon size={16} />}
                          onClick={() => handleCopyLink(provider.accessKey, provider.id)}
                        >
                          {copiedId === provider.id ? '已复制' : '复制链接'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          icon={<WrenchIcon size={16} />}
                          onClick={() => {
                            setSelectedProvider(provider.id);
                            setWebhookUrl(provider.wechat_webhook_url || '');
                            setIsWebhookModalOpen(true);
                          }}
                        >
                          配置通知
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          icon={<TrashIcon size={16} />}
                          onClick={() => {
                            setSelectedProvider(provider.id);
                            setIsDeleteModalOpen(true);
                          }}
                        >
                          删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Provider Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">添加物流公司</h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="providerName" className="block mb-1 text-sm font-medium text-gray-700">
                  公司名称
                </label>
                <input
                  type="text"
                  id="providerName"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入物流公司名称"
                  value={newProviderData.name}
                  onChange={(e) => setNewProviderData({...newProviderData, name: e.target.value})}
                />
              </div>

              <div>
                <label htmlFor="webhookUrl" className="block mb-1 text-sm font-medium text-gray-700">
                  企业微信Webhook URL（可选）
                </label>
                <input
                  type="text"
                  id="webhookUrl"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                  value={newProviderData.webhookUrl}
                  onChange={(e) => setNewProviderData({...newProviderData, webhookUrl: e.target.value})}
                />
                <p className="mt-1 text-xs text-gray-500">
                  用于自动发送新订单通知到企业微信群
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleAddProvider}
                disabled={!newProviderData.name.trim()}
              >
                添加
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">确认删除</h3>
            <p className="text-gray-600 mb-6">
              您确定要删除这个物流公司吗？该操作无法撤销。
            </p>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                取消
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteProvider}
              >
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Configuration Modal */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">配置企业微信通知</h3>

            <div>
              <label htmlFor="webhookUrlConfig" className="block mb-1 text-sm font-medium text-gray-700">
                企业微信Webhook URL
              </label>
              <input
                type="text"
                id="webhookUrlConfig"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                在企业微信群中添加机器人后获取的Webhook地址
              </p>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">企业微信配置说明：</h4>
              <ol className="text-xs text-blue-700 list-decimal list-inside space-y-1">
                <li>在企业微信中创建群聊</li>
                <li>点击群设置 → 群机器人 → 添加</li>
                <li>创建机器人后，复制Webhook URL</li>
                <li>粘贴到上方输入框中</li>
              </ol>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsWebhookModalOpen(false)}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateWebhook}
              >
                保存配置
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderManagement;