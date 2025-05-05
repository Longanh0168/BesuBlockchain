const { expect } = require("chai");
const { ethers } = require("hardhat");

// Mô tả bộ kiểm thử cho hợp đồng SupplyChainTracking
describe("SupplyChainTracking", function () {
    let contract; // Biến lưu trữ instance của hợp đồng đã triển khai
    // Các biến lưu trữ signer (tài khoản) cho các vai trò khác nhau
    let admin, producer, transporter, distributor, retailer, outsider;
    let itemId = ethers.encodeBytes32String("ITEM001"); // ID mẫu cho mặt hàng (dùng bytes32)
    let itemDescription = "Sữa tươi tiệt trùng 100% nguyên chất"; // Mô tả mẫu cho mặt hàng
    let plannedDeliveryTime = Math.floor(Date.now() / 1000) + 3600; // Thời gian giao hàng dự kiến (1 giờ kể từ bây giờ)

    // Hàm này chạy trước mỗi bài kiểm thử (it block)
    // Nó thiết lập môi trường kiểm thử sạch sẽ cho mỗi lần chạy
    beforeEach(async function () {
        // Lấy danh sách các tài khoản (signer) từ Hardhat Network
        [admin, producer, transporter, distributor, retailer, outsider] = await ethers.getSigners();

        // Lấy Factory của hợp đồng SupplyChainTracking để triển khai
        const SupplyChainTracking = await ethers.getContractFactory("SupplyChainTracking");
        // Triển khai hợp đồng. Người triển khai (admin) sẽ tự động nhận DEFAULT_ADMIN_ROLE.
        contract = await SupplyChainTracking.deploy();

        // Thiết lập vai trò cho các tài khoản sử dụng hàm grantRole (từ AccessControl)
        // Chỉ admin (người có DEFAULT_ADMIN_ROLE) mới có thể cấp vai trò
        // await contract.connect(admin).grantRole(await contract.PRODUCER_ROLE(), producer.address);
        // await contract.connect(admin).grantRole(await contract.TRANSPORTER_ROLE(), transporter.address);
        // await contract.connect(admin).grantRole(await contract.DISTRIBUTOR_ROLE(), distributor.address);
        // await contract.connect(admin).grantRole(await contract.RETAILER_ROLE(), retailer.address);
        // Tài khoản 'outsider' sẽ không có vai trò nào, dùng để kiểm tra phân quyền

        // Cấp vai trò cho các tài khoản
        await contract.grantAccess(await contract.PRODUCER_ROLE(), producer.address);
        await contract.grantAccess(await contract.TRANSPORTER_ROLE(), transporter.address);
        await contract.grantAccess(await contract.DISTRIBUTOR_ROLE(), distributor.address);
        await contract.grantAccess(await contract.RETAILER_ROLE(), retailer.address);
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
        const item = await contract.items(itemId);

        // Kiểm tra các thuộc tính của mặt hàng vừa tạo
        expect(item.id).to.equal(itemId); // ID phải khớp
        expect(item.name).to.equal("Milk"); // Tên phải khớp
        expect(item.description).to.equal(itemDescription); // Mô tả phải khớp (kiểm thử trường mới)
        expect(item.currentOwner).to.equal(producer.address); // Chủ sở hữu ban đầu phải là Producer
        // Kiểm tra trạng thái ban đầu phải là Produced (số nguyên 0)
        // Sửa lỗi: Thay contract.State().then(states => states.Produced) bằng giá trị số nguyên 0
        expect(item.currentState).to.equal(0); // State.Produced

        expect(item.exists).to.equal(true); // Mặt hàng phải tồn tại

        // Kiểm tra lịch sử: Lịch sử ban đầu phải có 1 mục
        const history = await contract.getItemHistory(itemId);
        expect(history.length).to.equal(1);
        // Sửa lỗi: Thay contract.State().then(states => states.Produced) bằng giá trị số nguyên 0
        expect(history[0].state).to.equal(0); // State.Produced
        expect(history[0].actor).to.equal(producer.address);
        expect(history[0].note).to.equal("Item created");
    });

    // Bài kiểm thử: Producer không thể tạo sản phẩm đã tồn tại
    it("Producer không thể tạo sản phẩm đã tồn tại", async function () {
        // Bước 1: Tạo sản phẩm lần đầu (sẽ thành công)
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);

        // Bước 2: Cố gắng tạo lại sản phẩm với cùng ID
        // Hợp đồng sẽ kiểm tra: Item ID đã tồn tại chưa. Vì nó đã tồn tại, giao dịch sẽ bị hoàn lại (revert).
        // Ta mong đợi giao dịch này sẽ bị hoàn lại với lý do "Item already exists".
        await expect(
            contract.connect(producer).createItem(itemId, "Soy Milk", "New Description", plannedDeliveryTime + 1000)
        ).to.be.revertedWith("Item already exists");
    });

     // Bài kiểm thử: Tài khoản không phải Producer không thể tạo sản phẩm
     it("Tài khoản không phải Producer không thể tạo sản phẩm", async function () {
        // Cố gắng gọi createItem bằng tài khoản Transporter (không có vai trò Producer)
        // Hợp đồng sẽ kiểm tra: Người gọi có vai trò PRODUCER_ROLE không (qua modifier onlyRole)
        // Vì Transporter không có vai trò này, giao dịch sẽ bị hoàn lại với lỗi của AccessControl.
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
    // Producer -> Transporter -> Distributor -> Retailer -> Received -> Sold
    it("Luồng đầy đủ: Producer -> Transporter -> Distributor -> Retailer -> Received -> Sold", async function () {
        // 1. Producer tạo sản phẩm
        // Trạng thái: Produced (0), Chủ sở hữu: Producer
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);
        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(producer.address);
        // Sửa lỗi: Thay contract.State().then(states => states.Produced) bằng 0
        expect(item.currentState).to.equal(0); // State.Produced

        // 2. Producer bắt đầu chuyển giao cho Transporter
        // Người gọi (Producer) phải là chủ sở hữu hiện tại. Người nhận (Transporter) phải có vai trò hợp lệ.
        // Hợp đồng sẽ tạo PendingTransfer, cập nhật trạng thái thành InTransit, ghi lịch sử và phát event.
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        // Kiểm tra PendingTransfer đã được tạo
        let pendingTransfer = await contract.pendingTransfers(itemId);
        expect(pendingTransfer.from).to.equal(producer.address);
        expect(pendingTransfer.to).to.equal(transporter.address);
        expect(pendingTransfer.fromConfirmed).to.equal(true);
        expect(pendingTransfer.toConfirmed).to.equal(false);
        // Kiểm tra trạng thái đã chuyển thành InTransit (số nguyên 1)
        // Sửa lỗi: Thay contract.State().then(states => states.InTransit) bằng 1
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(1); // State.InTransit

        // 3. Transporter xác nhận nhận hàng
        // Người gọi (Transporter) phải là người nhận trong PendingTransfer.
        // Hợp đồng sẽ cập nhật PendingTransfer (toConfirmed=true), thay đổi chủ sở hữu thành Transporter,
        // cập nhật trạng thái (trong trường hợp này vẫn là InTransit như logic đã sửa), ghi lịch sử và xóa PendingTransfer.
        await contract.connect(transporter).confirmTransfer(itemId);
        // Kiểm tra chủ sở hữu mới
        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(transporter.address);
        // Kiểm tra trạng thái sau khi Transporter xác nhận (vẫn là InTransit - 1)
        // Sửa lỗi: Thay contract.State().then(states => states.InTransit) bằng 1
        expect(item.currentState).to.equal(1); // State.InTransit

        // 4. Transporter bắt đầu chuyển giao cho Distributor
        // Người gọi (Transporter) phải là chủ sở hữu hiện tại. Người nhận (Distributor) phải có vai trò hợp lệ.
        // Hợp đồng sẽ tạo PendingTransfer mới, cập nhật trạng thái thành InTransit (lại lần nữa), ghi lịch sử.
        await contract.connect(transporter).initiateTransfer(itemId, distributor.address);
         // Kiểm tra PendingTransfer mới đã được tạo
        pendingTransfer = await contract.pendingTransfers(itemId);
        expect(pendingTransfer.from).to.equal(transporter.address);
        expect(pendingTransfer.to).to.equal(distributor.address);
        expect(pendingTransfer.fromConfirmed).to.equal(true);
        expect(pendingTransfer.toConfirmed).to.equal(false);
         // Kiểm tra trạng thái đã chuyển thành InTransit (1)
        // Sửa lỗi: Thay contract.State().then(states => states.InTransit) bằng 1
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(1); // State.InTransit


        // 5. Distributor xác nhận nhận hàng
        // Người gọi (Distributor) phải là người nhận trong PendingTransfer.
        // Hợp đồng sẽ cập nhật PendingTransfer, thay đổi chủ sở hữu thành Distributor,
        // cập nhật trạng thái thành ReceivedAtDistributor, ghi lịch sử và xóa PendingTransfer.
        await contract.connect(distributor).confirmTransfer(itemId);
        // Kiểm tra chủ sở hữu mới
        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(distributor.address);
        // Kiểm tra trạng thái sau khi Distributor xác nhận (ReceivedAtDistributor - 2)
        // Sửa lỗi: Thay contract.State().then(states => states.ReceivedAtDistributor) bằng 2
        expect(item.currentState).to.equal(2); // State.ReceivedAtDistributor

        // 6. Distributor bắt đầu chuyển giao cho Retailer
        // Người gọi (Distributor) phải là chủ sở hữu hiện tại. Người nhận (Retailer) phải có vai trò hợp lệ.
        // Hợp đồng sẽ tạo PendingTransfer mới, cập nhật trạng thái thành InTransitToRetailer, ghi lịch sử.
        await contract.connect(distributor).initiateTransfer(itemId, retailer.address);
        // Kiểm tra PendingTransfer mới đã được tạo
        pendingTransfer = await contract.pendingTransfers(itemId);
        expect(pendingTransfer.from).to.equal(distributor.address);
        expect(pendingTransfer.to).to.equal(retailer.address);
        expect(pendingTransfer.fromConfirmed).to.equal(true);
        expect(pendingTransfer.toConfirmed).to.equal(false);
        // Kiểm tra trạng thái đã chuyển thành InTransitToRetailer (3)
        // Sửa lỗi: Thay contract.State().then(states => states.InTransitToRetailer) bằng 3
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(3); // State.InTransitToRetailer


        // 7. Retailer xác nhận nhận hàng
        // Người gọi (Retailer) phải là người nhận trong PendingTransfer.
        // Hợp đồng sẽ cập nhật PendingTransfer, thay đổi chủ sở hữu thành Retailer,
        // cập nhật trạng thái thành Delivered, ghi lịch sử và xóa PendingTransfer.
        await contract.connect(retailer).confirmTransfer(itemId);
        // Kiểm tra chủ sở hữu mới
        item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(retailer.address);
        // Kiểm tra trạng thái sau khi Retailer xác nhận (Delivered - 4)
        // Sửa lỗi: Thay contract.State().then(states => states.Delivered) bằng 4
        expect(item.currentState).to.equal(4); // State.Delivered

        // 8. Retailer đánh dấu sản phẩm đã được nhận tại cửa hàng (sẵn sàng bán)
        // Chỉ người có vai trò RETAILER_ROLE và là chủ sở hữu hiện tại mới có thể gọi.
        // Hợp đồng sẽ cập nhật trạng thái thành Received, ghi lịch sử.
        await contract.connect(retailer).markAsReceived(itemId);
        // Kiểm tra trạng thái mới (Received - 5)
        // Sửa lỗi: Thay contract.State().then(states => states.Received) bằng 5
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(5); // State.Received

        // 9. Retailer đánh dấu sản phẩm đã bán cho người tiêu dùng cuối
        // Chỉ người có vai trò RETAILER_ROLE và là chủ sở hữu hiện tại mới có thể gọi.
        // Hợp đồng sẽ cập nhật trạng thái thành Sold, ghi lịch sử.
        await contract.connect(retailer).markAsSold(itemId);
        // Kiểm tra trạng thái cuối cùng (Sold - 6)
        // Sửa lỗi: Thay contract.State().then(states => states.Sold) bằng 6
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(6); // State.Sold

        // Kiểm tra lịch sử đầy đủ sau tất cả các bước
        const history = await contract.getItemHistory(itemId);
        // Đếm số mục lịch sử: Create (1) + Initiate (3) + Confirm (3) + Mark Received (1) + Mark Sold (1) = 9
        expect(history.length).to.equal(9);
        // Có thể thêm kiểm tra chi tiết từng mục lịch sử nếu cần
    });

    // Bài kiểm thử: Báo cáo hư hỏng bởi Transporter
    it("Báo cáo hư hỏng bởi Transporter", async function () {
        // Bước chuẩn bị: Tạo sản phẩm và chuyển đến Transporter
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);
        await contract.connect(producer).initiateTransfer(itemId, transporter.address);
        await contract.connect(transporter).confirmTransfer(itemId);
        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(transporter.address); // Đảm bảo hàng đang ở chỗ Transporter
        // Sửa lỗi: Thay contract.State().then(states => states.InTransit) bằng 1
        expect(item.currentState).to.equal(1); // Đảm bảo trạng thái đúng là InTransit

        // Bắt đầu xử lý: Transporter báo cáo hư hỏng
        // Hợp đồng sẽ kiểm tra: Người gọi có vai trò TRANSPORTER_ROLE không (qua onlyRole).
        // Nếu hợp lệ, cập nhật trạng thái thành Damaged, ghi lịch sử.
        const damageReason = "Broken during shipping";
        await contract.connect(transporter).reportDamage(itemId, damageReason);

        // Xác nhận kết quả: Kiểm tra trạng thái mới (Damaged - 7) và lịch sử
        // Sửa lỗi: Thay contract.State().then(states => states.Damaged) bằng 7
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(7); // Trạng thái phải là Damaged

        const history = await contract.getItemHistory(itemId);
        // Lịch sử: Created (0), Init Transfer (1), Confirm Transfer (2), Report Damage (3)
        expect(history.length).to.equal(4);
        // Sửa lỗi: Thay contract.State().then(states => states.Damaged) bằng 7
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
        // Sửa lỗi: Thay contract.State().then(states => states.ReceivedAtDistributor) bằng 2
        expect(item.currentState).to.equal(2); // Đảm bảo trạng thái đúng là ReceivedAtDistributor

        // Bắt đầu xử lý: Distributor báo cáo mất hàng
        // Hợp đồng sẽ kiểm tra: Người gọi có vai trò DISTRIBUTOR_ROLE không (qua onlyRole).
        // Nếu hợp lệ, cập nhật trạng thái thành Lost, ghi lịch sử.
        const lostReason = "Lost at warehouse";
        await contract.connect(distributor).reportLostAtDistributor(itemId, lostReason);

        // Xác nhận kết quả: Kiểm tra trạng thái mới (Lost - 8) và lịch sử
        // Sửa lỗi: Thay contract.State().then(states => states.Lost) bằng 8
        item = await contract.items(itemId);
        expect(item.currentState).to.equal(8); // Trạng thái phải là Lost

        const history = await contract.getItemHistory(itemId);
        // Lịch sử: Created, Init(P->T), Confirm(T), Init(T->D), Confirm(D), Report Lost
        expect(history.length).to.equal(6);
        // Sửa lỗi: Thay contract.State().then(states => states.Lost) bằng 8
        expect(history[5].state).to.equal(8); // State.Lost
        expect(history[5].actor).to.equal(distributor.address);
        expect(history[5].note).to.equal(lostReason);
    });

    // Bài kiểm thử: Thêm chứng chỉ cho sản phẩm
    it("Thêm chứng chỉ cho sản phẩm", async function () {
        // Bước chuẩn bị: Tạo sản phẩm (chỉ Producer mới có thể thêm chứng chỉ, và thường thêm lúc sản xuất)
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);

        // Bắt đầu xử lý: Producer thêm chứng chỉ
        // Hợp đồng sẽ kiểm tra: Người gọi có vai trò PRODUCER_ROLE không (qua onlyRole).
        // Nếu hợp lệ, thêm chứng chỉ vào danh sách itemCertificates.
        const certName = "Organic Certification";
        const certIssuer = "Certifier A";
        await contract.connect(producer).addCertificate(itemId, certName, certIssuer);

        // Xác nhận kết quả: Lấy danh sách chứng chỉ và kiểm tra
        const certificates = await contract.getCertificates(itemId);
        expect(certificates.length).to.equal(1); // Phải có 1 chứng chỉ
        expect(certificates[0].certName).to.equal(certName); // Tên chứng chỉ phải đúng
        expect(certificates[0].certIssuer).to.equal(certIssuer); // Đơn vị cấp chứng chỉ phải đúng
        // Kiểm tra ngày cấp chứng chỉ (không quá 5 phút so với thời điểm hiện tại)
        expect(certificates[0].issueDate).to.be.closeTo(Math.floor(Date.now() / 1000), 300); // Chai assertion with tolerance

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
    it("Không cho phép outsider thực hiện hành động trái phép", async function () {
        // Bước chuẩn bị: Tạo sản phẩm bởi Producer
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);
        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(producer.address); // Chủ sở hữu là Producer

        // Bắt đầu xử lý: Outsider cố gắng bắt đầu chuyển giao
        // Hợp đồng sẽ kiểm tra: Người gọi có phải là chủ sở hữu hiện tại không.
        // Vì outsider không phải chủ sở hữu, giao dịch sẽ bị hoàn lại.
        await expect(
            contract.connect(outsider).initiateTransfer(itemId, transporter.address)
        ).to.be.revertedWith("Only current owner can initiate transfer"); // Mong đợi lỗi cụ thể về chủ sở hữu

        // Bắt đầu xử lý: Outsider cố gắng báo cáo hư hỏng (hàm chỉ dành cho TRANSPORTER_ROLE)
        // Hợp đồng sẽ kiểm tra: Người gọi có vai trò TRANSPORTER_ROLE không (qua onlyRole).
        // Vì outsider không có vai trò này, giao dịch sẽ bị hoàn lại bằng lỗi tùy chỉnh của AccessControl.
        // Sử dụng revertedWithCustomError để mong đợi lỗi tùy chỉnh AccessControlUnauthorizedAccount.
        await expect(
            contract.connect(outsider).reportDamage(itemId, "Try damage")
        ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
         .withArgs(outsider.address, await contract.TRANSPORTER_ROLE()); // Kiểm tra xem lỗi có trả về đúng địa chỉ và vai trò thiếu không
    });

    // Bài kiểm thử: Kiểm tra các điều kiện lỗi khác trong Initiate/Confirm Transfer
    it("Kiểm tra điều kiện lỗi trong Initiate/Confirm Transfer", async function () {
         // Bước chuẩn bị: Tạo sản phẩm
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);
        let item = await contract.items(itemId);
        expect(item.currentOwner).to.equal(producer.address);

        // InitiateTransfer lỗi: Người nhận có vai trò không hợp lệ (ví dụ: admin)
        // Hợp đồng sẽ kiểm tra: Vai trò của _to có phải là Transporter, Distributor hay Retailer không.
        // Vì admin không có vai trò nào trong số đó, giao dịch sẽ bị hoàn lại.
        await expect(
             contract.connect(producer).initiateTransfer(itemId, admin.address)
        ).to.be.revertedWith("Invalid receiver role"); // Mong đợi lỗi về vai trò người nhận

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
         // Hợp đồng sẽ kiểm tra: Người gọi có phải là người nhận trong PendingTransfer không.
         // Vì Distributor không phải người nhận (Transporter là người nhận), giao dịch sẽ bị hoàn lại.
         await expect(
             contract.connect(distributor).confirmTransfer(itemId)
         ).to.be.revertedWith("Only receiver can confirm transfer"); // Mong đợi lỗi về người xác nhận

         // ConfirmTransfer lỗi: Người gọi là người nhận đúng nhưng sender chưa initiate (trường hợp này khó xảy ra với logic hiện tại vì initiate luôn set fromConfirmed = true)
         // Để kiểm thử, ta có thể chỉnh sửa PendingTransfer trực tiếp trong test (nhưng không nên làm trong thực tế)
         // Hoặc giả định một kịch bản logic khác của contract. Với contract hiện tại, lỗi này ít có khả năng xảy ra.

         // ConfirmTransfer lỗi: Item không tồn tại (không cần kiểm thử riêng vì pendingTransfers[_itemId] sẽ trống, và các require sau đó sẽ thất bại hoặc xử lý giá trị 0).
         // Tuy nhiên, nếu muốn test rõ ràng, có thể tạo PendingTransfer giả rồi gọi confirm.
    });

    // Bài kiểm thử: Kiểm tra điều kiện lỗi trong Report Damage/Lost
    it("Kiểm tra điều kiện lỗi trong Report Damage/Lost", async function () {
        // Bước chuẩn bị: Tạo sản phẩm
        await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);

        // ReportDamage lỗi: Người gọi không có vai trò Transporter
        // Đã kiểm thử ở bài outsider, nhưng có thể kiểm tra thêm vai trò khác, ví dụ Retailer.
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

     // Bài kiểm thử: Kiểm tra view functions (chỉ cần đảm bảo chúng chạy không lỗi và trả về đúng cấu trúc)
     it("Kiểm tra View Functions", async function () {
         // Bước chuẩn bị: Tạo sản phẩm và thêm vài mục vào lịch sử/chứng chỉ
         await contract.connect(producer).createItem(itemId, "Milk", itemDescription, plannedDeliveryTime);
         await contract.connect(producer).initiateTransfer(itemId, transporter.address);
         await contract.connect(transporter).confirmTransfer(itemId);
        
         // Thêm chứng chỉ với tên là "Organic"
         const certNameAdded = "Organic"; // Sử dụng biến để dễ đọc
         const certIssuerAdded = "Certifier A";
         await contract.connect(producer).addCertificate(itemId, certNameAdded, certIssuerAdded);

         // Kiểm tra getItemHistory
         const history = await contract.getItemHistory(itemId);
         // Số mục lịch sử: Create (1) + Init(P->T) (1) + Confirm(T) (1) + Add Cert (0 - cert doesn't add history) = 3
         expect(history.length).to.equal(3); // Phải có 3 mục lịch sử từ bước chuẩn bị
         // Có thể kiểm tra cấu trúc mục lịch sử đầu tiên
         // Sửa lỗi: Thay contract.State().then(states => states.Produced) bằng 0
         expect(history[0].state).to.equal(0); // State.Produced (int 0)
         expect(history[0].actor).to.equal(producer.address);

         // Kiểm tra getCertificates
         const certificates = await contract.getCertificates(itemId);
         expect(certificates.length).to.equal(1); // Phải có 1 chứng chỉ
         // Có thể kiểm tra cấu trúc chứng chỉ đầu tiên
         expect(certificates[0].certName).to.equal(certNameAdded); // Mong đợi "Organic"
         expect(certificates[0].certIssuer).to.equal(certIssuerAdded); // Mong đợi "Certifier A"

         // Kiểm tra getter function của mapping items (được tạo tự động)
         const item = await contract.items(itemId);
         expect(item.exists).to.equal(true);
         expect(item.name).to.equal("Milk");
         expect(item.description).to.equal(itemDescription);
     });

});