import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Typography, message, Spin } from 'antd';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ethers } from 'ethers';
import contractArtifact from './artifacts/contracts/SupplyChainTracking.sol/SupplyChainTracking.json';
import { CONTRACT_ADDRESS } from './config';
import CreateItem from './pages/CreateItem';
import ItemDetail from './pages/ItemDetail';
import ListItem from './pages/ListItem';
import AccessControl from './pages/AccessControl';
import TokenManagement from './pages/TokenManagement';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

function App() {
  const location = useLocation();
  const [contract, setContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [isProducer, setIsProducer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);

  // Function to determine the selected menu key based on the current pathname
  const getSelectedKey = () => {
    const { pathname } = location;
    if (pathname === '/') {
      return '1';
    } else if (pathname.startsWith('/list-item')) {
      return '2';
    } else if (pathname.startsWith('/create-item')) {
      return '3';
    } else if (pathname.startsWith('/item-detail')) {
      return '4';
    } else if (pathname.startsWith('/access-control')) {
      return '5';
    } else if (pathname.startsWith('/token-management')) {
      return '6';
    }
    return '1';
  };

  // Function to initialize Web3 connection, contract, and check roles
  const initWeb3AndRoles = useCallback(async () => {
    setLoadingRoles(true); // Start loading roles
    if (window.ethereum) {
      try {
        // Request accounts if not already connected
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signerInstance = await provider.getSigner();
        const address = await signerInstance.getAddress();
        setUserAddress(address); // Save user address

        // Initialize contract with signer for both view and write functions
        const supplyChain = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, signerInstance);
        setContract(supplyChain);
        setSigner(signerInstance); // Save signer

        // Check PRODUCER_ROLE
        const PRODUCER_ROLE_BYTES32 = ethers.keccak256(ethers.toUtf8Bytes("PRODUCER_ROLE"));
        const hasProducerRole = await supplyChain.hasRole(PRODUCER_ROLE_BYTES32, address);
        setIsProducer(hasProducerRole);

        // Check DEFAULT_ADMIN_ROLE
        const DEFAULT_ADMIN_ROLE_BYTES32 = await supplyChain.DEFAULT_ADMIN_ROLE();
        const hasAdminRole = await supplyChain.hasRole(DEFAULT_ADMIN_ROLE_BYTES32, address);
        setIsAdmin(hasAdminRole);

        message.success("Kết nối ví và kiểm tra vai trò thành công!");
      } catch (err) {
        message.error('Không thể kết nối ví hoặc kiểm tra vai trò: ' + err.message);
        console.error("Lỗi kết nối ví hoặc kiểm tra vai trò:", err);
      }
    } else {
      message.error('Vui lòng cài đặt MetaMask!');
    }
    setLoadingRoles(false); // End loading roles
  }, []);

  useEffect(() => {
    initWeb3AndRoles();

    // Add event listener for accountsChanged
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        console.log("Accounts changed:", accounts);
        // If accounts array is empty, user disconnected. Otherwise, re-initialize.
        if (accounts.length === 0) {
          setUserAddress(null);
          setIsProducer(false);
          setIsAdmin(false);
          setContract(null);
          setSigner(null);
          message.warning("Ví đã bị ngắt kết nối hoặc không có tài khoản nào được chọn.");
          setLoadingRoles(false); // Stop loading if disconnected
        } else {
          // Re-initialize to get new address and roles
          initWeb3AndRoles();
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      // Cleanup function to remove the event listener when the component unmounts
      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, [initWeb3AndRoles]); // Dependency array includes initWeb3AndRoles to ensure it's up-to-date

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Application Header */}
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', margin: 0, minWidth: 150 }}>
          SupplyChain DApp
        </Title>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[getSelectedKey()]}
          style={{ flex: 1, minWidth: 0, justifyContent: 'flex-end' }}
        >
          <Menu.Item key="1">
            <Link to="/">Trang chủ</Link>
          </Menu.Item>
          <Menu.Item key="2">
            <Link to="/list-item">Danh sách mặt hàng</Link>
          </Menu.Item>
          {loadingRoles ? (
            // Display loading state or disable the item while roles are loading
            <Menu.Item key="3" disabled>
              <Spin size="small" /> Đang tải...
            </Menu.Item>
          ) : (
            // Conditionally display based on Producer role
            isProducer && (
              <Menu.Item key="3">
                <Link to="/create-item">Tạo mặt hàng</Link>
              </Menu.Item>
            )
          )}
          <Menu.Item key="4">
            <Link to="/item-detail">Xem chi tiết mặt hàng</Link>
          </Menu.Item>
          {loadingRoles ? (
            // Display loading state or disable the item while roles are loading
            <Menu.Item key="5" disabled>
              <Spin size="small" /> Đang tải...
            </Menu.Item>
          ) : (
            // Conditionally display based on Admin role
            isAdmin && (
              <Menu.Item key="5">
                <Link to="/access-control">Quản lý quyền truy cập</Link>
              </Menu.Item>
            )
          )}
          {loadingRoles ? (
            // Display loading state or disable the item while roles are loading
            <Menu.Item key="6" disabled>
              <Spin size="small" /> Đang tải...
            </Menu.Item>
          ) : (
            // Conditionally display based on Admin role
            isAdmin && (
              <Menu.Item key="6">
                <Link to="/token-management">Quản lý Token</Link>
              </Menu.Item>
            )
          )}
          {/* You can add other menu items here */}
        </Menu>
      </Header>

      {/* Main content area */}
      <Content style={{ padding: '24px 48px' }}>
        <div style={{ background: '#fff', padding: 24, minHeight: 'calc(100vh - 170px)', borderRadius: 8 }}>
          <Routes>
            <Route path="/list-item" element={<ListItem />} />
            <Route path="/create-item" element={<CreateItem />} />
            <Route path="/item-detail" element={<ItemDetail />} />
            <Route path="/access-control" element={<AccessControl />} />
            <Route path="/token-management" element={<TokenManagement />} />
            <Route path="/" element={
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <Title level={2}>Chào mừng đến với Hệ thống theo dõi chuỗi cung ứng</Title>
                <p>Sử dụng thanh điều hướng phía trên để tạo hoặc xem thông tin mặt hàng.</p>
                {/* You can add other introductory or instructional information here */}
              </div>
            } />
          </Routes>
        </div>
      </Content>

      {/* Application Footer */}
      <Footer style={{ textAlign: 'center' }}>
        Supply Chain Tracking DApp ©{new Date().getFullYear()}
      </Footer>
    </Layout>
  );
}

// Wrap the App component in Router for useLocation hook to work
function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWrapper;
