import React, { useState, useEffect } from 'react';
import { Toast, List, Tag } from 'antd-mobile';
import type { Transaction } from '../../types';
import { getTransactions } from '../../services/mockData';
import './index.css';

const RecordsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const txList = await getTransactions();
      const sortedTx = txList.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(sortedTx);
    } catch (error) {
      Toast.show('加载交易记录失败');
    } finally {
      setLoading(false);
    }
  };

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
      'success': 'success',
      'pending': 'warning',
      'failed': 'danger'
    };
    return colorMap[status as keyof typeof colorMap] || 'default';
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

  if (loading) {
    return (
      <div className="records-page loading">
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <div className="records-page">
      <div className="records-header">
        <h2>交易记录</h2>
        <div className="records-summary">
          共 {transactions.length} 笔交易
        </div>
      </div>

      <div className="transaction-list">
        <List>
          {transactions.map((tx) => (
            <List.Item
              key={tx.id}
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
                  <Tag color={getStatusColor(tx.status)}>
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
      </div>
    </div>
  );
};

export default RecordsPage; 