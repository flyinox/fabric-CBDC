import React, { useEffect, useState } from 'react';
import type { User, Transaction } from '../../types';
import { getTransactions } from '../../services/walletApi';
import TransactionList from '../../components/TransactionList';

interface ManageRecordsProps {
  user: User | null;
  users: User[];
  isCentralBank: boolean;
  pageSize?: number;
}

const ManageRecords: React.FC<ManageRecordsProps> = ({ 
  user, 
  users, 
  isCentralBank, 
  pageSize = 10 
}) => {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [displayedTransactions, setDisplayedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (user) {
      loadTransactions(true); // 重置加载
    }
  }, [user]);

  const loadTransactions = async (reset = false) => {
    if (!user) return;
    
    if (reset) {
      setLoading(true);
      setCurrentPage(1);
      setHasMore(true);
    }
    
    try {
      console.log('🔍 ManageRecords: 开始加载交易记录');
      console.log('🔍 ManageRecords: 当前用户:', user);
      console.log('🔍 ManageRecords: 是否央行用户:', isCentralBank);
      
      // 加载交易记录
      const txList = await getTransactions(undefined, user.id);
      console.log('🔍 ManageRecords: 获取到原始交易记录:', txList.length);
      
      let filteredTx = txList;
      
      // 如果不是央行用户，过滤本组织交易
      if (!isCentralBank) {
        filteredTx = txList.filter(tx => {
          // 只要from或to是本组织的用户
          return users.some(u => u.organization === user.organization && (u.id === tx.from || u.id === tx.to));
        });
        console.log('🔍 ManageRecords: 过滤后交易记录:', filteredTx.length);
      }
      
      if (reset) {
        // 重置时，按时间倒序排列并设置初始数据
        const sortedTx = filteredTx.sort((a, b) => b.timestamp - a.timestamp);
        setAllTransactions(sortedTx);
        setDisplayedTransactions(sortedTx.slice(0, pageSize));
        setHasMore(sortedTx.length > pageSize);
        console.log('🔍 ManageRecords: 重置完成，显示前', pageSize, '条记录');
      } else {
        // 加载更多时，更新显示的交易记录
        const nextPage = currentPage + 1;
        const endIndex = nextPage * pageSize;
        setDisplayedTransactions(allTransactions.slice(0, endIndex));
        setCurrentPage(nextPage);
        setHasMore(endIndex < allTransactions.length);
        console.log('🔍 ManageRecords: 加载更多完成，显示到第', endIndex, '条记录');
      }
    } catch (error) {
      console.error('❌ ManageRecords: 加载交易记录失败:', error);
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
    
    console.log('🔍 ManageRecords: 开始加载更多交易记录...', {
      currentPage,
      displayedCount: displayedTransactions.length,
      totalCount: allTransactions.length,
      hasMore
    });
    
    // 模拟加载延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    await loadTransactions(false);
    
    console.log('✅ ManageRecords: 加载完成', {
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

export default ManageRecords; 