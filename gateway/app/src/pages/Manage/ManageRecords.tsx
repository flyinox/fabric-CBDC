import React, { useEffect, useState } from 'react';
import type { User, Transaction } from '../../types';
import { getAllTransactions } from '../../services/walletApi';
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
      
      // 使用新的getAllTransactions方法，根据用户角色自动处理权限
      const result = await getAllTransactions(user.id, {
        pageSize: pageSize.toString(),
        offset: reset ? '0' : (currentPage * pageSize).toString()
      });
      
      if (!result.success) {
        console.error('❌ ManageRecords: 查询失败:', result.error);
        if (reset) {
          setAllTransactions([]);
          setDisplayedTransactions([]);
        }
        return;
      }
      
      const txList = result.data?.transactions || [];
      console.log('🔍 ManageRecords: 获取到交易记录:', txList.length);
      console.log('🔍 ManageRecords: 用户角色信息:', result.data?.userRole);
      
      if (reset) {
        // 重置时，按时间倒序排列并设置初始数据
        const sortedTx = txList.sort((a: Transaction, b: Transaction) => b.timestamp - a.timestamp);
        setAllTransactions(sortedTx);
        setDisplayedTransactions(sortedTx.slice(0, pageSize));
        setHasMore(result.data?.pagination?.hasMore || false);
        console.log('🔍 ManageRecords: 重置完成，显示前', pageSize, '条记录');
      } else {
        // 加载更多时，更新显示的交易记录
        const nextPage = currentPage + 1;
        const endIndex = nextPage * pageSize;
        setDisplayedTransactions(allTransactions.slice(0, endIndex));
        setCurrentPage(nextPage);
        setHasMore(result.data?.pagination?.hasMore || false);
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
    
    // 直接调用API获取下一页数据
    try {
      const result = await getAllTransactions(user!.id, {
        pageSize: pageSize.toString(),
        offset: (currentPage * pageSize).toString()
      });
      
      if (result.success && result.data?.transactions) {
        const newTransactions = result.data.transactions;
        const sortedNewTx = newTransactions.sort((a: Transaction, b: Transaction) => b.timestamp - a.timestamp);
        
        // 合并新数据到现有数据
        const updatedAllTransactions = [...allTransactions, ...sortedNewTx];
        setAllTransactions(updatedAllTransactions);
        setDisplayedTransactions(updatedAllTransactions);
        setCurrentPage(currentPage + 1);
        setHasMore(result.data.pagination?.hasMore || false);
        
        console.log('✅ ManageRecords: 加载完成', {
          newPage: currentPage + 1,
          newDisplayedCount: updatedAllTransactions.length,
          totalCount: updatedAllTransactions.length,
          hasMore: result.data.pagination?.hasMore
        });
      }
    } catch (error) {
      console.error('❌ ManageRecords: 加载更多失败:', error);
    }
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