import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, Select, message } from 'antd';

const { Option } = Select;

const RevokeAccessModal = ({
  visible,
  onCancel,
  onSubmit,
  loading,
  roleOptions, // <-- PROP NÀY BÂY GIỜ CHỨA CÁC QUYỀN HIỆN CÓ
  initialAccountAddress,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && initialAccountAddress) {
      form.setFieldsValue({
        accountAddress: initialAccountAddress,
        role: undefined, // Xóa lựa chọn vai trò cũ khi mở modal
      });
    } else if (!visible) {
      form.resetFields();
    }
  }, [visible, initialAccountAddress, form]);

  const handleFormSubmit = async (values) => {
    await onSubmit(values.role, values.accountAddress);
  };

  return (
    <Modal
      title="Thu hồi quyền truy cập"
      visible={visible}
      onCancel={onCancel}
      footer={null}
      destroyOnClose={true}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFormSubmit}
      >
        <Form.Item
          label="Vai trò"
          name="role"
          rules={[{ required: true, message: 'Vui lòng chọn vai trò cần thu hồi' }]}
        >
          <Select placeholder="Chọn vai trò cần thu hồi">
            {/* roleOptions giờ đây đã được lọc từ AccessControl */}
            {roleOptions.map(role => (
              <Option key={role.value} value={role.value}>{role.label}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          label="Địa chỉ tài khoản"
          name="accountAddress"
          rules={[
            { required: true, message: 'Vui lòng nhập địa chỉ tài khoản' },
            { pattern: /^0x[a-fA-F0-9]{40}$/, message: 'Địa chỉ ví không hợp lệ' },
          ]}
        >
          <Input placeholder="0x..." readOnly={!!initialAccountAddress} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Thu hồi quyền
          </Button>
          <Button onClick={onCancel} style={{ marginLeft: 8 }}>
            Hủy
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RevokeAccessModal;