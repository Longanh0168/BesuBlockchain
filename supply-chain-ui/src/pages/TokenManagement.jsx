import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import tokenArtifact from '../artifacts/contracts/SupplyChainCoin.sol/SupplyChainCoin.json';
import { TOKEN_ADDRESS } from '../config';
import { useNavigate } from 'react-router-dom';
import {
  message,
  Typography,
  Spin,
  Empty,
  Button,
  Table,
  Space,
  Card,
  Statistic,
} from 'antd';

import MintTokenModal from '../components/MintTokenModal';
import BurnTokenModal from '../components/BurnTokenModal';

// Import các tiện ích về vai trò và địa chỉ
import { getNameByAddress, ADDRESS_TO_NAME_MAP } from '../utils/roles';

const { Title, Text } = Typography;

const TokenManagement = () => {
  const navigate = useNavigate();
  const [tokenContract, setTokenContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [isTokenOwner, setIsTokenOwner] = useState(false); // Kiểm tra xem người dùng có phải là chủ sở hữu token không
  const [loading, setLoading] = useState(true);
  const [accountsBalances, setAccountsBalances] = useState([]); // Dữ liệu các tài khoản và số dư SCC của họ

  const [isMintModalVisible, setIsMintModalVisible] = useState(false);
  const [isBurnModalVisible, setIsBurnModalVisible] = useState(false);
  const [selectedAccountForTokenAction, setSelectedAccountForTokenAction] = useState(null); // Tài khoản được chọn để mint/burn

  // Hàm khởi tạo kết nối ví và hợp đồng token
  const initConnection = useCallback(async () => {
    setLoading(true);
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signerInstance = await provider.getSigner();
        const address = await signerInstance.getAddress();
        setUserAddress(address);

        const sccToken = new ethers.Contract(TOKEN_ADDRESS, tokenArtifact.abi, signerInstance);
        setTokenContract(sccToken);
        setSigner(signerInstance);

        const ownerAddress = await sccToken.owner(); // Lấy chủ sở hữu của hợp đồng token
        const isOwner = (ownerAddress.toLowerCase() === address.toLowerCase());
        setIsTokenOwner(isOwner);

        if (!isOwner) {
          message.error("Bạn không có quyền truy cập trang này. Chỉ chủ sở hữu token mới có thể quản lý.");
          navigate('/'); // Chuyển hướng về trang chủ nếu không phải chủ sở hữu
          setLoading(false);
          return;
        }

        message.success("Kết nối ví và kiểm tra quyền sở hữu token thành công!");
        await fetchAccountBalances(sccToken); // Fetch dữ liệu số dư tài khoản
      } catch (err) {
        message.error('Không thể kết nối ví hoặc kiểm tra quyền sở hữu token: ' + err.message);
        console.error("Lỗi kết nối ví hoặc kiểm tra quyền sở hữu token:", err);
        setLoading(false);
        navigate('/'); // Chuyển hướng về trang chủ nếu có lỗi
      }
    } else {
      message.error('Vui lòng cài đặt MetaMask!');
      setLoading(false);
      navigate('/'); // Chuyển hướng về trang chủ nếu không có MetaMask
    }
  }, [navigate]);

  // Hàm tải số dư SCC của tất cả các tài khoản đã biết
  const fetchAccountBalances = useCallback(async (sccContract) => {
    if (!sccContract) return;

    setLoading(true);
    try {
      const knownAddresses = Object.keys(ADDRESS_TO_NAME_MAP);
      const fetchedBalances = [];

      for (const addr of knownAddresses) {
        const balance = await sccContract.balanceOf(addr);
        const formattedBalance = ethers.formatUnits(balance, 18); // Định dạng số dư với 18 số thập phân
        fetchedBalances.push({
          key: addr, // Sử dụng địa chỉ làm key
          address: addr,
          name: getNameByAddress(addr),
          balance: formattedBalance,
        });
      }
      setAccountsBalances(fetchedBalances);
    } catch (error) {
      console.error("Lỗi khi tải số dư tài khoản:", error);
      message.error("Lỗi khi tải số dư tài khoản: " + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initConnection();

    // Lắng nghe sự kiện thay đổi tài khoản MetaMask
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        console.log("Accounts changed in TokenManagement:", accounts);
        if (accounts.length === 0) {
          // Người dùng ngắt kết nối hoặc không có tài khoản nào được chọn
          setUserAddress(null);
          setIsTokenOwner(false);
          setTokenContract(null);
          setSigner(null);
          setAccountsBalances([]);
          message.warning("Ví đã bị ngắt kết nối hoặc không có tài khoản nào được chọn.");
          setLoading(false);
          navigate('/'); // Chuyển hướng về trang chủ
        } else {
          // Tài khoản thay đổi, khởi tạo lại kết nối và kiểm tra quyền sở hữu
          initConnection();
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, [initConnection, navigate]);

  // Hàm xử lý Mint Token
  const handleMintSubmit = async (accountAddress, amount) => {
    if (!tokenContract || !signer) {
      message.error("Hợp đồng token hoặc ví chưa sẵn sàng.");
      return;
    }
    setLoading(true);
    try {
      const parsedAmount = ethers.parseUnits(amount.toString(), 18); // Chuyển đổi số lượng sang BigInt
      message.info(`Đang mint ${amount} SCC cho ${accountAddress}, vui lòng xác nhận giao dịch.`);
      const tx = await tokenContract.connect(signer).mint(accountAddress, parsedAmount);
      await tx.wait();
      message.success(`Đã mint ${amount} SCC thành công cho ${accountAddress}!`);
      setIsMintModalVisible(false);
      await fetchAccountBalances(tokenContract); // Tải lại số dư sau khi mint
    } catch (err) {
      console.error("Lỗi khi mint token:", err);
      let errorMessage = "Lỗi khi mint token.";
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

  // Hàm xử lý Burn Token (ownerBurn)
  const handleBurnSubmit = async (accountAddress, amount) => {
    if (!tokenContract || !signer) {
      message.error("Hợp đồng token hoặc ví chưa sẵn sàng.");
      return;
    }
    setLoading(true);
    try {
      const parsedAmount = ethers.parseUnits(amount.toString(), 18); // Chuyển đổi số lượng sang BigInt
      message.info(`Đang hủy ${amount} SCC từ ${accountAddress}, vui lòng xác nhận giao dịch.`);

      // Gọi hàm ownerBurn mới (không cần kiểm tra allowance)
      const tx = await tokenContract.connect(signer).ownerBurn(accountAddress, parsedAmount);
      await tx.wait();
      message.success(`Đã hủy ${amount} SCC thành công từ ${accountAddress}!`);
      setIsBurnModalVisible(false);
      await fetchAccountBalances(tokenContract); // Tải lại số dư sau khi burn
    } catch (err) {
      console.error("Lỗi khi hủy token:", err);
      let errorMessage = "Lỗi khi hủy token.";
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

  const columns = [
    {
      title: 'Tên tài khoản',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text copyable={{ text: record.address }} type="secondary">{record.address}</Text>
        </Space>
      ),
    },
    {
      title: 'Số dư SCC',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance) => <Statistic value={balance} precision={0} suffix="SCC" />, // Hiển thị số dư với Statistic
    },
    {
      title: 'Hành động',
      key: 'actions',
      render: (text, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => {
              setSelectedAccountForTokenAction(record.address);
              setIsMintModalVisible(true);
            }}
            loading={loading}
          >
            Cấp SCC
          </Button>
          <Button
            type="dashed"
            danger
            size="small"
            onClick={() => {
              setSelectedAccountForTokenAction(record.address);
              setIsBurnModalVisible(true);
            }}
            loading={loading}
          >
            Thu hồi SCC
          </Button>
        </Space>
      ),
    },
  ];

  if (loading && !isTokenOwner) {
    return (
      <div style={{ textAlign: 'center', marginTop: 50 }}>
        <Spin size="large" tip="Đang kiểm tra quyền truy cập token..." />
      </div>
    );
  }

  if (!isTokenOwner) {
    return (
      <div style={{ textAlign: 'center', marginTop: 50 }}>
        <Empty description="Bạn không có quyền truy cập trang này. Chỉ chủ sở hữu token mới có thể quản lý." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Title level={3}>Quản lý Token SCC</Title>
      <Text type="secondary">Chỉ chủ sở hữu hợp đồng SupplyChainCoin mới có thể quản lý token.</Text>

      <Card style={{ marginTop: 20 }}>
        <Table
          columns={columns}
          dataSource={accountsBalances}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowKey="address"
          locale={{ emptyText: <Empty description="Không có tài khoản nào được tìm thấy." /> }}
        />
      </Card>

      {/* Modal Cấp SCC */}
      <MintTokenModal
        visible={isMintModalVisible}
        onCancel={() => {
          setIsMintModalVisible(false);
          setSelectedAccountForTokenAction(null);
        }}
        onSubmit={handleMintSubmit}
        loading={loading}
        initialAccountAddress={selectedAccountForTokenAction}
      />

      {/* Modal Thu hồi SCC */}
      <BurnTokenModal
        visible={isBurnModalVisible}
        onCancel={() => {
          setIsBurnModalVisible(false);
          setSelectedAccountForTokenAction(null);
        }}
        onSubmit={handleBurnSubmit}
        loading={loading}
        initialAccountAddress={selectedAccountForTokenAction}
      />
    </div>
  );
};

export default TokenManagement;
