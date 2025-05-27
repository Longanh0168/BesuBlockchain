import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import contractArtifact from '../artifacts/contracts/SupplyChainTracking.sol/SupplyChainTracking.json';
import { keccak256, toUtf8Bytes } from 'ethers';
import { CONTRACT_ADDRESS } from '../config';
import { useSearchParams } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  message,
  Typography,
  Card,
  Descriptions,
  Table,
  Spin,
  Empty
} from 'antd';
import moment from 'moment';

const { Title } = Typography;

const StateMap = {
  0: 'Produced',
  1: 'InTransit',
  2: 'ReceivedAtDistributor',
  3: 'InTransitToRetailer',
  4: 'Delivered',
  5: 'Received',
  6: 'Sold',
  7: 'Damaged',
  8: 'Lost',
};

const ItemDetail = () => {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [itemDetails, setItemDetails] = useState(null);
  const [itemHistory, setItemHistory] = useState([]);
  const [itemCertificates, setItemCertificates] = useState([]);
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();

  // Hàm xử lý tìm kiếm, được bọc trong useCallback để tránh re-render không cần thiết
  // Dependency: contract (đảm bảo contract đã được khởi tạo)
  const handleSearch = useCallback(async (values) => {
    // Kiểm tra contract đã sẵn sàng trước khi thực hiện tìm kiếm
    if (!contract) {
      console.warn("Contract not ready when handleSearch was called.");
      return;
    }

    setLoading(true);
    setItemDetails(null);
    setItemHistory([]);
    setItemCertificates([]);

    try {
      const itemIdBytes32 = keccak256(toUtf8Bytes(values.itemId));

      const details = await contract.getItemDetail(itemIdBytes32);

      if (!details.exists) {
        message.warning("Mặt hàng không tồn tại hoặc ID không đúng.");
        setLoading(false);
        return;
      }

      setItemDetails({
        id: values.itemId,
        name: details.name,
        description: details.description,
        currentOwner: details.currentOwner,
        currentState: StateMap[details.currentState],
        exists: details.exists,
        plannedDeliveryTime: moment.unix(Number(details.plannedDeliveryTime)).format('YYYY-MM-DD HH:mm:ss'),
        costPrice: ethers.formatUnits(details.costPrice, 18),
        sellingPrice: ethers.formatUnits(details.sellingPrice, 18),
      });

      const history = await contract.getItemHistory(itemIdBytes32);
      const formattedHistory = history.map((h, index) => ({
        key: index,
        state: StateMap[h.state],
        actor: h.actor,
        timestamp: moment.unix(Number(h.timestamp)).format('YYYY-MM-DD HH:mm:ss'),
        note: h.note,
      }));
      setItemHistory(formattedHistory);

      const certificates = await contract.getCertificates(itemIdBytes32);
      const formattedCertificates = certificates.map((cert, index) => ({
        key: index,
        certName: cert.certName,
        certIssuer: cert.certIssuer,
        issueDate: moment.unix(Number(cert.issueDate)).format('YYYY-MM-DD HH:mm:ss'),
      }));
      setItemCertificates(formattedCertificates);

      message.success("Tải thông tin mặt hàng thành công!");
    } catch (err) {
      console.error("Lỗi khi tải thông tin mặt hàng:", err);
      message.error("Lỗi khi tải thông tin mặt hàng: " + err.message);
    }
    setLoading(false);
  }, [contract]); // contract là dependency của handleSearch

  // useEffect 1: Khởi tạo kết nối ví và hợp đồng (chỉ chạy một lần khi component mount)
  useEffect(() => {
    const initConnection = async () => {
      if (window.ethereum) {
        try {
          // Yêu cầu tài khoản một lần để đảm bảo kết nối ví
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const provider = new ethers.BrowserProvider(window.ethereum);
          // Đối với các hàm chỉ đọc (view functions), chúng ta có thể sử dụng provider trực tiếp.
          // Không cần lấy signer ở đây trừ khi chúng ta định gửi giao dịch từ component này.
          const supplyChain = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, provider);
          setContract(supplyChain);
        } catch (err) {
          message.error('Không thể kết nối ví: ' + err.message);
          console.error(err);
        }
      } else {
        message.error('Vui lòng cài đặt MetaMask!');
      }
    };
    initConnection();
  }, []); // Mảng dependency rỗng: chỉ chạy một lần khi component được mount

  // useEffect 2: Tự động tải thông tin mặt hàng khi contract sẵn sàng và itemId trong URL thay đổi
  useEffect(() => {
    const initialItemId = searchParams.get('itemId');
    // Chỉ tiếp tục nếu contract đã được khởi tạo và có itemId trong URL
    if (contract && initialItemId) {
      form.setFieldsValue({ itemId: initialItemId }); // Điền ID vào trường input của form
      handleSearch({ itemId: initialItemId }); // Kích hoạt tìm kiếm
    }
    // Effect này chạy khi 'contract' trở nên khả dụng hoặc 'searchParams' thay đổi.
    // 'form' và 'handleSearch' là ổn định (do form.useForm và useCallback) nên chúng không gây ra re-run.
  }, [contract, searchParams, form, handleSearch]); // Dependencies cho effect này

  const historyColumns = [
    { title: 'Trạng thái', dataIndex: 'state', key: 'state' },
    { title: 'Người thực hiện', dataIndex: 'actor', key: 'actor' },
    { title: 'Thời gian', dataIndex: 'timestamp', key: 'timestamp' },
    { title: 'Ghi chú', dataIndex: 'note', key: 'note' },
  ];

  const certificateColumns = [
    { title: 'Tên chứng chỉ', dataIndex: 'certName', key: 'certName' },
    { title: 'Đơn vị cấp', dataIndex: 'certIssuer', key: 'certIssuer' },
    { title: 'Ngày cấp', dataIndex: 'issueDate', key: 'issueDate' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>Xem thông tin chi tiết mặt hàng</Title>

      <Form form={form} layout="vertical" onFinish={handleSearch}>
        <Form.Item
          label="Nhập ID mặt hàng"
          name="itemId"
          rules={[{ required: true, message: 'Vui lòng nhập ID mặt hàng để tìm kiếm' }]}
        >
          <Input placeholder="Ví dụ: ITEM001" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Tìm kiếm
          </Button>
        </Form.Item>
      </Form>

      <Spin spinning={loading} tip="Đang tải dữ liệu...">
        {itemDetails && (
          <Card title="Chi tiết mặt hàng" style={{ marginTop: 24 }}>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="ID mặt hàng">{itemDetails.id}</Descriptions.Item>
              <Descriptions.Item label="Tên">{itemDetails.name}</Descriptions.Item>
              <Descriptions.Item label="Mô tả">{itemDetails.description}</Descriptions.Item>
              <Descriptions.Item label="Chủ sở hữu hiện tại">{itemDetails.currentOwner}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái hiện tại">{itemDetails.currentState}</Descriptions.Item>
              <Descriptions.Item label="Thời gian giao dự kiến">{itemDetails.plannedDeliveryTime}</Descriptions.Item>
              <Descriptions.Item label="Giá sản xuất">{itemDetails.costPrice} SCC</Descriptions.Item>
              <Descriptions.Item label="Giá bán">{itemDetails.sellingPrice} SCC</Descriptions.Item>
              <Descriptions.Item label="Tồn tại">{itemDetails.exists ? 'Có' : 'Không'}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {itemHistory.length > 0 && (
          <Card title="Lịch sử mặt hàng" style={{ marginTop: 24 }}>
            <Table
              dataSource={itemHistory}
              columns={historyColumns}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        )}

        {itemCertificates.length > 0 && (
          <Card title="Chứng chỉ mặt hàng" style={{ marginTop: 24 }}>
            <Table
              dataSource={itemCertificates}
              columns={certificateColumns}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        )}

        {!itemDetails && !loading && (
          <Empty description="Vui lòng nhập ID mặt hàng để xem chi tiết" style={{ marginTop: 50 }} />
        )}
      </Spin>
    </div>
  );
};

export default ItemDetail;
