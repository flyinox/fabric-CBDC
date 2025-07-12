import React, { useState } from 'react';
import { Modal, Form, Input, Button, Toast } from 'antd-mobile';
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
        
        // 刷新用户余额
        await refreshUserBalances();
        
        onSuccess?.();
        onClose();
      } else {
        Toast.show({
          content: result.message || '授权转账失败',
          icon: 'fail'
        });
      }
    } catch (error: any) {
      Toast.show({
        content: '授权转账失败',
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
      return `请输入${fieldName}地址`;
    }
    if (address.length < 50) {
      return '地址长度不能少于50个字符';
    }
    if (address === currentUser?.id) {
      return `不能使用自己的地址作为${fieldName}`;
    }
    return null;
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
              label="代币所有者地址"
              name="from"
              rules={[
                { required: true, message: '请输入代币所有者地址' },
                {
                  validator: (_, value) => {
                    const error = validateAddress(value, '代币所有者');
                    return error ? Promise.reject(new Error(error)) : Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                placeholder="请输入代币所有者地址"
                type="text"
                maxLength={500}
              />
            </Form.Item>
            
            <Form.Item
              label="接收者地址"
              name="to"
              rules={[
                { required: true, message: '请输入接收者地址' },
                {
                  validator: (_, value) => {
                    const error = validateAddress(value, '接收者');
                    return error ? Promise.reject(new Error(error)) : Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                placeholder="请输入接收者地址"
                type="text"
                maxLength={500}
              />
            </Form.Item>
            
            <Form.Item
              name='amount'
              label='转账金额'
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