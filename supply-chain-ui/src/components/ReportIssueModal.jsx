import { Modal, Form, Input, Button, Select } from 'antd';

const { TextArea } = Input;
const { Option } = Select;

const ReportIssueModal = ({
  visible,
  onCancel,
  onSubmit,
  loading,
}) => {
  const [form] = Form.useForm();

  const handleFormSubmit = async (values) => {
    await onSubmit(values.issueType, values.reason);
    form.resetFields();
  };

  return (
    <Modal
      title="Báo cáo sự cố sản phẩm"
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
          label="Loại sự cố"
          name="issueType"
          rules={[{ required: true, message: 'Vui lòng chọn loại sự cố' }]}
        >
          <Select placeholder="Chọn loại sự cố">
            <Option value="Damaged">Hư hỏng</Option>
            <Option value="Lost">Thất lạc</Option>
          </Select>
        </Form.Item>
        <Form.Item
          label="Lý do"
          name="reason"
          rules={[{ required: true, message: 'Vui lòng nhập lý do' }]}
        >
          <TextArea rows={3} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Báo cáo
          </Button>
          <Button onClick={onCancel} style={{ marginLeft: 8 }}>
            Hủy
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ReportIssueModal;
