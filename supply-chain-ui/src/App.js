import React from 'react';
import { Layout, Menu, Typography } from 'antd';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CreateItem from './pages/CreateItem'; // Đảm bảo đường dẫn đúng
import ItemDetail from './pages/ItemDetail'; // Đảm bảo đường dẫn đúng
import './App.css'; // Giữ lại file CSS nếu bạn có các style tùy chỉnh
import ListItem from './pages/ListItem';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        {/* Header của ứng dụng */}
        <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
          <Title level={3} style={{ color: 'white', margin: 0, minWidth: 150 }}>
            SupplyChain DApp
          </Title>
          <Menu
            theme="dark"
            mode="horizontal"
            defaultSelectedKeys={['1']}
            style={{ flex: 1, minWidth: 0, justifyContent: 'flex-end' }}
          >
            <Menu.Item key="1">
              <Link to="/list-item">Danh sách mặt hàng</Link>
            </Menu.Item>
            <Menu.Item key="2">
              <Link to="/create-item">Tạo mặt hàng</Link>
            </Menu.Item>
            <Menu.Item key="3">
              <Link to="/item-detail">Xem chi tiết mặt hàng</Link>
            </Menu.Item>
            {/* Bạn có thể thêm các mục menu khác tại đây */}
          </Menu>
        </Header>

        {/* Khu vực nội dung chính */}
        <Content style={{ padding: '24px 48px' }}>
          <div style={{ background: '#fff', padding: 24, minHeight: 'calc(100vh - 170px)', borderRadius: 8 }}>
            <Routes>
              <Route path="/list-item" element={<ListItem />} />
              <Route path="/create-item" element={<CreateItem />} />
              <Route path="/item-detail" element={<ItemDetail />} />
              <Route path="/" element={
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                  <Title level={2}>Chào mừng đến với Hệ thống theo dõi chuỗi cung ứng</Title>
                  <p>Sử dụng thanh điều hướng phía trên để tạo hoặc xem thông tin mặt hàng.</p>
                  {/* Bạn có thể thêm các thông tin giới thiệu hoặc hướng dẫn khác tại đây */}
                </div>
              } />
            </Routes>
          </div>
        </Content>

        {/* Footer của ứng dụng */}
        <Footer style={{ textAlign: 'center' }}>
          Supply Chain Tracking DApp ©{new Date().getFullYear()} Created by Gemini
        </Footer>
      </Layout>
    </Router>
  );
}

export default App;
