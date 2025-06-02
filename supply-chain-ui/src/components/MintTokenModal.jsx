import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, InputNumber } from 'antd';

const MintTokenModal = ({
  visible,
  onCancel,
  onSubmit,
  loading,
  initialAccountAddress,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && initialAccountAddress) {
      form.setFieldsValue({
        accountAddress: initialAccountAddress,
        amount: undefined, // Clear amount when opening
      });
    } else if (!visible) {
      form.resetFields(); // Reset form when modal closes
    }
  }, [visible, initialAccountAddress, form]);

  const handleFormSubmit = async (values) => {
    await onSubmit(values.accountAddress, values.amount);
  };

  return (
    <Modal
      title="Cấp SCC (Mint Token)"
      visible={visible}
      onCancel={onCancel}
      footer={null}
      destroyOnClose={true} // Ensures form resets on close
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFormSubmit}
      >
        <Form.Item
          label="Địa chỉ tài khoản nhận"
          name="accountAddress"
          rules={[
            { required: true, message: 'Vui lòng nhập địa chỉ tài khoản' },
            { pattern: /^0x[a-fA-F0-9]{40}$/, message: 'Địa chỉ ví không hợp lệ' },
          ]}
        >
            <Input placeholder="0x..." readOnly={!!initialAccountAddress} />
        </Form.Item>
        <Form.Item
          label="Số lượng SCC cần cấp"
          name="amount"
          rules={[
            { required: true, message: 'Vui lòng nhập số lượng SCC' },
            { type: 'number', min: 0.000001, message: 'Số lượng phải là số dương' }, // Đảm bảo số dương và có thể là số thập phân nhỏ
          ]}
        >
          <InputNumber min={0.000001} step={0.000001} style={{ width: '100%' }} placeholder="Ví dụ: 100" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Cấp SCC
          </Button>
          <Button onClick={onCancel} style={{ marginLeft: 8 }}>
            Hủy
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MintTokenModal;
