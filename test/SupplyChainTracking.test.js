const { expect } = require("chai");
const { ethers } = require("hardhat");
const { upgrades } = require("hardhat");

// Mô tả bộ kiểm thử cho hợp đồng SupplyChainTracking
describe("SupplyChainTracking (Upgradeable)", function () {
    let contract; // Biến lưu trữ instance của hợp đồng SupplyChainTracking đã triển khai
    let supplyChainCoin; // Biến lưu trữ instance của hợp đồng SupplyChainCoin đã triển khai
    let admin, producer, transporter, distributor, retailer, outsider, customer; // Các biến lưu trữ signer (tài khoản)
    let itemId = ethers.encodeBytes32String("ITEM001"); // ID mẫu cho mặt hàng (dùng bytes32)
    let itemDescription = "Sữa tươi tiệt trùng 100% nguyên chất"; // Mô tả mẫu cho mặt hàng
    let plannedDeliveryTime = BigInt(Math.floor(Date.now() / 1000) + 3600); // Thời gian giao hàng dự kiến (1 giờ kể từ bây giờ)

    // Giá mẫu cho các bài test
    const initialCostPrice = ethers.parseUnits("100", 18); // 100 SCC
    const initialSellingPrice = ethers.parseUnits("200", 18); // 200 SCC
    const updatedSellingPrice = ethers.parseUnits("250", 18); // 250 SCC

    // Hàm này chạy trước mỗi bài kiểm thử (it block)
    // Nó thiết lập môi trường kiểm thử sạch sẽ cho mỗi lần chạy
    beforeEach(async function () {
        // Lấy danh sách các tài khoản (signer) từ Hardhat Network
        [admin, producer, transporter, distributor, retailer, outsider, customer] = await ethers.getSigners();

        // --- Bước 1: Triển khai hợp đồng SupplyChainCoin (Token) ---
        const SupplyChainCoinFactory = await ethers.getContractFactory("SupplyChainCoin");
        supplyChainCoin = await SupplyChainCoinFactory.deploy(admin.address, "SupplyChainCoin", "SCC");
        await supplyChainCoin.waitForDeployment();
        const tokenAddress = await supplyChainCoin.getAddress();
        console.log(`SupplyChainCoin deployed to: ${tokenAddress}`);

        // --- Bước 2: Mint một lượng token ban đầu cho các tài khoản liên quan ---
        const mintAmount = ethers.parseUnits("1000000", 18); // 1 triệu SCC
        await supplyChainCoin.connect(admin).mint(producer.address, mintAmount);
        await supplyChainCoin.connect(admin).mint(transporter.address, mintAmount);
        await supplyChainCoin.connect(admin).mint(distributor.address, mintAmount);
        await supplyChainCoin.connect(admin).mint(retailer.address, mintAmount);
        // Customer không cần token để nhận hàng, nhưng có thể cần nếu bạn thêm logic thanh toán từ customer

        // --- Bước 3: Triển khai hợp đồng SupplyChainTracking (Upgradeable) ---
        const SupplyChainTracking = await ethers.getContractFactory("SupplyChainTracking");
        contract = await upgrades.deployProxy(SupplyChainTracking, [], { initializer: 'initialize', kind: 'uups' });
        await contract.waitForDeployment();
        const contractAddress = await contract.getAddress();
        console.log(`SupplyChainTracking Proxy deployed to: ${contractAddress}`);

        // --- Bước 4: Thiết lập địa chỉ token trong SupplyChainTracking ---
        await contract.connect(admin).setTokenContractAddress(tokenAddress);
        expect(await contract.tokenContract()).to.equal(tokenAddress);
        console.log(`SupplyChainTracking tokenContract set to: ${tokenAddress}`);

        // --- Bước 5: Cấp vai trò cho các tài khoản ---
        await contract.connect(admin).grantAccess(await contract.PRODUCER_ROLE(), producer.address);
        await contract.connect(admin).grantAccess(await contract.TRANSPORTER_ROLE(), transporter.address);
        await contract.connect(admin).grantAccess(await contract.DISTRIBUTOR_ROLE(), distributor.address);
        await contract.connect(admin).grantAccess(await contract.RETAILER_ROLE(), retailer.address);
        // Tài khoản 'outsider' và 'customer' sẽ không có vai trò nào trong chuỗi cung ứng
    });

    // Bài kiểm thử: Producer tạo sản phẩm thành công
    it("Bài 1: Producer tạo sản phẩm thành công và có thông tin đúng, thanh toán costPrice", async function () {
        // Kiểm tra số dư ban đầu của Producer và FeeCollector
        const producerInitialBalance = await supplyChainCoin.balanceOf(producer.address);
        const feeCollectorInitialBalance = await supplyChainCoin.balanceOf(await contract.feeCollector());

        // Producer cần approve hợp đồng SupplyChainTracking để chi tiêu costPrice
        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);

        // Bắt đầu xử lý: Producer gọi hàm createItem để tạo sản phẩm mới
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);

        // Xác nhận kết quả: Lấy thông tin mặt hàng từ mapping public 'items'
        const item = await contract.items(itemId);

        // Kiểm tra các thuộc tính của mặt hàng vừa tạo
        expect(item.id).to.equal(itemId);
        expect(item.name).to.equal("Milk");
        expect(item.description).to.equal(itemDescription);
        expect(item.currentOwner).to.equal(producer.address);
        expect(item.currentState).to.equal(0); // State.Produced
        expect(item.exists).to.equal(true);
        expect(item.plannedDeliveryTime).to.equal(plannedDeliveryTime);
        expect(item.costPrice).to.equal(initialCostPrice);
        expect(item.sellingPrice).to.equal(initialSellingPrice);

        // Kiểm tra số dư sau giao dịch
        expect(await supplyChainCoin.balanceOf(producer.address)).to.equal(producerInitialBalance - initialCostPrice);
        expect(await supplyChainCoin.balanceOf(await contract.feeCollector())).to.equal(feeCollectorInitialBalance + initialCostPrice);

        // Kiểm tra lịch sử
        const history = await contract.getItemHistory(itemId);
        expect(history.length).to.equal(1);
        expect(history[0].state).to.equal(0); // State.Produced
        expect(history[0].actor).to.equal(producer.address);
        expect(history[0].note).to.equal("Item created");
    });

    // Bài kiểm thử: Producer không thể tạo sản phẩm đã tồn tại
    it("Bài 2: Producer không thể tạo sản phẩm đã tồn tại", async function () {
        // Bước 1: Tạo sản phẩm lần đầu (sẽ thành công)
        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);

        // Bước 2: Cố gắng tạo lại sản phẩm với cùng ID
        await expect(
            contract.connect(producer).createItem(itemId, "Soy Milk", "New Description", plannedDeliveryTime + BigInt(1000), initialCostPrice, initialSellingPrice)
        ).to.be.revertedWith("Item already exists");
    });

    // Bài kiểm thử: Tài khoản không phải Producer không thể tạo sản phẩm
    it("Bài 3: Tài khoản không phải Producer không thể tạo sản phẩm", async function () {
        // Cố gắng gọi createItem bằng tài khoản Transporter (không có vai trò Producer)
        await expect(
            contract.connect(transporter).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice)
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
            .withArgs(transporter.address, await contract.PRODUCER_ROLE());

        // Cố gắng gọi createItem bằng tài khoản outsider (không có vai trò nào)
        await expect(
            contract.connect(outsider).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice)
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
            .withArgs(outsider.address, await contract.PRODUCER_ROLE());
    });

    // Bài kiểm thử: Cập nhật giá bán của mặt hàng
    it("Bài 4: Chủ sở hữu hiện tại có thể cập nhật giá bán của mặt hàng", async function () {
        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);

        let item = await contract.items(itemId);
        expect(item.sellingPrice).to.equal(initialSellingPrice);

        // Producer cập nhật giá bán
        const updateTx = await contract.connect(producer).updateSellingPrice(itemId, updatedSellingPrice);
        await expect(updateTx)
            .to.emit(contract, "ItemSellingPriceUpdated")
            .withArgs(itemId, updatedSellingPrice, producer.address);

        item = await contract.items(itemId);
        expect(item.sellingPrice).to.equal(updatedSellingPrice);

        // Tài khoản khác không phải chủ sở hữu không thể cập nhật
        await expect(
            contract.connect(outsider).updateSellingPrice(itemId, ethers.parseUnits("300", 18))
        ).to.be.revertedWith("Only current owner can update selling price");
    });

    // Bài kiểm thử: Luồng xử lý đầy đủ trong chuỗi cung ứng
    // Producer -> Transporter -> Distributor -> Retailer -> Received -> Sold (to Customer)
    it("Bài 5: Luồng đầy đủ: Producer -> Transporter -> Distributor -> Retailer -> Received -> Sold (to Customer) với thanh toán token", async function () {
        // 1. Producer tạo sản phẩm
        // Trạng thái: Produced (0), Chủ sở hữu: Producer
        const producerInitialBalance = await supplyChainCoin.balanceOf(producer.address);
        const feeCollectorInitialBalance = await supplyChainCoin.balanceOf(await contract.feeCollector());

        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);

        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(producer.address);
        expect(item.currentState).to.equal(0); // State.Produced
        expect(await supplyChainCoin.balanceOf(producer.address)).to.equal(producerInitialBalance - initialCostPrice);
        expect(await supplyChainCoin.balanceOf(await contract.feeCollector())).to.equal(feeCollectorInitialBalance + initialCostPrice);

        // 2. Producer bắt đầu chuyển giao cho Transporter
        // Trạng thái: InTransit (1), Chủ sở hữu vẫn là Producer cho đến khi người nhận confirm
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(1); // State.InTransit
        expect(item.currentOwner).to.equal(producer.address); // Owner hasn't changed yet

        // 3. Transporter xác nhận nhận hàng và thanh toán sellingPrice cho Producer
        const transporterInitialBalance = await supplyChainCoin.balanceOf(transporter.address);
        const producerBalanceBeforeTransfer = await supplyChainCoin.balanceOf(producer.address);

        await supplyChainCoin.connect(transporter).approve(await contract.getAddress(), item.sellingPrice); // Transporter approve
        const confirmTx1 = await contract.connect(transporter).confirmTransfer(itemId);
        await expect(confirmTx1)
            .to.emit(contract, "PaymentTransferred")
            .withArgs(itemId, transporter.address, producer.address, item.sellingPrice, "Item Selling Price");

        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(transporter.address); // Chủ sở hữu mới là Transporter
        expect(item.currentState).to.equal(1); // State.InTransit (vẫn là 1 theo logic hiện tại của confirmTransfer)
        expect(await supplyChainCoin.balanceOf(transporter.address)).to.equal(transporterInitialBalance - initialSellingPrice);
        expect(await supplyChainCoin.balanceOf(producer.address)).to.equal(producerBalanceBeforeTransfer + initialSellingPrice);

        // 4. Transporter bắt đầu chuyển giao cho Distributor
        // Trạng thái: InTransit (1), Chủ sở hữu vẫn là Transporter
        await contract.connect(transporter).initiateTransfer(itemId, distributor.address);
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(1); // State.InTransit
        expect(item.currentOwner).to.equal(transporter.address); // Owner hasn't changed yet

        // 5. Distributor xác nhận nhận hàng và thanh toán sellingPrice cho Transporter
        const distributorInitialBalance = await supplyChainCoin.balanceOf(distributor.address);
        const transporterBalanceBeforeTransfer = await supplyChainCoin.balanceOf(transporter.address);

        await supplyChainCoin.connect(distributor).approve(await contract.getAddress(), item.sellingPrice); // Distributor approve
        const confirmTx2 = await contract.connect(distributor).confirmTransfer(itemId);
        await expect(confirmTx2)
            .to.emit(contract, "PaymentTransferred")
            .withArgs(itemId, distributor.address, transporter.address, item.sellingPrice, "Item Selling Price");

        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(distributor.address); // Chủ sở hữu mới là Distributor
        expect(item.currentState).to.equal(2); // State.ReceivedAtDistributor
        expect(await supplyChainCoin.balanceOf(distributor.address)).to.equal(distributorInitialBalance - initialSellingPrice);
        expect(await supplyChainCoin.balanceOf(transporter.address)).to.equal(transporterBalanceBeforeTransfer + initialSellingPrice);

        // 6. Distributor bắt đầu chuyển giao cho Retailer
        // Trạng thái: InTransitToRetailer (3), Chủ sở hữu vẫn là Distributor
        await contract.connect(distributor).initiateTransfer(itemId, retailer.address);
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(3); // State.InTransitToRetailer
        expect(item.currentOwner).to.equal(distributor.address); // Owner hasn't changed yet

        // 7. Retailer xác nhận nhận hàng và thanh toán sellingPrice cho Distributor
        const retailerInitialBalance = await supplyChainCoin.balanceOf(retailer.address);
        const distributorBalanceBeforeTransfer = await supplyChainCoin.balanceOf(distributor.address);

        await supplyChainCoin.connect(retailer).approve(await contract.getAddress(), item.sellingPrice); // Retailer approve
        const confirmTx3 = await contract.connect(retailer).confirmTransfer(itemId);
        await expect(confirmTx3)
            .to.emit(contract, "PaymentTransferred")
            .withArgs(itemId, retailer.address, distributor.address, item.sellingPrice, "Item Selling Price");

        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(retailer.address); // Chủ sở hữu mới là Retailer
        expect(item.currentState).to.equal(4); // State.Delivered
        expect(await supplyChainCoin.balanceOf(retailer.address)).to.equal(retailerInitialBalance - initialSellingPrice);
        expect(await supplyChainCoin.balanceOf(distributor.address)).to.equal(distributorBalanceBeforeTransfer + initialSellingPrice);

        // 8. Retailer đánh dấu sản phẩm đã được nhận tại cửa hàng (sẵn sàng bán)
        await contract.connect(retailer).markAsReceived(itemId);
        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(retailer.address); // Chủ sở hữu vẫn là Retailer
        expect(item.currentState).to.equal(5); // State.Received

        // 9. Retailer đánh dấu sản phẩm đã bán cho người tiêu dùng cuối
        const markAsSoldToCustomer = await contract.connect(retailer).markAsSold(itemId, customer.address);
        await expect(markAsSoldToCustomer)
            .to.emit(contract, "ItemSoldToCustomer")
            .withArgs(itemId, retailer.address, customer.address);

        item = await contract.items(itemId);
        expect(item.currentState).to.equal(6); // State.Sold
        expect(item.currentOwner).to.equal(customer.address); // Chủ sở hữu mới là Customer

        // Kiểm tra lịch sử đầy đủ sau tất cả các bước
        const history = await contract.getItemHistory(itemId);
        expect(history.length).to.equal(9); // 9 mục lịch sử
        expect(history[8].state).to.equal(6); // State.Sold
        expect(history[8].actor).to.equal(retailer.address); // Actor là Retailer (người thực hiện)
        expect(history[8].note).to.equal("Item sold to customer");
    });

    // Bài kiểm thử: Báo cáo hư hỏng bởi Transporter
    it("Bài 6: Báo cáo hư hỏng bởi Transporter", async function () {
        // Bước chuẩn bị: Tạo sản phẩm và chuyển đến Transporter
        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        await supplyChainCoin.connect(transporter).approve(await contract.getAddress(), initialSellingPrice);
        await contract.connect(transporter).confirmTransfer(itemId);

        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(transporter.address);
        expect(item.currentState).to.equal(1); // InTransit

        // Bắt đầu xử lý: Transporter báo cáo hư hỏng
        const damageReason = "Broken during shipping";
        await contract.connect(transporter).reportDamage(itemId, damageReason);

        // Xác nhận kết quả: Kiểm tra trạng thái mới (Damaged - 7) và lịch sử
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(7); // Damaged

        const history = await contract.getItemHistory(itemId);
        expect(history.length).to.equal(4); // Created, Init, Confirm, Report Damage
        expect(history[3].state).to.equal(7);
        expect(history[3].actor).to.equal(transporter.address);
        expect(history[3].note).to.equal(damageReason);
    });

    // Bài kiểm thử: Báo cáo mất hàng bởi Distributor
    it("Bài 7: Báo cáo mất hàng bởi Distributor", async function () {
        // Bước chuẩn bị: Tạo sản phẩm, chuyển đến Transporter, rồi chuyển đến Distributor
        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        await supplyChainCoin.connect(transporter).approve(await contract.getAddress(), initialSellingPrice);
        await contract.connect(transporter).confirmTransfer(itemId);
        await contract.connect(transporter).initiateTransfer(itemId, distributor.address);
        await supplyChainCoin.connect(distributor).approve(await contract.getAddress(), initialSellingPrice);
        await contract.connect(distributor).confirmTransfer(itemId);

        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(distributor.address);
        expect(item.currentState).to.equal(2); // ReceivedAtDistributor

        // Bắt đầu xử lý: Distributor báo cáo mất hàng
        const lostReason = "Lost at warehouse";
        await contract.connect(distributor).reportLostAtDistributor(itemId, lostReason);

        // Xác nhận kết quả: Kiểm tra trạng thái mới (Lost - 8) và lịch sử
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(8); // Lost

        const history = await contract.getItemHistory(itemId);
        expect(history.length).to.equal(6); // Created, Init(P->T), Confirm(T), Init(T->D), Confirm(D), Report Lost
        expect(history[5].state).to.equal(8);
        expect(history[5].actor).to.equal(distributor.address);
        expect(history[5].note).to.equal(lostReason);
    });

    // Bài kiểm thử: Thêm chứng chỉ cho sản phẩm
    it("Bài 8: Thêm chứng chỉ cho sản phẩm", async function () {
        // Bước chuẩn bị: Tạo sản phẩm
        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);

        // Bắt đầu xử lý: Producer thêm chứng chỉ
        const certName = "Organic Certification";
        const certIssuer = "Certifier A";
        await contract.connect(producer).addCertificate(itemId, certName, certIssuer);

        // Xác nhận kết quả: Lấy danh sách chứng chỉ và kiểm tra
        const certificates = await contract.getCertificates(itemId);
        expect(certificates.length).to.equal(1);
        expect(certificates[0].certName).to.equal(certName);
        expect(certificates[0].certIssuer).to.equal(certIssuer);
        expect(certificates[0].issueDate).to.be.closeTo(BigInt(Math.floor(Date.now() / 1000)), 300);

        // Thêm chứng chỉ thứ hai
        const certName2 = "ISO 9001";
        const certIssuer2 = "Certifier B";
        await contract.connect(producer).addCertificate(itemId, certName2, certIssuer2);

        // Kiểm tra lại danh sách chứng chỉ
        const certificatesAfterAdd = await contract.getCertificates(itemId);
        expect(certificatesAfterAdd.length).to.equal(2);
        expect(certificatesAfterAdd[1].certName).to.equal(certName2);
        expect(certificatesAfterAdd[1].certIssuer).to.equal(certIssuer2);
    });


    // Bài kiểm thử: Kiểm tra phân quyền (outsider không được phép thực hiện các hành động quan trọng)
    it("Bài 9: Không cho phép tài khoản không có vai trò hoặc không phải chủ sở hữu thực hiện hành động trái phép", async function () {
        // Bước chuẩn bị: Tạo sản phẩm bởi Producer
        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);
        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(producer.address);

        // Outsider cố gắng bắt đầu chuyển giao (outsider không phải chủ sở hữu)
        await expect(
            contract.connect(outsider).initiateTransfer(itemId, transporter.address)
        ).to.be.revertedWith("Only current owner can initiate transfer");

        // Outsider cố gắng báo cáo hư hỏng (hàm chỉ dành cho TRANSPORTER_ROLE)
        await expect(
            contract.connect(outsider).reportDamage(itemId, "Try damage")
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
            .withArgs(outsider.address, await contract.TRANSPORTER_ROLE());

        // BỔ SUNG TEST: Outsider cố gắng gọi markAsSold (outsider không có RETAILER_ROLE)
        await expect(
            contract.connect(outsider).markAsSold(itemId, customer.address)
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
            .withArgs(outsider.address, await contract.RETAILER_ROLE());

        // BỔ SUNG TEST: Producer cố gắng gọi markAsSold (Producer không có RETAILER_ROLE)
        await expect(
            contract.connect(producer).markAsSold(itemId, customer.address)
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
            .withArgs(producer.address, await contract.RETAILER_ROLE());

        // BỔ SUNG TEST: Transporter cố gắng gọi markAsSold (Transporter không có RETAILER_ROLE)
        await expect(
            contract.connect(transporter).markAsSold(itemId, customer.address)
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
            .withArgs(transporter.address, await contract.RETAILER_ROLE());

        // Chuyển hàng đến Retailer để test lỗi "Only current owner can mark sold"
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        await supplyChainCoin.connect(transporter).approve(await contract.getAddress(), initialSellingPrice);
        await contract.connect(transporter).confirmTransfer(itemId);

        await contract.connect(transporter).initiateTransfer(itemId, distributor.address);
        await supplyChainCoin.connect(distributor).approve(await contract.getAddress(), initialSellingPrice);
        await contract.connect(distributor).confirmTransfer(itemId);

        await contract.connect(distributor).initiateTransfer(itemId, retailer.address);
        await supplyChainCoin.connect(retailer).approve(await contract.getAddress(), initialSellingPrice);
        await contract.connect(retailer).confirmTransfer(itemId);

        await contract.connect(retailer).markAsReceived(itemId);
        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(retailer.address); // Retailer là chủ sở hữu

        // Thực hiện bán lần đầu để chuyển quyền sở hữu sang customer
        await contract.connect(retailer).markAsSold(itemId, customer.address);
        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(customer.address); // Chủ sở hữu đã là customer

        // BỔ SUNG TEST: Retailer cố gắng gọi markAsSold lần thứ 2 sau khi đã bán thành công (chủ sở hữu đã là customer)
        await expect(
            contract.connect(retailer).markAsSold(itemId, outsider.address) // Retailer gọi lại
        ).to.be.revertedWith("Only current owner (Retailer) can mark sold"); // Giờ lỗi sẽ là về chủ sở hữu
    });

    // Bài kiểm thử: Kiểm tra điều kiện lỗi khác trong Initiate/Confirm Transfer
    it("Bài 10: Kiểm tra điều kiện lỗi trong Initiate/Confirm Transfer", async function () {
        // Bước chuẩn bị: Tạo sản phẩm
        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);
        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(producer.address);

        // InitiateTransfer lỗi: Người nhận có vai trò không hợp lệ (ví dụ: admin hoặc customer)
        await expect(
            contract.connect(producer).initiateTransfer(itemId, admin.address)
        ).to.be.revertedWith("Invalid receiver role");

        await expect(
            contract.connect(producer).initiateTransfer(itemId, customer.address)
        ).to.be.revertedWith("Invalid receiver role");

        // InitiateTransfer lỗi: Item không tồn tại
        const nonExistentItemId = ethers.encodeBytes32String("NONEXISTENT");
        await expect(
            contract.connect(producer).initiateTransfer(nonExistentItemId, transporter.address)
        ).to.be.revertedWith("Item does not exist");

        // Bắt đầu chuyển giao hợp lệ để kiểm tra ConfirmTransfer
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        let pendingTransfer = await contract.pendingTransfers(itemId);
        expect(pendingTransfer.to).to.equal(transporter.address);

        // ConfirmTransfer lỗi: Người gọi không phải là người nhận đang chờ
        await expect(
            contract.connect(distributor).confirmTransfer(itemId)
        ).to.be.revertedWith("Only receiver can confirm transfer");

        // ConfirmTransfer lỗi: Item không tồn tại (gọi confirm cho item chưa initiate)
        await expect(
            contract.connect(transporter).confirmTransfer(nonExistentItemId)
        ).to.be.revertedWith("Item does not exist"); // Sẽ lỗi ở require(transfer.to == msg.sender) vì transfer.to là address(0)

        // ConfirmTransfer lỗi: Không đủ allowance
        const transporterBalance = await supplyChainCoin.balanceOf(transporter.address);
        // Đặt allowance nhỏ hơn sellingPrice
        await supplyChainCoin.connect(transporter).approve(await contract.getAddress(), initialSellingPrice - BigInt(1)); // Giả sử sellingPrice > 0
        await expect(
            contract.connect(transporter).confirmTransfer(itemId)
        ).to.be.revertedWith("Insufficient token allowance for selling price");

        // Reset allowance để không ảnh hưởng các test khác nếu có
        await supplyChainCoin.connect(transporter).approve(await contract.getAddress(), initialSellingPrice); // Approve lại đủ
        await contract.connect(transporter).confirmTransfer(itemId); // Hoàn tất transfer để dọn dẹp state
    });

    // Bài kiểm thử: Kiểm tra điều kiện lỗi trong Report Damage/Lost
    it("Bài 11: Kiểm tra điều kiện lỗi trong Report Damage/Lost", async function () {
        // Bước chuẩn bị: Tạo sản phẩm
        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);

        // ReportDamage lỗi: Người gọi không có vai trò Transporter
        await expect(
            contract.connect(retailer).reportDamage(itemId, "Damaged by Retailer?")
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
            .withArgs(retailer.address, await contract.TRANSPORTER_ROLE());

        // ReportLostAtDistributor lỗi: Người gọi không có vai trò Distributor
        await expect(
            contract.connect(transporter).reportLostAtDistributor(itemId, "Lost by Transporter?")
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
            .withArgs(transporter.address, await contract.DISTRIBUTOR_ROLE());

        // ReportDamage lỗi: Item không tồn tại
        const nonExistentItemId = ethers.encodeBytes32String("NONEXISTENT");
        await expect(
            contract.connect(transporter).reportDamage(nonExistentItemId, "Damage non-existent item")
        ).to.be.revertedWith("Item does not exist");

        // ReportLostAtDistributor lỗi: Item không tồn tại
        await expect(
            contract.connect(distributor).reportLostAtDistributor(nonExistentItemId, "Lost non-existent item")
        ).to.be.revertedWith("Item does not exist");
    });

    // Bài kiểm thử: Kiểm tra điều kiện lỗi trong Add Certificate
    it("Bài 12: Kiểm tra điều kiện lỗi trong Add Certificate", async function () {
        // Bước chuẩn bị: Tạo sản phẩm
        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);

        // AddCertificate lỗi: Người gọi không có vai trò Producer
        await expect(
            contract.connect(distributor).addCertificate(itemId, "Organic", "Certifier")
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
            .withArgs(distributor.address, await contract.PRODUCER_ROLE());

        // AddCertificate lỗi: Item không tồn tại
        const nonExistentItemId = ethers.encodeBytes32String("NONEXISTENT");
        await expect(
            contract.connect(producer).addCertificate(nonExistentItemId, "Organic", "Certifier")
        ).to.be.revertedWith("Item does not exist");
    });

    // Bài kiểm thử: Kiểm tra View Functions (bao gồm các hàm mới thêm vào)
    it("Bài 13: Kiểm tra View Functions (bao gồm các hàm mới)", async function () {
        // Bước chuẩn bị: Tạo sản phẩm và thêm vài mục vào lịch sử/chứng chỉ
        await supplyChainCoin.connect(producer).approve(await contract.getAddress(), initialCostPrice);
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime, initialCostPrice, initialSellingPrice);
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        await supplyChainCoin.connect(transporter).approve(await contract.getAddress(), initialSellingPrice);
        await contract.connect(transporter).confirmTransfer(itemId);

        // Thêm chứng chỉ
        const certNameAdded = "Organic";
        const certIssuerAdded = "Certifier A";
        await contract.connect(producer).addCertificate(itemId, certNameAdded, certIssuerAdded);

        // Kiểm tra getItemHistory
        const history = await contract.getItemHistory(itemId);
        expect(history.length).to.equal(3); // Create (1) + Init(P->T) (1) + Confirm(T) (1) = 3
        expect(history[0].state).to.equal(0); // State.Produced
        expect(history[0].actor).to.equal(producer.address);

        // Kiểm tra getCertificates
        const certificates = await contract.getCertificates(itemId);
        expect(certificates.length).to.equal(1);
        expect(certificates[0].certName).to.equal(certNameAdded);
        expect(certificates[0].certIssuer).to.equal(certIssuerAdded);

        // Kiểm tra getter function của mapping items (được tạo tự động)
        const item = await contract.items(itemId);
        expect(item.exists).to.equal(true);
        expect(item.name).to.equal("Milk");
        expect(item.description).to.equal(itemDescription);
        expect(item.currentOwner).to.equal(transporter.address); // Chủ sở hữu hiện tại sau các bước chuẩn bị
        expect(item.currentState).to.equal(1); // Trạng thái hiện tại sau các bước chuẩn bị (InTransit)
        expect(item.plannedDeliveryTime).to.equal(plannedDeliveryTime);
        expect(item.costPrice).to.equal(initialCostPrice);
        expect(item.sellingPrice).to.equal(initialSellingPrice);


        // BỔ SUNG TEST: Kiểm tra hàm getItemDetail
        const itemDetail = await contract.getItemDetail(itemId);
        expect(itemDetail.id).to.equal(itemId);
        expect(itemDetail.name).to.equal("Milk");
        expect(itemDetail.description).to.equal(itemDescription);
        expect(itemDetail.currentOwner).to.equal(transporter.address);
        expect(itemDetail.currentState).to.equal(1); // State.InTransit
        expect(itemDetail.exists).to.equal(true);
        expect(itemDetail.plannedDeliveryTime).to.equal(plannedDeliveryTime);
        expect(itemDetail.costPrice).to.equal(initialCostPrice);
        expect(itemDetail.sellingPrice).to.equal(initialSellingPrice);

        // BỔ SUNG TEST: Kiểm tra hàm getItemOwner
        const itemOwner = await contract.getItemOwner(itemId);
        expect(itemOwner).to.equal(transporter.address);

        // BỔ SUNG TEST: Kiểm tra hàm getItemState
        const itemState = await contract.getItemState(itemId);
        expect(itemState).to.equal(1); // State.InTransit (Enum value 1)

        // Kiểm tra các hàm view với item không tồn tại (sẽ trả về giá trị mặc định)
        const nonExistentItemId = ethers.encodeBytes32String("NONEXISTENT");
        const defaultItem = await contract.items(nonExistentItemId); // Getter tự động
        expect(defaultItem.exists).to.equal(false);
        expect(defaultItem.currentOwner).to.equal(ethers.ZeroAddress);

        const defaultItemDetail = await contract.getItemDetail(nonExistentItemId);
        expect(defaultItemDetail.exists).to.equal(false);

        const defaultItemOwner = await contract.getItemOwner(nonExistentItemId);
        expect(defaultItemOwner).to.equal(ethers.ZeroAddress);

        const defaultItemState = await contract.getItemState(nonExistentItemId);
        expect(defaultItemState).to.equal(0); // Enum mặc định là giá trị đầu tiên (Produced)

        const defaultHistory = await contract.getItemHistory(nonExistentItemId);
        expect(defaultHistory.length).to.equal(0);

        const defaultCertificates = await contract.getCertificates(nonExistentItemId);
        expect(defaultCertificates.length).to.equal(0);
    });
});
