import React, { useState } from 'react';
import { Modal, Form, Input, Button, Toast } from 'antd-mobile';
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

  const handleSubmit = async (values: any) => {
    console.log('🔍 BurnModal: 开始销毁操作');
    console.log('🔍 BurnModal: 当前用户:', currentUser);
    console.log('🔍 BurnModal: 表单数据:', values);
    
    if (!currentUser) {
      console.log('❌ BurnModal: 用户未选择');
      Toast.show('请先选择用户');
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
          content: '销毁成功',
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
          content: result.message || '销毁失败',
          icon: 'fail'
        });
      }
      
    } catch (error) {
      console.error('❌ BurnModal: 销毁失败:', error);
      Toast.show({
        content: '销毁失败',
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
      title="销毁"
      content={
        <div className="burn-modal">
          <div className="burn-description">
            <p>销毁操作将从指定用户账户减少代币</p>
            <p>此操作仅限央行用户执行，请谨慎操作</p>
          </div>

          <Form
            form={form}
            onFinish={handleSubmit}
            layout='vertical'
            className="burn-form"
          >
            <Form.Item
              label="销毁金额"
              name="amount"
              rules={[
                { required: true, message: '请输入销毁金额' },
                { pattern: /^[1-9]\d*$/, message: '请输入正整数' }
              ]}
            >
              <Input
                placeholder="请输入销毁金额"
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
                确认销毁
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

export default BurnModal; 