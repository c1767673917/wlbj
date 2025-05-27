import { BrowserRouter as Router, Routes, Route, useParams, useLocation } from 'react-router-dom';
import UserPortal from './components/user/UserPortal';
import ProviderPortal from './components/provider/ProviderPortal';
import LoginPage from './components/auth/LoginPage';
import HomePage from './components/layout/HomePage';
import { TruckIcon } from 'lucide-react';

// 供应商页面组件
function ProviderPage() {
  const { accessKey } = useParams<{ accessKey: string }>();
  return <ProviderPortal providerKey={accessKey || ''} />;
}

// 用户页面组件
function UserPage() {
  return <UserPortal />;
}

// 用户登录页面组件
function LoginUserPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hasError = searchParams.get('error') === '1';

  return <LoginPage hasError={hasError} />;
}

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login-user-page" element={<LoginUserPage />} />
            <Route path="/user" element={<UserPage />} />
            <Route path="/provider/:accessKey" element={<ProviderPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;