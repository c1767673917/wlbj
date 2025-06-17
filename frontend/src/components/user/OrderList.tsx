import { useState, useEffect } from 'react';
import { EyeIcon, EditIcon, XIcon, CheckIcon, CalendarIcon } from 'lucide-react';
import Button from '../ui/Button';
import api from '../../services/api';

interface Quote {
  id: string;
  provider: string;
  price: number;
  estimatedDelivery: string;
  createdAt: string;
}

interface Order {
  id: string;
  from: string;
  goods: string;
  to: string;
  createdAt: string;
  status: 'active' | 'closed';
  lowestQuote?: Quote | null;
  selectedProvider?: string;
  selectedPrice?: number;
  closedAt?: string;
  warehouse?: string;
  deliveryAddress?: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  loading: boolean;
}

interface OrderListProps {
  orders: Order[];
  showSelected?: boolean;
  onRefresh?: () => void;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
}

const OrderList = ({ orders, showSelected = false, onRefresh, pagination, onPageChange }: OrderListProps) => {
  const [ordersWithQuotes, setOrdersWithQuotes] = useState<Order[]>([]);
  const [quotesModalOpen, setQuotesModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    warehouse: '',
    goods: '',
    deliveryAddress: '',
  });

  // 获取最低报价
  useEffect(() => {
    const fetchLowestQuotes = async () => {
      if (orders.length === 0) {
        setOrdersWithQuotes([]);
        return;
      }

      if (showSelected) {
        // 对于历史订单，直接使用传入的数据，不需要获取最低报价
        setOrdersWithQuotes(orders);
        return;
      }

      try {
        const orderIds = orders.map(order => order.id);
        const lowestQuotes = await api.quotes.getLowestBatch(orderIds);

        const updatedOrders = orders.map(order => ({
          ...order,
          lowestQuote: lowestQuotes[order.id] || null
        }));

        setOrdersWithQuotes(updatedOrders);
      } catch (error) {
        console.error('获取最低报价失败:', error);
        setOrdersWithQuotes(orders);
      }
    };

    fetchLowestQuotes();
  }, [orders, showSelected]);

  // 查看报价
  const handleViewQuotes = async (order: Order) => {
    setSelectedOrder(order);
    setLoading(true);
    setQuotesModalOpen(true);

    try {
      const quotesData = await api.quotes.getByOrderId(order.id);
      setQuotes(quotesData || []);
    } catch (error) {
      console.error('获取报价失败:', error);
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  // 编辑订单
  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setEditFormData({
      warehouse: order.warehouse || order.from,
      goods: order.goods,
      deliveryAddress: order.deliveryAddress || order.to,
    });
    setEditModalOpen(true);
  };

  // 关闭订单
  const handleCloseOrder = async (order: Order) => {
    if (!confirm('确定要关闭这个订单吗？关闭后将移至历史订单。')) {
      return;
    }

    try {
      await api.orders.close(order.id);
      alert('订单已成功关闭');
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('关闭订单失败:', error);
      alert('关闭订单失败，请重试');
    }
  };

  // 选择报价
  const handleSelectQuote = async (quote: Quote) => {
    if (!selectedOrder) return;

    try {
      await api.quotes.select(selectedOrder.id, quote.provider, quote.price);
      alert('报价选择成功！');
      setQuotesModalOpen(false);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('选择报价失败:', error);
      alert('选择报价失败，请重试');
    }
  };

  // 提交编辑
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      await api.orders.update(selectedOrder.id, {
        warehouse: editFormData.warehouse,
        goods: editFormData.goods,
        deliveryAddress: editFormData.deliveryAddress,
      });
      alert('订单更新成功！');
      setEditModalOpen(false);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('更新订单失败:', error);
      alert('更新订单失败，请重试');
    }
  };

  if (orders.length === 0 && !pagination?.loading) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">
          {pagination && pagination.total === 0 ? '暂无订单数据' : '当前页面暂无数据'}
        </p>
        {pagination && pagination.total > 0 && pagination.currentPage > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => onPageChange && onPageChange(1)}
          >
            返回第一页
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto">
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
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {showSelected ? '选择报价' : '最低报价'}
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {ordersWithQuotes.map((order) => (
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
              <td className="px-6 py-4 whitespace-nowrap">
                {showSelected ? (
                  order.selectedProvider ? (
                    <div>
                      <div className="text-sm font-medium text-gray-900">{order.selectedProvider}</div>
                      <div className="text-sm text-green-600">¥{order.selectedPrice?.toLocaleString()}</div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">未选择</span>
                  )
                ) : (
                  order.lowestQuote ? (
                    <div>
                      <div className="text-sm font-medium text-gray-900">{order.lowestQuote.provider}</div>
                      <div className="text-sm text-green-600">¥{order.lowestQuote.price.toLocaleString()}</div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">暂无报价</span>
                  )
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<EyeIcon size={16} />}
                    onClick={() => handleViewQuotes(order)}
                  >
                    查看报价
                  </Button>

                  {!showSelected && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<EditIcon size={16} />}
                        onClick={() => handleEditOrder(order)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<XIcon size={16} />}
                        onClick={() => handleCloseOrder(order)}
                      >
                        关闭
                      </Button>
                    </>
                  )}
                </div>
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

      {/* 加载状态覆盖层 */}
      {pagination?.loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      )}

      {/* 查看报价模态框 */}
      {quotesModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">订单报价详情</h3>
              <p className="text-sm text-gray-600">订单编号: {selectedOrder.id}</p>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* 订单信息 */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">订单信息</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">发货仓库:</span> {selectedOrder.from}</div>
                  <div><span className="font-medium">货物信息:</span> {selectedOrder.goods}</div>
                  <div className="md:col-span-2 break-words leading-relaxed"><span className="font-medium">收货地址:</span> {selectedOrder.to}</div>
                </div>
              </div>

              {/* 报价列表 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-4">报价列表</h4>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">加载中...</p>
                  </div>
                ) : quotes.length > 0 ? (
                  <div className="space-y-3">
                    {quotes.map((quote) => (
                      <div key={quote.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium text-gray-900">{quote.provider}</h5>
                              <span className="text-lg font-bold text-green-600">¥{quote.price.toLocaleString()}</span>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center">
                                <CalendarIcon size={14} className="mr-1" />
                                预计送达: {quote.estimatedDelivery}
                              </div>
                              <div>报价时间: {new Date(quote.createdAt).toLocaleString('zh-CN')}</div>
                            </div>
                          </div>
                          {!showSelected && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSelectQuote(quote)}
                              className="ml-4"
                            >
                              选择
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    暂无报价
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setQuotesModalOpen(false)}
              >
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑订单模态框 */}
      {editModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">编辑订单</h3>
              <p className="text-sm text-gray-600">订单编号: {selectedOrder.id}</p>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    发货仓库 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={editFormData.warehouse}
                    onChange={(e) => setEditFormData({...editFormData, warehouse: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    货物信息 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={editFormData.goods}
                    onChange={(e) => setEditFormData({...editFormData, goods: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    收货地址 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none"
                    value={editFormData.deliveryAddress}
                    onChange={(e) => setEditFormData({...editFormData, deliveryAddress: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditModalOpen(false)}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                >
                  保存
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderList;