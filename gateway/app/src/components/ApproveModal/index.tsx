import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Toast, Selector } from 'antd-mobile';
import type { User } from '../../types';
import { approve, getUsersWithBalances } from '../../services/walletApi';
import './index.css';

interface ApproveModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSuccess?: () => void;
}

const ApproveModal: React.FC<ApproveModalProps> = ({
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
      const result = await approve(values.spender, values.amount, currentUser.id);
      
      if (result.success) {
        Toast.show({
          content: '授权成功',
          icon: 'success'
        });
        form.resetFields();
        onSuccess?.();
        onClose();
      } else {
        Toast.show({
          content: result.message || '授权失败',
          icon: 'fail'
        });
      }
    } catch (error) {
      console.error('授权失败:', error);
      Toast.show({
        content: '授权失败',
        icon: 'fail'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSpenderChange = (value: string[]) => {
    if (value.length > 0) {
      form.setFieldValue('spender', value[0]);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      closeOnMaskClick
      title="批准授权"
      content={
        <div className="approve-modal">
          <div className="approve-description">
            <p>授权允许其他用户使用您的代币进行转账操作</p>
            <p>授权后，被授权者可以在授权额度内使用您的代币</p>
          </div>

          <Form
            form={form}
            onFinish={handleSubmit}
            layout='vertical'
            className="approve-form"
          >
            <Form.Item
              label="被授权者"
              name="spender"
              rules={[{ required: true, message: '请选择被授权者' }]}
            >
              <Selector
                options={users
                  .filter(user => user.id !== currentUser?.id)
                  .map(user => ({
                    label: `${user.name} (${user.organization})`,
                    value: user.id
                  }))}
                onChange={handleSpenderChange}
              />
            </Form.Item>

            <Form.Item
              label="授权金额"
              name="amount"
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

            <div className="approve-actions">
              <Button
                block
                color="primary"
                type="submit"
                loading={loading}
                disabled={!currentUser}
              >
                确认授权
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

export default ApproveModal; 