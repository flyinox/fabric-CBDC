import React, { useState } from 'react';
import { Modal, Form, Input, Button, Toast } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { mint } from '../../services/walletApi';
import './index.css';

interface MintModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSuccess?: () => void;
}

const MintModal: React.FC<MintModalProps> = ({
  visible,
  onClose,
  currentUser,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (values: any) => {
    console.log('🔍 MintModal: 开始铸币操作');
    console.log('🔍 MintModal: 当前用户:', currentUser);
    console.log('🔍 MintModal: 表单数据:', values);
    
    if (!currentUser) {
      console.log('❌ MintModal: 用户未选择');
      Toast.show(t('common.pleaseSelectUser'));
      return;
    }

    setLoading(true);
    console.log('🔍 MintModal: 设置loading状态为true');
    
    try {
      console.log('🔍 MintModal: 准备调用铸币API');
      console.log('🔍 MintModal: 铸币金额:', values.amount);
      console.log('🔍 MintModal: 操作用户ID:', currentUser.id);
      
      // 调用真实铸币API
      console.log('🔍 MintModal: 调用mint API');
      const result = await mint(values.amount, currentUser.id);
      console.log('🔍 MintModal: API返回结果:', result);
      
      if (result.success) {
        console.log('🔍 MintModal: 铸币成功');
        Toast.show({
          content: t('messages.mintSuccess'),
          icon: 'success'
        });
        
        console.log('🔍 MintModal: 重置表单');
        form.resetFields();
        
        console.log('🔍 MintModal: 调用onSuccess回调');
        onSuccess?.();
        
        console.log('🔍 MintModal: 关闭弹窗');
        onClose();
        
        console.log('✅ MintModal: 铸币操作流程完成');
      } else {
        console.log('❌ MintModal: 铸币失败:', result.message);
        Toast.show({
          content: result.message || t('messages.mintFailed'),
          icon: 'fail'
        });
      }
      
    } catch (error) {
      console.error('❌ MintModal: 铸币失败:', error);
      Toast.show({
        content: t('messages.mintFailed'),
        icon: 'fail'
      });
    } finally {
      console.log('🔍 MintModal: 设置loading状态为false');
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnMaskClick
      title={t('modals.mint.title')}
      content={
        <div className="mint-modal">
          <div className="mint-description">
            <p>{t('modals.mint.description1')}</p>
            <p>{t('modals.mint.description2')}</p>
          </div>

          <Form
            form={form}
            onFinish={handleSubmit}
            layout='vertical'
            className="mint-form"
          >
            <Form.Item
              label={t('modals.mint.mintAmount')}
              name="amount"
              rules={[
                { required: true, message: t('validation.pleaseEnterMintAmount') },
                { pattern: /^[1-9]\d*$/, message: t('validation.pleaseEnterPositiveInteger') }
              ]}
            >
              <Input
                placeholder={t('modals.mint.amountPlaceholder')}
                type="text"
                inputMode="numeric"
              />
            </Form.Item>

            <div className="mint-actions">
              <Button
                block
                color="primary"
                type="submit"
                loading={loading}
                disabled={!currentUser}
              >
                {t('modals.mint.confirmMint')}
              </Button>
              <Button
                block
                color="default"
                onClick={onClose}
                style={{ marginTop: 12 }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </Form>
        </div>
      }
    />
  );
};

export default MintModal; 