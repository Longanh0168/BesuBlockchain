// Tạo cấu hình blockchain cho mạng Besu sử dụng IBFT
besu operator generate-blockchain-config --config-file=ibftConfigFile.json --to=networkFiles --private-key-file-name=key

// Chạy lệnh này trong Docker để tạo cấu hình blockchain cho mạng Besu sử dụng IBFT
docker run --rm -v D:\Besu-Private\IBFT-Network:/config hyperledger/besu:latest operator generate-blockchain-config --config-file=/config/ibftConfigFile.json --to=/config/networkFiles --private-key-file-name=key

// giải thích command
docker run --rm \                              // Chạy một container tạm thời (xóa sau khi dừng) từ image Besu.
--name node1 \                                 // Đặt tên cho container là node1.
--network besu-network-ibft-2 \                // Gán container vào mạng Docker tên là besu-network-ibft-2, giúp các node trong cùng mạng này giao tiếp với nhau.
-v D:\Besu-Private\IBFT-Network:/config \      // (Mount) Gán thư mục trên máy host (D:\Besu-Private\IBFT-Network) vào thư mục /config trong container, giúp lưu trữ dữ liệu và cấu hình.
-p 8545:8545 \                                 // Chuyển tiếp cổng 8545 từ container ra máy host, cho phép truy cập RPC từ bên ngoài.
hyperledger/besu:latest \                      // Sử dụng image Besu mới nhất từ Docker Hub.
--genesis-file=/config/genesis.json \          // Chỉ định tệp genesis.json chứa thông tin khởi tạo blockchain.
--rpc-http-enabled \                           // Bật giao diện RPC HTTP để tương tác với node thông qua REST API (JSON-RPC).
--host-allowlist="*" \                         // Cho phép tất cả các địa chỉ IP truy cập vào node (cần cẩn thận với tùy chọn này trong môi trường sản xuất).
--rpc-http-cors-origins="all" \                // Cho phép tất cả các nguồn gốc CORS, cho phép truy cập từ bất kỳ miền nào.
--metrics-enabled \                            // Bật tính năng thu thập số liệu (metrics) để giám sát hiệu suất của node.
--metrics-port=9545 \                          // Chỉ định cổng 9545 cho việc thu thập số liệu.
--metrics-host=0.0.0.0 \                       // Chỉ định địa chỉ host cho việc thu thập số liệu.
--profile=ENTERPRISE \                         // Sử dụng cấu hình mạng doanh nghiệp, tối ưu hóa cho các ứng dụng doanh nghiệp.

node 2 trở đi khác nhau ở chỗ có thêm --bootnodes và --p2p-port
-p 8547:8546                                   // Map port 8546 trong container ra ngoài là 8547, cho phép truy cập RPC từ bên ngoài. (cổng này khác với node 1 để tránh xung đột cổng).
--bootnodes:                                   // Địa chỉ của node khởi tạo (node 1) mà node này sẽ kết nối đến để tham gia mạng.
--p2p-port=30304                               // Chỉ định cổng P2P mà node này sẽ lắng nghe để nhận kết nối từ các node khác trong mạng. Mỗi node sẽ có cổng khác nhau (30304, 30305, 30306) để tránh xung đột cổng.


  // khởi tạo node 1
  docker run --rm --name node1 --network besu-network-ibft-2 -v D:\Besu-Private\IBFT-Network:/config -p 8545:8545 hyperledger/besu:latest `
    --data-path=/config/Node-1/data `
    --genesis-file=/config/genesis.json `
    --rpc-http-enabled `
    --rpc-http-api=ETH,NET,IBFT,ADMIN,WEB3,DEBUG,TXPOOL `
    --host-allowlist="*" `
    --rpc-http-cors-origins="all" `
    --metrics-enabled `
    --metrics-port=9545 `
    --metrics-host=0.0.0.0 `
    --profile=ENTERPRISE


  // khởi tạo node 2
  docker run --rm --name node2 --network besu-network-ibft-2 -v D:\Besu-Private\IBFT-Network:/config -p 8547:8546 hyperledger/besu:latest `
    --data-path=/config/Node-2/data `
    --genesis-file=/config/genesis.json `
    --bootnodes=enode://26e7c76a4850abe6b2478f20c6cc1cf47f6b48c8b922c6d28e61a206cde4dc2514dce197397d5cb1cc8018d0479fcb7bd38c0d15958821117c26a243aa2993ff@172.18.0.2:30303 `
    --p2p-port=30304 `
    --rpc-http-enabled `
    --rpc-http-api=ETH,NET,IBFT,ADMIN,WEB3,DEBUG,TXPOOL `
    --rpc-http-host=0.0.0.0 `
    --host-allowlist="*" `
    --rpc-http-cors-origins="all" `
    --rpc-http-port=8546 `
    --metrics-enabled `
    --metrics-port=9546 `
    --metrics-host=0.0.0.0 `
    --profile=ENTERPRISE


  // khởi tạo node 3
  docker run --rm --name node3 --network besu-network-ibft-2 -v D:\Besu-Private\IBFT-Network:/config -p 8548:8547 hyperledger/besu:latest `
    --data-path=/config/Node-3/data `
    --genesis-file=/config/genesis.json `
    --bootnodes=enode://26e7c76a4850abe6b2478f20c6cc1cf47f6b48c8b922c6d28e61a206cde4dc2514dce197397d5cb1cc8018d0479fcb7bd38c0d15958821117c26a243aa2993ff@172.18.0.2:30303 `
    --p2p-port=30305 `
    --rpc-http-enabled `
    --rpc-http-api=ETH,NET,IBFT,ADMIN,WEB3,DEBUG,TXPOOL `
    --host-allowlist="*" `
    --rpc-http-cors-origins="all" `
    --rpc-http-port=8547 `
    --metrics-enabled `
    --metrics-port=9547 `
    --metrics-host=0.0.0.0 `
    --profile=ENTERPRISE


  // khởi tạo node 4
  docker run --rm --name node4 --network besu-network-ibft-2 -v D:\Besu-Private\IBFT-Network:/config -p 8549:8548 hyperledger/besu:latest `
    --data-path=/config/Node-4/data `
    --genesis-file=/config/genesis.json `
    --bootnodes=enode://26e7c76a4850abe6b2478f20c6cc1cf47f6b48c8b922c6d28e61a206cde4dc2514dce197397d5cb1cc8018d0479fcb7bd38c0d15958821117c26a243aa2993ff@172.18.0.2:30303 `
    --p2p-port=30306 `
    --rpc-http-enabled `
    --rpc-http-api=ETH,NET,IBFT,ADMIN,WEB3,DEBUG,TXPOOL `
    --host-allowlist="*" `
    --rpc-http-cors-origins="all" `
    --rpc-http-port=8548 `
    --metrics-enabled `
    --metrics-port=9548 `
    --metrics-host=0.0.0.0 `
    --profile=ENTERPRISE



$response = Invoke-RestMethod -Uri "http://localhost:8545/" `
  -Method Post `
  -Body '{"jsonrpc":"2.0","method":"ibft_getValidatorsByBlockNumber","params":["latest"], "id":1}' `
  -Headers @{ "Content-Type" = "application/json" }

$response.result


// lệnh Kiểm tra danh sách các peers
  $response = Invoke-RestMethod -Uri "http://localhost:8545/" `
    -Method Post `
    -Body '{"jsonrpc":"2.0","method":"admin_peers","params":[], "id":1}' `
    -Headers @{ "Content-Type" = "application/json" }

  $response | ConvertTo-Json -Depth 10

// chỉ hiện thông tin cần thiết của các peers
$response = Invoke-RestMethod -Uri "http://localhost:8545/" `
    -Method Post `
    -Body '{"jsonrpc":"2.0","method":"admin_peers","params":[], "id":1}' `
    -Headers @{ "Content-Type" = "application/json" }

foreach ($peer in $response.result) {
    Write-Host "Name:        $($peer.name)"
    Write-Host "ID:          $($peer.id)"
    Write-Host "Enode:       $($peer.enode)"
    Write-Host "Remote Addr: $($peer.network.remoteAddress)"
    Write-Host "Listen Addr: $($peer.network.localAddress)"
    
    if ($peer.protocols.eth) {
        Write-Host "ETH Version: $($peer.protocols.eth.version)"
    }

    Write-Host "---------------------------"
}

// lệnh Kiểm tra số peers
Invoke-RestMethod -Uri "http://localhost:8545/" `
  -Method Post `
  -Body '{"jsonrpc":"2.0","method":"net_peerCount","params":[], "id":1}' `
  -Headers @{ "Content-Type" = "application/json" }


// lệnh kiểm tra tài khoản
Invoke-RestMethod -Uri "http://localhost:8546" `
  -Method Post `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{"jsonrpc":"2.0","method":"eth_accounts","params":[],"id":1}'


// lệnh kiểm tra số block
Invoke-RestMethod -Uri "http://localhost:8545/" `
  -Method Post `
  -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[], "id":1}' `
  -Headers @{ "Content-Type" = "application/json" }


# --- Configuration ---
# Cập nhật các đường dẫn và URL phù hợp với môi trường của bạn
$privateKeyPath = "D:\Besu-Private\IBFT-Network\jwt\jwt_private.pem"
$pythonScriptPath = "D:\Besu-Private\IBFT-Network\scripts\generate_jwt.py"
$besuRpcUrl = "http://localhost:8545/" # <-- CẬP NHẬT ĐỊA CHỈ & CỔNG RPC CỦA NODE BESU


// tạo network với docker
docker network create besu-network-ibft-2

// xóa network
docker network rm besu-network-ibft-2

// kiểm tra network
docker ps

// kiểm tra IP của container
docker inspect <container_name> | findstr "IPAddress"
vd: docker inspect unruffled_austin | findstr "IPAddress"


/// tạo ví mới
mkdir besu-wallet && cd besu-wallet
npm init -y
npm install ethers


// script tạo 1 tài khoản ví mới
PS D:\Besu-Private\IBFT-Network\besu-wallet> node create-wallet.js


// script tạo các tài khoản cần thiết cho supply chain
PS D:\Besu-Private\IBFT-Network\besu-wallet> node supply-chain-wallets.js

-> các tài khoản sẽ được tạo trong thư mục D:\Besu-Private\IBFT-Network\besu-wallet\accounts.json


// xóa dữ liệu của các node
Remove-Item -Recurse -Force "D:\Besu-Private\IBFT-Network\Node-1\data"
Remove-Item -Recurse -Force "D:\Besu-Private\IBFT-Network\Node-2\data"
Remove-Item -Recurse -Force "D:\Besu-Private\IBFT-Network\Node-3\data"
Remove-Item -Recurse -Force "D:\Besu-Private\IBFT-Network\Node-4\data"


// kiểm tra balance của tài khoản
$body = @{
  jsonrpc = "2.0"
  method = "eth_getBalance"
  params = @("0xa586c054754e674141B3E1067dD6163Baae59417", "latest")
  id = 1
} | ConvertTo-Json -Compress
Invoke-RestMethod -Uri http://localhost:8545 -Method POST -Body $body -ContentType "application/json"



/// biên dịch contract
npx hardhat compile


// Các bước triển khai hợp đồng thông minh Supply Chain lên hệ thống Besu sử dụng Hardhat
// Bước 1: deploy SupplyChainCoin contract
PS D:\Besu-Private\IBFT-Network> npx hardhat run scripts/deployToken.js --network besu_local

Kết quả biên dịch:
Compiled 22 Solidity files successfully (evm target: paris).
Deploying SupplyChainCoin with the account: 0xa586c054754e674141B3E1067dD6163Baae59417
Account ETH balance: 100000000000000000000000
SupplyChainCoin (SCC) deployed to: 0x159901Af979465F6c2741fB65Da5CBeea5f6B4Ae
Token Owner (minter): 0xa586c054754e674141B3E1067dD6163Baae59417
Token address saved to deployedTokenAddress.txt

Minting 1000000.0 SCC to 0xa586c054754e674141B3E1067dD6163Baae59417...
Minted to 0xa586c054754e674141B3E1067dD6163Baae59417.
Current SCC balance of 0xa586c054754e674141B3E1067dD6163Baae59417: 1000000.0 SCC

Minting 1000000.0 SCC to 0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54...
Minted to 0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54.
Current SCC balance of 0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54: 1000000.0 SCC

Minting 1000000.0 SCC to 0xAAfD5D06eAB12321852413ffE3A06233C33e8a66...
Minted to 0xAAfD5D06eAB12321852413ffE3A06233C33e8a66.
Current SCC balance of 0xAAfD5D06eAB12321852413ffE3A06233C33e8a66: 1000000.0 SCC

Minting 1000000.0 SCC to 0xe83f7EA2eB8D5049d9162B1F2cfc9075a1C698D0...
Minted to 0xe83f7EA2eB8D5049d9162B1F2cfc9075a1C698D0.
Current SCC balance of 0xe83f7EA2eB8D5049d9162B1F2cfc9075a1C698D0: 1000000.0 SCC

Minting 1000000.0 SCC to 0xBe85127318076116cf4C19c5Dd91C95503368FFe...
Minted to 0xBe85127318076116cf4C19c5Dd91C95503368FFe.
Current SCC balance of 0xBe85127318076116cf4C19c5Dd91C95503368FFe: 1000000.0 SCC

Minting 1000000.0 SCC to 0xB85a94BB5D2F97D1CD517b7ec6208b869C4b2444...
Minted to 0xB85a94BB5D2F97D1CD517b7ec6208b869C4b2444.
Current SCC balance of 0xB85a94BB5D2F97D1CD517b7ec6208b869C4b2444: 1000000.0 SCC

🎉 Token deployment and initial minting finished!

// Bước 2: deploy SupplyChainTracking contract
PS D:\Besu-Private\IBFT-Network> npx hardhat run scripts/deploySupplyChain.js --network besu_local

Kết quả biên dịch:
Deploying upgradeable SupplyChainTracking contract...
Found SupplyChainCoin address: 0x159901Af979465F6c2741fB65Da5CBeea5f6B4Ae
Proxy contract deployed successfully to address: 0x2a8d9D59f6b645EEe6f62fADF885a6Dc90078F96
Note: This is the PROXY address. Interact with this address.
Implementation contract deployed to address: 0x672D429678F7489Eaf87F1a0b2066C08392f557b
Proxy address saved to deployedProxyAddress.txt

Setting SupplyChainCoin address (0x159901Af979465F6c2741fB65Da5CBeea5f6B4Ae) in SupplyChainTracking contract...
SupplyChainCoin address set successfully!

Remember to run the grant_roles.js script using the proxy address to set up roles.

🎉 SupplyChainTracking deployment and token linking finished!


// Bước 3: gán quyền cho các tài khoản
PS D:\Besu-Private\IBFT-Network> npx hardhat run scripts/grantRoles.js --network besu_local

Kết quả biên dịch:
Reading SupplyChainTracking Proxy address from file: 0x2a8d9D59f6b645EEe6f62fADF885a6Dc90078F96
Attaching to SupplyChainTracking contract at 0x2a8d9D59f6b645EEe6f62fADF885a6Dc90078F96...
Using admin account: 0xa586c054754e674141B3E1067dD6163Baae59417
Fetching role identifiers...
Role identifiers fetched successfully:
 - DEFAULT_ADMIN_ROLE: 0x0000000000000000000000000000000000000000000000000000000000000000
 - PRODUCER_ROLE: 0x8eb467f061ca67f42a2d2ca4a346fc9fb645efc0ba75056ee9f71c3a0ccc10a8
 - TRANSPORTER_ROLE: 0xddaa901e2fe3bda354fe0ede2785152d5c109282a613fe024a056a3e66c41bb3
 - DISTRIBUTOR_ROLE: 0xfbd454f36a7e1a388bd6fc3ab10d434aa4578f811acbbcf33afb1c697486313c
 - RETAILER_ROLE: 0x2a5f906c256a5d799494fcd066e1f6c077689de1cdb65052a1624de4bace99bf
 - CUSTOMER_ROLE: 0x288a15c4a15d470e4cd9cad2f113b91206b520c26dbd3dd74627f0c057baa19c

Granting roles...
 -> Account 0xa586c054754e674141B3E1067dD6163Baae59417 already has role DEFAULT_ADMIN_ROLE. Skipping.
 -> Account 0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54 already has role PRODUCER_ROLE. Skipping.
 -> Account 0xe83f7EA2eB8D5049d9162B1F2cfc9075a1C698D0 already has role TRANSPORTER_ROLE. Skipping.
 -> Account 0xBe85127318076116cf4C19c5Dd91C95503368FFe already has role DISTRIBUTOR_ROLE. Skipping.
 -> Account 0xB85a94BB5D2F97D1CD517b7ec6208b869C4b2444 already has role RETAILER_ROLE. Skipping.
 -> Account 0xAAfD5D06eAB12321852413ffE3A06233C33e8a66 already has role CUSTOMER_ROLE. Skipping.

🎉 Role granting process finished!


// upgrade SupplyChainTracking contract
npx hardhat run scripts/upgradeSupplyChain.js --network besu_local

PS D:\Besu-Private\IBFT-Network> npx hardhat run scripts/upgradeSupplyChain.js --network besu_local
Reading SupplyChainTracking Proxy address from file: 0x2a8d9D59f6b645EEe6f62fADF885a6Dc90078F96
Đang nâng cấp hợp đồng SupplyChainTracking...
Địa chỉ Proxy hiện tại: 0x2a8d9D59f6b645EEe6f62fADF885a6Dc90078F96
Hợp đồng SupplyChainTracking đã được nâng cấp thành công!
Địa chỉ Proxy (không đổi): 0x2a8d9D59f6b645EEe6f62fADF885a6Dc90078F96
Địa chỉ Implementation mới: 0xd37bCfe8426Cb4a60d4432B87cf2129AB0fD4f56


// kiểm tra contract có còn trên network không
$body = @{
    jsonrpc = "2.0"
    method = "eth_getCode"
    params = @("0x2b5a5176cB45Bb6caB6FbC1a17C9ADD2eA09f4C3", "latest")
    id = 1
} | ConvertTo-Json -Depth 3

$response = Invoke-WebRequest -Uri http://localhost:8545 `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

$response.Content



/// test contract bằng hardhat
npx hardhat test

// test contract bằng hardhat với network besu_local
npx hardhat test --network besu_local


// xóa các artifacts và cache của contract cũ
Remove-Item -Recurse -Force artifacts,cache


/// phần 3 tích hợp các cơ chế bảo mật + giám sát
// tích hợp trình phân tích bảo mật Slither vào quy trình CI/CD của bạn, bạn có thể thực hiện các bước sau:

slither . 

Chạy Slither trên thư mục hiện tại chứa mã nguồn hợp đồng thông minh slither sẽ tự động phát hiện
các vấn đề bảo mật trong mã nguồn hợp đồng thông minh của bạn và cung cấp báo cáo chi tiết về các vấn đề đã
phát hiện.


// 3.5. Giám sát và kiểm soát an toàn hệ thống
1. Chạy container Prometheus
Công dụng chính: Khởi động container Prometheus để thu thập dữ liệu (metrics) hiệu suất và hoạt động từ các Besu node.
chạy cổng : localhost:9090

docker run --rm --name prometheus --network besu-network-ibft-2 `
  -p 9090:9090 `
  -v D:\Besu-Private\IBFT-Network\Monitoring\prometheus\prometheus.yml:/etc/prometheus/prometheus.yml `
  -v D:\Besu-Private\IBFT-Network\Monitoring\prometheus\data:/prometheus `
  prom/prometheus

docker run --rm --name prometheus --network besu-network-ibft-2 ` # Chạy container, tự xóa khi dừng, đặt tên "prometheus", kết nối vào mạng "besu-network-ibft-2"
  -p 9090:9090 `                                                 # Ánh xạ port 9090 (UI Prometheus) từ container ra máy host
  -v D:\Besu-Private\IBFT-Network\Monitoring\prometheus\prometheus.yml:/etc/prometheus/prometheus.yml ` # Mount file cấu hình Prometheus từ host vào container
  -v D:\Besu-Private\IBFT-Network\Monitoring\prometheus\data:/prometheus ` # Mount thư mục lưu trữ dữ liệu của Prometheus từ host vào container (lưu ý: data sẽ mất nếu container bị xóa do --rm)
  prom/prometheus  

2. Chạy container Grafana
Công dụng chính: Khởi động container Grafana để hiển thị dữ liệu metrics đã thu thập bởi Prometheus thông qua dashboard.
chạy cổng: localhost:3000

docker run --rm --name grafana --network besu-network-ibft-2 `
  -p 3000:3000 `
  -v D:\Besu-Private\IBFT-Network\Monitoring\grafana\data:/var/lib/grafana `
  grafana/grafana

docker run --rm --name grafana --network besu-network-ibft-2 ` # Chạy container, tự xóa khi dừng, đặt tên "grafana", kết nối vào mạng "besu-network-ibft-2"
  -p 3000:3000 `                                               # Ánh xạ port 3000 (UI Grafana) từ container ra máy host
  -v D:\Besu-Private\IBFT-Network\Monitoring\grafana\data:/var/lib/grafana ` # Mount thư mục lưu trữ dữ liệu/cấu hình của Grafana từ host vào container (lưu ý: data sẽ mất nếu container bị xóa do --rm)
  grafana/grafana                                              # Image Docker của Grafana

Thông tin đăng nhập Grafana:
Username mặc định: admin
Password mặc định (lần đầu): admin
Password sau khi đổi: Longanh2402
Công dụng: Dùng để đăng nhập vào giao diện web của Grafana tại http://localhost:3000 để cấu hình nguồn dữ liệu (Prometheus) và import dashboard.