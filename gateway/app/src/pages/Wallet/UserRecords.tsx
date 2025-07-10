import React, { useEffect, useState } from 'react';
import type { User, Transaction } from '../../types';
import { getTransactions } from '../../services/walletApi';
import TransactionList from '../../components/TransactionList';

interface UserRecordsProps {
  user: User | null;
}

const UserRecords: React.FC<UserRecordsProps> = ({ user }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserTransactions();
    }
  }, [user]);

  const loadUserTransactions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 只传递 identityName，让 getTransactions 自动获取真实 userId
      const userTx = await getTransactions(undefined, user.id);
      setTransactions(userTx.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('加载用户交易记录失败:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TransactionList
      transactions={transactions}
      loading={loading}
      hasMore={false}
      onLoadMore={async () => {}}
    />
  );
};

export default UserRecords; 