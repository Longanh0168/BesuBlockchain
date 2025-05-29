import { Modal, Button, Typography, Space, Descriptions, Tag } from 'antd';
const { Text } = Typography;

const getStateTagColor = (state) => {
  switch (state) {
    case 'PRODUCED': return 'blue';
    case 'IN_TRANSIT': return 'geekblue';
    case 'IN_TRANSIT_AT_TRANSPORTER': return 'volcano';
    case 'IN_TRANSIT_TO_DISTRIBUTOR': return 'magenta';
    case 'RECEIVED_AT_DISTRIBUTOR': return 'purple';
    case 'IN_TRANSIT_TO_RETAILER': return 'orange';
    case 'RECEIVED_AT_RETAILER': return 'green';
    case 'SOLD': return 'success';
    case 'DAMAGED': return 'red';
    case 'LOST': return 'gray';
    default: return 'default';
  }
};

const getStateTagName = (state) => {
  switch (state) {
    case 'PRODUCED': return 'Sản xuất';
    case 'IN_TRANSIT': return 'Đang vận chuyển';
    case 'IN_TRANSIT_AT_TRANSPORTER': return 'Đang vận chuyển (Tại người vận chuyển)';
    case 'IN_TRANSIT_TO_DISTRIBUTOR': return 'Đang vận chuyển (Tới nhà phân phối)';
    case 'RECEIVED_AT_DISTRIBUTOR': return 'Đã nhận tại nhà phân phối';
    case 'IN_TRANSIT_TO_RETAILER': return 'Đang vận chuyển (Tới nhà bán lẻ)';
    case 'RECEIVED_AT_RETAILER': return 'Đã nhận tại nhà bán lẻ';
    case 'SOLD': return 'Đã bán';
    case 'DAMAGED': return 'Bị hư hỏng';
    case 'LOST': return 'Bị thất lạc';
    default: return 'default';
  }
};

const CustomerPurchaseModal = ({ visible, onCancel, onSubmit, loading, itemDetails }) => {
  if (!itemDetails) {
    return null;
  }

  return (
    <Modal
      title="Xác nhận mua sản phẩm"
      visible={visible}
      onCancel={onCancel}
      footer={null}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text>Bạn đang chuẩn bị mua sản phẩm này:</Text>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Tên sản phẩm">{itemDetails.name}</Descriptions.Item>
          <Descriptions.Item label="Mô tả">{itemDetails.description}</Descriptions.Item>
          <Descriptions.Item label="Giá bán">
            <Text strong>{itemDetails.sellingPrice} SCC</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Chủ sở hữu hiện tại">
            {itemDetails.currentOwner}
          </Descriptions.Item>
          <Descriptions.Item label="Địa chỉ Chủ sở hữu">
            <Text style={{ fontSize: 12 }}>
                {itemDetails.currentOwnerAddress}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={getStateTagColor(itemDetails.currentState)}>{getStateTagName(itemDetails.currentState)}</Tag>
          </Descriptions.Item>
        </Descriptions>
        <Text type="secondary">
          Bạn sẽ thanh toán <Text strong>{itemDetails.sellingPrice} SCC</Text> cho nhà bán lẻ hiện tại.
          Vui lòng đảm bảo bạn có đủ số dư token và đã phê duyệt số lượng cần thiết cho hợp đồng.
        </Text>
      </Space>

      <div style={{ marginTop: 20, textAlign: 'right' }}>
        <Button onClick={onCancel} style={{ marginRight: 8 }}>
          Hủy
        </Button>
        <Button type="primary" onClick={onSubmit} loading={loading}>
          Xác nhận mua
        </Button>
      </div>
    </Modal>
  );
};

export default CustomerPurchaseModal;
