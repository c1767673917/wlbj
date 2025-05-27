import { CheckCircleIcon } from 'lucide-react';

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

interface QuoteHistoryProps {
  quotes: Quote[];
}

const QuoteHistory = ({ quotes }: QuoteHistoryProps) => {
  if (quotes.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">暂无报价历史</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
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

      <div className="flex justify-between items-center mt-4 px-6 py-3 bg-white border-t border-gray-200">
        <div className="text-sm text-gray-700">
          显示 <span className="font-medium">{quotes.length}</span> 条结果
        </div>
        <div className="flex space-x-2">
          <button className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            上一页
          </button>
          <button className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuoteHistory;