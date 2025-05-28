import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import contractArtifact from '../artifacts/contracts/SupplyChainTracking.sol/SupplyChainTracking.json';
import { CONTRACT_ADDRESS } from '../config';
import { useNavigate } from 'react-router-dom';
import {
  message,
  Typography,
  List,
  Spin,
  Empty,
  Button,
  Space,
} from 'antd';

const { Title, Text } = Typography;

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

const ListItem = () => {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true); // Bắt đầu với loading true
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  // Hàm khởi tạo kết nối ví và hợp đồng
  const initConnection = useCallback(async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(window.ethereum);
        // Sử dụng provider cho các hàm view
        const supplyChain = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, provider);
        setContract(supplyChain);
        message.success("Kết nối ví thành công!");
      } catch (err) {
        message.error('Không thể kết nối ví: ' + err.message);
        console.error("Lỗi kết nối ví:", err);
        setLoading(false); // Tắt loading nếu có lỗi kết nối
      }
    } else {
      message.error('Vui lòng cài đặt MetaMask!');
      setLoading(false); // Tắt loading nếu không có MetaMask
    }
  }, []);

  // Hàm tải tất cả các mặt hàng
  const fetchAllItems = useCallback(async () => {
    if (!contract) {
      return message.error("Contract chưa sẵn sàng");
    }

    setLoading(true);
    try {
      const allItemIds = await contract.getAllItemIds();
      console.log("Tất cả ID mặt hàng:", allItemIds);
      const fetchedItems = [];

      // Lặp qua từng ID và lấy chi tiết
      for (const idBytes32 of allItemIds) {
        const itemDetail = await contract.getItemDetail(idBytes32);
        if (itemDetail.exists) { // Chỉ thêm vào nếu mặt hàng thực sự tồn tại
          fetchedItems.push({
            idBytes32: idBytes32, // Giữ lại hash ID nếu bạn muốn debug hoặc tham chiếu
            itemId: itemDetail.itemIdString, // <-- THAY THẾ Ở ĐÂY: Lấy ID gốc từ trường mới trong contract
            name: itemDetail.name,
            currentOwner: itemDetail.currentOwner,
            currentState: StateMap[itemDetail.currentState],
            sellingPrice: ethers.formatUnits(itemDetail.sellingPrice, 18),
          });
        }
      }
      setItems(fetchedItems);
      message.success(`Đã tải ${fetchedItems.length} mặt hàng.`);
    } catch (err) {
      console.error("Lỗi khi tải danh sách mặt hàng:", err);
      message.error("Lỗi khi tải danh sách mặt hàng: " + err.message);
    }
    setLoading(false);
  }, [contract]); // Dependency là contract

  // useEffect để khởi tạo kết nối khi component mount
  useEffect(() => {
    initConnection();
  }, [initConnection]);

  // useEffect để tải dữ liệu khi contract đã sẵn sàng
  useEffect(() => {
    if (contract) {
      fetchAllItems();
    }
  }, [contract, fetchAllItems]); // fetchAllItems là dependency

  const handleItemClick = (itemId) => {
    navigate(`/item-detail?itemId=${itemId}`);
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>Tất cả các mặt hàng</Title>

      <Button type="primary" onClick={fetchAllItems} loading={loading} style={{ marginBottom: 20 }}>
        {loading ? 'Đang tải...' : 'Tải lại danh sách'}
      </Button>

      <Spin spinning={loading} tip="Đang tải danh sách mặt hàng...">
        {items.length === 0 && !loading ? (
          <Empty description="Chưa có mặt hàng nào được tạo." style={{ marginTop: 50 }} />
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={items}
            renderItem={item => (
              <List.Item
                actions={[<Button type="link" onClick={() => handleItemClick(item.itemId)}>Xem chi tiết</Button>]}
                style={{ cursor: 'pointer' }}
              >
                <List.Item.Meta
                  // eslint-disable-next-line jsx-a11y/anchor-is-valid
                  title={<a onClick={() => handleItemClick(item.itemId)}>{item.name} (ID: {item.itemId})</a>}
                  description={
                    <Space direction="vertical" size={0}>
                      <Text>Chủ sở hữu: {item.currentOwner}</Text>
                      <Text>Trạng thái: {item.currentState}</Text>
                      <Text>Giá bán: {item.sellingPrice} SCC</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Spin>
    </div>
  );
};

export default ListItem;
