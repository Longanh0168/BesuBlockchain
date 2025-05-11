const { expect } = require("chai");
const { ethers } = require("hardhat");

// Mô tả bộ kiểm thử cho hợp đồng SupplyChainTracking
describe("SupplyChainTracking", function () {
    let contract; // Biến lưu trữ instance của hợp đồng đã triển khai
    // Các biến lưu trữ signer (tài khoản) cho các vai trò khác nhau
    // Thêm biến 'customer' cho bài test markAsSold mới
    let admin, producer, transporter, distributor, retailer, outsider, customer;
    let itemId = ethers.encodeBytes32String("ITEM001"); // ID mẫu cho mặt hàng (dùng bytes32)
    let itemDescription = "Sữa tươi tiệt trùng 100% nguyên chất"; // Mô tả mẫu cho mặt hàng
    // Thời gian giao hàng dự kiến (1 giờ kể từ bây giờ) - sử dụng số nguyên lớn cho chắc chắn trên các môi trường test
    let plannedDeliveryTime = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Hàm này chạy trước mỗi bài kiểm thử (it block)
    // Nó thiết lập môi trường kiểm thử sạch sẽ cho mỗi lần chạy
    beforeEach(async function () {
        // Lấy danh sách các tài khoản (signer) từ Hardhat Network
        // Thêm 'customer' vào danh sách
        [admin, producer, transporter, distributor, retailer, outsider, customer] = await ethers.getSigners();

        // Lấy Factory của hợp đồng SupplyChainTracking để triển khai
        const SupplyChainTracking = await ethers.getContractFactory("SupplyChainTracking");
        // Triển khai hợp đồng. Người triển khai (admin) sẽ tự động nhận DEFAULT_ADMIN_ROLE.
        contract = await SupplyChainTracking.deploy();

        // Thiết lập vai trò cho các tài khoản sử dụng hàm grantAccess (từ AccessControl)
        // Chỉ admin (người có DEFAULT_ADMIN_ROLE) mới có thể cấp vai trò
        await contract.connect(admin).grantAccess(await contract.PRODUCER_ROLE(), producer.address);
        await contract.connect(admin).grantAccess(await contract.TRANSPORTER_ROLE(), transporter.address);
        await contract.connect(admin).grantAccess(await contract.DISTRIBUTOR_ROLE(), distributor.address);
        await contract.connect(admin).grantAccess(await contract.RETAILER_ROLE(), retailer.address);
        // Tài khoản 'outsider' và 'customer' sẽ không có vai trò nào trong chuỗi cung ứng (trừ khi được cấp admin)
        // 'outsider' dùng để kiểm tra phân quyền cấm
        // 'customer' dùng để làm địa chỉ người mua cuối trong bài test markAsSold
    });

    // Bài kiểm thử: Producer tạo sản phẩm thành công
    it("Producer tạo sản phẩm thành công và có thông tin đúng", async function () {
        // Bắt đầu xử lý: Producer gọi hàm createItem để tạo sản phẩm mới
        // Hợp đồng sẽ kiểm tra:
        // 1. Người gọi có vai trò PRODUCER_ROLE không (qua modifier onlyRole)
        // 2. Item ID này đã tồn tại chưa
        // Nếu hợp lệ, hợp đồng sẽ tạo Item, thiết lập chủ sở hữu là Producer, trạng thái ban đầu là Produced, lưu mô tả, ghi lịch sử và phát event.
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);

        // Xác nhận kết quả: Lấy thông tin mặt hàng từ mapping public 'items'
        // Sử dụng hàm getter tự động của mapping public
        const item = await contract.items(itemId);

        // Kiểm tra các thuộc tính của mặt hàng vừa tạo
        expect(item.id).to.equal(itemId); // ID phải khớp
        expect(item.name).to.equal("Milk"); // Tên phải khớp
        expect(item.description).to.equal(itemDescription); // Mô tả phải khớp
        expect(item.currentOwner).to.equal(producer.address); // Chủ sở hữu ban đầu phải là Producer
        // Kiểm tra trạng thái ban đầu phải là Produced (số nguyên 0)
        expect(item.currentState).to.equal(0); // State.Produced (Enum value 0)

        expect(item.exists).to.equal(true); // Mặt hàng phải tồn tại
        expect(item.plannedDeliveryTime).to.equal(plannedDeliveryTime); // Thời gian giao hàng dự kiến phải khớp

        // Kiểm tra lịch sử: Lịch sử ban đầu phải có 1 mục
        const history = await contract.getItemHistory(itemId);
        expect(history.length).to.equal(1);
        expect(history[0].state).to.equal(0); // State.Produced (Enum value 0)
        expect(history[0].actor).to.equal(producer.address);
        expect(history[0].note).to.equal("Item created");
    });

    // Bài kiểm thử: Producer không thể tạo sản phẩm đã tồn tại
    it("Producer không thể tạo sản phẩm đã tồn tại", async function () {
        // Bước 1: Tạo sản phẩm lần đầu (sẽ thành công)
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);

        // Bước 2: Cố gắng tạo lại sản phẩm với cùng ID
        // Ta mong đợi giao dịch này sẽ bị hoàn lại với lý do "Item already exists".
        await expect(
            contract.connect(producer).createItem(itemId, "Soy Milk", "New Description", plannedDeliveryTime + BigInt(1000))
        ).to.be.revertedWith("Item already exists");
    });

    // Bài kiểm thử: Tài khoản không phải Producer không thể tạo sản phẩm
    it("Tài khoản không phải Producer không thể tạo sản phẩm", async function () {
        // Cố gắng gọi createItem bằng tài khoản Transporter (không có vai trò Producer)
        // Mong đợi giao dịch sẽ bị hoàn lại với lỗi tùy chỉnh của AccessControl.
        await expect(
            contract.connect(transporter).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime)
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
         .withArgs(transporter.address, await contract.PRODUCER_ROLE());

        // Cố gắng gọi createItem bằng tài khoản outsider (không có vai trò nào)
        await expect(
            contract.connect(outsider).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime)
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
         .withArgs(outsider.address, await contract.PRODUCER_ROLE());
    });


    // Bài kiểm thử: Luồng xử lý đầy đủ trong chuỗi cung ứng
    // Producer -> Transporter -> Distributor -> Retailer -> Received -> Sold (to Customer)
    it("Luồng đầy đủ: Producer -> Transporter -> Distributor -> Retailer -> Received -> Sold (to Customer)", async function () {
        // 1. Producer tạo sản phẩm
        // Trạng thái: Produced (0), Chủ sở hữu: Producer
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);
        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(producer.address);
        expect(item.currentState).to.equal(0); // State.Produced

        // 2. Producer bắt đầu chuyển giao cho Transporter
        // Trạng thái: InTransit (1), Chủ sở hữu vẫn là Producer cho đến khi người nhận confirm
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        let pendingTransfer = await contract.pendingTransfers(itemId);
        expect(pendingTransfer.from).to.equal(producer.address);
        expect(pendingTransfer.to).to.equal(transporter.address);
        expect(pendingTransfer.fromConfirmed).to.equal(true);
        expect(pendingTransfer.toConfirmed).to.equal(false);
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(1); // State.InTransit (Enum value 1)
        expect(item.currentOwner).to.equal(producer.address); // Owner hasn't changed yet

        // 3. Transporter xác nhận nhận hàng
        // Trạng thái: InTransit (1) (Theo logic confirmTransfer đã sửa), Chủ sở hữu: Transporter
        await contract.connect(transporter).confirmTransfer(itemId);
        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(transporter.address); // Chủ sở hữu mới là Transporter
        expect(item.currentState).to.equal(1); // State.InTransit (vẫn là 1 theo logic hiện tại của confirmTransfer)
        // Kiểm tra PendingTransfer đã bị xóa
        pendingTransfer = await contract.pendingTransfers(itemId);
        expect(pendingTransfer.from).to.equal(ethers.ZeroAddress); // Struct mặc định, địa chỉ là 0x0

        // 4. Transporter bắt đầu chuyển giao cho Distributor
        // Trạng thái: InTransit (1), Chủ sở hữu vẫn là Transporter
        await contract.connect(transporter).initiateTransfer(itemId, distributor.address);
        pendingTransfer = await contract.pendingTransfers(itemId);
        expect(pendingTransfer.from).to.equal(transporter.address);
        expect(pendingTransfer.to).to.equal(distributor.address);
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(1); // State.InTransit
        expect(item.currentOwner).to.equal(transporter.address); // Owner hasn't changed yet

        // 5. Distributor xác nhận nhận hàng
        // Trạng thái: ReceivedAtDistributor (2), Chủ sở hữu: Distributor
        await contract.connect(distributor).confirmTransfer(itemId);
        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(distributor.address); // Chủ sở hữu mới là Distributor
        expect(item.currentState).to.equal(2); // State.ReceivedAtDistributor (Enum value 2)
        // Kiểm tra PendingTransfer đã bị xóa
        pendingTransfer = await contract.pendingTransfers(itemId);
        expect(pendingTransfer.from).to.equal(ethers.ZeroAddress);

        // 6. Distributor bắt đầu chuyển giao cho Retailer
        // Trạng thái: InTransitToRetailer (3), Chủ sở hữu vẫn là Distributor
        await contract.connect(distributor).initiateTransfer(itemId, retailer.address);
        pendingTransfer = await contract.pendingTransfers(itemId);
        expect(pendingTransfer.from).to.equal(distributor.address);
        expect(pendingTransfer.to).to.equal(retailer.address);
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(3); // State.InTransitToRetailer (Enum value 3)
        expect(item.currentOwner).to.equal(distributor.address); // Owner hasn't changed yet

        // 7. Retailer xác nhận nhận hàng
        // Trạng thái: Delivered (4), Chủ sở hữu: Retailer
        await contract.connect(retailer).confirmTransfer(itemId);
        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(retailer.address); // Chủ sở hữu mới là Retailer
        expect(item.currentState).to.equal(4); // State.Delivered (Enum value 4)
        // Kiểm tra PendingTransfer đã bị xóa
        pendingTransfer = await contract.pendingTransfers(itemId);
        expect(pendingTransfer.from).to.equal(ethers.ZeroAddress);


        // 8. Retailer đánh dấu sản phẩm đã được nhận tại cửa hàng (sẵn sàng bán)
        // Trạng thái: Received (5), Chủ sở hữu vẫn là Retailer
        await contract.connect(retailer).markAsReceived(itemId);
        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(retailer.address); // Chủ sở hữu vẫn là Retailer
        expect(item.currentState).to.equal(5); // State.Received (Enum value 5)

        // 9. Retailer đánh dấu sản phẩm đã bán cho người tiêu dùng cuối
        // Trạng thái: Sold (6), Chủ sở hữu: CUSTOMER

        const markAsSoldToCustomer = await contract.connect(retailer).markAsSold(itemId, customer.address);

        // Kiểm tra Event ItemSoldToCustomer đã được phát ra từ giao dịch này
        await expect(markAsSoldToCustomer)
            .to.emit(contract, "ItemSoldToCustomer")
            .withArgs(itemId, retailer.address, customer.address);

        // Lấy thông tin mặt hàng SAU KHI giao dịch markAsSold thành công
        item = await contract.items(itemId);

        // Kiểm tra trạng thái cuối cùng (Sold - 6)
        expect(item.currentState).to.equal(6); // State.Sold (Enum value 6)

        // *** THAY ĐỔI: Kiểm tra chủ sở hữu cuối cùng phải là Customer ***
        expect(item.currentOwner).to.equal(customer.address); // Chủ sở hữu mới là Customer


        // Kiểm tra lịch sử đầy đủ sau tất cả các bước
        const history = await contract.getItemHistory(itemId);
        // Đếm số mục lịch sử: Create (1) + Init(P->T) (1) + Confirm(T) (1) + Init(T->D) (1) + Confirm(D) (1) + Init(D->R) (1) + Confirm(R) (1) + Mark Received (1) + Mark Sold (1) = 9
        expect(history.length).to.equal(9);

        // Có thể thêm kiểm tra chi tiết mục lịch sử cuối cùng (Mark Sold)
        expect(history[8].state).to.equal(6); // State.Sold
        expect(history[8].actor).to.equal(retailer.address); // Actor là Retailer (người thực hiện)
        expect(history[8].note).to.equal("Item sold to customer"); // Ghi chú đã cập nhật
    });

    // Bài kiểm thử: Báo cáo hư hỏng bởi Transporter
    it("Báo cáo hư hỏng bởi Transporter", async function () {
        // Bước chuẩn bị: Tạo sản phẩm và chuyển đến Transporter
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        await contract.connect(transporter).confirmTransfer(itemId);
        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(transporter.address); // Đảm bảo hàng đang ở chỗ Transporter
        expect(item.currentState).to.equal(1); // Đảm bảo trạng thái đúng là InTransit

        // Bắt đầu xử lý: Transporter báo cáo hư hỏng
        const damageReason = "Broken during shipping";
        await contract.connect(transporter).reportDamage(itemId, damageReason);

        // Xác nhận kết quả: Kiểm tra trạng thái mới (Damaged - 7) và lịch sử
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(7); // Trạng thái phải là Damaged

        const history = await contract.getItemHistory(itemId);
        // Lịch sử: Created (0), Init Transfer (1), Confirm Transfer (2), Report Damage (3)
        expect(history.length).to.equal(4);
        expect(history[3].state).to.equal(7); // State.Damaged
        expect(history[3].actor).to.equal(transporter.address);
        expect(history[3].note).to.equal(damageReason);
    });

    // Bài kiểm thử: Báo cáo mất hàng bởi Distributor
    it("Báo cáo mất hàng bởi Distributor", async function () {
        // Bước chuẩn bị: Tạo sản phẩm, chuyển đến Transporter, rồi chuyển đến Distributor
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        await contract.connect(transporter).confirmTransfer(itemId);
        await contract.connect(transporter).initiateTransfer(itemId, distributor.address);
        await contract.connect(distributor).confirmTransfer(itemId);
        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(distributor.address); // Đảm bảo hàng đang ở chỗ Distributor
        expect(item.currentState).to.equal(2); // Đảm bảo trạng thái đúng là ReceivedAtDistributor

        // Bắt đầu xử lý: Distributor báo cáo mất hàng
        const lostReason = "Lost at warehouse";
        await contract.connect(distributor).reportLostAtDistributor(itemId, lostReason);

        // Xác nhận kết quả: Kiểm tra trạng thái mới (Lost - 8) và lịch sử
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(8); // Trạng thái phải là Lost

        const history = await contract.getItemHistory(itemId);
        // Lịch sử: Created (0), Init(P->T) (1), Confirm(T) (2), Init(T->D) (3), Confirm(D) (4), Report Lost (5)
        expect(history.length).to.equal(6);
        expect(history[5].state).to.equal(8); // State.Lost
        expect(history[5].actor).to.equal(distributor.address);
        expect(history[5].note).to.equal(lostReason);
    });

    // Bài kiểm thử: Thêm chứng chỉ cho sản phẩm
    it("Thêm chứng chỉ cho sản phẩm", async function () {
        // Bước chuẩn bị: Tạo sản phẩm (chỉ Producer mới có thể thêm chứng chỉ, và thường thêm lúc sản xuất)
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);

        // Bắt đầu xử lý: Producer thêm chứng chỉ
        const certName = "Organic Certification";
        const certIssuer = "Certifier A";
        await contract.connect(producer).addCertificate(itemId, certName, certIssuer);

        // Xác nhận kết quả: Lấy danh sách chứng chỉ và kiểm tra
        const certificates = await contract.getCertificates(itemId);
        expect(certificates.length).to.equal(1); // Phải có 1 chứng chỉ
        expect(certificates[0].certName).to.equal(certName); // Tên chứng chỉ phải đúng
        expect(certificates[0].certIssuer).to.equal(certIssuer); // Đơn vị cấp chứng chỉ phải đúng
        // Kiểm tra ngày cấp chứng chỉ (không quá 5 phút so với thời điểm hiện tại)
        expect(certificates[0].issueDate).to.be.closeTo(BigInt(Math.floor(Date.now() / 1000)), 300); // Chai assertion with tolerance

        // Thêm chứng chỉ thứ hai
        const certName2 = "ISO 9001";
        const certIssuer2 = "Certifier B";
        await contract.connect(producer).addCertificate(itemId, certName2, certIssuer2);

        // Kiểm tra lại danh sách chứng chỉ
        const certificatesAfterAdd = await contract.getCertificates(itemId);
        expect(certificatesAfterAdd.length).to.equal(2); // Phải có 2 chứng chỉ
        expect(certificatesAfterAdd[1].certName).to.equal(certName2);
        expect(certificatesAfterAdd[1].certIssuer).to.equal(certIssuer2);
    });


    // Bài kiểm thử: Kiểm tra phân quyền (outsider không được phép thực hiện các hành động quan trọng)
    it("Không cho phép tài khoản không có vai trò hoặc không phải chủ sở hữu thực hiện hành động trái phép", async function () {
        // Bước chuẩn bị: Tạo sản phẩm bởi Producer
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);
        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(producer.address); // Chủ sở hữu là Producer

        // Outsider cố gắng bắt đầu chuyển giao (outsider không phải chủ sở hữu)
        await expect(
            contract.connect(outsider).initiateTransfer(itemId, transporter.address)
        ).to.be.revertedWith("Only current owner can initiate transfer"); // Mong đợi lỗi cụ thể về chủ sở hữu

        // Outsider cố gắng báo cáo hư hỏng (hàm chỉ dành cho TRANSPORTER_ROLE)
        await expect(
            contract.connect(outsider).reportDamage(itemId, "Try damage")
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
         .withArgs(outsider.address, await contract.TRANSPORTER_ROLE()); // Kiểm tra xem lỗi có trả về đúng địa chỉ và vai trò thiếu không

        // *** BỔ SUNG TEST: Outsider cố gắng gọi markAsSold (outsider không có RETAILER_ROLE) ***
        // Sử dụng customer.address làm địa chỉ người mua trong test này
        await expect(
            contract.connect(outsider).markAsSold(itemId, customer.address)
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
         .withArgs(outsider.address, await contract.RETAILER_ROLE()); // Mong đợi lỗi thiếu vai trò Retailer

        // *** BỔ SUNG TEST: Producer cố gắng gọi markAsSold (Producer không có RETAILER_ROLE VÀ không phải chủ sở hữu tại thời điểm này) ***
         await expect(
            contract.connect(producer).markAsSold(itemId, customer.address)
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
         .withArgs(producer.address, await contract.RETAILER_ROLE()); // Mong đợi lỗi thiếu vai trò Retailer

        // *** BỔ SUNG TEST: Transporter cố gắng gọi markAsSold (Transporter không có RETAILER_ROLE) ***
         await expect(
            contract.connect(transporter).markAsSold(itemId, customer.address)
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
         .withArgs(transporter.address, await contract.RETAILER_ROLE()); // Mong đợi lỗi thiếu vai trò Retailer

         // Chuyển hàng đến Retailer để test lỗi "Only current owner can mark sold"
         await contract.connect(producer).initiateTransfer(itemId, transporter.address);
         await contract.connect(transporter).confirmTransfer(itemId);
         await contract.connect(transporter).initiateTransfer(itemId, distributor.address);
         await contract.connect(distributor).confirmTransfer(itemId);
         await contract.connect(distributor).initiateTransfer(itemId, retailer.address);
         await contract.connect(retailer).confirmTransfer(itemId);
         await contract.connect(retailer).markAsReceived(itemId);
         item = await contract.items(itemId);
         expect(item.currentOwner).to.equal(retailer.address); // Retailer là chủ sở hữu

        // *** BỔ SUNG TEST: Một Retailer khác cố gắng gọi markAsSold (có vai trò nhưng không phải chủ sở hữu hiện tại) ***
        // Tạo một Retailer khác nếu cần, hoặc dùng lại Retailer sau khi chuyển quyền sở hữu đi
        // Hoặc đơn giản là test Retailer gọi lần thứ 2 sau khi đã bán thành công (chủ sở hữu đã là customer)
        // Để test lỗi "Only current owner can mark sold" một cách rõ ràng, ta cần một Retailer khác.
        // Giả định có thêm một signer `retailer2` với vai trò Retailer
        // Nếu không có `retailer2`, bỏ qua test này hoặc mock nó.
        // Với signer hiện tại, ta có thể test Retailer gọi lại sau khi đã bán thành công (chủ sở hữu là customer)
        await contract.connect(retailer).markAsSold(itemId, customer.address); // Thực hiện bán lần đầu
        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(customer.address); // Chủ sở hữu đã là customer

         await expect(
            contract.connect(retailer).markAsSold(itemId, outsider.address) // Retailer gọi lại
        ).to.be.revertedWith("Only current owner (Retailer) can mark sold"); // Giờ lỗi sẽ là về chủ sở hữu

    });

    // Bài kiểm thử: Kiểm tra điều kiện lỗi khác trong Initiate/Confirm Transfer
    it("Kiểm tra điều kiện lỗi trong Initiate/Confirm Transfer", async function () {
         // Bước chuẩn bị: Tạo sản phẩm
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);
        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(producer.address);

        // InitiateTransfer lỗi: Người nhận có vai trò không hợp lệ (ví dụ: admin hoặc customer)
        await expect(
             contract.connect(producer).initiateTransfer(itemId, admin.address)
        ).to.be.revertedWith("Invalid receiver role"); // Mong đợi lỗi về vai trò người nhận

         await expect(
             contract.connect(producer).initiateTransfer(itemId, customer.address)
        ).to.be.revertedWith("Invalid receiver role"); // Customer không phải vai trò hợp lệ

        // InitiateTransfer lỗi: Item không tồn tại
        const nonExistentItemId = ethers.encodeBytes32String("NONEXISTENT");
        await expect(
             contract.connect(producer).initiateTransfer(nonExistentItemId, transporter.address)
        ).to.be.revertedWith("Item does not exist"); // Mong đợi lỗi về item không tồn tại

        // Bắt đầu chuyển giao hợp lệ để kiểm tra ConfirmTransfer
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        let pendingTransfer = await contract.pendingTransfers(itemId);
        expect(pendingTransfer.to).to.equal(transporter.address); // Đảm bảo pending transfer đến đúng người

        // ConfirmTransfer lỗi: Người gọi không phải là người nhận đang chờ
        await expect(
             contract.connect(distributor).confirmTransfer(itemId)
        ).to.be.revertedWith("Only receiver can confirm transfer"); // Mong đợi lỗi về người xác nhận

        // ConfirmTransfer lỗi: Item không tồn tại (gọi confirm cho item chưa initiate)
         await expect(
            contract.connect(transporter).confirmTransfer(nonExistentItemId)
         ).to.be.revertedWith("Only receiver can confirm transfer"); // Sẽ lỗi ở require(transfer.to == msg.sender) vì transfer.to là address(0)

    });

    // Bài kiểm thử: Kiểm tra điều kiện lỗi trong Report Damage/Lost
    it("Kiểm tra điều kiện lỗi trong Report Damage/Lost", async function () {
        // Bước chuẩn bị: Tạo sản phẩm
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);

        // ReportDamage lỗi: Người gọi không có vai trò Transporter
        await expect(
             contract.connect(retailer).reportDamage(itemId, "Damaged by Retailer?")
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
         .withArgs(retailer.address, await contract.TRANSPORTER_ROLE()); // Lỗi vì Retailer thiếu vai trò Transporter

        // ReportLostAtDistributor lỗi: Người gọi không có vai trò Distributor
        await expect(
             contract.connect(transporter).reportLostAtDistributor(itemId, "Lost by Transporter?")
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
         .withArgs(transporter.address, await contract.DISTRIBUTOR_ROLE()); // Lỗi vì Transporter thiếu vai trò Distributor

        // ReportDamage lỗi: Item không tồn tại
        const nonExistentItemId = ethers.encodeBytes32String("NONEXISTENT");
        await expect(
             contract.connect(transporter).reportDamage(nonExistentItemId, "Damage non-existent item")
        ).to.be.revertedWith("Item does not exist"); // Mong đợi lỗi về item không tồn tại

         // ReportLostAtDistributor lỗi: Item không tồn tại
         await expect(
             contract.connect(distributor).reportLostAtDistributor(nonExistentItemId, "Lost non-existent item")
        ).to.be.revertedWith("Item does not exist"); // Mong đợi lỗi về item không tồn tại
    });

    // Bài kiểm thử: Kiểm tra điều kiện lỗi trong Add Certificate
    it("Kiểm tra điều kiện lỗi trong Add Certificate", async function () {
        // Bước chuẩn bị: Tạo sản phẩm
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);

        // AddCertificate lỗi: Người gọi không có vai trò Producer
        await expect(
             contract.connect(distributor).addCertificate(itemId, "Organic", "Certifier")
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
         .withArgs(distributor.address, await contract.PRODUCER_ROLE()); // Lỗi vì Distributor thiếu vai trò Producer

        // AddCertificate lỗi: Item không tồn tại
        const nonExistentItemId = ethers.encodeBytes32String("NONEXISTENT");
         await expect(
             contract.connect(producer).addCertificate(nonExistentItemId, "Organic", "Certifier")
        ).to.be.revertedWith("Item does not exist"); // Mong đợi lỗi về item không tồn tại
    });

    // Bài kiểm thử: Kiểm tra View Functions (bao gồm các hàm mới thêm vào)
    it("Kiểm tra View Functions (bao gồm các hàm mới)", async function () {
        // Bước chuẩn bị: Tạo sản phẩm và thêm vài mục vào lịch sử/chứng chỉ
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        await contract.connect(transporter).confirmTransfer(itemId);

        // Thêm chứng chỉ
        const certNameAdded = "Organic";
        const certIssuerAdded = "Certifier A";
        await contract.connect(producer).addCertificate(itemId, certNameAdded, certIssuerAdded);

        // Kiểm tra getItemHistory
        const history = await contract.getItemHistory(itemId);
        // Số mục lịch sử: Create (1) + Init(P->T) (1) + Confirm(T) (1) = 3
        expect(history.length).to.equal(3);
        expect(history[0].state).to.equal(0); // State.Produced
        expect(history[0].actor).to.equal(producer.address);

        // Kiểm tra getCertificates
        const certificates = await contract.getCertificates(itemId);
        expect(certificates.length).to.equal(1); // Phải có 1 chứng chỉ
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


        // *** BỔ SUNG TEST: Kiểm tra hàm getItemDetail ***
        const itemDetail = await contract.getItemDetail(itemId);
        expect(itemDetail.id).to.equal(itemId);
        expect(itemDetail.name).to.equal("Milk");
        expect(itemDetail.description).to.equal(itemDescription);
        expect(itemDetail.currentOwner).to.equal(transporter.address);
        expect(itemDetail.currentState).to.equal(1); // State.InTransit
        expect(itemDetail.exists).to.equal(true);
        expect(itemDetail.plannedDeliveryTime).to.equal(plannedDeliveryTime);

        // *** BỔ SUNG TEST: Kiểm tra hàm getItemOwner ***
        const itemOwner = await contract.getItemOwner(itemId);
        expect(itemOwner).to.equal(transporter.address); // Phải là Transporter

        // *** BỔ SUNG TEST: Kiểm tra hàm getItemState ***
        const itemState = await contract.getItemState(itemId);
        expect(itemState).to.equal(1); // State.InTransit (Enum value 1)

         // Kiểm tra các hàm view với item không tồn tại (sẽ trả về giá trị mặc định)
        const nonExistentItemId = ethers.encodeBytes32String("NONEXISTENT");
        const defaultItem = await contract.items(nonExistentItemId); // Getter tự động
        expect(defaultItem.exists).to.equal(false); // Cờ exists sẽ là false
        expect(defaultItem.currentOwner).to.equal(ethers.ZeroAddress); // Địa chỉ mặc định là 0x0
        // Các hàm view tường minh cũng sẽ trả về giá trị mặc định
         const defaultItemDetail = await contract.getItemDetail(nonExistentItemId);
         expect(defaultItemDetail.exists).to.equal(false);

         const defaultItemOwner = await contract.getItemOwner(nonExistentItemId);
         expect(defaultItemOwner).to.equal(ethers.ZeroAddress);

         const defaultItemState = await contract.getItemState(nonExistentItemId);
         expect(defaultItemState).to.equal(0); // Enum mặc định là giá trị đầu tiên (Produced)

         const defaultHistory = await contract.getItemHistory(nonExistentItemId);
         expect(defaultHistory.length).to.equal(0); // Mảng rỗng cho item không tồn tại

         const defaultCertificates = await contract.getCertificates(nonExistentItemId);
         expect(defaultCertificates.length).to.equal(0); // Mảng rỗng cho item không tồn tại
    });

});