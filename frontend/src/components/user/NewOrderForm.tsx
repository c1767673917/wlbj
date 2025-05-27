import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { SparklesIcon, LoaderIcon, CheckCircleIcon } from 'lucide-react';
import api from '../../services/api';

const NewOrderForm = () => {
  const [formData, setFormData] = useState({
    warehouse: '',
    goods: '',
    destination: '',
  });
  const [aiText, setAiText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAIRecognize = async () => {
    if (!aiText.trim()) return;

    setIsProcessing(true);

    try {
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
      const result = await api.orders.create(formData);
      setOrderNumber(result.orderNumber || result.id);
      setSuccess(true);

      // Reset form after a delay
      setTimeout(() => {
        setFormData({
          warehouse: '',
          goods: '',
          destination: '',
        });
        setAiText('');
        setSuccess(false);
        setOrderNumber('');
      }, 5000);
    } catch (error) {
      console.error('创建订单失败:', error);
      // 可以显示错误提示
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      {success ? (
        <div className="flex flex-col items-center py-8">
          <div className="flex items-center justify-center w-16 h-16 mb-4 text-green-500 bg-green-100 rounded-full">
            <CheckCircleIcon size={32} />
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-800">订单发布成功！</h3>
          <p className="text-gray-600">订单编号：{orderNumber}</p>
          <p className="mt-4 text-sm text-gray-500">所有物流公司将收到通知并开始报价</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800">发布新物流订单</h2>
            <p className="text-gray-600">填写以下信息或使用AI智能识别</p>
          </div>

          <div className="p-4 mb-6 border border-blue-200 rounded-lg bg-blue-50">
            <h3 className="flex items-center mb-2 text-md font-medium text-blue-800">
              <SparklesIcon size={18} className="mr-2" />
              AI智能识别
            </h3>
            <p className="mb-4 text-sm text-blue-600">
              粘贴您的文本内容，AI将自动识别订单信息
            </p>
            <div className="flex flex-col space-y-3">
              <textarea
                className="w-full p-3 border border-blue-300 rounded-lg resize-none focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="粘贴订单相关文本，例如：'从广州仓发货，清香牛肉579箱，香辣味1321箱，送到河南省漯河市...'"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
              ></textarea>
              <Button
                onClick={handleAIRecognize}
                variant="primary"
                className="w-full sm:w-auto"
                isLoading={isProcessing}
                disabled={!aiText.trim() || isProcessing}
              >
                识别信息
              </Button>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div>
                <label htmlFor="warehouse" className="block mb-2 text-sm font-medium text-gray-700">
                  发货仓库
                </label>
                <input
                  type="text"
                  id="warehouse"
                  name="warehouse"
                  value={formData.warehouse}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例如：广州仓、深圳仓"
                  required
                />
              </div>

              <div>
                <label htmlFor="goods" className="block mb-2 text-sm font-medium text-gray-700">
                  货物信息
                </label>
                <textarea
                  id="goods"
                  name="goods"
                  value={formData.goods}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请详细描述货物种类、数量、规格等信息"
                  required
                ></textarea>
              </div>

              <div>
                <label htmlFor="destination" className="block mb-2 text-sm font-medium text-gray-700">
                  收货信息
                </label>
                <textarea
                  id="destination"
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请填写详细的收货地址"
                  required
                ></textarea>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isSubmitting}
                >
                  发布订单
                </Button>
              </div>
            </div>
          </form>
        </>
      )}
    </Card>
  );
};

export default NewOrderForm;