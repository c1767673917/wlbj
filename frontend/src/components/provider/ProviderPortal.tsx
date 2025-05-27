import { useState, useEffect } from 'react';
import { Tabs } from '../ui/Tabs';
import Card from '../ui/Card';
import Button from '../ui/Button';
import AvailableOrdersList from './AvailableOrdersList';
import QuoteHistory from './QuoteHistory';
import { TruckIcon, FileTextIcon } from 'lucide-react';
import api, { exportAPI } from '../../services/api';

interface ProviderPortalProps {
  providerKey: string;
}

const ProviderPortal = ({ providerKey }: ProviderPortalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [providerInfo, setProviderInfo] = useState<any>(null);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [quoteHistory, setQuoteHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProviderData = async () => {
      if (!providerKey) {
        setError('无效的访问链接');
        setLoading(false);
        return;
      }

      try {
        // 验证供应商并获取基本信息
        const provider = await api.providers.getByAccessKey(providerKey);
        setProviderInfo(provider);

        // 获取可报价订单
        const ordersResponse = await api.providers.getAvailableOrders(providerKey);
        const orders = ordersResponse.items || ordersResponse || [];
        setAvailableOrders(orders);

        // 获取报价历史
        const quotesResponse = await api.providers.getQuoteHistory(providerKey);
        const quotes = quotesResponse.items || quotesResponse || [];
        setQuoteHistory(quotes);

      } catch (error) {
        console.error('加载供应商数据失败:', error);
        setError('无法加载数据，请检查访问链接是否正确');
      } finally {
        setLoading(false);
      }
    };

    loadProviderData();
  }, [providerKey]);

  // 导出可报价订单
  const handleExportAvailableOrders = () => {
    try {
      exportAPI.exportProviderAvailableOrders(providerKey, searchTerm);
      console.log('可报价订单导出已开始下载');
    } catch (error) {
      console.error('导出可报价订单失败:', error);
    }
  };

  // 导出报价历史
  const handleExportQuoteHistory = () => {
    try {
      exportAPI.exportProviderQuoteHistory(providerKey, searchTerm);
      console.log('报价历史导出已开始下载');
    } catch (error) {
      console.error('导出报价历史失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">访问错误</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const providerTabs = [
    {
      id: 'availableOrders',
      label: '可报价订单',
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
            <Button
              variant="outline"
              icon={<FileTextIcon size={16} />}
              onClick={handleExportAvailableOrders}
            >
              导出Excel
            </Button>
          </div>
          <AvailableOrdersList
            orders={availableOrders.filter(order =>
              order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
              order.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
              order.goods.toLowerCase().includes(searchTerm.toLowerCase()) ||
              order.to.toLowerCase().includes(searchTerm.toLowerCase())
            )}
            accessKey={providerKey}
            onQuoteSubmitted={() => {
              // 重新加载数据
              const loadData = async () => {
                try {
                  const ordersResponse = await api.providers.getAvailableOrders(providerKey);
                  const orders = ordersResponse.items || ordersResponse || [];
                  setAvailableOrders(orders);

                  const quotesResponse = await api.providers.getQuoteHistory(providerKey);
                  const quotes = quotesResponse.items || quotesResponse || [];
                  setQuoteHistory(quotes);
                } catch (error) {
                  console.error('重新加载数据失败:', error);
                }
              };
              loadData();
            }}
          />
        </div>
      ),
    },
    {
      id: 'quoteHistory',
      label: '报价历史',
      content: (
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索报价历史..."
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
              onClick={handleExportQuoteHistory}
            >
              导出Excel
            </Button>
          </div>
          <QuoteHistory
            quotes={quoteHistory.filter(quote =>
              quote.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
              quote.warehouse.toLowerCase().includes(searchTerm.toLowerCase()) ||
              quote.goods.toLowerCase().includes(searchTerm.toLowerCase()) ||
              quote.deliveryAddress.toLowerCase().includes(searchTerm.toLowerCase())
            )}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* 顶部标题区域 */}
      <div className="mb-8 px-4 pt-4">
        <div className="flex items-center mb-4">
          <div className="flex items-center justify-center w-10 h-10 mr-3 bg-blue-600 rounded-full">
            <TruckIcon size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">
            {providerInfo?.name || '物流公司'}
          </h1>
        </div>
      </div>

      {/* 快速统计 - 横向排列在顶部 */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 可报价订单卡片 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileTextIcon size={24} className="text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">可报价订单</p>
                <p className="text-2xl font-bold text-gray-800">{availableOrders.length}</p>
              </div>
            </div>
          </div>

          {/* 已报价订单卡片 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">已报价订单</p>
                <p className="text-2xl font-bold text-gray-800">{quoteHistory.length}</p>
              </div>
            </div>
          </div>

          {/* 已中标订单卡片 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">已中标订单</p>
                <p className="text-2xl font-bold text-green-600">
                  {quoteHistory.filter(quote => quote.selected).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div>
        <Tabs tabs={providerTabs} defaultTab="availableOrders" />
      </div>
    </div>
  );
};

export default ProviderPortal;