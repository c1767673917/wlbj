import { TruckIcon } from 'lucide-react';

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 space-y-6 text-center">
      <div className="flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full">
        <TruckIcon size={36} className="text-white" />
      </div>
      <h1 className="text-3xl font-bold text-gray-800">物流报价平台</h1>
      <p className="max-w-2xl text-lg text-gray-600">
        欢迎使用我们的物流报价平台，连接货主与物流供应商的桥梁。
      </p>
      <div className="text-sm text-gray-500 mt-8">
        <p>请联系管理员获取访问权限</p>
      </div>
    </div>
  );
}

export default HomePage;
