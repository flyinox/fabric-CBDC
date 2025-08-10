import React, { useState } from 'react';
import { Modal, Form, Input, Button, Toast } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { burn } from '../../services/walletApi';
import './index.css';

interface BurnModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSuccess?: () => void;
}

const BurnModal: React.FC<BurnModalProps> = ({
  visible,
  onClose,
  currentUser,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (values: any) => {
    console.log('🔍 BurnModal: 开始销毁操作');
    console.log('🔍 BurnModal: 当前用户:', currentUser);
    console.log('🔍 BurnModal: 表单数据:', values);
    
    if (!currentUser) {
      console.log('❌ BurnModal: 用户未选择');
      Toast.show(t('common.pleaseSelectUser'));
      return;
    }

    setLoading(true);
    console.log('🔍 BurnModal: 设置loading状态为true');
    
    try {
      console.log('🔍 BurnModal: 准备调用销毁API');
      console.log('🔍 BurnModal: 销毁金额:', values.amount);
      console.log('🔍 BurnModal: 操作用户ID:', currentUser.id);
      
      // 调用真实销毁API
      console.log('🔍 BurnModal: 调用burn API');
      const result = await burn(values.amount, currentUser.id);
      console.log('🔍 BurnModal: API返回结果:', result);
      
      if (result.success) {
        console.log('🔍 BurnModal: 销毁成功');
        Toast.show({
          content: t('messages.burnSuccess'),
          icon: 'success'
        });
        
        console.log('🔍 BurnModal: 重置表单');
        form.resetFields();
        
        console.log('🔍 BurnModal: 调用onSuccess回调');
        onSuccess?.();
        
        console.log('🔍 BurnModal: 关闭弹窗');
        onClose();
        
        console.log('✅ BurnModal: 销毁操作流程完成');
      } else {
        console.log('❌ BurnModal: 销毁失败:', result.message);
        Toast.show({
          content: result.message || t('messages.burnFailed'),
          icon: 'fail'
        });
      }
      
    } catch (error) {
      console.error('❌ BurnModal: 销毁失败:', error);
      Toast.show({
        content: t('messages.burnFailed'),
        icon: 'fail'
      });
    } finally {
      console.log('🔍 BurnModal: 设置loading状态为false');
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnMaskClick
      title={t('modals.burn.title')}
      content={
        <div className="burn-modal">
          <div className="burn-description">
            <p>{t('modals.burn.description1')}</p>
            <p>{t('modals.burn.description2')}</p>
          </div>

          <Form
            form={form}
            onFinish={handleSubmit}
            layout='vertical'
            className="burn-form"
          >
            <Form.Item
              label={t('modals.burn.burnAmount')}
              name="amount"
              rules={[
                { required: true, message: t('validation.pleaseEnterBurnAmount') },
                { pattern: /^[1-9]\d*$/, message: t('validation.pleaseEnterPositiveInteger') }
              ]}
            >
              <Input
                placeholder={t('modals.burn.amountPlaceholder')}
                type="text"
                inputMode="numeric"
              />
            </Form.Item>

            <div className="burn-actions">
              <Button
                block
                color="danger"
                type="submit"
                loading={loading}
                disabled={!currentUser}
              >
                {t('modals.burn.confirmBurn')}
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

export default BurnModal; 