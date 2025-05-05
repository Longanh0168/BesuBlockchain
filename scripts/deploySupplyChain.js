const hre = require("hardhat");

async function main() {
  console.log("Deploying SupplyChainTracking contract...");

  // Lấy đối tượng "Factory" cho contract
  const SupplyChainTracking = await hre.ethers.getContractFactory("SupplyChainTracking");

  // Deploy contract
  // Hardhat sẽ tự động dùng tài khoản đầu tiên trong `accounts` của network được chọn
  const supplyChain = await SupplyChainTracking.deploy();

  // Chờ cho đến khi transaction deploy được mined và contract có địa chỉ
  await supplyChain.waitForDeployment();

  const contractAddress = await supplyChain.getAddress();
  console.log(`SupplyChainTracking deployed successfully to address: ${contractAddress}`);

  // Bạn có thể lưu địa chỉ này lại để dùng trong các script khác
  // Ví dụ: Lưu vào file
  // const fs = require("fs");
  // fs.writeFileSync("deployedAddress.txt", contractAddress);
}

// Xử lý lỗi chuẩn của Hardhat
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});