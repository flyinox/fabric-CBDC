import React, { useState, useEffect } from 'react';
import { Card, Button, Grid, Toast, List, Tag, Selector, Divider } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { getAllowance, getUserBalance, getUserAccountId } from '../../services/walletApi';
import { useUserContext } from '../../context/UserContext';
import ApproveModal from '../../components/ApproveModal';
import TransferFromModal from '../../components/TransferFromModal';
import './index.css';

// 自定义进度条组件
interface ProgressBarProps {
  percent: number;
  style?: React.CSSProperties;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ percent, style }) => {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  
  return (
    <div 
      className="custom-progress-bar" 
      style={style}
    >
      <div 
        className="custom-progress-fill"
        style={{ width: `${clampedPercent}%` }}
      />
    </div>
  );
};

interface AllowanceInfo {
  owner: string;
  spender: string;
  allowance: number;
  usedAmount?: number; // 已使用金额
  remainingAmount?: number; // 剩余金额
}

interface AuthorizationStats {
  totalApproved: number; // 总授权金额
  totalUsed: number; // 总使用金额
  totalRemaining: number; // 总剩余金额
  availableBalance: number; // 可用余额
  maxCanApprove: number; // 最大可授权金额
  totalIncomingAllowance: number; // 收到的授权总额
}

const AuthorizationPage: React.FC = () => {
  const { currentUser, users, refreshUserBalances, switchingUser } = useUserContext();
  const [loading, setLoading] = useState(true);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [transferFromModalVisible, setTransferFromModalVisible] = useState(false);
  const [allowances, setAllowances] = useState<AllowanceInfo[]>([]);
  const [accountId, setAccountId] = useState<string>('');
  const [stats, setStats] = useState<AuthorizationStats>({
    totalApproved: 0,
    totalUsed: 0,
    totalRemaining: 0,
    availableBalance: 0,
    maxCanApprove: 0,
    totalIncomingAllowance: 0
  });
  const { t } = useTranslation();

  useEffect(() => {
    if (currentUser) {
      loadAllowances();
      loadUserBalance();
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

  const loadUserBalance = async () => {
    if (!currentUser) return;
    try {
      // 优先使用当前用户的余额，如果为空则从API获取
      let balance = parseInt(currentUser.balance || '0');
      
      // 如果当前用户余额为0，尝试从API获取
      if (balance === 0) {
        balance = await getUserBalance(currentUser.id);
      }
      
      console.log(`加载用户余额: ${currentUser.id} = ${balance} (原始余额: ${currentUser.balance})`);
      setStats(prev => ({
        ...prev,
        availableBalance: balance
      }));
    } catch (error) {
      console.error('加载用户余额失败:', error);
      // 如果API调用失败，使用当前用户的余额
      const fallbackBalance = parseInt(currentUser?.balance || '0');
      setStats(prev => ({
        ...prev,
        availableBalance: fallbackBalance
      }));
    }
  };

  const loadAllowances = async () => {
    if (!currentUser) return;
    try {
      // 简化实现：不进行全局统计，只显示已知的授权记录
      const allowanceList: AllowanceInfo[] = [];
      
      // 只查询当前用户作为授权者的授权情况（用于显示已授权的记录）
      for (const user of users) {
        if (user.id !== currentUser.id) {
          try {
            const result = await getAllowance(currentUser.id, user.id, currentUser.id);
            if (result.success && result.data.allowance > 0) {
              const allowanceInfo: AllowanceInfo = {
                owner: currentUser.id,
                spender: user.id,
                allowance: result.data.allowance,
                usedAmount: 0, // 简化实现
                remainingAmount: result.data.allowance
              };
              allowanceList.push(allowanceInfo);
            }
          } catch (error) {
            console.error('查询授权额度失败:', error);
          }
        }
      }

      setAllowances(allowanceList);
      
      // 简化统计：只显示当前用户余额和可授权金额
      const currentUserBalance = parseInt(currentUser?.balance || '0');
      
      setStats(prev => ({
        ...prev,
        totalApproved: 0, // 不统计总授权金额
        totalUsed: 0,
        totalRemaining: 0,
        maxCanApprove: currentUserBalance, // 可授权金额等于当前余额
        totalIncomingAllowance: 0 // 不统计收到的授权总额
      }));
    } catch (error) {
      console.error('加载授权信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSuccess = async () => {
    await refreshUserBalances();
    await loadAllowances();
  };

  const handleTransferFromSuccess = async () => {
    await refreshUserBalances();
    await loadAllowances();
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.name} (${user.organization})` : userId;
  };

  const getAuthorizationType = (allowance: AllowanceInfo) => {
    if (allowance.owner === currentUser?.id) {
      return { type: 'outgoing', label: t('authorization.outgoing'), color: 'primary' };
    } else {
      return { type: 'incoming', label: t('authorization.incoming'), color: 'success' };
    }
  };

  if (loading || switchingUser) {
    return (
      <div className="authorization-page loading">
        <div>
          {switchingUser ? t('common.switchingUser') : t('common.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="authorization-page">
      {/* 当前用户信息 */}
      {currentUser && (
        <Card className="user-card">
          <div className="user-info">
            <div className="user-header">
              <div className="user-title">{currentUser.name}</div>
              <div className="user-org">{currentUser.organization}</div>
            </div>
            <div className="user-balance">
              <div className="balance-label">{t('user.balance')}</div>
              <div className="balance-amount">¥{currentUser.balance}</div>
            </div>
            <div className="user-address">
              <div className="address-label">{t('user.userAddress')}</div>
              <div className="address-value" onClick={handleCopyAddress} style={{wordBreak: 'break-all'}}>
                {accountId || t('common.loading')}
                <span className="copy-icon">📋</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 授权统计信息 */}
      <Card className="stats-card">
        <div className="stats-header">
          <h3>{t('authorization.authInfo')}</h3>
        </div>
        <div className="stats-content">
          <div className="stats-row">
            <div className="stats-item">
              <div className="stats-label">{t('authorization.accountBalance')}</div>
              <div className="stats-value">¥{stats.availableBalance}</div>
            </div>
            <div className="stats-item">
              <div className="stats-label">{t('authorization.maxCanApprove')}</div>
              <div className="stats-value highlight">¥{stats.maxCanApprove}</div>
            </div>
          </div>
          <div className="stats-description">
            <p>{t('authorization.tips')}</p>
            <ul>
              <li>{t('authorization.tipsList.tip1')}</li>
              <li>{t('authorization.tipsList.tip2')}</li>
              <li>{t('authorization.tipsList.tip3')}</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* 授权操作按钮 */}
      <div className="authorization-actions">
        <Grid columns={2} gap={16}>
          <Grid.Item>
            <Button 
              block 
              color="primary"
              onClick={() => setApproveModalVisible(true)}
              disabled={stats.maxCanApprove <= 0}
            >
              {t('authorization.approveAction')}
              {stats.maxCanApprove > 0 && (
                <div className="button-subtitle">{t('authorization.canApprove')}: ¥{stats.maxCanApprove}</div>
              )}
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Button 
              block 
              color="success"
              onClick={() => setTransferFromModalVisible(true)}
            >
              {t('authorization.transferFromAction')}
              <div className="button-subtitle">{t('authorization.verifyInBackground')}</div>
            </Button>
          </Grid.Item>
        </Grid>
      </div>

      {/* 使用说明 */}
      <Card className="help-card">
        <div className="help-header">
          <h4>{t('authorization.helpTitle')}</h4>
        </div>
        <div className="help-content">
          <div className="help-section">
            <h5>{t('authorization.helpSections.approve.title')}</h5>
            <p>{t('authorization.helpSections.approve.desc')}</p>
          </div>
          <div className="help-section">
            <h5>{t('authorization.helpSections.transferFrom.title')}</h5>
            <p>{t('authorization.helpSections.transferFrom.desc')}</p>
          </div>
          <div className="help-section">
            <h5>{t('authorization.helpSections.records.title')}</h5>
            <p>{t('authorization.helpSections.records.desc')}</p>
          </div>
        </div>
      </Card>

      {/* 授权记录 */}
      <div className="allowance-section">
        <div className="allowance-title">{t('authorization.authRecords')}</div>
        {allowances.length > 0 ? (
          <List className="allowance-list">
            {allowances.map((allowance, index) => {
              const authType = getAuthorizationType(allowance);
              const usagePercent = allowance.allowance > 0 
                ? Math.round(((allowance.allowance - (allowance.remainingAmount || 0)) / allowance.allowance) * 100)
                : 0;
              
              return (
                <List.Item
                  key={index}
                  className="allowance-item"
                  extra={
                    <div className="allowance-extra">
                      <Tag color={authType.color as any}>
                        {authType.label}
                      </Tag>
                      <div className="allowance-amount">
                        ¥{allowance.allowance}
                      </div>
                    </div>
                  }
                >
                  <div className="allowance-info">
                    <div className="allowance-owner">
                      {t('authorization.authorizer')}: {getUserName(allowance.owner)}
                    </div>
                    <div className="allowance-spender">
                      {t('authorization.authorized')}: {getUserName(allowance.spender)}
                    </div>
                    {allowance.remainingAmount !== undefined && (
                      <div className="allowance-usage">
                        <div className="usage-info">
                          <span>{t('authorization.remaining')}: ¥{allowance.remainingAmount}</span>
                          <span>{t('authorization.used')}: {usagePercent}%</span>
                        </div>
                        <ProgressBar 
                          percent={usagePercent} 
                          style={{ height: '4px' }}
                        />
                      </div>
                    )}
                  </div>
                </List.Item>
              );
            })}
          </List>
        ) : (
          <div className="no-allowance">
            <p>{t('authorization.noAuthRecords')}</p>
            <p>{t('authorization.authRecordsDesc')}</p>
          </div>
        )}
      </div>

      {/* 授权模态框 */}
      <ApproveModal
        visible={approveModalVisible}
        onClose={() => setApproveModalVisible(false)}
        currentUser={currentUser}
        onSuccess={handleApproveSuccess}
        maxAmount={stats.maxCanApprove}
      />

      {/* 授权转账模态框 */}
      <TransferFromModal
        visible={transferFromModalVisible}
        onClose={() => setTransferFromModalVisible(false)}
        onSuccess={handleTransferFromSuccess}
      />
    </div>
  );
};

export default AuthorizationPage; 