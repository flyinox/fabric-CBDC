import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Toast, Selector } from 'antd-mobile';
import type { User } from '../../types';
import { transfer, getUsersWithBalances } from '../../services/walletApi';
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
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [transferType, setTransferType] = useState<'direct' | 'approve'>('direct');

  useEffect(() => {
    if (visible) {
      loadUsers();
    }
  }, [visible]);

  const loadUsers = async () => {
    try {
      const userList = await getUsersWithBalances();
      setUsers(userList);
    } catch (error) {
      console.error('加载用户列表失败:', error);
    }
  };

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

  const handleRecipientChange = (value: string[]) => {
    if (value.length > 0) {
      form.setFieldValue('recipient', value[0]);
    }
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
              label="接收者"
              name="recipient"
              rules={[{ required: true, message: '请选择接收者' }]}
            >
              <Selector
                options={users
                  .filter(user => user.id !== currentUser?.id)
                  .map(user => ({
                    label: `${user.name} (${user.organization})`,
                    value: user.id
                  }))}
                onChange={handleRecipientChange}
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