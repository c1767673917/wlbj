import { useState } from 'react';
import Button from '../ui/Button';
import { DollarSignIcon, CalendarIcon } from 'lucide-react';
import api from '../../services/api';

interface Order {
  id: string;
  from: string;
  goods: string;
  to: string;
  createdAt: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  loading: boolean;
}

interface AvailableOrdersListProps {
  orders: Order[];
  accessKey: string;
  onQuoteSubmitted?: () => void;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
}

const AvailableOrdersList = ({ orders, accessKey, onQuoteSubmitted, pagination, onPageChange }: AvailableOrdersListProps) => {
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [quoteData, setQuoteData] = useState({
    price: '',
    expectedDelivery: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleOpenQuoteModal = (order: Order) => {
    setSelectedOrder(order);
    setQuoteData({ price: '', expectedDelivery: '' });
    setErrorMessage('');
    setQuoteModalOpen(true);
  };

  const handleSubmitQuote = async () => {
    if (!selectedOrder || !quoteData.price || !quoteData.expectedDelivery) {
      setErrorMessage('请填写完整的报价信息');
      return;
    }

    // 验证价格是否为有效数字
    const priceValue = parseFloat(quoteData.price);
    if (isNaN(priceValue) || priceValue <= 0) {
      setErrorMessage('请输入有效的报价金额');
      return;
    }

    // 验证日期是否有效
    if (!quoteData.expectedDelivery.trim()) {
      setErrorMessage('请选择预计送达日期');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await api.quotes.submitByProvider({
        orderId: selectedOrder.id,
        price: priceValue,
        estimatedDelivery: quoteData.expectedDelivery,
        accessKey: accessKey
      });

      setIsSubmitting(false);
      setQuoteModalOpen(false);
      setSuccessMessage(`报价提交成功！订单编号: ${selectedOrder.id}`);

      // 调用回调函数刷新数据
      if (onQuoteSubmitted) {
        onQuoteSubmitted();
      }

      // Clear success message after a delay
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('提交报价失败:', error);
      setIsSubmitting(false);
      setErrorMessage('提交报价失败，请重试');
    }
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">暂无可报价订单</p>
      </div>
    );
  }

  return (
    <div>
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
            </svg>
            {successMessage}
          </p>
        </div>
      )}

      <div className="relative overflow-x-auto">
        {/* 加载状态覆盖层 */}
        {pagination?.loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">加载中...</p>
            </div>
          </div>
        )}

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                订单编号
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                发货信息
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                收货信息
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{order.id}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{order.from}</div>
                  <div className="text-sm text-gray-500 break-words max-w-sm leading-relaxed">{order.goods}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 break-words max-w-sm leading-relaxed">{order.to}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{order.createdAt}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<DollarSignIcon size={16} />}
                    onClick={() => handleOpenQuoteModal(order)}
                  >
                    提交报价
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 分页组件 */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                显示第 {((pagination.currentPage - 1) * pagination.pageSize) + 1} - {Math.min(pagination.currentPage * pagination.pageSize, pagination.total)} 条，共 {pagination.total} 条记录
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange && onPageChange(Math.max(pagination.currentPage - 1, 1))}
                  disabled={pagination.currentPage === 1 || pagination.loading}
                >
                  上一页
                </Button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  第 {pagination.currentPage} / {pagination.totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange && onPageChange(Math.min(pagination.currentPage + 1, pagination.totalPages))}
                  disabled={pagination.currentPage === pagination.totalPages || pagination.loading}
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 无分页时显示简单统计 */}
        {(!pagination || pagination.totalPages <= 1) && (
          <div className="px-6 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              显示 <span className="font-medium">{orders.length}</span> 条结果
              {pagination && pagination.total > 0 && (
                <span>，共 {pagination.total} 条记录</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quote Modal */}
      {quoteModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">提交报价</h3>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700">订单信息</h4>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-800"><span className="font-medium">订单编号:</span> {selectedOrder.id}</p>
                <p className="text-sm text-gray-800 mt-1"><span className="font-medium">发货信息:</span> {selectedOrder.from}</p>
                <p className="text-sm text-gray-800 mt-1 break-words leading-relaxed"><span className="font-medium">货物信息:</span> {selectedOrder.goods}</p>
                <p className="text-sm text-gray-800 mt-1 break-words leading-relaxed"><span className="font-medium">收货信息:</span> {selectedOrder.to}</p>
              </div>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{errorMessage}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="price" className="block mb-1 text-sm font-medium text-gray-700">
                  报价金额 (元)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">¥</span>
                  </div>
                  <input
                    type="number"
                    id="price"
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="请输入报价金额"
                    value={quoteData.price}
                    onChange={(e) => setQuoteData({...quoteData, price: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="expectedDelivery" className="block mb-1 text-sm font-medium text-gray-700">
                  预计送达日期
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CalendarIcon size={16} className="text-gray-500" />
                  </div>
                  <input
                    type="date"
                    id="expectedDelivery"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={quoteData.expectedDelivery}
                    onChange={(e) => setQuoteData({...quoteData, expectedDelivery: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setQuoteModalOpen(false)}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitQuote}
                isLoading={isSubmitting}
                disabled={!quoteData.price || !quoteData.expectedDelivery}
              >
                提交报价
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailableOrdersList;