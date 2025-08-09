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


const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState(location.pathname);
  const { currentUser } = useUserContext();

  useEffect(() => {
    setActiveKey(location.pathname);
  }, [location.pathname]);

  // 根据用户角色动态生成 tabs
  const getTabs = () => {
    const baseTabs = [
      {
        key: '/wallet',
        title: '钱包',
        icon: () => <PayCircleOutline />
      },
      {
        key: '/authorization',
        title: '授权',
        icon: () => <SetOutline />
      }
    ];

    // 判断是否显示管理 tab
    // 规则：央行用户（不管是否Admin）或银行Admin用户可以看到管理tab
    if (currentUser?.canManage) {
      baseTabs.push({
        key: '/manage',
        title: '管理',
        icon: () => <BillOutline />
      });
    }

    return baseTabs;
  };

  const tabs = getTabs();

  // 用户选择器弹窗控制
  const [drawerVisible, setDrawerVisible] = useState(false);
  const { users, setCurrentUser, switchingUser } = useUserContext();

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
            color: switchingUser ? '#999' : '#1677ff',
            cursor: switchingUser ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            minHeight: 48,
            opacity: switchingUser ? 0.7 : 1,
            transition: 'all 0.3s ease'
          }}
          onClick={() => !switchingUser && setDrawerVisible(true)}
        >
          {switchingUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 16,
                height: 16,
                border: '2px solid #1677ff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              切换用户中...
            </div>
          ) : (
            currentUser ? `${currentUser.name}（${currentUser.organization}）` : '请选择用户'
          )}
        </div>
        <UserSelectorDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          users={users}
          currentUser={currentUser}
          onSelect={user => { setCurrentUser(user); setDrawerVisible(false); }}
          switchingUser={switchingUser}
        />
        <Routes>
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/authorization" element={<AuthorizationPage />} />
          <Route 
            path="/manage" 
            element={
              currentUser?.canManage ? 
                <ManagePage /> : 
                <Navigate to="/wallet" replace />
            } 
          />
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
