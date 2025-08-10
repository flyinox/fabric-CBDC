import React, { useState } from 'react';
import { Modal, Form, Input, Button, Toast } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { transferFrom } from '../../services/walletApi';
import { useUserContext } from '../../context/UserContext';
import './index.css';

interface TransferFromModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TransferFromModal: React.FC<TransferFromModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  const { currentUser, refreshUserBalances } = useUserContext();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (values: any) => {
    if (!currentUser) {
      Toast.show(t('common.pleaseSelectUser'));
      return;
    }

    setLoading(true);
    try {
      const result = await transferFrom(values.from, values.to, values.amount, currentUser.id);
      
      if (result.success) {
        Toast.show({
          content: t('messages.authTransferSuccess'),
          icon: 'success'
        });
        form.resetFields();
        
        // 刷新用户余额
        await refreshUserBalances();
        
        onSuccess?.();
        onClose();
      } else {
        Toast.show({
          content: result.message || t('messages.authTransferFailed'),
          icon: 'fail'
        });
      }
    } catch (error: any) {
      Toast.show({
        content: t('messages.authTransferFailed'),
        icon: 'fail'
      });
    } finally {
      setLoading(false);
    }
  };

  // 验证地址格式
  const validateAddress = (address: string, fieldName: string) => {
    // 简单的地址格式验证，可以根据实际需求调整
    if (!address || address.trim() === '') {
      return fieldName === t('modals.transferFrom.ownerAddress') ? 
        t('validation.pleaseEnterOwner') : 
        t('validation.pleaseEnterRecipient');
    }
    if (address.length < 50) {
      return t('validation.addressTooShort');
    }
    if (address === currentUser?.id) {
      return t('validation.cannotUseSelfAsOwner', { fieldName });
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnMaskClick
      title={t('modals.transferFrom.title')}
      content={
        <div className="transfer-from-modal">
          <div className="transfer-from-description">
            <p>{t('modals.transferFrom.description1')}</p>
            <p>{t('modals.transferFrom.description2')}</p>
          </div>

          <Form
            form={form}
            onFinish={handleSubmit}
            layout='vertical'
            className="transfer-from-form"
          >
            <Form.Item
              label={t('modals.transferFrom.ownerAddress')}
              name="from"
              rules={[
                { required: true, message: t('validation.pleaseEnterOwner') },
                {
                  validator: (_, value) => {
                    const error = validateAddress(value, t('modals.transferFrom.ownerAddress'));
                    return error ? Promise.reject(new Error(error)) : Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                placeholder={t('modals.transferFrom.ownerPlaceholder')}
                type="text"
                maxLength={500}
              />
            </Form.Item>
            
            <Form.Item
              label={t('modals.transferFrom.recipientAddress')}
              name="to"
              rules={[
                { required: true, message: t('validation.pleaseEnterRecipient') },
                {
                  validator: (_, value) => {
                    const error = validateAddress(value, t('modals.transferFrom.recipientAddress'));
                    return error ? Promise.reject(new Error(error)) : Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                placeholder={t('modals.transferFrom.recipientPlaceholder')}
                type="text"
                maxLength={500}
              />
            </Form.Item>
            
            <Form.Item
              name='amount'
              label={t('modals.transferFrom.transferAmount')}
              rules={[
                { required: true, message: t('validation.pleaseEnterAmount') },
                { pattern: /^[1-9]\d*$/, message: t('validation.pleaseEnterPositiveInteger') }
              ]}
            >
              <Input
                placeholder={t('modals.transferFrom.amountPlaceholder')}
                type="text"
                inputMode="numeric"
              />
            </Form.Item>
            
            <div className="transfer-from-actions">
              <Button
                block
                color="primary"
                type="submit"
                loading={loading}
                disabled={!currentUser}
              >
                {t('modals.transferFrom.confirmTransfer')}
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

export default TransferFromModal; 