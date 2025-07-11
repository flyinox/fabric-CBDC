import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Toast, Selector } from 'antd-mobile';
import type { User } from '../../types';
import { transferFrom, getUsersWithBalances } from '../../services/walletApi';
import './index.css';

interface TransferFromModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSuccess?: () => void;
}

const TransferFromModal: React.FC<TransferFromModalProps> = ({
  visible,
  onClose,
  currentUser,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

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
      const result = await transferFrom(values.from, values.to, values.amount, currentUser.id);
      
      if (result.success) {
        Toast.show({
          content: '授权转账成功',
          icon: 'success'
        });
        form.resetFields();
        onSuccess?.();
        onClose();
      } else {
        Toast.show({
          content: result.message || '授权转账失败',
          icon: 'fail'
        });
      }
    } catch (error) {
      console.error('授权转账失败:', error);
      Toast.show({
        content: '授权转账失败',
        icon: 'fail'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFromChange = (value: string[]) => {
    if (value.length > 0) {
      form.setFieldValue('from', value[0]);
    }
  };

  const handleToChange = (value: string[]) => {
    if (value.length > 0) {
      form.setFieldValue('to', value[0]);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnMaskClick
      title="授权转账"
      content={
        <div className="transfer-from-modal">
          <div className="transfer-from-description">
            <p>使用被授权的代币进行转账操作</p>
            <p>您需要先获得代币所有者的授权才能执行此操作</p>
          </div>

          <Form
            form={form}
            onFinish={handleSubmit}
            layout='vertical'
            className="transfer-from-form"
          >
            <Form.Item
              label="代币所有者"
              name="from"
              rules={[{ required: true, message: '请选择代币所有者' }]}
            >
              <Selector
                options={users
                  .filter(user => user.id !== currentUser?.id)
                  .map(user => ({
                    label: `${user.name} (${user.organization})`,
                    value: user.id
                  }))}
                onChange={handleFromChange}
              />
            </Form.Item>

            <Form.Item
              label="接收者"
              name="to"
              rules={[{ required: true, message: '请选择接收者' }]}
            >
              <Selector
                options={users
                  .filter(user => user.id !== currentUser?.id)
                  .map(user => ({
                    label: `${user.name} (${user.organization})`,
                    value: user.id
                  }))}
                onChange={handleToChange}
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

            <div className="transfer-from-actions">
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

export default TransferFromModal; 