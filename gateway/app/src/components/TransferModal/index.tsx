import React, { useState } from 'react';
import { Modal, Form, Input, Button, Toast, Selector } from 'antd-mobile';
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

  const handleSubmit = async (values: any) => {
    if (!currentUser) {
      Toast.show('请先选择用户');
      return;
    }

    setLoading(true);
    try {
      const result = await transfer(values.recipient, values.amount, currentUser.id);
      
      if (result.success) {
        Toast.show({
          content: '转账成功',
          icon: 'success'
        });
        form.resetFields();
        
        // 刷新用户余额
        await refreshUserBalances();
        
        onSuccess?.();
        onClose();
      } else {
        Toast.show({
          content: result.message || '转账失败',
          icon: 'fail'
        });
      }
    } catch (error) {
      console.error('转账失败:', error);
      Toast.show({
        content: '转账失败',
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
      return '请输入接收者地址';
    }
    if (address.length < 50) {
      return '地址长度不能少于50个字符';
    }
    if (address === currentUser?.id) {
      return '不能转账给自己';
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnMaskClick
      title="转账"
      content={
        <div className="transfer-modal">
          <div className="transfer-type-selector">
            <div className="transfer-type-label">转账类型:</div>
            <Selector
              options={[
                { label: '直接转账', value: 'direct' },
                { label: '授权转账', value: 'approve' }
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
              label="接收者地址"
              name="recipient"
              rules={[
                { required: true, message: '请输入接收者地址' },
                {
                  validator: (_, value) => {
                    const error = validateAddress(value);
                    return error ? Promise.reject(new Error(error)) : Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                placeholder="请输入接收者地址"
                type="text"
                maxLength={5000}
              />
            </Form.Item>

            <Form.Item
              label="转账金额"
              name="amount"
              rules={[
                { required: true, message: '请输入转账金额' },
                { pattern: /^[1-9]\d*$/, message: '请输入正整数' }
              ]}
            >
              <Input
                placeholder="请输入转账金额"
                type="text"
                inputMode="numeric"
              />
            </Form.Item>

            {transferType === 'approve' && (
              <Form.Item
                label="授权金额"
                name="approveAmount"
                rules={[
                  { required: true, message: '请输入授权金额' },
                  { pattern: /^[1-9]\d*$/, message: '请输入正整数' }
                ]}
              >
                <Input
                  placeholder="请输入授权金额"
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
                确认转账
              </Button>
              <Button
                block
                color="default"
                onClick={onClose}
                style={{ marginTop: 12 }}
              >
                取消
              </Button>
            </div>
          </Form>
        </div>
      }
    />
  );
};

export default TransferModal; 