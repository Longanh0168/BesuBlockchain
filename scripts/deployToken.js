const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await hre.ethers.getSigners(); // Tài khoản này sẽ là chủ sở hữu token contract

    console.log("Deploying SupplyChainCoin with the account:", deployer.address);
    console.log("Account ETH balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

    const tokenName = "SupplyChainCoin"; // Đặt tên token của bạn
    const tokenSymbol = "SCC";           // Đặt ký hiệu token của bạn

    const SupplyChainCoin = await hre.ethers.getContractFactory("SupplyChainCoin");
    const supplyChainCoin = await SupplyChainCoin.deploy(deployer.address, tokenName, tokenSymbol);

    await supplyChainCoin.waitForDeployment();

    const tokenAddress = await supplyChainCoin.getAddress();
    console.log(`SupplyChainCoin (SCC) deployed to: ${tokenAddress}`);
    console.log(`Token Owner (minter): ${deployer.address}`);

    // Lưu địa chỉ token vào file để các script khác có thể đọc
    fs.writeFileSync("deployedTokenAddress.txt", tokenAddress);
    console.log(`Token address saved to deployedTokenAddress.txt`);

    const genesisAccounts = [
        "0xa586c054754e674141B3E1067dD6163Baae59417", // Administrator
        "0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54", // Producer
        "0xAAfD5D06eAB12321852413ffE3A06233C33e8a66", // Customer
        "0xe83f7EA2eB8D5049d9162B1F2cfc9075a1C698D0", // Transporter
        "0xBe85127318076116cf4C19c5Dd91C95503368FFe", // Distributor
        "0xB85a94BB5D2F97D1CD517b7ec6208b869C4b2444"  // Retailer
    ];
    const amountToMintPerAccount = hre.ethers.parseUnits("1000000", 18); // 1 triệu SCC (18 decimals)

    for (const accountAddress of genesisAccounts) {
        console.log(`\nMinting ${hre.ethers.formatUnits(amountToMintPerAccount, 18)} SCC to ${accountAddress}...`);
        const mintTx = await supplyChainCoin.connect(deployer).mint(accountAddress, amountToMintPerAccount);
        await mintTx.wait();
        console.log(`Minted to ${accountAddress}.`);
        const balance = await supplyChainCoin.balanceOf(accountAddress);
        console.log(`Current SCC balance of ${accountAddress}: ${hre.ethers.formatUnits(balance, 18)} SCC`);
    }
    console.log("\n🎉 Token deployment and initial minting finished!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
