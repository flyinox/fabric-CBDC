import React, { useState } from 'react';
import { Modal, Form, Input, Button, Toast, Selector } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { transfer } from '../../services/walletApi';
import { useUserContext } from '../../context/UserContext';
import './index.css';

interface TransferModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSuccess?: () => void;
}

const TransferModal: React.FC<TransferModalProps> = ({
  visible,
  onClose,
  currentUser,
  onSuccess
}) => {
  const { refreshUserBalances } = useUserContext();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [transferType, setTransferType] = useState<'direct' | 'approve'>('direct');
  const { t } = useTranslation();

  const handleSubmit = async (values: any) => {
    if (!currentUser) {
      Toast.show(t('common.pleaseSelectUser'));
      return;
    }

    setLoading(true);
    try {
      const result = await transfer(values.recipient, values.amount, currentUser.id);
      
      if (result.success) {
        Toast.show({
          content: t('messages.transferSuccess'),
          icon: 'success'
        });
        form.resetFields();
        
        // 刷新用户余额
        await refreshUserBalances();
        
        onSuccess?.();
        onClose();
      } else {
        Toast.show({
          content: result.message || t('messages.transferFailed'),
          icon: 'fail'
        });
      }
    } catch (error) {
      console.error('转账失败:', error);
      Toast.show({
        content: t('messages.transferFailed'),
        icon: 'fail'
      });
    } finally {
      setLoading(false);
    }
  };

  // 验证地址格式
  const validateAddress = (address: string) => {
    // 简单的地址格式验证，可以根据实际需求调整
    if (!address || address.trim() === '') {
      return t('validation.pleaseEnterRecipient');
    }
    if (address.length < 50) {
      return t('validation.addressTooShort');
    }
    if (address === currentUser?.id) {
      return t('validation.cannotTransferToSelf');
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnMaskClick
      title={t('modals.transfer.title')}
      content={
        <div className="transfer-modal">
          <div className="transfer-type-selector">
            <div className="transfer-type-label">{t('modals.transfer.transferType')}</div>
            <Selector
              options={[
                { label: t('modals.transfer.directTransfer'), value: 'direct' },
                { label: t('modals.transfer.approveTransfer'), value: 'approve' }
              ]}
              value={[transferType]}
              onChange={(arr) => setTransferType(arr[0] as 'direct' | 'approve')}
            />
          </div>

          <Form
            form={form}
            onFinish={handleSubmit}
            layout='vertical'
            className="transfer-form"
          >
            <Form.Item
              label={t('modals.transfer.recipientAddress')}
              name="recipient"
              rules={[
                { required: true, message: t('validation.pleaseEnterRecipient') },
                {
                  validator: (_, value) => {
                    const error = validateAddress(value);
                    return error ? Promise.reject(new Error(error)) : Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                placeholder={t('modals.transfer.recipientPlaceholder')}
                type="text"
                maxLength={5000}
              />
            </Form.Item>

            <Form.Item
              label={t('modals.transfer.transferAmount')}
              name="amount"
              rules={[
                { required: true, message: t('validation.pleaseEnterAmount') },
                { pattern: /^[1-9]\d*$/, message: t('validation.pleaseEnterPositiveInteger') }
              ]}
            >
              <Input
                placeholder={t('modals.transfer.amountPlaceholder')}
                type="text"
                inputMode="numeric"
              />
            </Form.Item>

            {transferType === 'approve' && (
              <Form.Item
                label={t('modals.transfer.approveAmount')}
                name="approveAmount"
                rules={[
                  { required: true, message: t('validation.pleaseEnterApproveAmount') },
                  { pattern: /^[1-9]\d*$/, message: t('validation.pleaseEnterPositiveInteger') }
                ]}
              >
                <Input
                  placeholder={t('modals.transfer.approvePlaceholder')}
                  type="text"
                  inputMode="numeric"
                />
              </Form.Item>
            )}

            <div className="transfer-actions">
              <Button
                block
                color="primary"
                type="submit"
                loading={loading}
                disabled={!currentUser}
              >
                {t('modals.transfer.confirmTransfer')}
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

export default TransferModal; 