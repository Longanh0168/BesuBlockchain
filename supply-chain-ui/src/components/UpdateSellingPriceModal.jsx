import React from 'react';
import { Modal, Form, InputNumber, Button } from 'antd';

const UpdateSellingPriceModal = ({
  visible,
  onCancel,
  onSubmit, // Hàm xử lý submit từ component cha
  initialPrice,
  loading,
}) => {
  const [form] = Form.useForm();

  // Đặt giá trị ban đầu cho form khi modal hiển thị
  React.useEffect(() => {
    if (visible && initialPrice) {
      form.setFieldsValue({ newSellingPrice: initialPrice });
    }
  }, [visible, initialPrice, form]);

  const handleFormSubmit = async (values) => {
    // Gọi hàm onSubmit được truyền từ component cha
    await onSubmit(values.newSellingPrice);
    form.resetFields(); // Reset form sau khi submit (hoặc hủy)
  };

  return (
    <Modal
      title="Cập nhật giá bán sản phẩm"
      visible={visible}
      onCancel={onCancel}
      footer={null} // Tùy chỉnh footer nếu muốn
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFormSubmit}
      >
        <Form.Item
          label="Giá bán mới (SCC)"
          name="newSellingPrice"
          rules={[{ required: true, message: 'Vui lòng nhập giá bán mới' }]}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Xác nhận cập nhật
          </Button>
          <Button onClick={onCancel} style={{ marginLeft: 8 }}>
            Hủy
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default UpdateSellingPriceModal;