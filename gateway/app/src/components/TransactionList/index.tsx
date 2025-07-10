import React from 'react';
import { List, Tag, InfiniteScroll } from 'antd-mobile';
import type { Transaction } from '../../types';
import './index.css';

interface TransactionListProps {
  transactions: Transaction[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  loading,
  hasMore,
  onLoadMore
}) => {
  const getTransactionTypeText = (type: string) => {
    const typeMap = {
      'transfer': '转账',
      'approve': '授权',
      'mint': '铸币',
      'burn': '销毁'
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
      'success': '成功',
      'pending': '待确认',
      'failed': '失败'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) {
      return '刚刚';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`;
    } else {
      return `${Math.floor(diff / 86400000)}天前`;
    }
  };

  const formatAddress = (address: string) => {
    if (address === '0x0000000000000000') return '销毁地址';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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
                  <span>从 {formatAddress(tx.from)}</span>
                  <span> → </span>
                  <span>到 {formatAddress(tx.to)}</span>
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
        loadMore={onLoadMore}
        hasMore={hasMore}
        threshold={10}
      >
        {hasMore ? (
          <span>加载中...</span>
        ) : (
          <span>没有更多了</span>
        )}
      </InfiniteScroll>
    </div>
  );
};

export default TransactionList; 