import React, { useState, useEffect } from 'react';
import { Button, Toast, Selector } from 'antd-mobile';
import type { User, Transaction } from '../../types';
import { getTransactions } from '../../services/walletApi';
import { useUserContext } from '../../context/UserContext';
import TransactionList from '../../components/TransactionList';
import MintModal from '../../components/MintModal';
import BurnModal from '../../components/BurnModal';
import './index.css';

const ManagePage: React.FC = () => {
  const { currentUser, users, switchingUser, refreshUserBalances } = useUserContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mintModalVisible, setMintModalVisible] = useState(false);
  const [burnModalVisible, setBurnModalVisible] = useState(false);

  useEffect(() => {
    console.log('🔍 ManagePage: useEffect触发，currentUser变化');
    console.log('🔍 ManagePage: 新的currentUser:', currentUser);
    
    if (currentUser) {
      console.log('🔍 ManagePage: 用户已选择，开始加载交易记录');
      loadTransactions();
    } else {
      console.log('🔍 ManagePage: 用户未选择，跳过加载');
    }
  }, [currentUser]);

  const loadTransactions = async () => {
    console.log('🔍 ManagePage: 开始加载交易记录');
    console.log('🔍 ManagePage: 当前用户:', currentUser);
    
    if (!currentUser) {
      console.log('❌ ManagePage: 用户未选择，跳过加载');
      return;
    }
    
    try {
      console.log('🔍 ManagePage: 设置loading状态为true');
      setLoading(true);
      
      console.log('🔍 ManagePage: 调用getTransactions API');
      const txList = await getTransactions(undefined, currentUser.id);
      console.log('🔍 ManagePage: 获取到交易记录:', txList);
      console.log('🔍 ManagePage: 交易记录数量:', txList.length);
      
      setTransactions(txList);
      console.log('🔍 ManagePage: 更新交易记录状态');
    } catch (error) {
      console.error('❌ ManagePage: 加载交易记录失败:', error);
      setTransactions([]);
    } finally {
      console.log('🔍 ManagePage: 设置loading状态为false');
      setLoading(false);
    }
  };

  if (!currentUser || switchingUser) {
    return (
      <div className="manage-page loading">
        {switchingUser ? '切换用户中...' : '加载中...'}
      </div>
    );
  }

  // 角色判断
  const isCentralBank = currentUser.organization === '中国人民银行';
  const isOrgAdmin = currentUser.name.startsWith('Admin@') && currentUser.organization !== '中国人民银行';
  
  console.log('🔍 ManagePage: 角色判断结果');
  console.log('🔍 ManagePage: 用户组织:', currentUser?.organization);
  console.log('🔍 ManagePage: 是否央行用户:', isCentralBank);
  console.log('🔍 ManagePage: 是否组织管理员:', isOrgAdmin);

  // 央行：全网交易
  // admin：本组织交易
  // 其他：无权限
  let content = null;
  if (isCentralBank) {
    content = (
      <>
        <div className="manage-actions">
          <Button color="primary" onClick={() => {
            console.log('🔍 ManagePage: 点击铸币按钮');
            console.log('🔍 ManagePage: 当前用户:', currentUser);
            console.log('🔍 ManagePage: 用户组织:', currentUser?.organization);
            console.log('🔍 ManagePage: 是否央行用户:', isCentralBank);
            setMintModalVisible(true);
          }}>铸币</Button>
          <Button color="danger" style={{ marginLeft: 12 }} onClick={() => {
            console.log('🔍 ManagePage: 点击销毁按钮');
            console.log('🔍 ManagePage: 当前用户:', currentUser);
            console.log('🔍 ManagePage: 用户组织:', currentUser?.organization);
            console.log('🔍 ManagePage: 是否央行用户:', isCentralBank);
            setBurnModalVisible(true);
          }}>销毁</Button>
        </div>
        <div className="manage-title">全网交易记录</div>
        <TransactionList
          transactions={transactions}
          loading={loading}
          hasMore={false}
          onLoadMore={async () => {}}
        />
      </>
    );
  } else if (isOrgAdmin) {
    const orgTx = transactions.filter(tx => {
      // 只要from或to是本组织的用户
      return users.some(u => u.organization === currentUser.organization && (u.id === tx.from || u.id === tx.to));
    });
    content = (
      <>
        <div className="manage-title">本组织交易记录</div>
        <TransactionList
          transactions={orgTx}
          loading={loading}
          hasMore={false}
          onLoadMore={async () => {}}
        />
      </>
    );
  } else {
    content = <div className="manage-noauth">无管理权限</div>;
  }

  return (
    <div className="manage-page">
      {content}
      
      {/* 铸币模态框 */}
      <MintModal
        visible={mintModalVisible}
        onClose={() => setMintModalVisible(false)}
        currentUser={currentUser}
        onSuccess={async () => {
          console.log('🔍 ManagePage: 收到铸币成功回调');
          console.log('🔍 ManagePage: 当前用户:', currentUser);
          console.log('🔍 ManagePage: 当前交易记录数量:', transactions.length);
          
          // 刷新数据
          console.log('🔍 ManagePage: 开始刷新数据 - 余额和交易记录');
          console.log('🔍 ManagePage: 当前余额:', currentUser?.balance);
          
          try {
            // 刷新交易记录
            console.log('🔍 ManagePage: 刷新交易记录');
            await loadTransactions();
            
            // 刷新用户余额（通过context）
            console.log('🔍 ManagePage: 刷新用户余额');
            await refreshUserBalances();
            
            console.log('✅ ManagePage: 数据刷新完成');
          } catch (error) {
            console.error('❌ ManagePage: 数据刷新失败:', error);
          }
        }}
      />
      
      {/* 销毁模态框 */}
      <BurnModal
        visible={burnModalVisible}
        onClose={() => setBurnModalVisible(false)}
        currentUser={currentUser}
        onSuccess={async () => {
          console.log('🔍 ManagePage: 收到销毁成功回调');
          console.log('🔍 ManagePage: 当前用户:', currentUser);
          console.log('🔍 ManagePage: 当前交易记录数量:', transactions.length);
          
          // 刷新数据
          console.log('🔍 ManagePage: 开始刷新数据 - 余额和交易记录');
          console.log('🔍 ManagePage: 当前余额:', currentUser?.balance);
          
          try {
            // 刷新交易记录
            console.log('🔍 ManagePage: 刷新交易记录');
            await loadTransactions();
            
            // 刷新用户余额（通过context）
            console.log('🔍 ManagePage: 刷新用户余额');
            await refreshUserBalances();
            
            console.log('✅ ManagePage: 数据刷新完成');
          } catch (error) {
            console.error('❌ ManagePage: 数据刷新失败:', error);
          }
        }}
      />
    </div>
  );
};

export default ManagePage; 