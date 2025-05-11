const hre = require("hardhat");

async function main() {
  // Địa chỉ contract đã được deploy (PHẢI LÀ ĐỊA CHỈ CỦA PROXY CONTRACT)
  const deployedContractAddress = "0x2b5a5176cB45Bb6caB6FbC1a17C9ADD2eA09f4C3";

  const accounts = {
    producer: "0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54",
    transporter: "0xe83f7EA2eB8D5049d9162B1F2cfc9075a1C698D0",
    distributor: "0xBe85127318076116cf4C19c5Dd91C95503368FFe",
    retailer: "0xB85a94BB5D2F97D1CD517b7ec6208b869C4b2444",
  };


  console.log(`Attaching to SupplyChainTracking contract at ${deployedContractAddress}...`);

  // Lấy đối tượng contract đã deploy bằng cách attach vào địa chỉ PROXY
  // Hardhat Upgrades plugin cho phép bạn làm điều này
  const SupplyChainTracking = await hre.ethers.getContractFactory("SupplyChainTracking");
  const supplyChain = SupplyChainTracking.attach(deployedContractAddress); // Attach vào địa chỉ Proxy

  // Lấy signer mặc định (tài khoản deployer, có quyền admin)
  // Đảm bảo tài khoản này có DEFAULT_ADMIN_ROLE trên hợp đồng Proxy
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Using admin account: ${deployer.address}`);
  // Kiểm tra xem deployer có phải là admin không (tùy chọn)
  const defaultAdminRole = await supplyChain.DEFAULT_ADMIN_ROLE();
  if (!(await supplyChain.hasRole(defaultAdminRole, deployer.address))) {
      console.error("Error: Deployer account does not have DEFAULT_ADMIN_ROLE on the proxy contract.");
      console.error("Please ensure the account used for deployment has this role or run initialize correctly.");
      process.exitCode = 1;
      return;
  }


  // Lấy định danh (bytes32) của các vai trò từ contract
  console.log("Fetching role identifiers...");
  const PRODUCER_ROLE = await supplyChain.PRODUCER_ROLE();
  const TRANSPORTER_ROLE = await supplyChain.TRANSPORTER_ROLE();
  const DISTRIBUTOR_ROLE = await supplyChain.DISTRIBUTOR_ROLE();
  const RETAILER_ROLE = await supplyChain.RETAILER_ROLE();
  console.log(` - PRODUCER_ROLE: ${PRODUCER_ROLE}`);
  console.log(` - TRANSPORTER_ROLE: ${TRANSPORTER_ROLE}`);
  console.log(` - DISTRIBUTOR_ROLE: ${DISTRIBUTOR_ROLE}`);
  console.log(` - RETAILER_ROLE: ${RETAILER_ROLE}`);

  // Thực hiện cấp quyền
  console.log("\nGranting roles...");

  async function grantRoleIfNotGranted(role, accountAddress, roleName) {
      if (!(await supplyChain.hasRole(role, accountAddress))) {
          console.log(` -> Granting ${roleName} to ${accountAddress}...`);
          const tx = await supplyChain.connect(deployer).grantAccess(role, accountAddress);
          await tx.wait(); // Đợi transaction hoàn tất
          console.log(`    Done.`);
      } else {
          console.log(` -> Account ${accountAddress} already has role ${roleName}. Skipping.`);
      }
  }

  await grantRoleIfNotGranted(PRODUCER_ROLE, accounts.producer, "PRODUCER_ROLE");
  await grantRoleIfNotGranted(TRANSPORTER_ROLE, accounts.transporter, "TRANSPORTER_ROLE");
  await grantRoleIfNotGranted(DISTRIBUTOR_ROLE, accounts.distributor, "DISTRIBUTOR_ROLE");
  await grantRoleIfNotGranted(RETAILER_ROLE, accounts.retailer, "RETAILER_ROLE");

  console.log("\n🎉 Role granting process finished!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});