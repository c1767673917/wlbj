import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Eye,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  User,
  MapPin
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import AuthService from '../../services/auth';

interface Order {
  id: string;
  warehouse: string;
  goods: string;
  deliveryAddress: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  selectedProvider: string | null;
  selectedPrice: number | null;
  selectedAt: string | null;
  userId: string;
  userEmail?: string;
  userName?: string;
}

interface OrderListResponse {
  data: Order[];
  total: number;
  page: number;
  totalPages: number;
}

const OrderManagement = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [currentPage, searchTerm, statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter })
      });

      const response = await fetch(`/api/admin/orders?${params}`, {
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取订单列表失败');
      }

      const data: OrderListResponse = await response.json();
      setOrders(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('加载订单列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadOrders();
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const handleExportOrders = async () => {
    try {
      const params = new URLSearchParams({
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter })
      });

      const response = await fetch(`/api/export/orders?${params}`, {
        headers: {
          'Authorization': `Bearer ${AuthService.getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `orders_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出订单失败:', error);
      alert('导出订单失败');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '活跃';
      case 'closed':
        return '已关闭';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Package className="mr-3" size={28} />
          订单管理
        </h2>
        <div className="flex space-x-2">
          <Button
            onClick={handleExportOrders}
            variant="outline"
            size="sm"
            className="flex items-center"
          >
            <Download size={16} className="mr-2" />
            导出Excel
          </Button>
          <Button
            onClick={loadOrders}
            variant="outline"
            size="sm"
            className="flex items-center"
          >
            <RefreshCw size={16} className="mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 搜索和筛选栏 */}
      <Card className="p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="搜索订单ID、货物、地址..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="min-w-32">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">所有状态</option>
              <option value="active">活跃订单</option>
              <option value="closed">已关闭</option>
            </select>
          </div>
          <Button type="submit">搜索</Button>
          {(searchTerm || statusFilter) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setCurrentPage(1);
              }}
            >
              清除筛选
            </Button>
          )}
        </form>
      </Card>

      {/* 订单统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{total}</p>
            <p className="text-sm text-gray-600">总订单数</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {orders.filter(o => o.status === 'active').length}
            </p>
            <p className="text-sm text-gray-600">活跃订单</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-600">
              {orders.filter(o => o.status === 'closed').length}
            </p>
            <p className="text-sm text-gray-600">已关闭订单</p>
          </div>
        </Card>
      </div>

      {/* 订单列表 */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  订单信息
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  创建时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        订单号: {order.id}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        <div className="flex items-center">
                          <MapPin size={14} className="mr-1" />
                          {order.warehouse}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        货物: {order.goods}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User size={16} className="mr-2 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-900">
                          {order.userName || '未知用户'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.userEmail}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </span>
                    {order.selectedProvider && (
                      <div className="text-xs text-gray-500 mt-1">
                        已选择: {order.selectedProvider}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar size={14} className="mr-1" />
                      {formatDate(order.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleViewOrder(order)}
                      className="text-blue-600 hover:text-blue-900 flex items-center"
                      title="查看详情"
                    >
                      <Eye size={16} className="mr-1" />
                      查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                显示第 {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, total)} 条，共 {total} 条记录
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  上一页
                </Button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  第 {currentPage} / {totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 订单详情模态框 */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">订单详情</h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedOrder(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">订单号</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedOrder.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">状态</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusText(selectedOrder.status)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">发货仓库</label>
                <p className="mt-1 text-sm text-gray-900">{selectedOrder.warehouse}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">货物信息</label>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{selectedOrder.goods}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">收货地址</label>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{selectedOrder.deliveryAddress}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">创建时间</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(selectedOrder.createdAt)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">更新时间</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(selectedOrder.updatedAt)}</p>
                </div>
              </div>

              {selectedOrder.selectedProvider && (
                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-2">选择的物流商</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">物流公司</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedOrder.selectedProvider}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">报价</label>
                      <p className="mt-1 text-sm text-gray-900">¥{selectedOrder.selectedPrice}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">选择时间</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedOrder.selectedAt ? formatDate(selectedOrder.selectedAt) : '-'}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="text-md font-medium text-gray-900 mb-2">用户信息</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">用户邮箱</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedOrder.userEmail || '未知'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">用户姓名</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedOrder.userName || '未设置'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedOrder(null);
                }}
              >
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;
