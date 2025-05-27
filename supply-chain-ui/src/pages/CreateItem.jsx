import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import contractArtifact from '../artifacts/contracts/SupplyChainTracking.sol/SupplyChainTracking.json';
import tokenArtifact from '../artifacts/contracts/SupplyChainCoin.sol/SupplyChainCoin.json';
import { keccak256, toUtf8Bytes } from 'ethers';
import { CONTRACT_ADDRESS, TOKEN_ADDRESS } from '../config';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import {
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  message, // Import message từ antd
  Typography,
} from 'antd';

const { TextArea } = Input;
const { Title } = Typography;

const CreateItem = () => {
  const [contract, setContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // Khởi tạo hook useNavigate

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();

          const supplyChain = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, signer);
          const tokenContract = new ethers.Contract(TOKEN_ADDRESS, tokenArtifact.abi, signer);

          setContract(supplyChain);
          setToken(tokenContract);
          setSigner(signer);
        } catch (err) {
          message.error('Không thể kết nối ví: ' + err.message);
        }
      } else {
        message.error('Vui lòng cài đặt MetaMask!');
      }
    };
    init();
  }, []);

  const handleSubmit = async (values) => {
    if (!contract || !token || !signer) return message.error("Contract chưa sẵn sàng");

    setLoading(true);
    try {
      const itemIdBytes32 = keccak256(toUtf8Bytes(values.itemId));
      const deliveryTimestamp = Math.floor(values.plannedDeliveryTime.toDate().getTime() / 1000);
      const cost = ethers.parseUnits(values.costPrice.toString(), 18);
      const sell = ethers.parseUnits(values.sellingPrice.toString(), 18);

      const userAddress = await signer.getAddress();
      const allowance = await token.allowance(userAddress, CONTRACT_ADDRESS);

      console.log("userAddress:", userAddress);
      console.log("allowance:", allowance.toString());

      // Kiểm tra và yêu cầu approve nếu allowance không đủ
      if (allowance < cost) {
        message.info("Vui lòng xác nhận giao dịch Approve token trong ví MetaMask của bạn.");
        const approveTx = await token.approve(CONTRACT_ADDRESS, cost);
        await approveTx.wait();
        message.success("Đã approve token thành công!");
      }

      message.info("Đang tạo mặt hàng, vui lòng xác nhận giao dịch trong ví MetaMask của bạn.");
      const tx = await contract.createItem(
        itemIdBytes32,
        values.name,
        values.description,
        deliveryTimestamp,
        cost,
        sell
      );
      await tx.wait();

      message.success("Tạo mặt hàng thành công!"); // Thông báo thành công
      // Chuyển hướng đến trang chi tiết mặt hàng vừa tạo
      navigate(`/item-detail?itemId=${values.itemId}`);

    } catch (err) {
      console.error(err);
      // Thông báo lỗi cụ thể hơn
      let errorMessage = "Lỗi khi tạo mặt hàng.";
      if (err.code === 'ACTION_REJECTED') {
        errorMessage = "Giao dịch đã bị từ chối bởi người dùng.";
      } else if (err.data && err.data.message) {
        errorMessage = err.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      message.error(errorMessage); // Thông báo lỗi
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <Title level={3}>Tạo mặt hàng mới</Title>

      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="ID mặt hàng"
          name="itemId"
          rules={[{ required: true, message: 'Vui lòng nhập ID mặt hàng' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Tên mặt hàng"
          name="name"
          rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Mô tả"
          name="description"
          rules={[{ required: true, message: 'Vui lòng nhập mô tả' }]}
        >
          <TextArea rows={3} />
        </Form.Item>

        <Form.Item
          label="Thời gian giao dự kiến"
          name="plannedDeliveryTime"
          rules={[{ required: true, message: 'Vui lòng chọn thời gian' }]}
        >
          <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="Giá sản xuất (Cost Price)"
          name="costPrice"
          rules={[{ required: true, message: 'Vui lòng nhập giá sản xuất' }]}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="Giá bán (Selling Price)"
          name="sellingPrice"
          rules={[{ required: true, message: 'Vui lòng nhập giá bán' }]}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Tạo mặt hàng
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default CreateItem;
