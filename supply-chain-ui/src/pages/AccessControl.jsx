import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import contractArtifact from '../artifacts/contracts/SupplyChainTracking.sol/SupplyChainTracking.json';
import { CONTRACT_ADDRESS } from '../config';
import { useNavigate } from 'react-router-dom';
import {
  message,
  Typography,
  Spin,
  Empty,
  Button,
  Table,
  Space,
  Tag,
  Card,
} from 'antd';

// Import các modal đã có
import GrantAccessModal from '../components/GrantAccessModal';
import RevokeAccessModal from '../components/RevokeAccessModal';

// Import các tiện ích về vai trò
import { getNameByAddress, ROLE_OPTIONS, ADDRESS_TO_NAME_MAP } from '../utils/roles';

const { Title, Text } = Typography;

const AccessControl = () => {
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accountsData, setAccountsData] = useState([]); // Dữ liệu các tài khoản và vai trò của họ

  const [isGrantModalVisible, setIsGrantModalVisible] = useState(false);
  const [isRevokeModalVisible, setIsRevokeModalVisible] = useState(false);
  const [selectedAccountForRoleAction, setSelectedAccountForRoleAction] = useState(null);
  const [selectedAccountCurrentRoles, setSelectedAccountCurrentRoles] = useState([]); // Lưu trữ các vai trò hiện có của tài khoản được chọn
  const [rolesToGrantOptions, setRolesToGrantOptions] = useState([]); // Lưu trữ các vai trò có thể cấp (chưa có)

  // Hàm khởi tạo kết nối ví và hợp đồng
  const initConnection = useCallback(async () => {
    setLoading(true);
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signerInstance = await provider.getSigner();
        const address = await signerInstance.getAddress();
        setUserAddress(address);

        const supplyChain = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, signerInstance);
        setContract(supplyChain);
        setSigner(signerInstance);

        // Lấy DEFAULT_ADMIN_ROLE từ hợp đồng (quan trọng để kiểm tra đúng role Admin)
        const DEFAULT_ADMIN_ROLE_BYTES32 = await supplyChain.DEFAULT_ADMIN_ROLE();
        const hasAdminRole = await supplyChain.hasRole(DEFAULT_ADMIN_ROLE_BYTES32, address);
        setIsAdmin(hasAdminRole);

        if (!hasAdminRole) {
          message.error("Bạn không có quyền truy cập trang này.");
          navigate('/'); // Chuyển hướng về trang chủ nếu không phải Admin
          setLoading(false);
          return;
        }

        message.success("Kết nối ví và kiểm tra vai trò thành công!");
        await fetchAccountsAndRoles(supplyChain); // Fetch dữ liệu tài khoản và vai trò
      } catch (err) {
        message.error('Không thể kết nối ví hoặc kiểm tra vai trò: ' + err.message);
        console.error("Lỗi kết nối ví hoặc kiểm tra vai trò:", err);
        setLoading(false);
        navigate('/'); // Chuyển hướng về trang chủ nếu có lỗi
      }
    } else {
      message.error('Vui lòng cài đặt MetaMask!');
      setLoading(false);
      navigate('/'); // Chuyển hướng về trang chủ nếu không có MetaMask
    }
  }, [navigate]);

  // Hàm lấy tất cả các tài khoản đã biết và vai trò của chúng
  const fetchAccountsAndRoles = useCallback(async (supplyChainContract) => {
    if (!supplyChainContract) return;

    setLoading(true);
    try {
      const knownAddresses = Object.keys(ADDRESS_TO_NAME_MAP);
      const fetchedAccounts = [];

      for (const addr of knownAddresses) {
        const rolesForAccount = [];
        for (const roleOption of ROLE_OPTIONS) {
          const roleBytes32 = ethers.keccak256(ethers.toUtf8Bytes(roleOption.value));
          const hasRole = await supplyChainContract.hasRole(roleBytes32, addr);
          if (hasRole) {
            rolesForAccount.push(roleOption); // Lưu cả object roleOption {value, label}
          }
        }
        fetchedAccounts.push({
          key: addr, // Sử dụng địa chỉ làm key
          address: addr,
          name: getNameByAddress(addr),
          roles: rolesForAccount, // roles bây giờ là mảng các object { value, label }
        });
      }
      setAccountsData(fetchedAccounts);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu tài khoản và vai trò:", error);
      message.error("Lỗi khi tải dữ liệu tài khoản và vai trò: " + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initConnection();

    // Lắng nghe sự kiện thay đổi tài khoản MetaMask
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        console.log("Accounts changed in AccessControl:", accounts);
        if (accounts.length === 0) {
          // Người dùng ngắt kết nối hoặc không có tài khoản nào được chọn
          setUserAddress(null);
          setIsAdmin(false);
          setContract(null);
          setSigner(null);
          setAccountsData([]);
          message.warning("Ví đã bị ngắt kết nối hoặc không có tài khoản nào được chọn.");
          setLoading(false);
          navigate('/'); // Chuyển hướng về trang chủ
        } else {
          // Tài khoản thay đổi, khởi tạo lại kết nối và kiểm tra vai trò
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

  // Hàm xử lý cấp quyền truy cập
  const handleGrantAccessSubmit = async (roleString, accountAddress) => {
    if (!contract || !signer) {
      message.error("Contract hoặc ví chưa sẵn sàng.");
      return;
    }
    setLoading(true);
    try {
      const roleBytes32 = ethers.keccak256(ethers.toUtf8Bytes(roleString));
      message.info(`Đang cấp vai trò ${roleString} cho ${accountAddress}, vui lòng xác nhận giao dịch.`);
      const tx = await contract.grantAccess(roleBytes32, accountAddress);
      await tx.wait();
      message.success(`Đã cấp vai trò ${roleString} thành công cho ${accountAddress}!`);
      setIsGrantModalVisible(false);
      await fetchAccountsAndRoles(contract); // Tải lại dữ liệu sau khi thay đổi
    } catch (err) {
      console.error("Lỗi khi cấp quyền truy cập:", err);
      let errorMessage = "Lỗi khi cấp quyền truy cập.";
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

  // Hàm xử lý thu hồi quyền truy cập
  const handleRevokeAccessSubmit = async (roleString, accountAddress) => {
    if (!contract || !signer) {
      message.error("Contract hoặc ví chưa sẵn sàng.");
      return;
    }
    setLoading(true);
    try {
      const roleBytes32 = ethers.keccak256(ethers.toUtf8Bytes(roleString));
      message.info(`Đang thu hồi vai trò ${roleString} từ ${accountAddress}, vui lòng xác nhận giao dịch.`);
      const tx = await contract.revokeAccess(roleBytes32, accountAddress);
      await tx.wait();
      message.success(`Đã thu hồi vai trò ${roleString} thành công từ ${accountAddress}!`);
      setIsRevokeModalVisible(false);
      await fetchAccountsAndRoles(contract); // Tải lại dữ liệu sau khi thay đổi
    } catch (err) {
      console.error("Lỗi khi thu hồi quyền truy cập:", err);
      let errorMessage = "Lỗi khi thu hồi quyền truy cập.";
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
      title: 'Các vai trò',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles) => (
        <Space size={[0, 8]} wrap>
          {roles.map((role, index) => (
            <Tag key={index} color="blue">{role.label}</Tag>
          ))}
        </Space>
      ),
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
              setSelectedAccountForRoleAction(record.address);
              // Lọc các vai trò mà tài khoản chưa có để gợi ý cấp quyền
              const rolesNotYetGranted = ROLE_OPTIONS.filter(
                (roleOpt) =>
                  !record.roles.some((r) => r.value === roleOpt.value) && // Kiểm tra quyền chưa có
                  roleOpt.value !== "DEFAULT_ADMIN_ROLE" // Không cho phép cấp Admin role qua đây
              );
              setRolesToGrantOptions(rolesNotYetGranted); // Cập nhật state cho GrantAccessModal
              setIsGrantModalVisible(true);
            }}
            loading={loading}
          >
            Cấp quyền
          </Button>
          <Button
            type="dashed"
            danger
            size="small"
            onClick={() => {
              setSelectedAccountForRoleAction(record.address);
              // Lọc các vai trò mà tài khoản hiện có để thu hồi (trừ Admin role)
              setSelectedAccountCurrentRoles(
                record.roles.filter(role => role.value !== "DEFAULT_ADMIN_ROLE")
              );
              setIsRevokeModalVisible(true);
            }}
            loading={loading}
          >
            Thu hồi quyền
          </Button>
        </Space>
      ),
    },
  ];

  if (loading && !isAdmin) {
    return (
      <div style={{ textAlign: 'center', marginTop: 50 }}>
        <Spin size="large" tip="Đang kiểm tra quyền truy cập..." />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', marginTop: 50 }}>
        <Empty description="Bạn không có quyền truy cập trang này." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Title level={3}>Quản lý quyền truy cập</Title>
      <Text type="secondary">Chỉ Admin mới có thể quản lý các vai trò.</Text>

      <Card style={{ marginTop: 20 }}>
        <Table
          columns={columns}
          dataSource={accountsData}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowKey="address"
          locale={{ emptyText: <Empty description="Không có tài khoản nào được tìm thấy." /> }}
        />
      </Card>

      {/* Modal Cấp quyền truy cập */}
      <GrantAccessModal
        visible={isGrantModalVisible}
        onCancel={() => {
          setIsGrantModalVisible(false);
          setSelectedAccountForRoleAction(null);
          setRolesToGrantOptions([]); // Reset khi đóng modal
        }}
        onSubmit={handleGrantAccessSubmit}
        loading={loading}
        roleOptions={rolesToGrantOptions} // Truyền danh sách quyền có thể cấp
        initialAccountAddress={selectedAccountForRoleAction}
      />

      {/* Modal Thu hồi quyền truy cập */}
      <RevokeAccessModal
        visible={isRevokeModalVisible}
        onCancel={() => {
          setIsRevokeModalVisible(false);
          setSelectedAccountForRoleAction(null);
          setSelectedAccountCurrentRoles([]); // Reset khi đóng modal
        }}
        onSubmit={handleRevokeAccessSubmit}
        loading={loading}
        roleOptions={selectedAccountCurrentRoles} // Truyền danh sách quyền hiện có
        initialAccountAddress={selectedAccountForRoleAction}
      />
    </div>
  );
};

export default AccessControl;