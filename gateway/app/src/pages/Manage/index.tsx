import React, { useState, useEffect } from 'react';
import { Button, Toast, Selector } from 'antd-mobile';
import type { User, Transaction } from '../../types';
import { getUsersWithBalances, getTransactions } from '../../services/walletApi';
import TransactionList from '../../components/TransactionList';
import './index.css';

const ManagePage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadTransactions();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      const userList = await getUsersWithBalances();
      setUsers(userList);
      if (userList.length > 0) {
        setCurrentUser(userList[0]); // 默认第一个
      }
    } catch (error) {
      console.error('加载用户失败:', error);
    }
  };

  const loadTransactions = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const txList = await getTransactions(undefined, currentUser.id);
      setTransactions(txList);
    } catch (error) {
      console.error('加载交易记录失败:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  if (!currentUser) {
    return <div className="manage-page loading">加载中...</div>;
  }

  // 角色判断
  const isCentralBank = currentUser.organization === '中国人民银行';
  const isOrgAdmin = currentUser.name.startsWith('Admin@') && currentUser.organization !== '中国人民银行';

  // 央行：全网交易
  // admin：本组织交易
  // 其他：无权限
  let content = null;
  if (isCentralBank) {
    content = (
      <>
        <div className="manage-actions">
          <Button color="primary" onClick={() => { Toast.show('铸币功能开发中...'); }}>铸币</Button>
          <Button color="danger" style={{ marginLeft: 12 }} onClick={() => { Toast.show('销毁功能开发中...'); }}>销毁</Button>
        </div>
        <div className="manage-title">全网交易记录</div>
        <TransactionList
          transactions={transactions}
          loading={loading}
          hasMore={false}
          onLoadMore={async () => {}}
        />
      </>
    );
  } else if (isOrgAdmin) {
    const orgTx = transactions.filter(tx => {
      // 只要from或to是本组织的用户
      return users.some(u => u.organization === currentUser.organization && (u.address === tx.from || u.address === tx.to));
    });
    content = (
      <>
        <div className="manage-title">本组织交易记录</div>
        <TransactionList
          transactions={orgTx}
          loading={loading}
          hasMore={false}
          onLoadMore={async () => {}}
        />
      </>
    );
  } else {
    content = <div className="manage-noauth">无管理权限</div>;
  }

  return (
    <div className="manage-page">
      {/* 用户选择器 */}
      <div style={{ padding: '16px', background: 'white', marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontSize: '14px', color: '#666' }}>选择用户:</div>
        <Selector
          options={users.map(user => ({
            label: user.name,
            value: user.id
          }))}
          value={currentUser ? [currentUser.id] : []}
          onChange={(arr) => handleUserChange(arr[0])}
        />
      </div>
      
      {content}
    </div>
  );
};

export default ManagePage; 