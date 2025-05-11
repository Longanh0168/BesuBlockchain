require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    // Thêm cấu hình cho mạng Besu local của bạn
    besu_local: {
      url: "http://localhost:8545", // Đây là RPC URL của Node Besu bạn kết nối Metamask tới (thường là Node 1)
      chainId: 1337, // Phải khớp với chainId trong genesis.json của bạn
      accounts: [
        // --- QUAN TRỌNG: Thêm Private Key vào đây ---
        // Private key của tài khoản sẽ deploy contract (ví dụ: Producer)
        // Hardhat sẽ dùng tài khoản ĐẦU TIÊN trong danh sách này để deploy mặc định
        "0xeffef1d65ed1a44b5415326af7aeb8dc1d8550ed2c62883525f24aa24593ee91", // Producer Private Key

        // (Tùy chọn) Thêm private key của các tài khoản khác nếu bạn muốn
        // điều khiển chúng dễ dàng từ script Hardhat sau này
        "0x0890183f1bb79b9e8e79980e66931f270dc4f3e57060dd40cc74d58ee33af97c", // Transporter
        "0x854c614563aa24568989ee68acd599f6c4df87ea5ac5244d5d39daaad061c3ae", // Distributor
        "0x5315274d43c9a1517530196024603f7c2f952210a57482a37eec2877a839d294", // Retailer
        "0xb619bb2b6ab20c07620ee8dca2d493ac335e974e1644960470168f8d4a2d33d4"  // Customer
      ]
      // Bạn có thể cần thêm cấu hình gas/gasPrice nếu mạng yêu cầu,
      // nhưng với Besu local mặc định thường không cần.
      // gasPrice: 1000000000, // Ví dụ: 1 Gwei
    }
    // Bạn có thể thêm các mạng khác ở đây (vd: Sepolia testnet, mainnet)
  }
};