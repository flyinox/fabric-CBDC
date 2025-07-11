import React, { useState, useEffect } from 'react';
import { Toast, Card, Button, Grid, Dropdown } from 'antd-mobile';
import type { User } from '../../types';
import { getUserBalance, getUserAccountId } from '../../services/walletApi';
import { useUserContext } from '../../context/UserContext';
import './index.css';
import UserRecords from './UserRecords';
import TransferModal from '../../components/TransferModal';
import ApproveModal from '../../components/ApproveModal';

const WalletPage: React.FC = () => {
  const { currentUser, loading } = useUserContext();
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [accountId, setAccountId] = useState<string>('');

  useEffect(() => {
    if (currentUser) {
      getUserAccountId(currentUser.id).then(id => setAccountId(id));
    } else {
      setAccountId('');
    }
  }, [currentUser]);

  const handleCopyAddress = () => {
    if (currentUser) {
      navigator.clipboard.writeText(currentUser.id).then(() => {
        Toast.show('用户ID已复制到剪贴板');
      }).catch(() => {
        Toast.show('复制失败');
      });
    }
  };

  const handleTransferSuccess = () => {
    // 转账成功后刷新用户余额和交易记录
    if (currentUser) {
      getUserBalance(currentUser.id).then(balance => {
        setCurrentUser(prev => prev ? { ...prev, balance: balance.toString() } : null);
      });
    }
  };

  const handleApproveSuccess = () => {
    // 授权成功后可以刷新相关数据
    Toast.show('授权操作成功');
  };

  if (loading) {
    return (
      <div className="wallet-page loading">
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <div className="wallet-page">
      {/* 当前用户信息 */}
      {currentUser && (
        <Card className="user-card">
          <div className="user-info">
            <div className="user-header">
              <div className="user-title">{currentUser.name}</div>
              <div className="user-org">{currentUser.organization}</div>
            </div>
            <div className="user-balance">
              <div className="balance-label">余额</div>
              <div className="balance-amount">¥{currentUser.balance}</div>
            </div>
            <div className="user-address">
              <div className="address-label">用户ID</div>
              <div className="address-value" onClick={handleCopyAddress} style={{wordBreak: 'break-all'}}>
                {accountId || '加载中...'}
                <span className="copy-icon">📋</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="action-buttons">
        <Grid columns={4} gap={16}>
          <Grid.Item>
            <Button 
              block 
              onClick={() => setTransferModalVisible(true)}
            >
              转账
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Button 
              block 
              onClick={() => { Toast.show('收款功能开发中...'); }}
            >
              收款
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Button 
              block 
              onClick={() => setApproveModalVisible(true)}
            >
              授权
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Button 
              block 
              onClick={() => { Toast.show('记录功能开发中...'); }}
            >
              记录
            </Button>
          </Grid.Item>
        </Grid>
      </div>

      {/* 本用户交易记录 */}
      <div className="user-records-section">
        <div className="user-records-title">我的交易记录</div>
        <UserRecords user={currentUser} />
      </div>

      {/* 转账模态框 */}
      <TransferModal
        visible={transferModalVisible}
        onClose={() => setTransferModalVisible(false)}
        currentUser={currentUser}
        onSuccess={handleTransferSuccess}
      />

      {/* 授权模态框 */}
      <ApproveModal
        visible={approveModalVisible}
        onClose={() => setApproveModalVisible(false)}
        currentUser={currentUser}
        onSuccess={handleApproveSuccess}
      />
    </div>
  );
};

export default WalletPage; 