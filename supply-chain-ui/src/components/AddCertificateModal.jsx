import React from 'react';
import { Modal, Form, Input, Button } from 'antd';

const AddCertificateModal = ({
  visible,
  onCancel,
  onSubmit, // Hàm xử lý submit từ component cha
  loading,
}) => {
  const [form] = Form.useForm();

  const handleFormSubmit = async (values) => {
    await onSubmit(values.certName, values.certIssuer);
    form.resetFields(); // Reset form sau khi submit (hoặc hủy)
  };

  return (
    <Modal
      title="Thêm chứng chỉ cho sản phẩm"
      visible={visible}
      onCancel={onCancel}
      footer={null}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFormSubmit}
      >
        <Form.Item
          label="Tên chứng chỉ"
          name="certName"
          rules={[{ required: true, message: 'Vui lòng nhập tên chứng chỉ' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Đơn vị cấp"
          name="certIssuer"
          rules={[{ required: true, message: 'Vui lòng nhập đơn vị cấp' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Thêm chứng chỉ
          </Button>
          <Button onClick={onCancel} style={{ marginLeft: 8 }}>
            Hủy
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddCertificateModal;