import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { TabBar } from 'antd-mobile';
import { 
  PayCircleOutline, 
  BillOutline,
  SetOutline
} from 'antd-mobile-icons';
import WalletPage from './pages/Wallet';
import ManagePage from './pages/Manage';
import AuthorizationPage from './pages/Authorization';
import './App.css';
import { UserProvider, useUserContext } from './context/UserContext';
import UserSelectorDrawer from './components/UserSelectorDrawer';
import { UserCircleOutline } from 'antd-mobile-icons';

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
      key: '/authorization',
      title: '授权',
      icon: (active: boolean) => <SetOutline />
    },
    {
      key: '/manage',
      title: '管理',
      icon: (active: boolean) => <BillOutline />
    }
  ];

  // 用户选择器弹窗控制
  const [drawerVisible, setDrawerVisible] = useState(false);
  const { users, currentUser, setCurrentUser, loading } = useUserContext();

  return (
    <>
      {/* 主内容区 */}
      <div className="app-content">
        {/* 全局用户选择入口，独立一行 */}
        <div
          style={{
            width: '100%',
            background: '#fff',
            borderRadius: 12,
            margin: '0 0 18px 0',
            padding: '16px 24px',
            fontSize: 18,
            fontWeight: 600,
            color: '#1677ff',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            minHeight: 48
          }}
          onClick={() => setDrawerVisible(true)}
        >
          {currentUser ? `${currentUser.name}（${currentUser.organization}）` : '请选择用户'}
        </div>
        <UserSelectorDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          users={users}
          currentUser={currentUser}
          onSelect={user => { setCurrentUser(user); setDrawerVisible(false); }}
        />
        <Routes>
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/authorization" element={<AuthorizationPage />} />
          <Route path="/manage" element={<ManagePage />} />
          <Route path="/" element={<Navigate to="/wallet" replace />} />
        </Routes>
      </div>
      {/* 底部TabBar不变 */}
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

const App: React.FC = () => (
  <Router>
    <UserProvider>
      <AppContent />
    </UserProvider>
  </Router>
);

export default App;
