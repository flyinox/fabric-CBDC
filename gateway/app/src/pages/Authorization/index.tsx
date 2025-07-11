import React, { useState, useEffect } from 'react';
import { Card, Button, Grid, Toast, List, Tag, Selector } from 'antd-mobile';
import type { User } from '../../types';
import { getAllowance } from '../../services/walletApi';
import { useUserContext } from '../../context/UserContext';
import ApproveModal from '../../components/ApproveModal';
import TransferFromModal from '../../components/TransferFromModal';
import './index.css';

interface AllowanceInfo {
  owner: string;
  spender: string;
  allowance: number;
}

const AuthorizationPage: React.FC = () => {
  const { currentUser, users } = useUserContext();
  const [loading, setLoading] = useState(true);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [transferFromModalVisible, setTransferFromModalVisible] = useState(false);
  const [allowances, setAllowances] = useState<AllowanceInfo[]>([]);

  useEffect(() => {
    if (currentUser) {
      loadAllowances();
    }
  }, [currentUser]);

  const loadAllowances = async () => {
    if (!currentUser) return;
    try {
      const allowanceList: AllowanceInfo[] = [];
      
      // 查询当前用户作为授权者的授权情况
      for (const user of users) {
        if (user.id !== currentUser.id) {
          try {
            const result = await getAllowance(currentUser.id, user.id, currentUser.id);
            if (result.success && result.data.allowance > 0) {
              allowanceList.push({
                owner: currentUser.id,
                spender: user.id,
                allowance: result.data.allowance
              });
            }
          } catch (error) {
            console.error('查询授权额度失败:', error);
          }
        }
      }

      // 查询当前用户作为被授权者的授权情况
      for (const user of users) {
        if (user.id !== currentUser.id) {
          try {
            const result = await getAllowance(user.id, currentUser.id, currentUser.id);
            if (result.success && result.data.allowance > 0) {
              allowanceList.push({
                owner: user.id,
                spender: currentUser.id,
                allowance: result.data.allowance
              });
            }
          } catch (error) {
            console.error('查询授权额度失败:', error);
          }
        }
      }

      setAllowances(allowanceList);
    } catch (error) {
      console.error('加载授权信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSuccess = () => {
    loadAllowances();
  };

  const handleTransferFromSuccess = () => {
    loadAllowances();
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.name} (${user.organization})` : userId;
  };

  if (loading) {
    return (
      <div className="authorization-page loading">
        <div>加载中...</div>
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
              <div className="balance-label">余额</div>
              <div className="balance-amount">¥{currentUser.balance}</div>
            </div>
          </div>
        </Card>
      )}

      {/* 授权操作按钮 */}
      <div className="authorization-actions">
        <Grid columns={2} gap={16}>
          <Grid.Item>
            <Button 
              block 
              color="primary"
              onClick={() => setApproveModalVisible(true)}
            >
              批准授权
            </Button>
          </Grid.Item>
          <Grid.Item>
            <Button 
              block 
              color="success"
              onClick={() => setTransferFromModalVisible(true)}
            >
              授权转账
            </Button>
          </Grid.Item>
        </Grid>
      </div>

      {/* 授权记录 */}
      <div className="allowance-section">
        <div className="allowance-title">授权记录</div>
        {allowances.length > 0 ? (
          <List className="allowance-list">
            {allowances.map((allowance, index) => (
              <List.Item
                key={index}
                className="allowance-item"
                extra={
                  <Tag color="primary">
                    {allowance.allowance}
                  </Tag>
                }
              >
                <div className="allowance-info">
                  <div className="allowance-owner">
                    授权者: {getUserName(allowance.owner)}
                  </div>
                  <div className="allowance-spender">
                    被授权者: {getUserName(allowance.spender)}
                  </div>
                </div>
              </List.Item>
            ))}
          </List>
        ) : (
          <div className="no-allowance">
            <p>暂无授权记录</p>
            <p>您可以批准授权给其他用户，或使用其他用户给您的授权</p>
          </div>
        )}
      </div>

      {/* 授权模态框 */}
      <ApproveModal
        visible={approveModalVisible}
        onClose={() => setApproveModalVisible(false)}
        currentUser={currentUser}
        onSuccess={handleApproveSuccess}
      />

      {/* 授权转账模态框 */}
      <TransferFromModal
        visible={transferFromModalVisible}
        onClose={() => setTransferFromModalVisible(false)}
        currentUser={currentUser}
        onSuccess={handleTransferFromSuccess}
      />
    </div>
  );
};

export default AuthorizationPage; 