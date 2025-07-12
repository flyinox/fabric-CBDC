import React, { useState } from 'react';
import { Modal, Form, Input, Button, Toast } from 'antd-mobile';
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

  // 验证地址格式
  const validateAddress = (address: string) => {
    // 简单的地址格式验证，可以根据实际需求调整
    if (!address || address.trim() === '') {
      return '请输入被授权者地址';
    }
    if (address.length < 50) {
      return '地址长度不能少于50个字符';
    }
    if (address === currentUser?.id) {
      return '不能授权给自己';
    }
    return null;
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
              label="被授权者地址"
              name="spender"
              rules={[
                { required: true, message: '请输入被授权者地址' },
                {
                  validator: (_, value) => {
                    const error = validateAddress(value);
                    return error ? Promise.reject(new Error(error)) : Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                placeholder="请输入被授权者地址"
                type="text"
                maxLength={500}
              />
            </Form.Item>

            <Form.Item
              label="授权金额"
              name="amount"
              rules={[
                { required: true, message: '请输入授权金额' },
                { pattern: /^[1-9]\d*$/, message: '请输入正整数' },
                {
                  validator: (_, value) => {
                    if (maxAmount !== undefined && parseInt(value) > maxAmount) {
                      return Promise.reject(new Error(`授权金额不能超过可授权金额 ¥${maxAmount}`));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                placeholder={`请输入授权金额 (最大: ¥${maxAmount || '无限制'})`}
                type="text"
                inputMode="numeric"
              />
            </Form.Item>
            
            {maxAmount !== undefined && maxAmount > 0 && (
              <div className="max-amount-info">
                <span>可授权金额: ¥{maxAmount}</span>
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