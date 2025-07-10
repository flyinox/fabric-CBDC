import React, { useEffect, useState } from 'react';
import type { User, Transaction } from '../../types';
import { getTransactions } from '../../services/mockData';
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
    setLoading(true);
    const allTx = await getTransactions();
    const userTx = allTx.filter(tx => tx.from === user?.address || tx.to === user?.address);
    setTransactions(userTx.sort((a, b) => b.timestamp - a.timestamp));
    setLoading(false);
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