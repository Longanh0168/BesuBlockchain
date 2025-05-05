const { Wallet } = require('ethers');
const fs = require('fs');

// Danh sách các tài khoản với mnemonic
const accounts = [
    {
        name: "producer",
        address: "0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54",
        mnemonic: "armed output earth tip noble opera swarm midnight myself bean promote corn"
    },
    {
        name: "transporter",
        address: "0xe83f7EA2eB8D5049d9162B1F2cfc9075a1C698D0",
        mnemonic: "drastic sure vote edge naive drum basic resemble year slab reason fault"
    },
    {
        name: "distributor",
        address: "0xBe85127318076116cf4C19c5Dd91C95503368FFe",
        mnemonic: "man sword cargo gate either hard payment leaf tragic swamp tide knife"
    },
    {
        name: "retailer",
        address: "0xB85a94BB5D2F97D1CD517b7ec6208b869C4b2444",
        mnemonic: "daughter radar help lens surface game away trap good weapon school carpet"
    },
    {
        name: "customer",
        address: "0xAAfD5D06eAB12321852413ffE3A06233C33e8a66",
        mnemonic: "borrow short ramp truck napkin either pair ill today social video manual"
    }
];

// Lấy private key từ mnemonic
accounts.forEach(account => {
    const wallet = Wallet.fromPhrase(account.mnemonic); // Sử dụng Wallet.fromPhrase thay vì Wallet.fromMnemonic
    console.log(`🎉 Tài khoản ${account.name} được khôi phục:`);
    console.log(`Địa chỉ: ${wallet.address}`);
    console.log(`Private Key: ${wallet.privateKey}`);
    console.log(`Mnemonic: ${account.mnemonic}`);
    console.log('---------------------------');
});

const recoveredAccounts = accounts.map(account => {
    const wallet = Wallet.fromPhrase(account.mnemonic); // Sử dụng Wallet.fromPhrase thay vì Wallet.fromMnemonic
    return {
        name: account.name,
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: account.mnemonic
    };
});

fs.writeFileSync('recovered-accounts.json', JSON.stringify(recoveredAccounts, null, 2));
console.log("🎉 Tài khoản đã được lưu vào file recovered-accounts.json");