// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol"; // Import thư viện AccessControl của OpenZeppelin để quản lý vai trò

// Hợp đồng quản lý chuỗi cung ứng phiên bản 2
// Kế thừa AccessControl để sử dụng hệ thống vai trò phân quyền
contract SupplyChainTracking is AccessControl {
    // Định nghĩa các vai trò tham gia vào chuỗi cung ứng
    // bytes32 là kiểu dữ liệu được sử dụng cho vai trò trong AccessControl
    bytes32 public constant PRODUCER_ROLE = keccak256("PRODUCER_ROLE"); // Vai trò Nhà sản xuất
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE"); // Vai trò Người vận chuyển
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE"); // Vai trò Nhà phân phối
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE"); // Vai trò Nhà bán lẻ

    // Enum định nghĩa các trạng thái có thể có của một mặt hàng trong chuỗi cung ứng
    enum State {
        Produced, // Đã sản xuất
        InTransit, // Đang vận chuyển (có thể là tới Transporter hoặc Distributor)
        ReceivedAtDistributor, // Đã nhận tại Nhà phân phối
        InTransitToRetailer, // Đang vận chuyển đến Nhà bán lẻ
        Delivered, // Đã giao hàng (đến Retailer)
        Received, // Đã nhận hàng (tại Retailer, sẵn sàng bán)
        Sold, // Đã bán
        Damaged, // Bị hư hỏng
        Lost // Bị thất lạc
    }

    // Struct định nghĩa cấu trúc dữ liệu cho Chứng chỉ của sản phẩm
    struct Certificate {
        string certName; // Tên chứng chỉ (ví dụ: Organic Certification)
        string certIssuer; // Đơn vị cấp chứng chỉ
        uint256 issueDate; // Ngày cấp chứng chỉ (timestamp)
    }

    // Struct định nghĩa cấu trúc dữ liệu cho một Mặt hàng
    struct Item {
        bytes32 id; // ID duy nhất của mặt hàng (dùng bytes32 để tối ưu storage)
        string name; // Tên mặt hàng
        string description; // Mô tả chi tiết về mặt hàng
        address currentOwner; // Địa chỉ của chủ sở hữu hiện tại
        State currentState; // Trạng thái hiện tại của mặt hàng
        bool exists; // Cờ kiểm tra xem mặt hàng có tồn tại không
        uint256 plannedDeliveryTime; // Thời gian giao hàng dự kiến (timestamp)
    }

    // Struct định nghĩa cấu trúc dữ liệu cho Lịch sử trạng thái của mặt hàng
    struct History {
        State state; // Trạng thái tại thời điểm ghi lịch sử
        address actor; // Địa chỉ của người thực hiện hành động
        uint256 timestamp; // Thời gian xảy ra (timestamp)
        string note; // Ghi chú về sự kiện
    }

    // Struct định nghĩa cấu trúc dữ liệu cho một Giao dịch chuyển giao đang chờ xử lý
    // Đây là bước trung gian yêu cầu cả người gửi và người nhận xác nhận
    struct PendingTransfer {
        address from; // Địa chỉ người gửi
        address to; // Địa chỉ người nhận
        bool fromConfirmed; // Cờ xác nhận từ người gửi (luôn là true khi bắt đầu)
        bool toConfirmed; // Cờ xác nhận từ người nhận
    }

    // Mappings để lưu trữ dữ liệu
    mapping(bytes32 => Item) public items; // Lưu trữ thông tin mặt hàng theo ID
    mapping(bytes32 => History[]) public itemHistories; // Lưu trữ lịch sử trạng thái của mặt hàng theo ID
    mapping(bytes32 => Certificate[]) public itemCertificates; // Lưu trữ chứng chỉ của mặt hàng theo ID
    mapping(bytes32 => PendingTransfer) public pendingTransfers; // Lưu trữ các giao dịch chuyển giao đang chờ xử lý theo ID mặt hàng

    // Events để thông báo khi có sự kiện quan trọng xảy ra
    event ItemCreated(bytes32 indexed itemId, string name, address indexed owner); // Thông báo khi mặt hàng được tạo
    event TransferInitiated(bytes32 indexed itemId, address indexed from, address indexed to); // Thông báo khi một giao dịch chuyển giao được bắt đầu
    event TransferConfirmed(bytes32 indexed itemId, address indexed confirmer); // Thông báo khi một giao dịch chuyển giao được xác nhận
    event ItemStateUpdated(bytes32 indexed itemId, State newState, string note); // Thông báo khi trạng thái mặt hàng thay đổi
    event CertificateAdded(bytes32 indexed itemId, string certName, string certIssuer); // Thông báo khi chứng chỉ được thêm vào

    // Constructor: Hàm được gọi duy nhất một lần khi triển khai hợp đồng
    constructor() {
        // Cấp vai trò mặc định DEFAULT_ADMIN_ROLE cho người triển khai hợp đồng (msg.sender)
        // Vai trò admin có quyền cấp/thu hồi các vai trò khác
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Hàm để admin cấp vai trò cho các địa chỉ cụ thể.
     * @param role Vai trò cần cấp (PRODUCER_ROLE, TRANSPORTER_ROLE, ...)
     * @param account Địa chỉ ví của người được cấp vai trò.
     */
    function grantAccess(bytes32 role, address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
    }

    /**
     * @dev Hàm để admin thu hồi vai trò.
     * @param role Vai trò cần thu hồi.
     * @param account Địa chỉ ví của người bị thu hồi vai trò.
     */
    function revokeAccess(bytes32 role, address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(role, account);
    }

    // ----------- Chức năng quản lý mặt hàng -----------

    // Hàm tạo mặt hàng mới
    // Chỉ có người có vai trò PRODUCER_ROLE mới được gọi hàm này (sử dụng modifier onlyRole)
    function createItem(bytes32 _itemId, string memory _name, string memory _description, uint256 _plannedDeliveryTime) external onlyRole(PRODUCER_ROLE) {
        // Yêu cầu: Mặt hàng với ID này chưa tồn tại
        require(!items[_itemId].exists, "Item already exists");

        // Tạo một Item mới và lưu vào mapping items
        items[_itemId] = Item({
            id: _itemId,
            name: _name,
            description: _description,
            currentOwner: msg.sender, // Chủ sở hữu ban đầu là người tạo (Producer)
            currentState: State.Produced, // Trạng thái ban đầu là Đã sản xuất
            exists: true,
            plannedDeliveryTime: _plannedDeliveryTime // Thời gian giao hàng dự kiến
        });

        // Ghi lại lịch sử trạng thái ban đầu
        itemHistories[_itemId].push(History({
            state: State.Produced,
            actor: msg.sender,
            timestamp: block.timestamp,
            note: "Item created"
        }));

        // Phát ra sự kiện ItemCreated
        emit ItemCreated(_itemId, _name, msg.sender);
    }

    // Hàm bắt đầu quá trình chuyển giao mặt hàng cho người khác
    // Bất kỳ ai là chủ sở hữu hiện tại đều có thể gọi hàm này
    function initiateTransfer(bytes32 _itemId, address _to) external {
        Item storage item = items[_itemId];
        // Yêu cầu: Mặt hàng phải tồn tại
        require(item.exists, "Item does not exist");
        // Yêu cầu: Người gọi hàm phải là chủ sở hữu hiện tại của mặt hàng
        require(item.currentOwner == msg.sender, "Only current owner can initiate transfer");

        // Thêm kiểm tra vai trò của người nhận (_to)
        // Người nhận phải là Transporter, Distributor hoặc Retailer
        if (!(hasRole(TRANSPORTER_ROLE, _to) || hasRole(DISTRIBUTOR_ROLE, _to) || hasRole(RETAILER_ROLE, _to))) {
            revert("Invalid receiver role"); // Hoàn lại nếu vai trò người nhận không hợp lệ
        }

        // Lưu thông tin về giao dịch chuyển giao đang chờ xử lý
        pendingTransfers[_itemId] = PendingTransfer({
            from: msg.sender, // Người gửi là chủ sở hữu hiện tại
            to: _to, // Người nhận
            fromConfirmed: true, // Người gửi tự động xác nhận khi bắt đầu
            toConfirmed: false // Người nhận chưa xác nhận
        });

        // Cập nhật trạng thái của mặt hàng dựa trên vai trò của người nhận
        if (hasRole(TRANSPORTER_ROLE, _to) || hasRole(DISTRIBUTOR_ROLE, _to)) {
             // Sử dụng InTransit khi gửi cho Transporter hoặc Distributor
             item.currentState = State.InTransit;
        } else if (hasRole(RETAILER_ROLE, _to)) {
            // Trạng thái khi gửi trực tiếp cho Retailer
            item.currentState = State.InTransitToRetailer;
        }
        // Không cần khối else ở đây vì đã kiểm tra vai trò ở trên

        itemHistories[_itemId].push(History({
            state: item.currentState, // Sử dụng trạng thái vừa được thiết lập
            actor: msg.sender,
            timestamp: block.timestamp,
            note: "Transfer initiated"
        }));

        emit TransferInitiated(_itemId, msg.sender, _to); // Phát ra sự kiện TransferInitiated
    }

    // Hàm xác nhận hoàn tất việc chuyển giao mặt hàng
    // Chỉ có người nhận trong giao dịch đang chờ xử lý mới có thể gọi hàm này
    function confirmTransfer(bytes32 _itemId) external {
        PendingTransfer storage transfer = pendingTransfers[_itemId];
        // Yêu cầu: Người gọi hàm phải là người nhận trong giao dịch đang chờ xử lý
        require(transfer.to == msg.sender, "Only receiver can confirm transfer");
        // Yêu cầu: Người gửi đã bắt đầu giao dịch trước đó
        require(transfer.fromConfirmed, "Sender must initiate transfer first");

        // Đánh dấu người nhận đã xác nhận
        transfer.toConfirmed = true;

        Item storage item = items[_itemId];
        // Cập nhật chủ sở hữu hiện tại của mặt hàng thành người xác nhận
        item.currentOwner = transfer.to; // transfer.to == msg.sender ở đây

        // Cập nhật trạng thái dựa trên vai trò của người xác nhận
        // Thêm trường hợp cho Transporter xác nhận
        if (hasRole(TRANSPORTER_ROLE, msg.sender)) {
            // Nếu Transporter xác nhận, trạng thái vẫn là InTransit
            item.currentState = State.InTransit; // Hoặc một trạng thái mới nếu bạn thêm vào Enum
        } else if (hasRole(DISTRIBUTOR_ROLE, msg.sender)) {
            // Nếu Distributor xác nhận, trạng thái là Đã nhận tại Nhà phân phối
            item.currentState = State.ReceivedAtDistributor;
        } else if (hasRole(RETAILER_ROLE, msg.sender)) {
            // Nếu Retailer xác nhận, trạng thái là Đã giao hàng
            item.currentState = State.Delivered;
        } else {
             revert("Confirmer does not have a valid participant role in this transfer step");
        }

        string memory note = "Delivered on time";
        // Logic kiểm tra thời gian giao hàng có thể cần điều chỉnh cho phù hợp với từng bước xác nhận
        if (block.timestamp > item.plannedDeliveryTime) {
            note = "Delivered late!";
        }

        itemHistories[_itemId].push(History({
            state: item.currentState, // Sử dụng trạng thái vừa thiết lập
            actor: msg.sender,
            timestamp: block.timestamp,
            note: note
        }));

        // Xóa thông tin giao dịch đang chờ xử lý sau khi hoàn tất
        delete pendingTransfers[_itemId];

        // Phát ra sự kiện TransferConfirmed
        emit TransferConfirmed(_itemId, msg.sender);
    }

    // Hàm đánh dấu mặt hàng đã được nhận tại điểm bán lẻ (sau khi trạng thái là Delivered)
    // Chỉ có người có vai trò RETAILER_ROLE mới được gọi hàm này
    function markAsReceived(bytes32 _itemId) external onlyRole(RETAILER_ROLE) {
        Item storage item = items[_itemId];
        // Yêu cầu: Người gọi hàm phải là chủ sở hữu hiện tại
        require(item.currentOwner == msg.sender, "Only owner can mark received");
        // Có thể thêm yêu cầu về trạng thái trước đó, ví dụ: require(item.currentState == State.Delivered, "Item not in Delivered state");

        // Cập nhật trạng thái thành Đã nhận (Received)
        item.currentState = State.Received;

        // Ghi lại lịch sử
        itemHistories[_itemId].push(History({
            state: State.Received,
            actor: msg.sender,
            timestamp: block.timestamp,
            note: "Item received"
        }));

        // Phát ra sự kiện cập nhật trạng thái
        emit ItemStateUpdated(_itemId, State.Received, "Item received");
    }

    // Hàm đánh dấu mặt hàng đã được bán cho người tiêu dùng cuối
    // Chỉ có người có vai trò RETAILER_ROLE mới được gọi hàm này
    function markAsSold(bytes32 _itemId) external onlyRole(RETAILER_ROLE) {
        Item storage item = items[_itemId];
        // Yêu cầu: Người gọi hàm phải là chủ sở hữu hiện tại
        require(item.currentOwner == msg.sender, "Only owner can mark sold");
        // Có thể thêm yêu cầu về trạng thái trước đó, ví dụ: require(item.currentState == State.Received, "Item not in Received state");


        // Cập nhật trạng thái thành Đã bán (Sold)
        item.currentState = State.Sold;

        // Ghi lại lịch sử
        itemHistories[_itemId].push(History({
            state: State.Sold,
            actor: msg.sender,
            timestamp: block.timestamp,
            note: "Item sold"
        }));

        // Phát ra sự kiện cập nhật trạng thái
        emit ItemStateUpdated(_itemId, State.Sold, "Item sold");
    }

    // ----------- Chức năng xử lý sự cố (Hư hỏng, Thất lạc) -----------
    // Các hàm này sử dụng modifier onlyRole để đảm bảo chỉ người có vai trò phù hợp mới có thể gọi

    // Hàm báo cáo mặt hàng bị hư hỏng bởi Transporter
    // Chỉ có người có vai trò TRANSPORTER_ROLE mới được gọi
    function reportDamage(bytes32 _itemId, string memory _reason) external onlyRole(TRANSPORTER_ROLE) {
        Item storage item = items[_itemId];
        require(item.exists, "Item does not exist");
        // Có thể thêm yêu cầu người gọi là chủ sở hữu hiện tại, hoặc đang trong trạng thái vận chuyển

        item.currentState = State.Damaged; // Cập nhật trạng thái thành Hư hỏng

        // Ghi lại lịch sử sự cố
        itemHistories[_itemId].push(History({
            state: State.Damaged,
            actor: msg.sender,
            timestamp: block.timestamp,
            note: _reason
        }));

        emit ItemStateUpdated(_itemId, State.Damaged, _reason); // Phát ra sự kiện
    }

    // Hàm báo cáo mặt hàng bị thất lạc bởi Transporter
    // Chỉ có người có vai trò TRANSPORTER_ROLE mới được gọi
    function reportLost(bytes32 _itemId, string memory _reason) external onlyRole(TRANSPORTER_ROLE) {
        Item storage item = items[_itemId];
        require(item.exists, "Item does not exist");
        // Có thể thêm yêu cầu người gọi là chủ sở hữu hiện tại, hoặc đang trong trạng thái vận chuyển

        item.currentState = State.Lost; // Cập nhật trạng thái thành Thất lạc

        // Ghi lại lịch sử sự cố
        itemHistories[_itemId].push(History({
            state: State.Lost,
            actor: msg.sender,
            timestamp: block.timestamp,
            note: _reason
        }));

        emit ItemStateUpdated(_itemId, State.Lost, _reason); // Phát ra sự kiện
    }

    // Hàm báo cáo mặt hàng bị hư hỏng tại Nhà phân phối
    // Chỉ có người có vai trò DISTRIBUTOR_ROLE mới được gọi
    function reportDamageAtDistributor(bytes32 _itemId, string memory _reason) external onlyRole(DISTRIBUTOR_ROLE) {
        Item storage item = items[_itemId];
        require(item.exists, "Item does not exist");
        // Có thể thêm yêu cầu người gọi là chủ sở hữu hiện tại, hoặc đang ở trạng thái ReceivedAtDistributor

        item.currentState = State.Damaged; // Cập nhật trạng thái thành Hư hỏng

        // Ghi lại lịch sử sự cố
        itemHistories[_itemId].push(History({
            state: State.Damaged,
            actor: msg.sender,
            timestamp: block.timestamp,
            note: _reason
        }));

        emit ItemStateUpdated(_itemId, State.Damaged, _reason); // Phát ra sự kiện
    }

    // Hàm báo cáo mặt hàng bị thất lạc tại Nhà phân phối
    // Chỉ có người có vai trò DISTRIBUTOR_ROLE mới được gọi
    function reportLostAtDistributor(bytes32 _itemId, string memory _reason) external onlyRole(DISTRIBUTOR_ROLE) {
        Item storage item = items[_itemId];
        require(item.exists, "Item does not exist");
        // Có thể thêm yêu cầu người gọi là chủ sở hữu hiện tại, hoặc đang ở trạng thái ReceivedAtDistributor

        item.currentState = State.Lost; // Cập nhật trạng thái thành Thất lạc

        // Ghi lại lịch sử sự cố
        itemHistories[_itemId].push(History({
            state: State.Lost,
            actor: msg.sender,
            timestamp: block.timestamp,
            note: _reason
        }));

        emit ItemStateUpdated(_itemId, State.Lost, _reason); // Phát ra sự kiện
    }

    // ----------- Chức năng quản lý chứng chỉ -----------

    // Hàm thêm chứng chỉ cho mặt hàng
    // Chỉ có người có vai trò PRODUCER_ROLE mới được gọi hàm này
    function addCertificate(bytes32 _itemId, string memory _certName, string memory _certIssuer) external onlyRole(PRODUCER_ROLE) {
        Item storage item = items[_itemId];
        require(item.exists, "Item does not exist");
        // Có thể thêm yêu cầu người gọi là chủ sở hữu hiện tại, hoặc mặt hàng đang ở trạng thái Produced

        // Thêm chứng chỉ mới vào danh sách chứng chỉ của mặt hàng
        itemCertificates[_itemId].push(Certificate({
            certName: _certName,
            certIssuer: _certIssuer,
            issueDate: block.timestamp
        }));

        emit CertificateAdded(_itemId, _certName, _certIssuer); // Phát ra sự kiện
    }

    // Hàm xem danh sách chứng chỉ của mặt hàng
    // Là hàm view, không tốn gas khi gọi
    function getCertificates(bytes32 _itemId) external view returns (Certificate[] memory) {
        return itemCertificates[_itemId];
    }

    // ----------- Chức năng xem dữ liệu -----------

    // Hàm xem lịch sử trạng thái của mặt hàng
    // Là hàm view, không tốn gas khi gọi
    function getItemHistory(bytes32 _itemId) external view returns (History[] memory) {
        return itemHistories[_itemId];
    }

    // Hàm lấy thông tin chi tiết của mặt hàng
    // Là hàm view, không tốn gas khi gọi. Mapping public items tự động tạo hàm getter này.
    // function items(bytes32 _itemId) external view returns (Item memory) { ... }
}