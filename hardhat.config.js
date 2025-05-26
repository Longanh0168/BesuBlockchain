require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28", // Phiên bản Solidity của bạn
    settings: {
      optimizer: {
        enabled: true, // Bật trình tối ưu hóa
        runs: 200, // Tối ưu hóa cho 200 lần chạy. Giá trị này thường giúp giảm kích thước bytecode.
      },
    },
  },
  networks: {
    // Thêm cấu hình cho mạng Besu local của bạn
    besu_local: {
      url: "http://localhost:8545", // Đây là RPC URL của Node Besu bạn kết nối Metamask tới (thường là Node 1)
      chainId: 1337, // Phải khớp với chainId trong genesis.json của bạn
      accounts: [
        // --- QUAN TRỌNG: Thêm Private Key vào đây ---
        // Private key của tài khoản sẽ deploy contract (ví dụ: Admin)
        // Hardhat sẽ dùng tài khoản ĐẦU TIÊN trong danh sách này để deploy mặc định
        "0x3142371e076a5444191275ea016964ba21820613e51c65f7af0841f3435dee10", // Admin Private Key
        "0xeffef1d65ed1a44b5415326af7aeb8dc1d8550ed2c62883525f24aa24593ee91", // Producer Private Key
        "0x0890183f1bb79b9e8e79980e66931f270dc4f3e57060dd40cc74d58ee33af97c", // Transporter Private Key
        "0x854c614563aa24568989ee68acd599f6c4df87ea5ac5244d5d39daaad061c3ae", // Distributor Private Key
        "0x5315274d43c9a1517530196024603f7c2f952210a57482a37eec2877a839d294", // Retailer Private Key
        "0xb619bb2b6ab20c07620ee8dca2d493ac335e974e1644960470168f8d4a2d33d4"  // Customer Private Key
      ]
      // Bạn có thể cần thêm cấu hình gas/gasPrice nếu mạng yêu cầu,
      // nhưng với Besu local mặc định thường không cần.
      // gasPrice: 1000000000, // Ví dụ: 1 Gwei
    }
    // Bạn có thể thêm các mạng khác ở đây (vd: Sepolia testnet, mainnet)
  }
};