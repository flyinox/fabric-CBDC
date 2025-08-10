import React, { useState, useEffect } from 'react';
import { Button } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import { useUserContext } from '../../context/UserContext';
import MintModal from '../../components/MintModal';
import BurnModal from '../../components/BurnModal';
import ManageRecords from './ManageRecords';
import './index.css';

// 从配置文件读取央行信息
const getCentralBankInfo = async () => {
  try {
    const response = await fetch('/api/network-config');
    if (response.ok) {
      const config = await response.json();
      return {
        centralBankId: config._central_bank,
        centralBankName: config.network.organizations.find((org: any) => org.type === 'central_bank')?.name || 'c1'
      };
    }
  } catch (error) {
    console.error('获取网络配置失败:', error);
  }
  // 默认值
  return { centralBankId: 'c1', centralBankName: 'c1' };
};

const ManagePage: React.FC = () => {
  const { currentUser, users, switchingUser, refreshUserBalances } = useUserContext();
  const [mintModalVisible, setMintModalVisible] = useState(false);
  const [burnModalVisible, setBurnModalVisible] = useState(false);
  const [centralBankInfo, setCentralBankInfo] = useState({ centralBankId: 'c1', centralBankName: 'c1' });
  const { t } = useTranslation();

  useEffect(() => {
    // 加载央行信息
    getCentralBankInfo().then(setCentralBankInfo);
  }, []);

  useEffect(() => {
    console.log('🔍 ManagePage: useEffect触发，currentUser变化');
    console.log('🔍 ManagePage: 新的currentUser:', currentUser);
  }, [currentUser]);

  if (!currentUser || switchingUser) {
    return (
      <div className="manage-page loading">
        {switchingUser ? t('common.switchingUser') : t('common.loading')}
      </div>
    );
  }

  // 角色判断 - 使用动态读取的央行信息
  const isCentralBank = currentUser.organization === centralBankInfo.centralBankName;
  const isOrgAdmin = currentUser.name.startsWith('Admin@') && currentUser.organization !== centralBankInfo.centralBankName;
  
  console.log('🔍 ManagePage: 角色判断结果');
  console.log('🔍 ManagePage: 用户组织:', currentUser?.organization);
  console.log('🔍 ManagePage: 央行名称:', centralBankInfo.centralBankName);
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
          }}>{t('manage.mint')}</Button>
          <Button color="danger" style={{ marginLeft: 12 }} onClick={() => {
            console.log('🔍 ManagePage: 点击销毁按钮');
            console.log('🔍 ManagePage: 当前用户:', currentUser);
            console.log('🔍 ManagePage: 用户组织:', currentUser?.organization);
            console.log('🔍 ManagePage: 是否央行用户:', isCentralBank);
            setBurnModalVisible(true);
          }}>{t('manage.burn')}</Button>
        </div>
        <div className="manage-title">{t('manage.networkRecords')}</div>
        <ManageRecords
          user={currentUser}
          users={users}
          isCentralBank={true}
          pageSize={10}
        />
      </>
    );
  } else if (isOrgAdmin) {
    content = (
      <>
        <div className="manage-title">{t('manage.orgRecords')}</div>
        <ManageRecords
          user={currentUser}
          users={users}
          isCentralBank={false}
          pageSize={10}
        />
      </>
    );
  } else {
    content = <div className="manage-noauth">{t('manage.noPermission')}</div>;
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
          
          // 刷新数据
          console.log('🔍 ManagePage: 开始刷新数据 - 余额');
          console.log('🔍 ManagePage: 当前余额:', currentUser?.balance);
          
          try {
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
          
          // 刷新数据
          console.log('🔍 ManagePage: 开始刷新数据 - 余额');
          console.log('🔍 ManagePage: 当前余额:', currentUser?.balance);
          
          try {
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