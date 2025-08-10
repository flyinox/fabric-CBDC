import React, { useState } from 'react';
import { Modal, Form, Input, Button, Toast } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { approve } from '../../services/walletApi';
import './index.css';

interface ApproveModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSuccess?: () => void;
  maxAmount?: number; // 最大可授权金额
}

const ApproveModal: React.FC<ApproveModalProps> = ({
  visible,
  onClose,
  currentUser,
  onSuccess,
  maxAmount
}) => {
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
      const result = await approve(values.spender, values.amount, currentUser.id);
      
      if (result.success) {
        Toast.show({
          content: t('messages.approveSuccess'),
          icon: 'success'
        });
        form.resetFields();
        onSuccess?.();
        onClose();
      } else {
        Toast.show({
          content: result.message || t('messages.approveFailed'),
          icon: 'fail'
        });
      }
    } catch (error) {
      console.error('授权失败:', error);
      Toast.show({
        content: t('messages.approveFailed'),
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
      return t('validation.pleaseEnterSpender');
    }
    if (address.length < 50) {
      return t('validation.addressTooShort');
    }
    if (address === currentUser?.id) {
      return t('validation.cannotApproveToSelf');
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnMaskClick
      title={t('modals.approve.title')}
      content={
        <div className="approve-modal">
          <div className="approve-description">
            <p>{t('modals.approve.description1')}</p>
            <p>{t('modals.approve.description2')}</p>
          </div>

          <Form
            form={form}
            onFinish={handleSubmit}
            layout='vertical'
            className="approve-form"
          >
            <Form.Item
              label={t('modals.approve.spenderAddress')}
              name="spender"
              rules={[
                { required: true, message: t('validation.pleaseEnterSpender') },
                {
                  validator: (_, value) => {
                    const error = validateAddress(value);
                    return error ? Promise.reject(new Error(error)) : Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                placeholder={t('modals.approve.spenderPlaceholder')}
                type="text"
                maxLength={500}
              />
            </Form.Item>

            <Form.Item
              label={t('modals.approve.approveAmount')}
              name="amount"
              rules={[
                { required: true, message: t('validation.pleaseEnterApproveAmount') },
                { pattern: /^[1-9]\d*$/, message: t('validation.pleaseEnterPositiveInteger') },
                {
                  validator: (_, value) => {
                    if (maxAmount !== undefined && parseInt(value) > maxAmount) {
                      return Promise.reject(new Error(t('validation.approveAmountExceedsMax', { maxAmount })));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                placeholder={t('modals.approve.amountPlaceholder', { maxAmount: maxAmount || t('common.unlimited') })}
                type="text"
                inputMode="numeric"
              />
            </Form.Item>
            
            {maxAmount !== undefined && maxAmount > 0 && (
              <div className="max-amount-info">
                <span>{t('modals.approve.maxAmountInfo', { amount: maxAmount })}</span>
              </div>
            )}

            <div className="approve-actions">
              <Button
                block
                color="primary"
                type="submit"
                loading={loading}
                disabled={!currentUser}
              >
                {t('modals.approve.confirmApprove')}
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

export default ApproveModal; 