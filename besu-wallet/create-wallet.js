const { Wallet } = require('ethers');
const wallet = Wallet.createRandom();

console.log("🎉 Tài khoản mới được tạo:");
console.log("Địa chỉ: ", wallet.address);
console.log("Private Key: ", wallet.privateKey);
console.log("Mnemonic: ", wallet.mnemonic.phrase);
