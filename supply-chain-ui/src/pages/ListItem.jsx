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
  Tag,
} from 'antd';

// Import hàm tiện ích để lấy tên vai trò từ địa chỉ
import { getNameByAddress } from '../utils/roles';

const { Title, Text } = Typography;

// Cập nhật StateMap để khớp với enum State mới trong Solidity (viết hoa)
const StateMap = {
  0: 'PRODUCED',
  1: 'IN_TRANSIT',
  2: 'IN_TRANSIT_AT_TRANSPORTER',
  3: 'IN_TRANSIT_TO_DISTRIBUTOR',
  4: 'RECEIVED_AT_DISTRIBUTOR',
  5: 'IN_TRANSIT_TO_RETAILER',
  6: 'RECEIVED_AT_RETAILER',
  7: 'SOLD',
  8: 'DAMAGED',
  9: 'LOST',
};

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

const ListItem = () => {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
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
        setLoading(false);
      }
    } else {
      message.error('Vui lòng cài đặt MetaMask!');
      setLoading(false);
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
        if (itemDetail.exists) {
          fetchedItems.push({
            idBytes32: idBytes32,
            itemId: itemDetail.itemIdString,
            name: itemDetail.name,
            currentOwner: await getNameByAddress(itemDetail.currentOwner),
            currentOwnerAddress: itemDetail.currentOwner,
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
                      <Text>Địa chỉ: {item.currentOwnerAddress}</Text>
                      <Text>Trạng thái: <Tag color={getStateTagColor(item.currentState)}>{getStateTagName(item.currentState)}</Tag></Text>
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
