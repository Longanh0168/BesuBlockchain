const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Deploying upgradeable SupplyChainTracking contract...");

    // Bước 1: Đọc địa chỉ của hợp đồng SupplyChainCoin đã được triển khai trước đó
    let tokenAddress;
    try {
        tokenAddress = fs.readFileSync("deployedTokenAddress.txt", "utf8").trim();
        console.log(`Found SupplyChainCoin address: ${tokenAddress}`);
    } catch (error) {
        console.error("Error: deployedTokenAddress.txt not found or empty.");
        console.error("Please ensure SupplyChainCoin is deployed and its address is saved to deployedTokenAddress.txt.");
        process.exit(1); // Thoát nếu không tìm thấy địa chỉ token
    }

    // Lấy đối tượng "Factory" cho contract SupplyChainTracking
    const SupplyChainTracking = await hre.ethers.getContractFactory("SupplyChainTracking");

    // Deploy contract SỬ DỤNG PROXY
    // deployProxy sẽ triển khai 3 thứ: Implementation contract, Proxy contract, và AdminUpgradeabilityProxy contract (để quản lý việc nâng cấp)
    // Nó cũng TỰ ĐỘNG gọi hàm initialize() trên Proxy (ủy quyền đến Implementation)
    // Bạn có thể truyền tham số cho hàm initialize() dưới dạng mảng sau tên Factory.
    // Hàm initialize() của bạn không nhận tham số, nên mảng tham số là rỗng `[]`.
    const supplyChain = await upgrades.deployProxy(SupplyChainTracking, [], { initializer: 'initialize', kind: 'uups' });

    // Chờ cho đến khi transaction deploy được mined và contract có địa chỉ
    await supplyChain.waitForDeployment();

    const contractAddress = await supplyChain.getAddress();
    console.log(`Proxy contract deployed successfully to address: ${contractAddress}`);
    console.log("Note: This is the PROXY address. Interact with this address.");

    // Hardhat Upgrades plugin cũng lưu lại địa chỉ của implementation và proxy trong tệp .openzeppelin
    // Bạn có thể lấy địa chỉ implementation nếu cần (ví dụ để xác minh mã nguồn trên Etherscan)
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
    console.log(`Implementation contract deployed to address: ${implementationAddress}`);

    // Lưu địa chỉ PROXY này lại để dùng trong các script khác và ứng dụng của bạn
    fs.writeFileSync("deployedProxyAddress.txt", contractAddress);
    console.log(`Proxy address saved to deployedProxyAddress.txt`);

    // Bước 2: Thiết lập địa chỉ hợp đồng token ERC20 cho SupplyChainTracking
    console.log(`\nSetting SupplyChainCoin address (${tokenAddress}) in SupplyChainTracking contract...`);
    try {
        // Gọi hàm setTokenContractAddress trên hợp đồng proxy
        const setTokenTx = await supplyChain.setTokenContractAddress(tokenAddress);
        await setTokenTx.wait();
        console.log("SupplyChainCoin address set successfully!");
    } catch (error) {
        console.error("Failed to set token contract address:", error);
        process.exit(1);
    }

    // *** QUAN TRỌNG: Cấp vai trò ban đầu ***
    // Hàm initialize đã cấp DEFAULT_ADMIN_ROLE cho người deploy proxy.
    // Bây giờ bạn cần cấp các vai trò khác (PRODUCER, TRANSPORTER, v.v.)
    // Script grant_roles.js bạn đã viết sẽ làm việc này, chỉ cần đảm bảo nó kết nối đến `contractAddress` (địa chỉ Proxy).
    console.log("\nRemember to run the grant_roles.js script using the proxy address to set up roles.");
    console.log("\n🎉 SupplyChainTracking deployment and token linking finished!");
}

// Xử lý lỗi chuẩn của Hardhat
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});