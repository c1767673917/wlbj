import { CheckCircleIcon, EditIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import Button from '../ui/Button';

interface Quote {
  orderId: string;
  warehouse: string;
  goods: string;
  deliveryAddress: string;
  createdAt: string;
  price: number;
  estimatedDelivery: string;
  selected?: boolean;
  orderStatus?: string; // 订单状态：'active' | 'closed'
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  loading: boolean;
}

interface QuoteHistoryProps {
  quotes: Quote[];
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
  onRequote?: (orderId: string, price: number, estimatedDelivery: string) => Promise<void>;
}

interface RequoteForm {
  orderId: string;
  price: number;
  estimatedDelivery: string;
}

const QuoteHistory = ({ quotes, pagination, onPageChange, onRequote }: QuoteHistoryProps) => {
  const [requoteForm, setRequoteForm] = useState<RequoteForm | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const handleRequoteClick = (quote: Quote) => {
    setRequoteForm({
      orderId: quote.orderId,
      price: quote.price,
      estimatedDelivery: quote.estimatedDelivery
    });
  };

  const handleRequoteCancel = () => {
    setRequoteForm(null);
  };

  const handleRequoteSubmit = async () => {
    if (!requoteForm || !onRequote) return;
    
    setIsSubmitting(true);
    try {
      await onRequote(requoteForm.orderId, requoteForm.price, requoteForm.estimatedDelivery);
      setRequoteForm(null);
      setNotification({ type: 'success', message: '重新报价成功！' });
      // 3秒后自动隐藏通知
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('重新报价失败:', error);
      setNotification({ 
        type: 'error', 
        message: error instanceof Error ? error.message : '重新报价失败，请稍后重试' 
      });
      // 5秒后自动隐藏错误通知
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOrderClosed = (quote: Quote) => {
    return quote.orderStatus === 'closed';
  };

  if (quotes.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">暂无报价历史</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 通知提示 */}
      {notification && (
        <div className={`mb-4 px-4 py-3 rounded-lg border ${
          notification.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' ? (
              <CheckCircleIcon size={16} className="mr-2" />
            ) : (
              <XIcon size={16} className="mr-2" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>
      )}
      
      <div className="relative overflow-x-auto bg-white shadow-sm rounded-lg border border-gray-200">
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
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                订单编号
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                发货信息
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                收货信息
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                报价时间
              </th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                报价金额
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                预计送达
              </th>
              <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                状态
              </th>
              <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotes.map((quote) => (
              <tr key={quote.orderId} className={`hover:bg-gray-50 transition-colors ${quote.selected ? 'bg-green-50' : ''}`}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{quote.orderId}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900">{quote.warehouse}</div>
                  <div className="text-sm text-gray-500 truncate max-w-xs">{quote.goods}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900 truncate max-w-xs">{quote.deliveryAddress}</div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="text-xs text-gray-500">
                    {new Date(quote.createdAt).toLocaleDateString('zh-CN', { 
                      month: '2-digit', 
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-right">
                  <div className={`text-sm font-medium ${quote.selected ? 'text-green-600' : 'text-gray-900'}`}>
                    ¥{quote.price.toLocaleString()}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="text-xs text-gray-500">{quote.estimatedDelivery}</div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-center">
                  {quote.selected ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircleIcon size={12} className="mr-1" />
                      已中标
                    </span>
                  ) : isOrderClosed(quote) ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      已关闭
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      进行中
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-center">
                  {!isOrderClosed(quote) && !quote.selected && (
                    <button
                      onClick={() => handleRequoteClick(quote)}
                      className="text-blue-600 hover:text-blue-900 text-xs flex items-center justify-center mx-auto"
                      title="重新报价"
                    >
                      <EditIcon size={14} className="mr-1" />
                      重新报价
                    </button>
                  )}
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
              显示 <span className="font-medium">{quotes.length}</span> 条结果
              {pagination && pagination.total > 0 && (
                <span>，共 {pagination.total} 条记录</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 重新报价模态框 */}
      {requoteForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">重新报价</h3>
                <button
                  onClick={handleRequoteCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XIcon size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    订单编号
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {requoteForm.orderId}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    报价金额 (元)
                  </label>
                  <input
                    type="number"
                    value={requoteForm.price}
                    onChange={(e) => setRequoteForm({
                      ...requoteForm,
                      price: parseFloat(e.target.value) || 0
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    预计送达时间
                  </label>
                  <input
                    type="text"
                    value={requoteForm.estimatedDelivery}
                    onChange={(e) => setRequoteForm({
                      ...requoteForm,
                      estimatedDelivery: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：2-3个工作日"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="outline"
                  onClick={handleRequoteCancel}
                  disabled={isSubmitting}
                >
                  取消
                </Button>
                <Button
                  onClick={handleRequoteSubmit}
                  disabled={isSubmitting || !requoteForm.price || !requoteForm.estimatedDelivery}
                >
                  {isSubmitting ? '提交中...' : '确认重新报价'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteHistory;
