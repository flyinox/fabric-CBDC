import React, { useState, useEffect } from 'react';
import { Toast, Card, Button, Grid, Dropdown } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { getUserBalance, getUserAccountId } from '../../services/walletApi';
import { useUserContext } from '../../context/UserContext';
import './index.css';
import UserRecords from './UserRecords';
import TransferModal from '../../components/TransferModal';
import ApproveModal from '../../components/ApproveModal';

const WalletPage: React.FC = () => {
  const { currentUser, loading, switchingUser, refreshUserBalances } = useUserContext();
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [accountId, setAccountId] = useState<string>('');
  const { t } = useTranslation();

  useEffect(() => {
    if (currentUser) {
      getUserAccountId(currentUser.id).then(id => setAccountId(id));
    } else {
      setAccountId('');
    }
  }, [currentUser]);

  const handleCopyAddress = () => {
    if (accountId) {
      navigator.clipboard.writeText(accountId).then(() => {
        Toast.show(t('user.addressCopied'));
      }).catch(() => {
        Toast.show(t('user.copyFailed'));
      });
    } else {
      Toast.show(t('user.addressLoading'));
    }
  };

  const handleTransferSuccess = async () => {
    // 转账成功后刷新用户余额
    await refreshUserBalances();
  };

  const handleApproveSuccess = async () => {
    // 授权成功后刷新用户余额
    await refreshUserBalances();
    Toast.show(t('messages.approveSuccess'));
  };

  if (loading || switchingUser) {
    return (
      <div className="wallet-page loading">
        <div>
          {switchingUser ? t('common.switchingUser') : t('common.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-page">
      {/* 当前用户信息 */}
      {currentUser && (
        <div className="user-card-modern">
          <div className="user-card-row">
            <div className="user-card-main">
              <div className="user-card-amount">¥{currentUser.balance}</div>
              <div className="user-card-address-row">
                <span className="user-card-address">
                {accountId || t('common.loading')}
                </span>
                <span className="user-card-copy" onClick={handleCopyAddress} title={t('user.copyAddress')}>📋</span>
              </div>
            </div>
          </div>
          <div className="user-card-footer-row">
            <span className="user-card-bank-tag">{currentUser.organization}</span>
            <span className="user-card-username">{currentUser.name}</span>
          </div>
        </div>
      )}

      <div className="action-buttons">
        <Grid columns={4} gap={16}>
          <Grid.Item>
            <Button 
              block 
              onClick={() => setTransferModalVisible(true)}
            >
              {t('wallet.transfer')}
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Button 
              block 
              onClick={() => { Toast.show(t('wallet.receiveFeature')); }}
            >
              {t('wallet.receive')}
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Button 
              block 
              onClick={() => setApproveModalVisible(true)}
            >
              {t('wallet.approve')}
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Button 
              block 
              onClick={() => { Toast.show(t('wallet.recordsFeature')); }}
            >
              {t('wallet.records')}
            </Button>
          </Grid.Item>
        </Grid>
      </div>

      {/* 本用户交易记录 */}
      <div className="user-records-section">
        <div className="user-records-title">{t('wallet.myTransactions')}</div>
        <UserRecords user={currentUser} pageSize={10} />
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