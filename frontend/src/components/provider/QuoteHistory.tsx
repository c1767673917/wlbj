import { CheckCircleIcon } from 'lucide-react';
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
}

const QuoteHistory = ({ quotes, pagination, onPageChange }: QuoteHistoryProps) => {
  if (quotes.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">暂无报价历史</p>
      </div>
    );
  }

  return (
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
              报价时间
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              报价金额
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              预计送达
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              状态
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {quotes.map((quote) => (
            <tr key={quote.orderId} className={`hover:bg-gray-50 transition-colors ${quote.selected ? 'bg-green-50' : ''}`}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{quote.orderId}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900">{quote.warehouse}</div>
                <div className="text-sm text-gray-500 truncate max-w-xs">{quote.goods}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900 truncate max-w-xs">{quote.deliveryAddress}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">{new Date(quote.createdAt).toLocaleString('zh-CN')}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className={`text-sm font-medium ${quote.selected ? 'text-green-600' : 'text-gray-900'}`}>
                  ¥{quote.price.toLocaleString()}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">{quote.estimatedDelivery}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                {quote.selected ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircleIcon size={12} className="mr-1" />
                    已中标
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    已报价
                  </span>
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
  );
};

export default QuoteHistory;