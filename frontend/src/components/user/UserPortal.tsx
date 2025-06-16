import { useState, useEffect } from 'react';
import { Tabs } from '../ui/Tabs';
import Card from '../ui/Card';
import Button from '../ui/Button';
import OrderList from './OrderList';
import ProviderManagement from './ProviderManagement';
import UserSettings from './UserSettings';
import { PlusIcon, FileTextIcon, HistoryIcon, TruckIcon, CheckCircleIcon, SparklesIcon, LogOutIcon, UserIcon, SettingsIcon } from 'lucide-react';
import api, { exportAPI } from '../../services/api';
import AuthService from '../../services/auth';

const UserPortal = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('activeOrders');
  const [providers, setProviders] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [closedOrders, setClosedOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 并行加载不同状态的订单
        const [activeOrdersRes, closedOrdersRes, providersRes] = await Promise.all([
          api.orders.getActiveOrders(),
          api.orders.getClosedOrders(),
          api.providers.getAll()
        ]);

        // 转换数据格式以匹配前端组件期望的字段
        const transformOrder = (order: any) => ({
          ...order,
          from: order.warehouse, // 后端字段映射
          to: order.deliveryAddress, // 后端字段映射
          createdAt: new Date(order.createdAt).toLocaleString('zh-CN'), // 格式化时间
          // 保留选择的物流商信息
          selectedProvider: order.selectedProvider,
          selectedPrice: order.selectedPrice,
          selectedAt: order.selectedAt,
        });

        setActiveOrders((activeOrdersRes || []).map(transformOrder));
        setClosedOrders((closedOrdersRes || []).map(transformOrder));
        setProviders(providersRes || []);
      } catch (error) {
        console.error('加载数据失败:', error);
        setError('加载数据失败，请刷新页面重试');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 刷新数据的函数
  const refreshData = async () => {
    try {
      // 并行加载不同状态的订单
      const [activeOrdersRes, closedOrdersRes, providersRes] = await Promise.all([
        api.orders.getActiveOrders(),
        api.orders.getClosedOrders(),
        api.providers.getAll()
      ]);

      // 转换数据格式以匹配前端组件期望的字段
      const transformOrder = (order: any) => ({
        ...order,
        from: order.warehouse, // 后端字段映射
        to: order.deliveryAddress, // 后端字段映射
        createdAt: new Date(order.createdAt).toLocaleString('zh-CN'), // 格式化时间
        // 保留选择的物流商信息
        selectedProvider: order.selectedProvider,
        selectedPrice: order.selectedPrice,
        selectedAt: order.selectedAt,
      });

      setActiveOrders((activeOrdersRes || []).map(transformOrder));
      setClosedOrders((closedOrdersRes || []).map(transformOrder));
      setProviders(providersRes || []);
    } catch (error) {
      console.error('刷新数据失败:', error);
    }
  };

  // 导出活跃订单
  const handleExportActiveOrders = () => {
    try {
      exportAPI.exportActiveOrders(searchTerm);
      console.log('活跃订单导出已开始下载');
    } catch (error) {
      console.error('导出活跃订单失败:', error);
    }
  };

  // 导出历史订单
  const handleExportClosedOrders = () => {
    try {
      exportAPI.exportClosedOrders(searchTerm);
      console.log('历史订单导出已开始下载');
    } catch (error) {
      console.error('导出历史订单失败:', error);
    }
  };

  const userTabs = [
    {
      id: 'newOrder',
      label: '发布新订单',
      content: (
        <NewOrderForm onClose={() => {
          setActiveTab('activeOrders');
          refreshData(); // 刷新数据
        }} />
      ),
    },
    {
      id: 'activeOrders',
      label: '我的订单',
      content: (
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索订单..."
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                icon={<FileTextIcon size={16} />}
                onClick={handleExportActiveOrders}
              >
                导出Excel
              </Button>
            </div>
          </div>
          <OrderList
            orders={activeOrders.filter(order =>
              order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
              order.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
              order.goods.toLowerCase().includes(searchTerm.toLowerCase()) ||
              order.to.toLowerCase().includes(searchTerm.toLowerCase())
            )}
            onRefresh={refreshData}
          />
        </div>
      ),
    },
    {
      id: 'closedOrders',
      label: '订单历史',
      content: (
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索历史订单..."
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <Button
              variant="outline"
              icon={<FileTextIcon size={16} />}
              onClick={handleExportClosedOrders}
            >
              导出Excel
            </Button>
          </div>
          <OrderList
            orders={closedOrders.filter(order =>
              order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
              order.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
              order.goods.toLowerCase().includes(searchTerm.toLowerCase()) ||
              order.to.toLowerCase().includes(searchTerm.toLowerCase())
            )}
            showSelected={true}
            onRefresh={refreshData}
          />
        </div>
      ),
    },
    {
      id: 'providerManagement',
      label: '物流公司管理',
      content: <ProviderManagement providers={providers} onRefresh={refreshData} />,
    },
    {
      id: 'settings',
      label: '通知设置',
      content: <UserSettings />,
    },
  ];

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在加载数据...</p>
          </div>
        </div>
      </div>
    );
  }

  // 如果有错误，显示错误信息
  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="primary">
            刷新页面
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* 顶部标题区域 */}
      <div className="mb-8 px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 mr-3 bg-blue-600 rounded-full">
              <TruckIcon size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">瑞勋报价平台</h1>
          </div>

          {/* 用户信息和登出按钮 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-600">
              <UserIcon size={16} className="mr-2" />
              <span>{AuthService.getCurrentUser()?.email || '用户'}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<LogOutIcon size={16} />}
              onClick={async () => {
                if (window.confirm('确定要退出登录吗？')) {
                  await api.auth.logout();
                }
              }}
            >
              退出
            </Button>
          </div>
        </div>
      </div>

      {/* 快速统计 - 横向排列在顶部 */}
      <div className="mb-6">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 活跃订单卡片 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileTextIcon size={24} className="text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">活跃订单</p>
                <p className="text-2xl font-bold text-gray-800">{activeOrders.length}</p>
              </div>
            </div>
          </div>

          {/* 历史订单卡片 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <HistoryIcon size={24} className="text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">历史订单</p>
                <p className="text-2xl font-bold text-gray-800">{closedOrders.length}</p>
              </div>
            </div>
          </div>

          {/* 物流公司卡片 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TruckIcon size={24} className="text-purple-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">物流公司</p>
                <p className="text-2xl font-bold text-gray-800">{providers.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div>
        <Tabs
          tabs={userTabs}
          activeTab={activeTab}
          onTabChange={(tabId) => {
            setActiveTab(tabId);
          }}
        />
      </div>
    </div>
  );
};

// 发布新订单表单组件
interface NewOrderFormProps {
  onClose: () => void;
}

const NewOrderForm = ({ onClose }: NewOrderFormProps) => {
  const [formData, setFormData] = useState({
    warehouse: '',
    goods: '',
    destination: '',
  });
  const [aiText, setAiText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAIRecognize = async () => {
    if (!aiText.trim()) return;

    setIsProcessing(true);

    try {
      // 调用真实的AI API
      const result = await api.ai.recognizeText(aiText);
      setFormData({
        warehouse: result.warehouse || '',
        goods: result.goods || '',
        destination: result.destination || '',
      });
      // 显示成功提示
      alert('AI识别成功，已自动填写表单！');
    } catch (error) {
      console.error('AI识别失败:', error);
      // 显示错误提示
      alert('AI识别过程中出现错误，请手动填写表单');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 调用真实的API创建订单
      const result = await api.orders.create({
        warehouse: formData.warehouse,
        goods: formData.goods,
        destination: formData.destination,
      });

      setSuccess(true);

      // 3秒后重置表单并关闭
      setTimeout(() => {
        setFormData({
          warehouse: '',
          goods: '',
          destination: '',
        });
        setAiText('');
        setSuccess(false);
        onClose();
      }, 3000);
    } catch (error) {
      console.error('创建订单失败:', error);
      // 这里可以添加错误提示
      alert('创建订单失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      {success ? (
        <div className="flex flex-col items-center py-12">
          <div className="flex items-center justify-center w-16 h-16 mb-4 text-green-500 bg-green-100 rounded-full">
            <CheckCircleIcon size={32} />
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-800">订单发布成功！</h3>
          <p className="text-gray-600">订单编号：<span className="font-semibold text-blue-600">等待API返回</span></p>
          <p className="mt-4 text-sm text-gray-500">所有物流公司将收到通知并开始报价</p>
          <div className="flex items-center mt-4 text-sm text-gray-400">
            <div className="w-2 h-2 mr-2 bg-green-400 rounded-full animate-pulse"></div>
            3秒后自动关闭...
          </div>
        </div>
      ) : (
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* AI智能识别区域 */}
            <div className="p-6 border-2 border-dashed border-blue-200 rounded-xl">
              <div className="flex items-center mb-4">
                <SparklesIcon size={24} className="mr-3 text-blue-600" />
                <div>
                  <h4 className="text-lg font-semibold text-blue-800">AI智能识别</h4>
                  <p className="text-sm text-blue-600">粘贴订单文本，AI自动提取信息</p>
                </div>
              </div>
              <div className="space-y-4">
                <textarea
                  className="w-full p-4 border border-blue-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  rows={3}
                  placeholder="请输入物流订单信息，AI将自动识别并提取关键信息..."
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={handleAIRecognize}
                  variant="primary"
                  className="w-full sm:w-auto"
                  isLoading={isProcessing}
                  disabled={!aiText.trim() || isProcessing}
                  icon={<SparklesIcon size={16} />}
                >
                  {isProcessing ? '识别中...' : '智能识别'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  发货仓库 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="请输入发货仓库"
                  value={formData.warehouse}
                  onChange={(e) => handleInputChange('warehouse', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  货物信息 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="请详细描述货物信息，包括名称、数量、规格等"
                  value={formData.goods}
                  onChange={(e) => handleInputChange('goods', e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  收货信息 <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                  placeholder="请输入详细收货地址"
                  value={formData.destination}
                  onChange={(e) => handleInputChange('destination', e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-200">
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                disabled={!formData.warehouse || !formData.goods || !formData.destination}
                className="px-8"
                icon={<PlusIcon size={16} />}
              >
                {isSubmitting ? '发布中...' : '发布订单'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default UserPortal;