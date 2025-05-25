// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // Để quản lý quyền sở hữu và các hàm đặc biệt như mint

/**
 * @title SupplyChainCoin
 * @dev Hợp đồng token ERC20 đơn giản với chức năng mint và burn,
 * được sở hữu bởi người triển khai.
 */
contract SupplyChainCoin is ERC20, Ownable {
    /**
     * @dev Constructor để khởi tạo token.
     * @param initialOwner Địa chỉ sẽ là chủ sở hữu ban đầu của hợp đồng token.
     * Chủ sở hữu này sẽ có quyền mint token.
     * @param name_ Tên của token.
     * @param symbol_ Ký hiệu của token.
     */
    constructor(address initialOwner, string memory name_, string memory symbol_) ERC20(name_, symbol_) Ownable(initialOwner) {
        // Ownable constructor sẽ gán msg.sender (người triển khai) làm chủ sở hữu
        // nếu initialOwner là address(0). Trong trường hợp này, chúng ta truyền initialOwner
        // để người triển khai có thể chỉ định một chủ sở hữu khác nếu muốn,
        // hoặc truyền chính địa chỉ của mình.
    }

    /**
     * @dev Tạo ra `amount` token mới và gán cho tài khoản `to`.
     * Chỉ có thể được gọi bởi chủ sở hữu hợp đồng.
     * @param to Địa chỉ sẽ nhận token mới.
     * @param amount Số lượng token cần tạo.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Hủy `amount` token từ tài khoản người gọi (`msg.sender`).
     * @param amount Số lượng token cần hủy.
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Hủy `amount` token từ tài khoản `account`.
     * Yêu cầu `account` phải cho phép `msg.sender` sử dụng `amount` token thông qua `approve`.
     * @param account Địa chỉ có token cần hủy.
     * @param amount Số lượng token cần hủy.
     */
    function burnFrom(address account, uint256 amount) public {
        _spendAllowance(account, msg.sender, amount); // Kiểm tra và giảm allowance
        _burn(account, amount);
    }

    /**
     * @dev Ghi đè hàm `decimals` để trả về 18 (tiêu chuẩn phổ biến).
     * Bạn có thể thay đổi nếu muốn.
     */
    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
}
