import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, message } from 'antd';
import { ethers } from 'ethers';
import { getNameByAddress, getAddressByName } from '../utils/roles'; // Đảm bảo có hàm getAddressByName

const { Option } = Select;

const InitiateTransferModal = ({
  visible,
  onCancel,
  onSubmit,
  loading,
  currentOwnerRole, // Thêm prop này để biết vai trò của chủ sở hữu hiện tại
}) => {
  const [form] = Form.useForm();
  const [recipientRoles, setRecipientRoles] = useState([]);

  // Cập nhật danh sách vai trò người nhận dựa trên vai trò của chủ sở hữu hiện tại
  useEffect(() => {
    let allowedRoles = [];
    if (currentOwnerRole === 'PRODUCER') {
      allowedRoles = ['TRANSPORTER', 'DISTRIBUTOR', 'RETAILER'];
    } else if (currentOwnerRole === 'TRANSPORTER') {
      allowedRoles = ['DISTRIBUTOR', 'RETAILER'];
    } else if (currentOwnerRole === 'DISTRIBUTOR') {
      allowedRoles = ['RETAILER'];
    }
    setRecipientRoles(allowedRoles);
    form.resetFields(); // Reset form khi vai trò thay đổi
  }, [currentOwnerRole, form]);

  const handleFormSubmit = async (values) => {
    const recipientAddress = getAddressByName(values.recipient);
    if (!recipientAddress || recipientAddress === ethers.ZeroAddress) {
      message.error("Địa chỉ người nhận không hợp lệ.");
      return;
    }
    await onSubmit(recipientAddress);
    form.resetFields();
  };

  return (
    <Modal
      title="Khởi tạo chuyển giao sản phẩm"
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
          label="Chọn người nhận"
          name="recipient"
          rules={[{ required: true, message: 'Vui lòng chọn người nhận' }]}
        >
          <Select placeholder="Chọn vai trò của người nhận">
            {recipientRoles.map(role => (
              <Option key={role} value={role}>
                {getNameByAddress(getAddressByName(role))} ({getAddressByName(role)})
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Khởi tạo chuyển giao
          </Button>
          <Button onClick={onCancel} style={{ marginLeft: 8 }}>
            Hủy
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default InitiateTransferModal;
