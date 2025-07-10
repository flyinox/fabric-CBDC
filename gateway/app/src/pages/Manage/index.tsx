import React, { useState, useEffect } from 'react';
import { Button, Toast } from 'antd-mobile';
import type { User, Transaction } from '../../types';
import { getUsers, getTransactions } from '../../services/mockData';
import TransactionList from '../../components/TransactionList';
import './index.css';

const ManagePage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
    loadTransactions();
  }, []);

  const loadUsers = async () => {
    const userList = await getUsers();
    setUsers(userList);
    if (userList.length > 0) {
      setCurrentUser(userList[0]); // 默认第一个
    }
  };

  const loadTransactions = async () => {
    const txList = await getTransactions();
    setTransactions(txList);
    setLoading(false);
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
          <Button color="primary" onClick={() => Toast.show('铸币功能开发中...')}>铸币</Button>
          <Button color="danger" style={{ marginLeft: 12 }} onClick={() => Toast.show('销毁功能开发中...')}>销毁</Button>
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
      {content}
    </div>
  );
};

export default ManagePage; 