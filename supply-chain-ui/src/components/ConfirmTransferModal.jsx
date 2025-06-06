import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Typography, Space, Spin, message, App as AntdApp  } from 'antd';
import { ethers } from 'ethers';
import tokenArtifact from '../artifacts/contracts/SupplyChainCoin.sol/SupplyChainCoin.json';
import { CONTRACT_ADDRESS } from '../config'; // Import CONTRACT_ADDRESS

const { Text } = Typography;

const ConfirmTransferModal = ({
  visible,
  onCancel,
  onSubmit, // Hàm xử lý submit xác nhận chuyển giao
  onApprove, // Hàm xử lý submit phê duyệt token (được truyền từ ItemDetail)
  loading, // Loading state của ItemDetail
  itemDetails,
  pendingTransferDetails,
  tokenContractAddress,
  userAddress,
}) => {
  const [tokenContract, setTokenContract] = useState(null);
  const [allowance, setAllowance] = useState(ethers.toBigInt(0));
  const [checkingAllowance, setCheckingAllowance] = useState(true);
  const [isApproving, setIsApproving] = useState(false); // Loading state riêng cho nút Approve
  const { message: messageApi } = AntdApp.useApp();
  
  // Hàm để kiểm tra lại allowance
  const checkAllowance = useCallback(async (tokenContractInstance) => {
    if (tokenContractInstance && userAddress && itemDetails) {
      setCheckingAllowance(true);
      try {
        const currentAllowance = await tokenContractInstance.allowance(userAddress, CONTRACT_ADDRESS);
        setAllowance(currentAllowance);
      } catch (error) {
        console.error("Lỗi khi kiểm tra allowance:", error);
        // Không hiển thị messageApi.error ở đây để tránh spam nếu lỗi liên tục
      } finally {
        setCheckingAllowance(false);
      }
    } else {
      setCheckingAllowance(false);
    }
  }, [userAddress, itemDetails]);

  // Khởi tạo hợp đồng token và kiểm tra allowance khi modal hiển thị hoặc dependencies thay đổi
  useEffect(() => {
    const initAndCheck = async () => {
      if (visible && tokenContractAddress && userAddress && itemDetails && window.ethereum) {
        setCheckingAllowance(true); // Đặt lại checkingAllowance khi bắt đầu init
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const tokenInstance = new ethers.Contract(tokenContractAddress, tokenArtifact.abi, signer);
          setTokenContract(tokenInstance);
          await checkAllowance(tokenInstance); // Truyền tokenInstance vào checkAllowance
        } catch (error) {
          console.error("Lỗi khi khởi tạo hợp đồng token trong modal:", error);
          messageApi.error("Không thể khởi tạo hợp đồng token để kiểm tra quyền chi tiêu.");
          setCheckingAllowance(false);
        }
      } else if (!visible) {
        // Reset states khi modal đóng
        setTokenContract(null);
        setAllowance(ethers.toBigInt(0));
        setCheckingAllowance(true);
        setIsApproving(false);
      }
    };
    initAndCheck();
  }, [visible, tokenContractAddress, userAddress, itemDetails, checkAllowance]);

  const handleApprove = async () => {
    if (!tokenContract || !itemDetails) {
      messageApi.error("Hợp đồng token hoặc chi tiết mặt hàng chưa sẵn sàng.");
      return false; // Trả về false nếu không sẵn sàng
    }
    setIsApproving(true);
    try {
      // Phê duyệt số lượng token bằng với giá bán
      const amountToApprove = ethers.parseUnits(itemDetails.sellingPrice.toString(), 18);
      
      // Gọi hàm onApprove được truyền từ ItemDetail
      await onApprove(tokenContract, amountToApprove);

      // Sau khi approve thành công, kiểm tra lại allowance
      await checkAllowance(tokenContract); // Truyền tokenContract vào checkAllowance
      return true; // Trả về true nếu thành công
    } catch (error) {
      console.error("Lỗi khi phê duyệt token:", error);
      let errorMessage = "Lỗi khi phê duyệt token.";
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') { // Cụ thể lỗi người dùng từ chối
        errorMessage = "Giao dịch đã bị từ chối bởi người dùng.";
      } else if (error.data && error.data.message) {
        errorMessage = error.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
        return false; 
    } finally {
      setIsApproving(false);
    }
  };

  const isAllowanceSufficient = itemDetails && allowance >= ethers.parseUnits(itemDetails.sellingPrice.toString(), 18);

  return (
    <Modal
      title="Xác nhận nhận sản phẩm"
      visible={visible}
      onCancel={onCancel}
      footer={null}
    >
      {checkingAllowance ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin tip="Đang kiểm tra quyền chi tiêu token..." />
        </div>
      ) : itemDetails && pendingTransferDetails ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text>Bạn đang xác nhận nhận sản phẩm:</Text>
          <Text strong>ID: {itemDetails.itemIdString}</Text>
          <Text strong>Tên: {itemDetails.name}</Text>
          <Text>Từ: {pendingTransferDetails.fromName} ({pendingTransferDetails.fromAddress})</Text>
          <Text>Đến: {pendingTransferDetails.toName} ({pendingTransferDetails.toAddress})</Text>
          <Text>Giá bán: {itemDetails.sellingPrice} SCC</Text>
          <Text type="secondary">
            Sau khi xác nhận, bạn sẽ trở thành chủ sở hữu mới của sản phẩm này.
            Số tiền {itemDetails.sellingPrice} SCC sẽ được chuyển từ ví của bạn đến người gửi.
          </Text>

          {!isAllowanceSufficient && (
            <>
              <Text type="danger">
                Bạn cần cấp quyền cho hợp đồng để chi tiêu {itemDetails.sellingPrice} SCC từ ví của bạn.
                Allowance hiện tại: {ethers.formatUnits(allowance, 18)} SCC
              </Text>
              <Button type="default" onClick={handleApprove} loading={isApproving} style={{ width: '100%' }}>
                Phê duyệt {itemDetails.sellingPrice} SCC
              </Button>
            </>
          )}

          <Button
            type="primary"
            onClick={onSubmit} // Hàm này sẽ được gọi từ ItemDetail và sẽ xử lý logic phê duyệt trước đó.
            loading={loading || isApproving}
            disabled={!isAllowanceSufficient || isApproving}
            style={{ width: '100%' }}
          >
            Xác nhận nhận sản phẩm và thanh toán
          </Button>
          <Button onClick={onCancel} style={{ width: '100%' }}>
            Hủy
          </Button>
        </Space>
      ) : (
        <Text>Không có thông tin giao dịch đang chờ.</Text>
      )}
    </Modal>
  );
};

export default ConfirmTransferModal;
