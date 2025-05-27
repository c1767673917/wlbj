import { useState, useEffect } from 'react';
import { TruckIcon, MenuIcon, XIcon } from 'lucide-react';

interface HeaderProps {
  activeTab: 'home' | 'user' | 'provider';
  setActiveTab: (tab: 'home' | 'user' | 'provider') => void;
  isAuthenticated: boolean;
  isProviderAccess: boolean;
}

const Header = ({ activeTab, setActiveTab, isAuthenticated, isProviderAccess }: HeaderProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md' : 'bg-white bg-opacity-95'
      }`}
    >
      <div className="container px-4 py-3 mx-auto">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center cursor-pointer" 
            onClick={() => setActiveTab('home')}
          >
            <div className="flex items-center justify-center w-10 h-10 mr-3 bg-blue-600 rounded-full">
              <TruckIcon size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-gray-800">物流报价平台</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('home')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'home'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              首页
            </button>
            <button
              onClick={() => setActiveTab('user')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'user'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              货主端
            </button>
            <button
              onClick={() => setActiveTab('provider')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'provider'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              物流商端
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex md:hidden items-center p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            {menuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <nav className="flex md:hidden flex-col mt-3 space-y-1 pb-3">
            <button
              onClick={() => {
                setActiveTab('home');
                setMenuOpen(false);
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'home'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              首页
            </button>
            <button
              onClick={() => {
                setActiveTab('user');
                setMenuOpen(false);
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'user'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              货主端
            </button>
            <button
              onClick={() => {
                setActiveTab('provider');
                setMenuOpen(false);
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'provider'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              物流商端
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;