import React, { useEffect, useState } from 'react';
import type { User, Transaction } from '../../types';
import { getTransactions } from '../../services/walletApi';
import TransactionList from '../../components/TransactionList';

interface UserRecordsProps {
  user: User | null;
  pageSize?: number; // 新增：每页显示数量
}

const UserRecords: React.FC<UserRecordsProps> = ({ user, pageSize = 10 }) => {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [displayedTransactions, setDisplayedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (user) {
      loadUserTransactions(true); // 重置加载
    }
  }, [user]);

  const loadUserTransactions = async (reset = false) => {
    if (!user) return;
    
    if (reset) {
    setLoading(true);
      setCurrentPage(1);
      setHasMore(true);
    }
    
    try {
      // 加载交易记录
      const userTx = await getTransactions(undefined, user.id);
      
      if (reset) {
        // 重置时，按时间倒序排列并设置初始数据
        const sortedTx = userTx.sort((a, b) => b.timestamp - a.timestamp);
        setAllTransactions(sortedTx);
        setDisplayedTransactions(sortedTx.slice(0, pageSize));
        setHasMore(sortedTx.length > pageSize);
      } else {
        // 加载更多时，更新显示的交易记录
        const nextPage = currentPage + 1;
        const endIndex = nextPage * pageSize;
        setDisplayedTransactions(allTransactions.slice(0, endIndex));
        setCurrentPage(nextPage);
        setHasMore(endIndex < allTransactions.length);
      }
    } catch (error) {
      console.error('加载用户交易记录失败:', error);
      if (reset) {
        setAllTransactions([]);
        setDisplayedTransactions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!hasMore || loading) return;
    
    console.log('开始加载更多交易记录...', {
      currentPage,
      displayedCount: displayedTransactions.length,
      totalCount: allTransactions.length,
      hasMore
    });
    
    // 模拟加载延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    await loadUserTransactions(false);
    
    console.log('加载完成', {
      newPage: currentPage + 1,
      newDisplayedCount: displayedTransactions.length + pageSize,
      totalCount: allTransactions.length
    });
  };

  return (
    <TransactionList
      transactions={displayedTransactions}
      loading={loading}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
      pageSize={pageSize}
    />
  );
};

export default UserRecords; 