import React, { useState, useEffect } from 'react';
import { Toast, Card, Button, Grid } from 'antd-mobile';
import type { User } from '../../types';
import { getUsersWithBalances, getUserBalance } from '../../services/walletApi';
import './index.css';
import UserRecords from './UserRecords';

const WalletPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const userList = await getUsersWithBalances();
      setUsers(userList);
      if (userList.length > 0) {
        setCurrentUser(userList[0]);
      }
    } catch (error) {
      Toast.show('加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = async (user: User) => {
    setCurrentUser(user);
    Toast.show(`已切换到 ${user.name}`);
    
    // 更新当前用户的余额
    try {
      const balance = await getUserBalance(user.id);
      setCurrentUser(prev => prev ? { ...prev, balance: balance.toString() } : null);
    } catch (error) {
      console.error('更新用户余额失败:', error);
    }
  };

  const handleCopyAddress = () => {
    if (currentUser) {
      navigator.clipboard.writeText(currentUser.address).then(() => {
        Toast.show('地址已复制到剪贴板');
      }).catch(() => {
        Toast.show('复制失败');
      });
    }
  };

  if (loading) {
    return (
      <div className="wallet-page loading">
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <div className="wallet-page">
      <div className="wallet-header-container">
        <div className="user-selector-container">
          <select 
            value={currentUser?.id || ''} 
            onChange={(e) => {
              const user = users.find(u => u.id === e.target.value);
              if (user) handleUserChange(user);
            }}
            className="user-selector"
          >
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} - {user.organization}
              </option>
            ))}
          </select>
        </div>
        
        {currentUser && (
          <Card className="balance-card">
            <div className="balance-amount">
              ¥ {currentUser.balance}
            </div>
            <div className="address-info" onClick={handleCopyAddress}>
              <span className="address-text">{currentUser.address}</span>
              <span className="copy-hint">点击复制</span>
            </div>
            <div className="currency-tag">
              数字人民币
            </div>
          </Card>
        )}
      </div>

      <div className="action-buttons">
        <Grid columns={4} gap={16}>
          <Grid.Item>
            <Button 
              block 
              onClick={() => { Toast.show('转账功能开发中...'); }}
            >
              转账
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Button 
              block 
              onClick={() => { Toast.show('收款功能开发中...'); }}
            >
              收款
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Button 
              block 
              onClick={() => { Toast.show('Approve功能开发中...'); }}
            >
              Approve
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Button 
              block 
              onClick={() => { Toast.show('记录功能开发中...'); }}
            >
              记录
            </Button>
          </Grid.Item>
        </Grid>
      </div>

      {/* 本用户交易记录 */}
      <div className="user-records-section">
        <div className="user-records-title">我的交易记录</div>
        <UserRecords user={currentUser} />
      </div>
    </div>
  );
};

export default WalletPage; 