// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Sử dụng các phiên bản upgradeable từ OpenZeppelin
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Hợp đồng quản lý chuỗi cung ứng phiên bản có thể nâng cấp
// Kế thừa AccessControlUpgradeable và UUPSUpgradeable
// Sử dụng ContextUpgradeable vì AccessControlUpgradeable cần nó
contract SupplyChainTracking is ContextUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    // Định nghĩa các vai trò tham gia vào chuỗi cung ứng
    // bytes32 là kiểu dữ liệu được sử dụng cho vai trò trong AccessControl
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE"); // Vai trò Quản trị viên
    bytes32 public constant PRODUCER_ROLE = keccak256("PRODUCER_ROLE"); // Vai trò Nhà sản xuất
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE"); // Vai trò Người vận chuyển
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE"); // Vai trò Nhà phân phối
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE"); // Vai trò Nhà bán lẻ
    bytes32 public constant CUSTOMER_ROLE = keccak256("CUSTOMER_ROLE"); // Vai trò Khách hàng

    // Enum định nghĩa các trạng thái có thể có của một mặt hàng trong chuỗi cung ứng
    enum State {
        PRODUCED, // Đã sản xuất
        IN_TRANSIT, // Đang vận chuyển (tới Transporter)
        IN_TRANSIT_AT_TRANSPORTER, // Đang vận chuyển và thuộc sở hữu của Transporter
        IN_TRANSIT_TO_DISTRIBUTOR, // Đang vận chuyển (tới Distributor)
        RECEIVED_AT_DISTRIBUTOR, // Đã nhận tại Nhà phân phối
        IN_TRANSIT_TO_RETAILER, // Đang vận chuyển đến Nhà bán lẻ
        RECEIVED_AT_RETAILER, // Đã nhận hàng tại Nhà bán lẻ
        SOLD, // Đã bán
        DAMAGED, // Bị hư hỏng
        LOST // Bị thất lạc
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
        uint256 costPrice; // Giá sản xuất (Producer trả cho feeCollector)
        uint256 sellingPrice; // Giá bán (Người nhận trả cho chủ sở hữu hiện tại khi chuyển giao)
        string itemIdString; // ID dưới dạng chuỗi
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
        bool toConfirmed; // Người nhận chưa xác nhận
    }

    IERC20 public tokenContract;
    address public feeCollector;

    // Mappings để lưu trữ dữ liệu
    mapping(bytes32 => Item) public items; // Lưu trữ thông tin mặt hàng theo ID
    mapping(bytes32 => History[]) public itemHistories; // Lưu trữ lịch sử trạng thái của mặt hàng theo ID
    mapping(bytes32 => Certificate[]) public itemCertificates; // Lưu trữ chứng chỉ của mặt hàng theo ID
    mapping(bytes32 => PendingTransfer) public pendingTransfers; // Lưu trữ các giao dịch chuyển giao đang chờ xử lý theo ID mặt hàng

    // Mảng mới để lưu trữ tất cả các ID mặt hàng đã được tạo
    bytes32[] private allItemIds; // Sử dụng private để chỉ có thể truy cập qua hàm getter

    // Events để thông báo khi có sự kiện quan trọng xảy ra
    event ItemCreated(bytes32 indexed itemId, string name, address indexed owner, uint256 costPrice, uint256 sellingPrice); // Thông báo khi mặt hàng được tạo
    event TransferInitiated(bytes32 indexed itemId, address indexed from, address indexed to); // Thông báo khi một giao dịch chuyển giao được bắt đầu
    event TransferConfirmed(bytes32 indexed itemId, address indexed confirmer, uint256 amountPaidToPreviousOwner); // Thông báo khi một giao dịch chuyển giao được xác nhận
    event ItemStateUpdated(bytes32 indexed itemId, State newState, string note); // Thông báo khi trạng thái mặt hàng thay đổi
    event CertificateAdded(bytes32 indexed itemId, string certName, string certIssuer); // Thông báo khi chứng chỉ được thêm vào
    event ItemSoldToCustomer(bytes32 indexed itemId, address indexed retailer, address indexed customer); // Thông báo khi mặt hàng được bán cho khách hàng
    event TokenContractAddressSet(address indexed tokenAddress); // Thông báo khi địa chỉ hợp đồng token được thiết lập
    event FeeCollectorAddressSet(address indexed collectorAddress); // Thông báo khi địa chỉ thu phí được thiết lập
    event ItemSellingPriceUpdated(bytes32 indexed itemId, uint256 newSellingPrice, address indexed updater); // Thông báo khi giá bán của mặt hàng được cập nhật
    event PaymentTransferred(bytes32 indexed itemId, address indexed payer, address indexed payee, uint256 amount, string reason); // Thông báo khi thanh toán được thực hiện

    // Hàm này chỉ được gọi MỘT LẦN duy nhất khi proxy contract được deploy lần đầu.
    function initialize() initializer public {
        // Gọi hàm initialize của các hợp đồng cha (AccessControlUpgradeable)
        // DEFAULT_ADMIN_ROLE cũng cần được khởi tạo
        __AccessControl_init();
        __UUPSUpgradeable_init(); // Khởi tạo UUPSUpgradeable

        // Cấp vai trò mặc định DEFAULT_ADMIN_ROLE cho người gọi hàm initialize (thường là người triển khai proxy)
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        feeCollector = _msgSender();
    }

    /**
     * @dev Hàm này được yêu cầu bởi UUPSUpgradeable để xác định ai được phép nâng cấp.
     * Chúng ta sẽ giới hạn quyền này cho người có vai trò DEFAULT_ADMIN_ROLE.
     * @param newImplementation Địa chỉ của phiên bản implementation mới.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /**
     * @dev Hàm để thiết lập địa chỉ hợp đồng token ERC20.
     * Chỉ người có vai trò DEFAULT_ADMIN_ROLE mới có thể gọi hàm này.
     * @param _tokenAddress Địa chỉ của hợp đồng token ERC20.
     */
    function setTokenContractAddress(address _tokenAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_tokenAddress != address(0), "Token address cannot be zero");
        tokenContract = IERC20(_tokenAddress);
        emit TokenContractAddressSet(_tokenAddress);
    }

    /**
     * @dev Hàm để thiết lập địa chỉ thu phí (fee collector).
     * Chỉ người có vai trò DEFAULT_ADMIN_ROLE mới có thể gọi hàm này.
     * @param _collectorAddress Địa chỉ của người thu phí.
     */
    function setFeeCollectorAddress(address _collectorAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_collectorAddress != address(0), "Fee collector address cannot be zero");
        feeCollector = _collectorAddress;
        emit FeeCollectorAddressSet(_collectorAddress);
    }

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
     * @dev Tạo một mặt hàng mới trong chuỗi cung ứng.
     * Chỉ người có vai trò PRODUCER_ROLE mới có thể gọi hàm này.
     * Hàm này sẽ yêu cầu Producer thanh toán chi phí sản xuất (costPrice) cho feeCollector.
     * @param _itemId ID duy nhất của mặt hàng (dùng bytes32 để tiết kiệm gas).
     * @param _name Tên của mặt hàng.
     * @param _description Mô tả chi tiết về mặt hàng.
     * @param _plannedDeliveryTime Thời gian giao hàng dự kiến (timestamp).
     * @param _costPrice Giá sản xuất (Producer trả cho feeCollector).
     * @param _sellingPrice Giá bán (Người nhận trả cho chủ sở hữu hiện tại khi chuyển giao).
     */
    function createItem(
        bytes32 _itemId,
        string memory _name,
        string memory _description,
        uint256 _plannedDeliveryTime,
        uint256 _costPrice,
        uint256 _sellingPrice,
        string memory _originalItemId
    ) external onlyRole(PRODUCER_ROLE) {
        require(!items[_itemId].exists, "Item already exists");
        require(address(tokenContract) != address(0), "Token contract address not set");
        require(feeCollector != address(0), "Fee collector address not set");

        // LOGIC: Thu costPrice từ Producer
        if (_costPrice > 0) {
            uint256 allowance = tokenContract.allowance(_msgSender(), address(this));
            require(allowance >= _costPrice, "Insufficient token allowance for cost price");

            bool success = tokenContract.transferFrom(_msgSender(), feeCollector, _costPrice);
            require(success, "Cost price token transfer failed");
            emit PaymentTransferred(_itemId, _msgSender(), feeCollector, _costPrice, "Item Cost Price");
        }

        items[_itemId] = Item({
            id: _itemId,
            itemIdString: _originalItemId,
            name: _name,
            description: _description,
            currentOwner: _msgSender(),
            currentState: State.PRODUCED,
            exists: true,
            plannedDeliveryTime: _plannedDeliveryTime,
            costPrice: _costPrice,
            sellingPrice: _sellingPrice
        });

        itemHistories[_itemId].push(History({
            state: State.PRODUCED,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: "Item created"
        }));

        allItemIds.push(_itemId); // Thêm ID mặt hàng vào mảng allItemIds

        emit ItemCreated(_itemId, _name, _msgSender(), _costPrice, _sellingPrice);
    }

    /**
     * @dev Cập nhật giá bán của mặt hàng.
     * Chỉ người hiện tại sở hữu mặt hàng và có vai trò là PRODUCER_ROLE, DISTRIBUTOR_ROLE, RETAILER_ROLE và mặt hàng ở trạng thái hợp lệ mới có thể gọi hàm này.
     * @param _itemId ID của mặt hàng cần cập nhật giá bán.
     * @param _newSellingPrice Giá bán mới cho mặt hàng.
     */
    function updateSellingPrice(bytes32 _itemId, uint256 _newSellingPrice) external {
        Item storage item = items[_itemId];
        // Yêu cầu: Mặt hàng phải tồn tại
        require(item.exists, "Item does not exist");
        // Yêu cầu: Người gọi hàm phải là chủ sở hữu hiện tại của mặt hàng
        require(item.currentOwner == _msgSender(), "Only current owner can update selling price");
        // Yêu cầu: Người gọi hàm phải có một trong các vai trò PRODUCER_ROLE, DISTRIBUTOR_ROLE, hoặc RETAILER_ROLE
        require(hasRole(PRODUCER_ROLE, _msgSender()) || hasRole(DISTRIBUTOR_ROLE, _msgSender()) || hasRole(RETAILER_ROLE, _msgSender()), "Caller is not authorized");
        // Yêu cầu trạng thái của mặt hàng phải PRODUCED, RECEIVED_AT_DISTRIBUTOR, RECEIVED_AT_RETAILER
        require(item.currentState == State.PRODUCED || item.currentState == State.RECEIVED_AT_DISTRIBUTOR || item.currentState == State.RECEIVED_AT_RETAILER, "Item must be in a valid state to update selling price");

        uint256 oldPrice = item.sellingPrice;
        item.sellingPrice = _newSellingPrice;
        emit ItemSellingPriceUpdated(_itemId, _newSellingPrice, _msgSender());

        // Ghi lại lịch sử thay đổi giá bán
        itemHistories[_itemId].push(History({
            state: item.currentState,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: string(abi.encodePacked("Selling price updated from ", _uintToString(oldPrice), " to ", _uintToString(_newSellingPrice)))
        }));
    }

    // Thêm hàm chuyển uint256 sang string nếu chưa có
    function _uintToString(uint256 v) internal pure returns (string memory) {
        if (v == 0) {
            return "0";
        }
        uint256 j = v;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = v;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        return string(bstr);
    }

    /**
     * @dev Báo cáo mặt hàng bị hư hỏng.
     * Chỉ người có vai trò TRANSPORTER_ROLE hoặc DISTRIBUTOR_ROLE và là chủ sở hữu hiện tại mới có thể gọi hàm này.
     * Cập nhật trạng thái mặt hàng thành Damaged và ghi lại lý do.
     * @param _itemId ID của mặt hàng bị hư hỏng.
     * @param _reason Lý do chi tiết về sự hư hỏng.
     */
    function reportDamage(bytes32 _itemId, string memory _reason) external {
        // Yêu cầu: Chỉ người có vai trò TRANSPORTER_ROLE hoặc DISTRIBUTOR_ROLE mới có thể gọi hàm này
        require(hasRole(TRANSPORTER_ROLE, _msgSender()) || hasRole(DISTRIBUTOR_ROLE, _msgSender()), "Caller must be Transporter or Distributor to report damage");
        Item storage item = items[_itemId];
        // Yêu cầu: Mặt hàng phải tồn tại
        require(item.exists, "Item does not exist");
        // Yêu cầu: Người gọi hàm phải là chủ sở hữu hiện tại của mặt hàng
        require(item.currentOwner == _msgSender(), "Only current owner can report damage");

        item.currentState = State.DAMAGED;
        // Ghi lại lịch sử sự cố
        itemHistories[_itemId].push(History({
            state: State.DAMAGED,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: _reason
        }));

        emit ItemStateUpdated(_itemId, State.DAMAGED, _reason);
    }

    /**
     * @dev Báo cáo mặt hàng bị thất lạc.
     * Chỉ người có vai trò TRANSPORTER_ROLE hoặc DISTRIBUTOR_ROLE và là chủ sở hữu hiện tại mới có thể gọi hàm này.
     * Cập nhật trạng thái mặt hàng thành Lost và ghi lại lý do.
     * @param _itemId ID của mặt hàng bị thất lạc.
     * @param _reason Lý do chi tiết về sự thất lạc.
     */
    function reportLost(bytes32 _itemId, string memory _reason) external {
        // Yêu cầu: Chỉ người có vai trò TRANSPORTER_ROLE hoặc DISTRIBUTOR_ROLE mới có thể gọi hàm này
        require(hasRole(TRANSPORTER_ROLE, _msgSender()) || hasRole(DISTRIBUTOR_ROLE, _msgSender()), "Caller must be Transporter or Distributor to report lost");
        Item storage item = items[_itemId];
        // Yêu cầu: Mặt hàng phải tồn tại
        require(item.exists, "Item does not exist");
        // Yêu cầu: Người gọi hàm phải là chủ sở hữu hiện tại của mặt hàng
        require(item.currentOwner == _msgSender(), "Only current owner can report lost");

        item.currentState = State.LOST;
        // Ghi lại lịch sử sự cố
        itemHistories[_itemId].push(History({
            state: State.LOST,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: _reason
        }));

        emit ItemStateUpdated(_itemId, State.LOST, _reason);
    }

    // ----------- Chức năng quản lý chuyển giao -----------
    /**
     * @dev Bắt đầu quá trình chuyển giao quyền sở hữu mặt hàng cho một bên khác trong chuỗi cung ứng.
     * Chỉ chủ sở hữu hiện tại của mặt hàng mới có thể gọi hàm này.
     * Người nhận (_to) phải có một trong các vai trò TRANSPORTER_ROLE, DISTRIBUTOR_ROLE, hoặc RETAILER_ROLE.
     * Khởi tạo một giao dịch đang chờ xác nhận từ người nhận.
     * Cập nhật trạng thái mặt hàng sang trạng thái vận chuyển phù hợp.
     * @param _itemId ID của mặt hàng cần chuyển giao.
     * @param _to Địa chỉ của người nhận mặt hàng.
     */
    function initiateTransfer(bytes32 _itemId, address _to) external {
        Item storage item = items[_itemId];
        // Yêu cầu: Mặt hàng phải tồn tại
        require(item.exists, "Item does not exist");
        // Yêu cầu: Người gọi hàm phải là chủ sở hữu hiện tại của mặt hàng
        require(item.currentOwner == _msgSender(), "Only current owner can initiate transfer");

        // Người nhận phải là Transporter, Distributor hoặc Retailer
        if (!(hasRole(TRANSPORTER_ROLE, _to) || hasRole(DISTRIBUTOR_ROLE, _to) || hasRole(RETAILER_ROLE, _to))) {
            revert("Invalid receiver role"); // Hoàn lại nếu vai trò người nhận không hợp lệ
        }

        // Kiểm tra xem có giao dịch chuyển giao nào đang chờ xử lý cho mặt hàng này không
        require(pendingTransfers[_itemId].from == address(0), "Existing transfer pending for this item");

        // Lưu thông tin về giao dịch chuyển giao đang chờ xử lý
        pendingTransfers[_itemId] = PendingTransfer({
            from: _msgSender(), // Người gửi là chủ sở hữu hiện tại
            to: _to, // Người nhận
            fromConfirmed: true, // Người gửi tự động xác nhận khi bắt đầu
            toConfirmed: false // Người nhận chưa xác nhận
        });

        // Cập nhật trạng thái của mặt hàng dựa trên vai trò của người nhận
        if (hasRole(TRANSPORTER_ROLE, _to)) {
            item.currentState = State.IN_TRANSIT; // Chuyển cho Transporter
        } else if (hasRole(DISTRIBUTOR_ROLE, _to)) {
            item.currentState = State.IN_TRANSIT_TO_DISTRIBUTOR; // Chuyển cho Distributor
        } else if (hasRole(RETAILER_ROLE, _to)) {
            item.currentState = State.IN_TRANSIT_TO_RETAILER; // Chuyển cho Retailer
        }

        itemHistories[_itemId].push(History({
            state: item.currentState,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: string(abi.encodePacked("Transfer initiated to ", _addressToString(_to)))
        }));

        emit TransferInitiated(_itemId, _msgSender(), _to); // Phát ra sự kiện TransferInitiated
    }

    /**
     * @dev Hàm trợ giúp để chuyển đổi địa chỉ sang chuỗi (cho mục đích ghi chú lịch sử)
     */
    function _addressToString(address _address) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_address)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i+12] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i+12] & 0x0F)];
        }
        return string(str);
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
        Item storage item = items[_itemId];

        // Yêu cầu: Mặt hàng phải tồn tại
        require(item.exists, "Item does not exist");
        // Yêu cầu: Người gọi hàm phải là người nhận trong giao dịch đang chờ xử lý
        require(transfer.to == _msgSender(), "Only receiver can confirm transfer");
        // Yêu cầu: Người gửi đã bắt đầu giao dịch trước đó
        require(transfer.fromConfirmed, "Sender must initiate transfer first");
        // Yêu cầu: Người nhận chưa xác nhận giao dịch này
        require(!transfer.toConfirmed, "Transfer already confirmed by receiver");
        // Người nhận phải là Transporter, Distributor hoặc Retailer
        if (!(hasRole(TRANSPORTER_ROLE, _msgSender()) || hasRole(DISTRIBUTOR_ROLE, _msgSender()) || hasRole(RETAILER_ROLE, _msgSender()))) {
            revert("Invalid confirm transfer role"); // Hoàn lại nếu vai trò người nhận không hợp lệ
        }

        uint256 amountPaid = 0; // Biến để lưu số tiền đã thanh toán
        // LOGIC: Thực hiện thanh toán sellingPrice
        if (item.sellingPrice > 0) {
            require(address(tokenContract) != address(0), "Token contract address not set");
            uint256 allowance = tokenContract.allowance(_msgSender(), address(this));
            require(allowance >= item.sellingPrice, "Insufficient token allowance for selling price");
            
            // Người nhận (_msgSender()) trả tiền cho người gửi (transfer.from)
            bool success = tokenContract.transferFrom(_msgSender(), transfer.from, item.sellingPrice);
            require(success, "Selling price token transfer failed");
            amountPaid = item.sellingPrice;
            emit PaymentTransferred(_itemId, _msgSender(), transfer.from, item.sellingPrice, "Item Selling Price");
        }

        // Đánh dấu người nhận đã xác nhận
        transfer.toConfirmed = true;

        // Cập nhật chủ sở hữu hiện tại của mặt hàng thành người xác nhận
        item.currentOwner = _msgSender(); // Cập nhật chủ sở hữu mới

        string memory note = "Item received.";
        // Cập nhật trạng thái dựa trên vai trò của người xác nhận
        if (hasRole(TRANSPORTER_ROLE, _msgSender())) {
            item.currentState = State.IN_TRANSIT_AT_TRANSPORTER; // Transporter xác nhận và giữ hàng
            note = "Item received by Transporter for transit.";
        } else if (hasRole(DISTRIBUTOR_ROLE, _msgSender())) {
            item.currentState = State.RECEIVED_AT_DISTRIBUTOR; // Distributor xác nhận
            note = "Item received at Distributor.";
        } else if (hasRole(RETAILER_ROLE, _msgSender())) {
            item.currentState = State.RECEIVED_AT_RETAILER; // Retailer xác nhận
            note = "Item received at Retailer.";
        }

        // Logic kiểm tra thời gian giao hàng có thể cần điều chỉnh cho phù hợp với từng bước xác nhận
        if (block.timestamp > item.plannedDeliveryTime) {
            note = string(abi.encodePacked(note, " (Delivered late!)"));
        }

        itemHistories[_itemId].push(History({
            state: item.currentState,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: note
        }));

        // Xóa thông tin giao dịch đang chờ xử lý sau khi hoàn tất
        delete pendingTransfers[_itemId];

        // Phát ra sự kiện TransferConfirmed
        emit TransferConfirmed(_itemId, _msgSender(), amountPaid);
    }

    /**
     * @dev Khách hàng mua mặt hàng từ Nhà bán lẻ.
     * Chỉ người có vai trò CUSTOMER_ROLE mới có thể gọi hàm này.
     * Cập nhật trạng thái mặt hàng thành Sold và chuyển quyền sở hữu cho khách hàng.
     * @param _itemId ID của mặt hàng cần mua.
     */
    function customerBuyItem(bytes32 _itemId) external onlyRole(CUSTOMER_ROLE) {
        Item storage item = items[_itemId];

        // Yêu cầu: Mặt hàng phải tồn tại
        require(item.exists, "Item does not exist");
        // Yêu cầu: Mặt hàng phải ở trạng thái 'Received' (đã sẵn sàng bán tại Retailer)
        require(item.currentState == State.RECEIVED_AT_RETAILER, "Item must be in RECEIVED_AT_RETAILER state to be bought by customer");

        address currentRetailer = item.currentOwner;
        // Yêu cầu: Chủ sở hữu hiện tại phải là một Retailer
        require(hasRole(RETAILER_ROLE, currentRetailer), "Current owner is not a Retailer");

        // LOGIC: Thanh toán sellingPrice từ khách hàng (_msgSender()) cho Nhà bán lẻ (currentRetailer)
        if (item.sellingPrice > 0) {
            require(address(tokenContract) != address(0), "Token contract address not set");
            uint256 allowance = tokenContract.allowance(_msgSender(), address(this));
            require(allowance >= item.sellingPrice, "Insufficient token allowance for selling price");

            bool success = tokenContract.transferFrom(_msgSender(), currentRetailer, item.sellingPrice);
            require(success, "Selling price token transfer failed");
            emit PaymentTransferred(_itemId, _msgSender(), currentRetailer, item.sellingPrice, "Item Sale to Customer");
        }

        // Cập nhật trạng thái thành Đã bán (SOLD)
        item.currentState = State.SOLD;

        // Cập nhật chủ sở hữu hiện tại thành địa chỉ của khách hàng
        item.currentOwner = _msgSender();

        // Ghi lại lịch sử
        itemHistories[_itemId].push(History({
            state: State.SOLD,
            actor: _msgSender(), // Khách hàng là người thực hiện hành động mua
            timestamp: block.timestamp,
            note: "Item sold to customer"
        }));

        // Phát ra sự kiện cập nhật trạng thái
        emit ItemStateUpdated(_itemId, State.SOLD, "Item sold to customer");
        // Phát ra sự kiện mới thông báo về việc bán cho khách hàng
        emit ItemSoldToCustomer(_itemId, currentRetailer, _msgSender()); // Retailer sold to customer
    }

    /**
     * @dev Thêm một chứng chỉ (ví dụ: chứng nhận hữu cơ) vào hồ sơ của một mặt hàng cụ thể.
     * Chỉ người chủ sở hữu hiện tại có vai trò PRODUCER_ROLE và mặt hàng đang ở trạng thái PRODUCED mới có thể gọi hàm này.
     * Chứng chỉ được liên kết với ID mặt hàng và bao gồm tên, đơn vị cấp và ngày cấp.
     * @param _itemId ID của mặt hàng cần thêm chứng chỉ.
     * @param _certName Tên của chứng chỉ (ví dụ: "Organic Certified").
     * @param _certIssuer Đơn vị hoặc tổ chức đã cấp chứng chỉ.
     */
    function addCertificate(bytes32 _itemId, string memory _certName, string memory _certIssuer) external onlyRole(PRODUCER_ROLE) {
        Item storage item = items[_itemId];
        // Yêu cầu: Mặt hàng phải tồn tại
        require(item.exists, "Item does not exist");
        // Yêu cầu: Người gọi hàm phải là chủ sở hữu hiện tại của mặt hàng
        require(item.currentOwner == _msgSender(), "Only current owner can add certificate");
        // Yêu cầu: Mặt hàng phải đang ở trạng thái PRODUCED
        require(item.currentState == State.PRODUCED, "Item must be in Produced state to add certificate");

        // Thêm chứng chỉ mới vào danh sách chứng chỉ của mặt hàng
        itemCertificates[_itemId].push(Certificate({
            certName: _certName,
            certIssuer: _certIssuer,
            issueDate: block.timestamp
        }));

        emit CertificateAdded(_itemId, _certName, _certIssuer); // Phát ra sự kiện

        // Ghi lại lịch sử thêm chứng chỉ
        itemHistories[_itemId].push(History({
            state: item.currentState,
            actor: _msgSender(),
            timestamp: block.timestamp,
            note: string(abi.encodePacked("Certificate added: ", _certName, " by ", _certIssuer))
        }));
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

    /**
     * @dev Lấy tất cả các ID mặt hàng đã được tạo.
     * Hàm này cho phép truy xuất danh sách tất cả các ID mặt hàng đang tồn tại trong hệ thống.
     * @return Một mảng các bytes32 chứa tất cả các ID mặt hàng.
     */
    function getAllItemIds() external view returns (bytes32[] memory) {
        return allItemIds;
    }
}
