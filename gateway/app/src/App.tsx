import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { TabBar } from 'antd-mobile';
import { 
  PayCircleOutline, 
  BillOutline
} from 'antd-mobile-icons';
import WalletPage from './pages/Wallet';
import ManagePage from './pages/Manage';
import './App.css';

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState(location.pathname);

  useEffect(() => {
    setActiveKey(location.pathname);
  }, [location.pathname]);

  const tabs = [
    {
      key: '/wallet',
      title: '钱包',
      icon: (active: boolean) => <PayCircleOutline />
    },
    {
      key: '/manage',
      title: '管理',
      icon: (active: boolean) => <BillOutline />
    }
  ];

  return (
    <>
      <div className="app-content">
        <Routes>
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/manage" element={<ManagePage />} />
          <Route path="/" element={<Navigate to="/wallet" replace />} />
        </Routes>
      </div>
      <div className="app-tabbar">
        <TabBar
          activeKey={activeKey}
          onChange={(key) => {
            setActiveKey(key);
            navigate(key);
          }}
        >
          {tabs.map(item => (
            <TabBar.Item
              key={item.key}
              icon={item.icon}
              title={item.title}
            />
          ))}
        </TabBar>
      </div>
    </>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <div className="app">
        <AppContent />
      </div>
    </Router>
  );
};

export default App;
