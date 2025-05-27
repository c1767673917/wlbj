import { GithubIcon, BookOpenIcon, HeartIcon } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-8 bg-gray-800 text-gray-300">
      <div className="container px-4 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h3 className="mb-4 text-xl font-bold text-white">物流报价平台</h3>
            <p className="mb-4 text-gray-400">
              连接货主与物流供应商的专业平台，提供高效、透明的物流报价服务。我们致力于简化物流流程，提升物流效率。
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <GithubIcon size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <BookOpenIcon size={20} />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="mb-4 text-lg font-semibold text-white">平台功能</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">订单管理</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">报价系统</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">物流商管理</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">AI识别</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">数据导出</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="mb-4 text-lg font-semibold text-white">使用指南</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">货主使用手册</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">物流商使用手册</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">企业微信配置</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">常见问题</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">安全说明</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 mt-8 border-t border-gray-700 text-center md:flex md:justify-between md:items-center">
          <p>© {currentYear} 物流报价平台. 保留所有权利.</p>
          <div className="mt-4 md:mt-0 flex items-center justify-center">
            <span className="flex items-center">
              <HeartIcon size={16} className="mr-2 text-red-500" />
              专为物流行业打造
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;