// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Sử dụng các phiên bản upgradeable từ OpenZeppelin    
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

// Hợp đồng quản lý chuỗi cung ứng phiên bản có thể nâng cấp
// Kế thừa AccessControlUpgradeable và UUPSUpgradeable
// Sử dụng ContextUpgradeable vì AccessControlUpgradeable cần nó
contract SupplyChainTracking is ContextUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
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
    event ItemSoldToCustomer(bytes32 indexed itemId, address indexed retailer, address indexed customer); // Thông báo khi mặt hàng được bán cho khách hàng

    // Hàm này chỉ được gọi MỘT LẦN duy nhất khi proxy contract được deploy lần đầu.
    function initialize() initializer public {
        // Gọi hàm initialize của các hợp đồng cha (AccessControlUpgradeable)
        // DEFAULT_ADMIN_ROLE cũng cần được khởi tạo
        __AccessControl_init();
        __UUPSUpgradeable_init(); // Khởi tạo UUPSUpgradeable

        // Cấp vai trò mặc định DEFAULT_ADMIN_ROLE cho người gọi hàm initialize (thường là người triển khai proxy)
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * @dev Hàm này được yêu cầu bởi UUPSUpgradeable để xác định ai được phép nâng cấp.
     * Chúng ta sẽ giới hạn quyền này cho người có vai trò DEFAULT_ADMIN_ROLE.
     * @param newImplementation Địa chỉ của phiên bản implementation mới.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ----------- Chức năng quản lý quyền truy cập -----------
    /**
     * @dev Hàm để admin cấp vai trò cho các địa chỉ cụ thể.
     * Chỉ người có vai trò DEFAULT_ADMIN_ROLE mới có thể gọi hàm này.
     * @param role Vai trò cần cấp (PRODUCER_ROLE, TRANSPORTER_ROLE, DISTRIBUTOR_ROLE, RETAILER_ROLE, v.v.).
     * @param account Địa chỉ ví của người được cấp vai trò.
     */
    function grantAccess(bytes32 role, address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
    }

    /**
     * @dev Hàm để admin thu hồi vai trò từ một địa chỉ cụ thể.
     * Chỉ người có vai trò DEFAULT_ADMIN_ROLE mới có thể gọi hàm này.
     * @param role Vai trò cần thu hồi.
     * @param account Địa chỉ ví của người bị thu hồi vai trò.
     */
    function revokeAccess(bytes32 role, address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(role, account);
    }

    // ----------- Chức năng quản lý mặt hàng -----------

    /**
     * @dev Producer tạo ra một sản phẩm mới và đăng ký vào chuỗi cung ứng.
     * Chỉ người có vai trò PRODUCER_ROLE mới có thể gọi hàm này.
     * Khởi tạo mặt hàng với trạng thái Produced và chủ sở hữu là người tạo.
     * @param _itemId ID duy nhất cho sản phẩm (do Producer cung cấp).
     * @param _name Tên sản phẩm.
     * @param _description Mô tả sản phẩm.
     * @param _plannedDeliveryTime Thời gian giao hàng dự kiến (timestamp) được đặt bởi Producer.
     */
    function createItem(bytes32 _itemId, string memory _name, string memory _description, uint256 _plannedDeliveryTime) external onlyRole(PRODUCER_ROLE) {
        // Yêu cầu: Mặt hàng với ID này chưa tồn tại
        require(!items[_itemId].exists, "Item already exists");

        // Tạo một Item mới và lưu vào mapping items
        items[_itemId] = Item({
            id: _itemId,
            name: _name,
            description: _description,
            currentOwner: _msgSender(), // Chủ sở hữu ban đầu là người tạo (Producer)
            currentState: State.Produced, // Trạng thái ban đầu là Đã sản xuất
            exists: true,
            plannedDeliveryTime: _plannedDeliveryTime // Thời gian giao hàng dự kiến
        });

        // Ghi lại lịch sử trạng thái ban đầu
        itemHistories[_itemId].push(History({
            state: State.Produced,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: "Item created"
        }));

        // Phát ra sự kiện ItemCreated
        emit ItemCreated(_itemId, _name, _msgSender());
    }

    /**
     * @dev Bắt đầu quá trình chuyển giao quyền sở hữu mặt hàng cho một bên khác trong chuỗi cung ứng.
     * Chỉ chủ sở hữu hiện tại của mặt hàng mới có thể gọi hàm này.
     * Người nhận (_to) phải có một trong các vai trò TRANSPORTER_ROLE, DISTRIBUTOR_ROLE, hoặc RETAILER_ROLE.
     * Khởi tạo một giao dịch đang chờ xác nhận từ người nhận.
     * Cập nhật trạng thái mặt hàng sang InTransit hoặc InTransitToRetailer.
     * @param _itemId ID của mặt hàng cần chuyển giao.
     * @param _to Địa chỉ của người nhận mặt hàng.
     */
    function initiateTransfer(bytes32 _itemId, address _to) external {
        Item storage item = items[_itemId];
        // Yêu cầu: Mặt hàng phải tồn tại
        require(item.exists, "Item does not exist");
        // Yêu cầu: Người gọi hàm phải là chủ sở hữu hiện tại của mặt hàng
        require(item.currentOwner == _msgSender(), "Only current owner can initiate transfer");

        // Thêm kiểm tra vai trò của người nhận (_to)
        // Người nhận phải là Transporter, Distributor hoặc Retailer
        if (!(hasRole(TRANSPORTER_ROLE, _to) || hasRole(DISTRIBUTOR_ROLE, _to) || hasRole(RETAILER_ROLE, _to))) {
            revert("Invalid receiver role"); // Hoàn lại nếu vai trò người nhận không hợp lệ
        }

        // Lưu thông tin về giao dịch chuyển giao đang chờ xử lý
        pendingTransfers[_itemId] = PendingTransfer({
            from: _msgSender(), // Người gửi là chủ sở hữu hiện tại
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
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: "Transfer initiated"
        }));

        emit TransferInitiated(_itemId, _msgSender(), _to); // Phát ra sự kiện TransferInitiated
    }

    /**
     * @dev Xác nhận việc nhận mặt hàng trong một giao dịch chuyển giao đang chờ xử lý.
     * Chỉ người nhận được chỉ định trong giao dịch đang chờ xử lý mới có thể gọi hàm này.
     * Người gọi hàm phải có vai trò tương ứng với bước tiếp theo trong chuỗi cung ứng (Transporter, Distributor, hoặc Retailer).
     * Cập nhật chủ sở hữu và trạng thái của mặt hàng sau khi xác nhận.
     * @param _itemId ID của mặt hàng cần xác nhận.
     */
    function confirmTransfer(bytes32 _itemId) external {
        PendingTransfer storage transfer = pendingTransfers[_itemId];
        // Yêu cầu: Người gọi hàm phải là người nhận trong giao dịch đang chờ xử lý
        require(transfer.to == _msgSender(), "Only receiver can confirm transfer");
        // Yêu cầu: Người gửi đã bắt đầu giao dịch trước đó
        require(transfer.fromConfirmed, "Sender must initiate transfer first");

        // Đánh dấu người nhận đã xác nhận
        transfer.toConfirmed = true;

        Item storage item = items[_itemId];
        // Cập nhật chủ sở hữu hiện tại của mặt hàng thành người xác nhận
        item.currentOwner = transfer.to; // transfer.to == _msgSender() ở đây

        // Cập nhật trạng thái dựa trên vai trò của người xác nhận
        // Thêm trường hợp cho Transporter xác nhận
        if (hasRole(TRANSPORTER_ROLE, _msgSender())) {
            // Nếu Transporter xác nhận, trạng thái vẫn là InTransit (hoặc có thể chuyển sang trạng thái vận chuyển tiếp theo nếu có)
            item.currentState = State.InTransit; // Hoặc một trạng thái mới nếu bạn thêm vào Enum
        } else if (hasRole(DISTRIBUTOR_ROLE, _msgSender())) {
            // Nếu Distributor xác nhận, trạng thái là Đã nhận tại Nhà phân phối
            item.currentState = State.ReceivedAtDistributor;
        } else if (hasRole(RETAILER_ROLE, _msgSender())) {
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
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: note
        }));

        // Xóa thông tin giao dịch đang chờ xử lý sau khi hoàn tất
        delete pendingTransfers[_itemId];

        // Phát ra sự kiện TransferConfirmed
        emit TransferConfirmed(_itemId, _msgSender());
    }

    /**
     * @dev Đánh dấu mặt hàng đã được nhận thành công tại điểm bán lẻ và sẵn sàng để bán.
     * Chỉ người có vai trò RETAILER_ROLE và là chủ sở hữu hiện tại của mặt hàng mới có thể gọi hàm này.
     * Cập nhật trạng thái mặt hàng thành Received.
     * @param _itemId ID của mặt hàng cần đánh dấu đã nhận.
     */
    function markAsReceived(bytes32 _itemId) external onlyRole(RETAILER_ROLE) {
        Item storage item = items[_itemId];
        // Yêu cầu: Người gọi hàm phải là chủ sở hữu hiện tại
        require(item.currentOwner == _msgSender(), "Only owner can mark received");
        // Có thể thêm yêu cầu về trạng thái trước đó, ví dụ: require(item.currentState == State.Delivered, "Item not in Delivered state");

        // Cập nhật trạng thái thành Đã nhận (Received)
        item.currentState = State.Received;

        // Ghi lại lịch sử
        itemHistories[_itemId].push(History({
            state: State.Received,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: "Item received"
        }));

        // Phát ra sự kiện cập nhật trạng thái
        emit ItemStateUpdated(_itemId, State.Received, "Item received");
    }

    /**
     * @dev Đánh dấu mặt hàng đã được bán cho người tiêu dùng cuối cùng.
     * Chỉ người có vai trò RETAILER_ROLE và là chủ sở hữu hiện tại của mặt hàng mới có thể gọi hàm này.
     * Cập nhật trạng thái mặt hàng thành Sold và chuyển quyền sở hữu cho người mua (khách hàng cuối).
     * @param _itemId ID của mặt hàng cần đánh dấu đã bán.
     * @param _customerAddress Địa chỉ ví của người mua (người tiêu dùng cuối).
     */
    function markAsSold(bytes32 _itemId, address _customerAddress) external onlyRole(RETAILER_ROLE) {
        Item storage item = items[_itemId];

        // Yêu cầu: Mặt hàng phải tồn tại
        require(item.exists, "Item does not exist");
        // Yêu cầu: Người gọi hàm phải là chủ sở hữu hiện tại (người bán - Retailer)
        require(item.currentOwner == _msgSender(), "Only current owner (Retailer) can mark sold");
        // Yêu cầu: Địa chỉ người mua không phải là địa chỉ zero
        require(_customerAddress != address(0), "Customer address cannot be zero");

        // Cập nhật trạng thái thành Đã bán (Sold)
        item.currentState = State.Sold;

        // Cập nhật chủ sở hữu hiện tại thành địa chỉ của người mua
        item.currentOwner = _customerAddress;

        // Ghi lại lịch sử
        // Actor vẫn là người thực hiện hành động (Retailer)
        itemHistories[_itemId].push(History({
            state: State.Sold,
            actor: _msgSender(), // Người gọi hàm (Retailer)
            timestamp: block.timestamp,
            note: "Item sold to customer" // Cập nhật ghi chú
        }));

        // Phát ra sự kiện cập nhật trạng thái
        emit ItemStateUpdated(_itemId, State.Sold, "Item sold");
        // Phát ra sự kiện mới thông báo về việc bán cho khách hàng
        emit ItemSoldToCustomer(_itemId, _msgSender(), _customerAddress);
    }

    // ----------- Chức năng xử lý sự cố (Hư hỏng, Thất lạc) -----------
    // Các hàm này sử dụng modifier onlyRole để đảm bảo chỉ người có vai trò phù hợp mới có thể gọi

    /**
     * @dev Báo cáo mặt hàng bị hư hỏng bởi người vận chuyển (Transporter).
     * Chỉ người có vai trò TRANSPORTER_ROLE mới có thể gọi hàm này.
     * Cập nhật trạng thái mặt hàng thành Damaged và ghi lại lý do.
     * @param _itemId ID của mặt hàng bị hư hỏng.
     * @param _reason Lý do chi tiết về sự hư hỏng.
     */
    function reportDamage(bytes32 _itemId, string memory _reason) external onlyRole(TRANSPORTER_ROLE) {
        Item storage item = items[_itemId];
        require(item.exists, "Item does not exist");
        // Có thể thêm yêu cầu người gọi là chủ sở hữu hiện tại, hoặc đang trong trạng thái vận chuyển

        item.currentState = State.Damaged; // Cập nhật trạng thái thành Hư hỏng

        // Ghi lại lịch sử sự cố
        itemHistories[_itemId].push(History({
            state: State.Damaged,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: _reason
        }));

        emit ItemStateUpdated(_itemId, State.Damaged, _reason); // Phát ra sự kiện
    }

    /**
     * @dev Báo cáo mặt hàng bị thất lạc bởi người vận chuyển (Transporter).
     * Chỉ người có vai trò TRANSPORTER_ROLE mới có thể gọi hàm này.
     * Cập nhật trạng thái mặt hàng thành Lost và ghi lại lý do.
     * @param _itemId ID của mặt hàng bị thất lạc.
     * @param _reason Lý do chi tiết về sự thất lạc.
     */
    function reportLost(bytes32 _itemId, string memory _reason) external onlyRole(TRANSPORTER_ROLE) {
        Item storage item = items[_itemId];
        require(item.exists, "Item does not exist");
        // Có thể thêm yêu cầu người gọi là chủ sở hữu hiện tại, hoặc đang trong trạng thái vận chuyển

        item.currentState = State.Lost; // Cập nhật trạng thái thành Thất lạc

        // Ghi lại lịch sử sự cố
        itemHistories[_itemId].push(History({
            state: State.Lost,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: _reason
        }));

        emit ItemStateUpdated(_itemId, State.Lost, _reason); // Phát ra sự kiện
    }

    /**
     * @dev Báo cáo mặt hàng bị hư hỏng tại điểm Nhà phân phối (Distributor).
     * Chỉ người có vai trò DISTRIBUTOR_ROLE mới có thể gọi hàm này.
     * Cập nhật trạng thái mặt hàng thành Damaged và ghi lại lý do.
     * @param _itemId ID của mặt hàng bị hư hỏng.
     * @param _reason Lý do chi tiết về sự hư hỏng.
     */
    function reportDamageAtDistributor(bytes32 _itemId, string memory _reason) external onlyRole(DISTRIBUTOR_ROLE) {
        Item storage item = items[_itemId];
        require(item.exists, "Item does not exist");
        // Có thể thêm yêu cầu người gọi là chủ sở hữu hiện tại, hoặc đang ở trạng thái ReceivedAtDistributor

        item.currentState = State.Damaged; // Cập nhật trạng thái thành Hư hỏng

        // Ghi lại lịch sử sự cố
        itemHistories[_itemId].push(History({
            state: State.Damaged,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: _reason
        }));

        emit ItemStateUpdated(_itemId, State.Damaged, _reason); // Phát ra sự kiện
    }

    /**
     * @dev Báo cáo mặt hàng bị thất lạc tại điểm Nhà phân phối (Distributor).
     * Chỉ người có vai trò DISTRIBUTOR_ROLE mới có thể gọi hàm này.
     * Cập nhật trạng thái mặt hàng thành Lost và ghi lại lý do.
     * @param _itemId ID của mặt hàng bị thất lạc.
     * @param _reason Lý do chi tiết về sự thất lạc.
     */
    function reportLostAtDistributor(bytes32 _itemId, string memory _reason) external onlyRole(DISTRIBUTOR_ROLE) {
        Item storage item = items[_itemId];
        require(item.exists, "Item does not exist");
        // Có thể thêm yêu cầu người gọi là chủ sở hữu hiện tại, hoặc đang ở trạng thái ReceivedAtDistributor

        item.currentState = State.Lost; // Cập nhật trạng thái thành Thất lạc

        // Ghi lại lịch sử sự cố
        itemHistories[_itemId].push(History({
            state: State.Lost,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: _reason
        }));

        emit ItemStateUpdated(_itemId, State.Lost, _reason); // Phát ra sự kiện
    }

    // ----------- Chức năng quản lý chứng chỉ -----------

    /**
     * @dev Thêm một chứng chỉ (ví dụ: chứng nhận hữu cơ) vào hồ sơ của một mặt hàng cụ thể.
     * Chỉ người có vai trò PRODUCER_ROLE mới có thể gọi hàm này.
     * Chứng chỉ được liên kết với ID mặt hàng và bao gồm tên, đơn vị cấp và ngày cấp.
     * @param _itemId ID của mặt hàng cần thêm chứng chỉ.
     * @param _certName Tên của chứng chỉ (ví dụ: "Organic Certified").
     * @param _certIssuer Đơn vị hoặc tổ chức đã cấp chứng chỉ.
     */
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

    /**
     * @dev Lấy danh sách tất cả các chứng chỉ đã được thêm cho một mặt hàng.
     * Đây là hàm chỉ đọc (view), không tốn gas khi gọi.
     * Bất kỳ ai cũng có thể gọi hàm này để kiểm tra chứng chỉ của sản phẩm.
     * @param _itemId ID của mặt hàng cần xem chứng chỉ.
     * @return Một mảng các cấu trúc Certificate chứa thông tin về các chứng chỉ của mặt hàng đó.
     */
    function getCertificates(bytes32 _itemId) external view returns (Certificate[] memory) {
        return itemCertificates[_itemId];
    }

    // ----------- Chức năng xem dữ liệu -----------

    /**
     * @dev Lấy thông tin chi tiết của một mặt hàng cụ thể.
     * Đây là hàm chỉ đọc (view), không tốn gas khi gọi.
     * Bất kỳ ai cũng có thể gọi hàm này để xem thông tin sản phẩm.
     * @param _itemId ID của mặt hàng cần xem thông tin.
     * @return Một cấu trúc Item chứa thông tin chi tiết về mặt hàng đó.
     */
    function getItemDetail(bytes32 _itemId) external view returns (Item memory) {
        return items[_itemId]; // Trả về thông tin mặt hàng theo ID
    }


    /**
     * @dev Lấy địa chỉ chủ sở hữu hiện tại của một mặt hàng cụ thể.
     * Đây là hàm chỉ đọc (view), không tốn gas khi gọi.
     * Bất kỳ ai cũng có thể gọi hàm này để kiểm tra chủ sở hữu sản phẩm.
     * @param _itemId ID của mặt hàng cần xem chủ sở hữu.
     * @return Địa chỉ của chủ sở hữu hiện tại của mặt hàng.
     */
    function getItemOwner(bytes32 _itemId) external view returns (address) {
        return items[_itemId].currentOwner; // Trả về chủ sở hữu hiện tại của mặt hàng theo ID
    }


    /**
     * @dev Lấy trạng thái hiện tại của một mặt hàng cụ thể.
     * Đây là hàm chỉ đọc (view), không tốn gas khi gọi.
     * Bất kỳ ai cũng có thể gọi hàm này để theo dõi trạng thái sản phẩm.
     * @param _itemId ID của mặt hàng cần xem trạng thái.
     * @return Trạng thái hiện tại của mặt hàng (được định nghĩa trong enum State).
     */
    function getItemState(bytes32 _itemId) external view returns (State) {
        return items[_itemId].currentState; // Trả về trạng thái hiện tại của mặt hàng theo ID
    }

    /**
     * @dev Lấy toàn bộ lịch sử thay đổi trạng thái của một mặt hàng cụ thể.
     * Đây là hàm chỉ đọc (view), không tốn gas khi gọi.
     * Bất kỳ ai cũng có thể gọi hàm này để theo dõi hành trình của sản phẩm.
     * @param _itemId ID của mặt hàng cần xem lịch sử.
     * @return Một mảng các cấu trúc History, mỗi phần tử ghi lại một sự kiện thay đổi trạng thái.
     */
    function getItemHistory(bytes32 _itemId) external view returns (History[] memory) {
        return itemHistories[_itemId]; // Trả về lịch sử mặt hàng theo ID
    }
}