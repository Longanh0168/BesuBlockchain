const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  // Thay thế bằng địa chỉ của Proxy Contract HIỆN TẠI của bạn
  // Đây là địa chỉ mà bạn đã nhận được khi triển khai hợp đồng lần đầu
  // và đã lưu trong file config.js của frontend.

  let proxyAddress;
    try {
        proxyAddress = fs.readFileSync("deployedProxyAddress.txt", "utf8").trim();
        if (!proxyAddress) {
            throw new Error("deployedProxyAddress.txt is empty.");
        }
        console.log(`Reading SupplyChainTracking Proxy address from file: ${proxyAddress}`);
    } catch (error) {
        console.error("Error: deployedProxyAddress.txt not found or empty.");
        console.error("Please ensure SupplyChainTracking contract is deployed and its proxy address is saved to deployedProxyAddress.txt.");
        process.exit(1); // Thoát nếu không tìm thấy địa chỉ proxy
    }

  console.log("Đang nâng cấp hợp đồng SupplyChainTracking...");
  console.log("Địa chỉ Proxy hiện tại:", proxyAddress);

  // Lấy ContractFactory cho phiên bản hợp đồng mới (Implementation mới)
  const SupplyChainTracking = await ethers.getContractFactory("SupplyChainTracking");

  // Thực hiện nâng cấp
  // `upgrades.upgradeProxy` sẽ:
  // 1. Kiểm tra tính tương thích của implementation mới với dữ liệu cũ.
  // 2. Triển khai implementation mới lên blockchain.
  // 3. Thực hiện giao dịch gọi hàm upgradeTo() trên proxy contract
  //    để trỏ proxy đến địa chỉ implementation mới.
  const upgradedSupplyChain = await upgrades.upgradeProxy(proxyAddress, SupplyChainTracking);

  // Đợi cho giao dịch nâng cấp được xác nhận trên blockchain
  // (Lưu ý: upgradedSupplyChain đã là một instance được kết nối với proxy sau nâng cấp)
  await upgradedSupplyChain.waitForDeployment(); // Nếu là Hardhat v2.12.0 trở lên

  console.log("Hợp đồng SupplyChainTracking đã được nâng cấp thành công!");
  console.log("Địa chỉ Proxy (không đổi):", await upgradedSupplyChain.getAddress());

  // Để lấy địa chỉ của Implementation mới (không bắt buộc, nhưng hữu ích để xác minh)
  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Địa chỉ Implementation mới:", newImplementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
