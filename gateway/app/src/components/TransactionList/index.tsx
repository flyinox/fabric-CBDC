import React, { useState } from 'react';
import { List, Tag, InfiniteScroll, SpinLoading } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import type { Transaction } from '../../types';
import './index.css';

interface TransactionListProps {
  transactions: Transaction[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  pageSize?: number; // 新增：每页显示数量
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  loading,
  hasMore,
  onLoadMore,
  pageSize = 10
}) => {
  const [loadingMore, setLoadingMore] = useState(false);
  const { t } = useTranslation();

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    
    console.log('🔄 TransactionList: 开始加载更多...', {
      loadingMore,
      hasMore,
      transactionsCount: transactions.length
    });
    
    setLoadingMore(true);
    try {
      await onLoadMore();
      console.log('✅ TransactionList: 加载更多完成');
    } catch (error) {
      console.error('❌ TransactionList: 加载更多交易记录失败:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const getTransactionTypeText = (type: string) => {
    const typeMap = {
      'transfer': t('transaction.types.transfer'),
      'approve': t('transaction.types.approve'),
      'transferFrom': t('transaction.types.transferFrom'),
      'mint': t('transaction.types.mint'),
      'burn': t('transaction.types.burn')
    };
    return typeMap[type as keyof typeof typeMap] || type;
  };

  const getStatusColor = (status: string) => {
    const colorMap = {
      'success': '#52c41a',
      'pending': '#faad14',
      'failed': '#ff4d4f'
    };
    return colorMap[status as keyof typeof colorMap] || '#666';
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      'success': t('transaction.status.success'),
      'pending': t('transaction.status.pending'),
      'failed': t('transaction.status.failed')
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) {
      return t('common.justNow');
    } else if (diff < 3600000) {
      return t('common.minutesAgo', { count: Math.floor(diff / 60000) });
    } else if (diff < 86400000) {
      return t('common.hoursAgo', { count: Math.floor(diff / 3600000) });
    } else {
      return t('common.daysAgo', { count: Math.floor(diff / 86400000) });
    }
  };

  const formatAddress = (address: string) => {
    if (address === '0x0000000000000000') return t('transactions.burnAddress');
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="transaction-list-loading">
        <div className="loading-container">
          <SpinLoading color="#1677ff" />
          <div className="loading-text">{t('transactions.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      <List>
        {transactions.map((tx) => (
          <List.Item
            key={tx.id}
            className="transaction-item"
            extra={
              <div className="transaction-amount">
                {tx.type === 'transfer' && tx.from !== '0x0000000000000000' ? '-' : ''}
                ¥{tx.amount}
              </div>
            }
          >
            <div className="transaction-content">
              <div className="transaction-header">
                <span className="transaction-type">
                  {getTransactionTypeText(tx.type)}
                </span>
                <Tag
                  color={getStatusColor(tx.status)}
                  className="transaction-status"
                >
                  {getStatusText(tx.status)}
                </Tag>
              </div>
              <div className="transaction-details">
                <div className="transaction-addresses">
                  {tx.type === 'approve' ? (
                    <>
                      <span>{t('transactions.approver')} {formatAddress(tx.from)}</span>
                      <span> → </span>
                      <span>{t('transactions.authorized')} {formatAddress(tx.to)}</span>
                    </>
                  ) : tx.type === 'transferFrom' ? (
                    <>
                      <span>{t('transactions.from')} {formatAddress(tx.from)}</span>
                      <span> → </span>
                      <span>{t('transactions.to')} {formatAddress(tx.to)}</span>
                      {tx.spender && (
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          {t('transactions.executor')}: {formatAddress(tx.spender)}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                  <span>{t('transactions.from')} {formatAddress(tx.from)}</span>
                  <span> → </span>
                  <span>{t('transactions.to')} {formatAddress(tx.to)}</span>
                    </>
                  )}
                </div>
                <div className="transaction-time">
                  {formatTime(tx.timestamp)}
                </div>
              </div>
            </div>
          </List.Item>
        ))}
      </List>
      
      <InfiniteScroll
        loadMore={handleLoadMore}
        hasMore={hasMore}
        threshold={50}
      >
        {(hasMore, failed, retry) =>
          loadingMore ? (
            <div className="loading-more">
              <SpinLoading color="#1677ff" style={{ '--size': '16px' }} />
              <span>{t('transactions.loadMore')}</span>
            </div>
          ) : null
        }
      </InfiniteScroll>
    </div>
  );
};

export default TransactionList; 