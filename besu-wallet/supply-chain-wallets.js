const { Wallet } = require('ethers');
const fs = require('fs');

// Tạo tài khoản cho Administrator
const adminWallet = Wallet.createRandom();
console.log("🎉 Tài khoản Administrator được tạo:")
console.log("Địa chỉ (Admin): ", adminWallet.address);
console.log("Private Key (Admin): ", adminWallet.privateKey);
console.log("Mnemonic (Admin): ", adminWallet.mnemonic.phrase);

// Tạo tài khoản cho Nhà sản xuất
const producerWallet = Wallet.createRandom();
console.log("🎉 Tài khoản Nhà sản xuất được tạo:");
console.log("Địa chỉ (Producer): ", producerWallet.address);
console.log("Private Key (Producer): ", producerWallet.privateKey);
console.log("Mnemonic (Producer): ", producerWallet.mnemonic.phrase);

// Tạo tài khoản cho Nhà vận chuyển
const transporterWallet = Wallet.createRandom();
console.log("\n🎉 Tài khoản Nhà vận chuyển được tạo:");
console.log("Địa chỉ (Transporter): ", transporterWallet.address);
console.log("Private Key (Transporter): ", transporterWallet.privateKey);
console.log("Mnemonic (Transporter): ", transporterWallet.mnemonic.phrase);

// Tạo tài khoản cho Nhà phân phối
const distributorWallet = Wallet.createRandom();
console.log("\n🎉 Tài khoản Nhà phân phối được tạo:");
console.log("Địa chỉ (Distributor): ", distributorWallet.address);
console.log("Private Key (Distributor): ", distributorWallet.privateKey);
console.log("Mnemonic (Distributor): ", distributorWallet.mnemonic.phrase);

// Tạo tài khoản cho Nhà bán lẻ
const retailerWallet = Wallet.createRandom();
console.log("\n🎉 Tài khoản Nhà bán lẻ được tạo:");
console.log("Địa chỉ (Retailer): ", retailerWallet.address);
console.log("Private Key (Retailer): ", retailerWallet.privateKey);
console.log("Mnemonic (Retailer): ", retailerWallet.mnemonic.phrase);

// Tạo tài khoản cho Khách hàng
const customerWallet = Wallet.createRandom();
console.log("\n🎉 Tài khoản Khách hàng được tạo:");
console.log("Địa chỉ (Customer): ", customerWallet.address);
console.log("Private Key (Customer): ", customerWallet.privateKey);
console.log("Mnemonic (Customer): ", customerWallet.mnemonic.phrase);

// Lưu thông tin tài khoản vào file JSON
const accounts = {
    administrator: {
        address: adminWallet.address,
        privateKey: adminWallet.privateKey,
        mnemonic: adminWallet.mnemonic.phrase,
    },
    producer: {
        address: producerWallet.address,
        privateKey: producerWallet.privateKey,
        mnemonic: producerWallet.mnemonic.phrase,
    },
    transporter: {
        address: transporterWallet.address,
        privateKey: transporterWallet.privateKey,
        mnemonic: transporterWallet.mnemonic.phrase,
    },
    distributor: {
        address: distributorWallet.address,
        privateKey: distributorWallet.privateKey,
        mnemonic: distributorWallet.mnemonic.phrase,
    },
    retailer: {
        address: retailerWallet.address,
        privateKey: retailerWallet.privateKey,
        mnemonic: retailerWallet.mnemonic.phrase,
    },
    customer: {
        address: customerWallet.address,
        privateKey: customerWallet.privateKey,
        mnemonic: customerWallet.mnemonic.phrase,
    },
};

// Ghi vào file JSON
fs.writeFileSync('accounts.json', JSON.stringify(accounts, null, 2));
console.log("\n🎉 Tài khoản đã được lưu vào file accounts.json");