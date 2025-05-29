import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import contractArtifact from '../artifacts/contracts/SupplyChainTracking.sol/SupplyChainTracking.json';
import tokenArtifact from '../artifacts/contracts/SupplyChainCoin.sol/SupplyChainCoin.json'; // Import token artifact
import { CONTRACT_ADDRESS, TOKEN_ADDRESS } from '../config'; // Import TOKEN_ADDRESS
import { useLocation } from 'react-router-dom';
import {
  message,
  Typography,
  Descriptions,
  Spin,
  Empty,
  Button,
  Card,
  Timeline,
  Tag,
  Space,
  Form,
  Input,
  Table,
} from 'antd';
import moment from 'moment';

// Import các component Modal
import UpdateSellingPriceModal from '../components/UpdateSellingPriceModal';
import AddCertificateModal from '../components/AddCertificateModal';
import ReportIssueModal from '../components/ReportIssueModal';
import InitiateTransferModal from '../components/InitiateTransferModal';
import ConfirmTransferModal from '../components/ConfirmTransferModal';
import CustomerPurchaseModal from '../components/CustomerPurchaseModal'; // Import CustomerPurchaseModal mới

// Import hàm tiện ích để lấy tên vai trò từ địa chỉ
import { getNameByAddress } from '../utils/roles';

const { Title, Text } = Typography;

// StateMap để khớp với enum State mới trong Solidity (viết hoa)
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

const ItemDetail = () => {
  const [contract, setContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [tokenContract, setTokenContract] = useState(null); // State mới cho hợp đồng token
  const [userAddress, setUserAddress] = useState(null);
  const [isProducer, setIsProducer] = useState(false);
  const [isTransporter, setIsTransporter] = useState(false);
  const [isDistributor, setIsDistributor] = useState(false);
  const [isRetailer, setIsRetailer] = useState(false);
  const [itemDetails, setItemDetails] = useState(null);
  const [itemHistory, setItemHistory] = useState([]);
  const [itemCertificates, setItemCertificates] = useState([]);
  const [pendingTransferDetails, setPendingTransferDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatePriceModalVisible, setIsUpdatePriceModalVisible] = useState(false);
  const [isAddCertificateModalVisible, setIsAddCertificateModalVisible] = useState(false);
  const [isReportIssueModalVisible, setIsReportIssueModalVisible] = useState(false);
  const [isInitiateTransferModalVisible, setIsInitiateTransferModalVisible] = useState(false);
  const [isConfirmTransferModalVisible, setIsConfirmTransferModalVisible] = useState(false);
  const [isCustomerPurchaseModalVisible, setIsCustomerPurchaseModalVisible] = useState(false); // State cho CustomerPurchaseModal
  const [supplyChainTokenAddress, setSupplyChainTokenAddress] = useState(null); // Đổi tên để tránh nhầm lẫn
  const [searchForm] = Form.useForm();


  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const itemIdFromUrl = queryParams.get('itemId');

  // Hàm khởi tạo kết nối ví và hợp đồng
  const initConnection = useCallback(async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signerInstance = await provider.getSigner();
        const address = await signerInstance.getAddress();
        setUserAddress(address);

        const supplyChain = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, signerInstance);
        const sccToken = new ethers.Contract(TOKEN_ADDRESS, tokenArtifact.abi, signerInstance); // Khởi tạo hợp đồng token
        
        setContract(supplyChain);
        setSigner(signerInstance);
        setTokenContract(sccToken); // Lưu instance của hợp đồng token
        message.success("Kết nối ví thành công!");

        // Lấy địa chỉ hợp đồng token từ SupplyChainTracking contract (nếu cần, nhưng đã có TOKEN_ADDRESS)
        const tokenAddrFromContract = await supplyChain.tokenContract();
        setSupplyChainTokenAddress(tokenAddrFromContract); // Lưu địa chỉ token từ hợp đồng

        // Kiểm tra vai trò Producer
        const PRODUCER_ROLE_BYTES32 = ethers.keccak256(ethers.toUtf8Bytes("PRODUCER_ROLE"));
        const hasProducerRole = await supplyChain.hasRole(PRODUCER_ROLE_BYTES32, address);
        setIsProducer(hasProducerRole);

        // Kiểm tra vai trò Transporter
        const TRANSPORTER_ROLE_BYTES32 = ethers.keccak256(ethers.toUtf8Bytes("TRANSPORTER_ROLE"));
        const hasTransporterRole = await supplyChain.hasRole(TRANSPORTER_ROLE_BYTES32, address);
        setIsTransporter(hasTransporterRole);

        // Kiểm tra vai trò Distributor
        const DISTRIBUTOR_ROLE_BYTES32 = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE"));
        const hasDistributorRole = await supplyChain.hasRole(DISTRIBUTOR_ROLE_BYTES32, address);
        setIsDistributor(hasDistributorRole);

        // Kiểm tra vai trò Retailer
        const RETAILER_ROLE_BYTES32 = ethers.keccak256(ethers.toUtf8Bytes("RETAILER_ROLE"));
        const hasRetailerRole = await supplyChain.hasRole(RETAILER_ROLE_BYTES32, address);
        setIsRetailer(hasRetailerRole);

      } catch (err) {
        message.error('Không thể kết nối ví: ' + err.message);
        console.error("Lỗi kết nối ví:", err);
      }
    } else {
      message.error('Vui lòng cài đặt MetaMask!');
    }
    setLoading(false);
  }, []);

  // Hàm tải chi tiết và lịch sử mặt hàng
  const fetchItemDetails = useCallback(async (idToFetch) => {
    setLoading(true);

    if (!contract || !idToFetch) {
      setLoading(false);
      return;
    }

    try {
      const itemIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(idToFetch));
      const details = await contract.getItemDetail(itemIdBytes32);
      const history = await contract.getItemHistory(itemIdBytes32);
      const certificates = await contract.getCertificates(itemIdBytes32);
      const pendingTransfer = await contract.pendingTransfers(itemIdBytes32);

      if (details.exists) {
        setItemDetails({
          id: details.id,
          itemIdString: details.itemIdString,
          name: details.name,
          description: details.description,
          currentOwner: getNameByAddress(details.currentOwner),
          currentOwnerAddress: details.currentOwner,
          currentState: StateMap[details.currentState],
          exists: details.exists,
          plannedDeliveryTime: moment.unix(Number(details.plannedDeliveryTime)).format('YYYY-MM-DD HH:mm:ss'),
          costPrice: ethers.formatUnits(details.costPrice, 18),
          sellingPrice: ethers.formatUnits(details.sellingPrice, 18),
        });

        const formattedHistory = history.map((h, index) => {
          let note = h.note;
          if (note.startsWith("Selling price updated from ") && note.includes(" to ")) {
            const parts = note.split(" from ")[1].split(" to ");
            const oldPriceRaw = parts[0];
            const newPriceRaw = parts[1];
            try {
              const oldPriceFormatted = ethers.formatUnits(oldPriceRaw, 18);
              const newPriceFormatted = ethers.formatUnits(newPriceRaw, 18);
              note = `Selling price updated from ${oldPriceFormatted} SCC to ${newPriceFormatted} SCC`;
            } catch (e) {
              console.warn("Could not format price note:", e);
            }
          }
          return {
            key: index,
            state: StateMap[h.state],
            actor: getNameByAddress(h.actor),
            actorAddress: h.actor,
            timestamp: moment.unix(Number(h.timestamp)).format('YYYY-MM-DD HH:mm:ss'),
            note: note,
          };
        }).reverse();
        setItemHistory(formattedHistory);

        const formattedCertificates = certificates.map((cert, index) => ({
          key: index,
          certName: cert.certName,
          certIssuer: cert.certIssuer,
          issueDate: moment.unix(Number(cert.issueDate)).format('YYYY-MM-DD HH:mm:ss'),
        }));
        setItemCertificates(formattedCertificates);

        if (pendingTransfer.from !== ethers.ZeroAddress) {
          setPendingTransferDetails({
            fromAddress: pendingTransfer.from,
            fromName: getNameByAddress(pendingTransfer.from),
            toAddress: pendingTransfer.to,
            toName: getNameByAddress(pendingTransfer.to),
            fromConfirmed: pendingTransfer.fromConfirmed,
            toConfirmed: pendingTransfer.toConfirmed,
          });
        } else {
          setPendingTransferDetails(null);
        }

        message.success("Tải thông tin mặt hàng thành công!");
      } else {
        setItemDetails(null);
        setPendingTransferDetails(null);
        message.error("Mặt hàng không tồn tại hoặc ID không đúng.");
      }
    } catch (err) {
      console.error("Lỗi khi tải chi tiết mặt hàng:", err);
      message.error("Lỗi khi tải chi tiết mặt hàng: " + err.message);
      setItemDetails(null);
      setPendingTransferDetails(null);
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => {
    initConnection();
  }, [initConnection]);

  useEffect(() => {
    if (contract && itemIdFromUrl) {
      searchForm.setFieldsValue({ itemId: itemIdFromUrl });
      fetchItemDetails(itemIdFromUrl);
    }
  }, [contract, itemIdFromUrl, fetchItemDetails, searchForm]);

  const handleSearchSubmit = (values) => {
    if (!contract) {
      message.error("Contract chưa sẵn sàng. Vui lòng kiểm tra kết nối ví MetaMask.");
      return;
    }
    fetchItemDetails(values.itemId);
  };

  const handleUpdatePriceSubmit = async (newPriceValue) => {
    if (!contract || !signer || !itemDetails) {
      message.error("Contract hoặc chi tiết mặt hàng chưa sẵn sàng.");
      return;
    }

    setLoading(true);
    try {
      const newPrice = ethers.parseUnits(newPriceValue.toString(), 18);
      const itemIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(itemDetails.itemIdString));

      message.info("Đang cập nhật giá bán, vui lòng xác nhận giao dịch trong ví MetaMask của bạn.");
      const tx = await contract.updateSellingPrice(itemIdBytes32, newPrice);
      await tx.wait();

      message.success("Cập nhật giá bán thành công!");
      setIsUpdatePriceModalVisible(false);
      fetchItemDetails(itemDetails.itemIdString);
    } catch (err) {
      console.error("Lỗi khi cập nhật giá bán:", err);
      let errorMessage = "Lỗi khi cập nhật giá bán.";
      if (err.code === 'ACTION_REJECTED') {
        errorMessage = "Giao dịch đã bị từ chối bởi người dùng.";
      } else if (err.data && err.data.message) {
        errorMessage = err.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCertificateSubmit = async (certName, certIssuer) => {
    if (!contract || !signer || !itemDetails) {
      message.error("Contract hoặc chi tiết mặt hàng chưa sẵn sàng.");
      return;
    }

    setLoading(true);
    try {
      const itemIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(itemDetails.itemIdString));

      message.info("Đang thêm chứng chỉ, vui lòng xác nhận giao dịch trong ví MetaMask của bạn.");
      const tx = await contract.addCertificate(itemIdBytes32, certName, certIssuer);
      await tx.wait();

      message.success("Thêm chứng chỉ thành công!");
      setIsAddCertificateModalVisible(false);
      fetchItemDetails(itemDetails.itemIdString);
    } catch (err) {
      console.error("Lỗi khi thêm chứng chỉ:", err);
      let errorMessage = "Lỗi khi thêm chứng chỉ.";
      if (err.code === 'ACTION_REJECTED') {
        errorMessage = "Giao dịch đã bị từ chối bởi người dùng.";
      } else if (err.data && err.data.message) {
        errorMessage = err.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReportIssueSubmit = async (issueType, reason) => {
    if (!contract || !signer || !itemDetails) {
      message.error("Contract hoặc chi tiết mặt hàng chưa sẵn sàng.");
      return;
    }

    setLoading(true);
    try {
      const itemIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(itemDetails.itemIdString));
      let tx;

      message.info(`Đang báo cáo sự cố ${issueType}, vui lòng xác nhận giao dịch trong ví MetaMask của bạn.`);

      if (issueType === 'Damaged') {
        // Sử dụng reportDamage hoặc reportDamageAtDistributor tùy thuộc vào vai trò
        if (isTransporter || isDistributor) {
          tx = await contract.reportDamage(itemIdBytes32, reason);
        } else {
          message.error("Bạn không có quyền báo cáo hư hỏng.");
          setLoading(false);
          return;
        }
      } else if (issueType === 'Lost') {
        // Sử dụng reportLost hoặc reportLostAtDistributor tùy thuộc vào vai trò
        if (isTransporter || isDistributor) {
          tx = await contract.reportLost(itemIdBytes32, reason);
        } else {
          message.error("Bạn không có quyền báo cáo thất lạc.");
          setLoading(false);
          return;
        }
      } else {
        message.error("Loại sự cố không hợp lệ.");
        setLoading(false);
        return;
      }

      await tx.wait();

      message.success(`Báo cáo sự cố ${issueType} thành công!`);
      setIsReportIssueModalVisible(false);
      fetchItemDetails(itemDetails.itemIdString);
    } catch (err) {
      console.error("Lỗi khi báo cáo sự cố:", err);
      let errorMessage = "Lỗi khi báo cáo sự cố.";
      if (err.code === 'ACTION_REJECTED') {
        errorMessage = "Giao dịch đã bị từ chối bởi người dùng.";
      } else if (err.data && err.data.message) {
        errorMessage = err.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateTransferSubmit = async (recipientAddress) => {
    if (!contract || !signer || !itemDetails) {
      message.error("Contract hoặc chi tiết mặt hàng chưa sẵn sàng.");
      return;
    }

    setLoading(true);
    try {
      const itemIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(itemDetails.itemIdString));

      message.info(`Đang khởi tạo chuyển giao đến ${getNameByAddress(recipientAddress)}, vui lòng xác nhận giao dịch.`);
      const tx = await contract.initiateTransfer(itemIdBytes32, recipientAddress);
      await tx.wait();

      message.success("Khởi tạo chuyển giao thành công!");
      setIsInitiateTransferModalVisible(false);
      fetchItemDetails(itemDetails.itemIdString);
    } catch (err) {
      console.error("Lỗi khi khởi tạo chuyển giao:", err);
      let errorMessage = "Lỗi khi khởi tạo chuyển giao.";
      if (err.code === 'ACTION_REJECTED') {
        errorMessage = "Giao dịch đã bị từ chối bởi người dùng.";
      } else if (err.data && err.data.message) {
        errorMessage = err.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTokenSubmit = async (tokenContractInstance, amountToApprove) => {
    if (!tokenContractInstance || !signer || !itemDetails) {
      message.error("Hợp đồng token hoặc chi tiết mặt hàng chưa sẵn sàng để phê duyệt.");
      return;
    }

    setLoading(true);
    try {
      message.info(`Đang phê duyệt ${ethers.formatUnits(amountToApprove, 18)} SCC cho hợp đồng, vui lòng xác nhận giao dịch.`);
      const tx = await tokenContractInstance.approve(CONTRACT_ADDRESS, amountToApprove);
      await tx.wait();
      message.success("Phê duyệt token thành công!");
    } catch (err) {
      console.error("Lỗi khi phê duyệt token:", err);
      let errorMessage = "Lỗi khi phê duyệt token.";
      if (err.code === 'ACTION_REJECTED') {
        errorMessage = "Giao dịch đã bị từ chối bởi người dùng.";
      } else if (err.data && err.data.message) {
        errorMessage = err.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      message.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTransferSubmit = async () => {
    if (!contract || !signer || !itemDetails || !pendingTransferDetails) {
      message.error("Contract, chi tiết mặt hàng hoặc giao dịch đang chờ chưa sẵn sàng.");
      return;
    }

    setLoading(true);
    try {
      const itemIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(itemDetails.itemIdString));

      message.info("Đang xác nhận chuyển giao, vui lòng xác nhận giao dịch và thanh toán trong ví MetaMask của bạn.");
      const tx = await contract.confirmTransfer(itemIdBytes32);
      await tx.wait();

      message.success("Xác nhận chuyển giao thành công!");
      setIsConfirmTransferModalVisible(false);
      fetchItemDetails(itemDetails.itemIdString);
    } catch (err) {
      console.error("Lỗi khi xác nhận chuyển giao:", err);
      let errorMessage = "Lỗi khi xác nhận chuyển giao.";
      if (err.code === 'ACTION_REJECTED') {
        errorMessage = "Giao dịch đã bị từ chối bởi người dùng.";
      } else if (err.data && err.data.message) {
        errorMessage = err.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Hàm xử lý khi khách hàng mua sản phẩm
  const handleCustomerPurchaseSubmit = async () => {
    if (!contract || !signer || !itemDetails || !tokenContract) {
      message.error("Contract, ví hoặc chi tiết mặt hàng chưa sẵn sàng.");
      return;
    }

    setLoading(true);
    try {
      const itemIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(itemDetails.itemIdString));
      const sellingPriceBigInt = ethers.parseUnits(itemDetails.sellingPrice.toString(), 18);
      const userAddress = await signer.getAddress();

      // Kiểm tra allowance của khách hàng
      const allowance = await tokenContract.allowance(userAddress, CONTRACT_ADDRESS);

      if (allowance < sellingPriceBigInt) {
        message.info(`Vui lòng xác nhận giao dịch Approve ${itemDetails.sellingPrice} SCC cho hợp đồng trong ví MetaMask của bạn.`);
        const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, sellingPriceBigInt);
        await approveTx.wait();
        message.success("Đã phê duyệt token thành công!");
      }

      message.info("Đang thực hiện giao dịch mua, vui lòng xác nhận trong ví MetaMask của bạn.");
      const tx = await contract.customerBuyItem(itemIdBytes32); // Gọi hàm customerBuyItem
      await tx.wait();

      message.success("Mua sản phẩm thành công!");
      setIsCustomerPurchaseModalVisible(false);
      fetchItemDetails(itemDetails.itemIdString);
    } catch (err) {
      console.error("Lỗi khi mua sản phẩm:", err);
      let errorMessage = "Lỗi khi mua sản phẩm.";
      if (err.code === 'ACTION_REJECTED') {
        errorMessage = "Giao dịch đã bị từ chối bởi người dùng.";
      } else if (err.data && err.data.message) {
        errorMessage = err.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const certificateColumns = [
    { title: 'Tên chứng chỉ', dataIndex: 'certName', key: 'certName' },
    { title: 'Đơn vị cấp', dataIndex: 'certIssuer', key: 'certIssuer' },
    { title: 'Ngày cấp', dataIndex: 'issueDate', key: 'issueDate' },
  ];

  if (loading && !itemDetails) {
    return (
      <div style={{ textAlign: 'center', marginTop: 50 }}>
        <Spin size="large" tip="Đang tải chi tiết mặt hàng..." />
      </div>
    );
  }

  // Lấy vai trò hiện tại của người dùng (nếu họ là chủ sở hữu) để truyền vào InitiateTransferModal
  const currentUserRole = (() => {
    if (!userAddress || !itemDetails || itemDetails.currentOwnerAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return null;
    }
    if (isProducer) return 'PRODUCER';
    if (isTransporter) return 'TRANSPORTER';
    if (isDistributor) return 'DISTRIBUTOR';
    if (isRetailer) return 'RETAILER';
    return null;
  })();

  // Kiểm tra điều kiện hiển thị nút "Mua sản phẩm"
  const showBuyButton = itemDetails && 
                       itemDetails.currentState === 'RECEIVED_AT_RETAILER' && // Hoặc 'RECEIVED' nếu bạn đã qua bước markAsReceived
                       userAddress && 
                       itemDetails.currentOwnerAddress.toLowerCase() !== userAddress.toLowerCase();


  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>Xem thông tin chi tiết mặt hàng</Title>

      <Form form={searchForm} layout="vertical" onFinish={handleSearchSubmit}>
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

      {itemDetails ? (
        <>
          <Title level={3} style={{ marginTop: 30 }}>Chi tiết mặt hàng: {itemDetails.name}</Title>
          <Text type="secondary">ID: {itemDetails.itemIdString || "N/A"}</Text>
          <br/>
          <Text type="secondary">ID Hash (Blockchain): {itemDetails.id}</Text>

          <Card style={{ marginTop: 20 }}>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Mô tả">{itemDetails.description}</Descriptions.Item>
              <Descriptions.Item label="Chủ sở hữu hiện tại">{itemDetails.currentOwner}</Descriptions.Item>
              <Descriptions.Item label="Địa Chỉ chủ sở hữu hiện tại">{itemDetails.currentOwnerAddress}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái hiện tại">
                <Tag color={getStateTagColor(itemDetails.currentState)}>{getStateTagName(itemDetails.currentState)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian giao dự kiến">{itemDetails.plannedDeliveryTime}</Descriptions.Item>
              <Descriptions.Item label="Giá sản xuất">{itemDetails.costPrice} SCC</Descriptions.Item>
              <Descriptions.Item label="Giá bán">{itemDetails.sellingPrice} SCC</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Hiển thị thông tin giao dịch đang chờ xử lý */}
          {pendingTransferDetails && (
            <Card title="Giao dịch đang chờ xử lý" style={{ marginTop: 20, borderColor: '#1890ff' }}>
              <Descriptions bordered column={1}>
                <Descriptions.Item label="Từ">
                  {pendingTransferDetails.fromName} ({pendingTransferDetails.fromAddress})
                </Descriptions.Item>
                <Descriptions.Item label="Đến">
                  {pendingTransferDetails.toName} ({pendingTransferDetails.toAddress})
                </Descriptions.Item>
                <Descriptions.Item label="Người gửi đã xác nhận">
                  {pendingTransferDetails.fromConfirmed ? <Tag color="green">Có</Tag> : <Tag color="red">Không</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="Người nhận đã xác nhận">
                  {pendingTransferDetails.toConfirmed ? <Tag color="green">Có</Tag> : <Tag color="red">Không</Tag>}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          <Space style={{ marginTop: 20 }} wrap>
            {/* Nút cập nhật giá bán */}
            {userAddress && itemDetails?.currentOwnerAddress?.toLowerCase() === userAddress?.toLowerCase() &&
              (itemDetails.currentState === 'PRODUCED' || itemDetails.currentState === 'RECEIVED_AT_DISTRIBUTOR' ||
              itemDetails.currentState === 'RECEIVED_AT_RETAILER') && 
              (isProducer || isDistributor || isRetailer) && (
              <Button
                type="primary"
                onClick={() => setIsUpdatePriceModalVisible(true)}
                loading={loading}
              >
                Cập nhật giá bán
              </Button>
            )}

            {/* Nút thêm chứng chỉ */}
            {userAddress && itemDetails?.currentOwnerAddress?.toLowerCase() === userAddress?.toLowerCase() && 
              isProducer && itemDetails.currentState === 'PRODUCED' && (
              <Button
                type="default"
                onClick={() => setIsAddCertificateModalVisible(true)}
                loading={loading}
              >
                Thêm chứng chỉ
              </Button>
            )}

            {/* Nút báo cáo sự cố */}
            {userAddress && itemDetails?.currentOwnerAddress?.toLowerCase() === userAddress?.toLowerCase() &&
              (isTransporter || isDistributor) && (
              <Button
                type="dashed"
                danger
                onClick={() => setIsReportIssueModalVisible(true)}
                loading={loading}
              >
                Báo cáo sự cố
              </Button>
            )}

            {/* Nút Khởi tạo chuyển giao */}
            {userAddress && itemDetails?.currentOwnerAddress?.toLowerCase() === userAddress?.toLowerCase() &&
             (itemDetails.currentState === 'PRODUCED' ||
              itemDetails.currentState === 'IN_TRANSIT_AT_TRANSPORTER' ||
              itemDetails.currentState === 'RECEIVED_AT_DISTRIBUTOR') &&
             !pendingTransferDetails && (
              <Button
                type="primary"
                onClick={() => setIsInitiateTransferModalVisible(true)}
                loading={loading}
              >
                Khởi tạo chuyển giao
              </Button>
            )}

            {/* Nút Xác nhận chuyển giao */}
            {pendingTransferDetails && userAddress && pendingTransferDetails.toAddress.toLowerCase() === userAddress.toLowerCase() && !pendingTransferDetails.toConfirmed && (
              <Button
                type="primary"
                onClick={() => setIsConfirmTransferModalVisible(true)}
                loading={loading}
              >
                Xác nhận chuyển giao
              </Button>
            )}

            {/* Nút Đánh dấu đã nhận (dành cho Retailer) */}
            {isRetailer && userAddress && itemDetails?.currentOwnerAddress?.toLowerCase() === userAddress.toLowerCase() &&
             itemDetails.currentState === 'DELIVERED' && ( 
              <Button
                type="primary"
                onClick={() => message.info("Chức năng 'Đánh dấu đã nhận' sẽ được triển khai sau.")} // Placeholder for now
                loading={loading}
              >
                Đánh dấu đã nhận
              </Button>
            )}

            {/* Nút Mua sản phẩm (dành cho Khách hàng) */}
            {showBuyButton && ( 
              <Button
                type="primary"
                onClick={() => setIsCustomerPurchaseModalVisible(true)} // Mở modal CustomerPurchaseModal
                loading={loading}
              >
                Mua sản phẩm
              </Button>
            )}
          </Space>

          <Title level={4} style={{ marginTop: 30 }}>Lịch sử mặt hàng</Title>
          {itemHistory.length > 0 ? (
            <Timeline
              items={itemHistory.map((h, index) => ({
                children: (
                  <Card size="small" key={index}>
                    <p><strong>Trạng thái:</strong> <Tag color={getStateTagColor(h.state)}>{getStateTagName(h.state)}</Tag></p>
                    <p><strong>Người thực hiện:</strong> {h.actor}</p>
                    <p><strong>Địa chỉ:</strong> {h.actorAddress}</p>
                    <p><strong>Thời gian:</strong> {h.timestamp}</p>
                    <p><strong>Ghi chú:</strong> {h.note}</p>
                  </Card>
                ),
              }))}
            />
          ) : (
            <Empty description="Chưa có lịch sử cho mặt hàng này." />
          )}

          <Title level={4} style={{ marginTop: 30 }}>Chứng chỉ mặt hàng</Title>
          {itemCertificates.length > 0 ? (
            <Table
              dataSource={itemCertificates}
              columns={certificateColumns}
              pagination={false}
              scroll={{ x: 'max-content' }}
              rowKey="key"
            />
          ) : (
            <Empty description="Chưa có chứng chỉ nào cho mặt hàng này." />
          )}
        </>
      ) : (
        <Empty description="Vui lòng nhập ID mặt hàng để xem chi tiết hoặc mặt hàng không tồn tại." style={{ marginTop: 50 }} />
      )}

      {/* Modal cập nhật giá bán */}
      <UpdateSellingPriceModal
        visible={isUpdatePriceModalVisible}
        onCancel={() => setIsUpdatePriceModalVisible(false)}
        onSubmit={handleUpdatePriceSubmit}
        initialPrice={itemDetails?.sellingPrice}
        loading={loading}
      />

      {/* Modal thêm chứng chỉ */}
      <AddCertificateModal
        visible={isAddCertificateModalVisible}
        onCancel={() => setIsAddCertificateModalVisible(false)}
        onSubmit={handleAddCertificateSubmit}
        loading={loading}
      />

      {/* Modal báo cáo sự cố */}
      <ReportIssueModal
        visible={isReportIssueModalVisible}
        onCancel={() => setIsReportIssueModalVisible(false)}
        onSubmit={handleReportIssueSubmit}
        loading={loading}
      />

      {/* Modal Khởi tạo chuyển giao */}
      <InitiateTransferModal
        visible={isInitiateTransferModalVisible}
        onCancel={() => setIsInitiateTransferModalVisible(false)}
        onSubmit={handleInitiateTransferSubmit}
        loading={loading}
        currentOwnerRole={currentUserRole} // Truyền vai trò của chủ sở hữu hiện tại
      />

      {/* Modal Xác nhận chuyển giao */}
      <ConfirmTransferModal
        visible={isConfirmTransferModalVisible}
        onCancel={() => setIsConfirmTransferModalVisible(false)}
        onSubmit={handleConfirmTransferSubmit}
        onApprove={handleApproveTokenSubmit}
        loading={loading}
        itemDetails={itemDetails}
        pendingTransferDetails={pendingTransferDetails}
        tokenContractAddress={supplyChainTokenAddress} // Sử dụng supplyChainTokenAddress
        userAddress={userAddress}
      />

      {/* Modal Mua sản phẩm (Customer) */}
      <CustomerPurchaseModal
        visible={isCustomerPurchaseModalVisible}
        onCancel={() => setIsCustomerPurchaseModalVisible(false)}
        onSubmit={handleCustomerPurchaseSubmit}
        loading={loading}
        itemDetails={itemDetails} // Truyền chi tiết mặt hàng để hiển thị trong modal
      />
    </div>
  );
};

export default ItemDetail;
