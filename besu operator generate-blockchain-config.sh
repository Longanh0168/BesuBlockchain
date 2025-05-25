besu operator generate-blockchain-config --config-file=ibftConfigFile.json --to=networkFiles --private-key-file-name=key

docker run --rm -v D:\Besu-Private\IBFT-Network:/config hyperledger/besu:latest operator generate-blockchain-config --config-file=/config/ibftConfigFile.json --to=/config/networkFiles --private-key-file-name=key
docker run --rm -v D:\Besu-Private\IBFT-Network:/config hyperledger/besu:23.10.1 operator generate-blockchain-config --config-file=/config/ibftConfigFile.json --to=/config/networkFiles --private-key-file-name=key



besu --data-path=data --genesis-file=../genesis.json --rpc-http-enabled --rpc-http-api=ETH,NET,IBFT --host-allowlist="*" --rpc-http-cors-origins="all" --profile=ENTERPRISE

// giải thích command
docker run --rm \                              // Chạy một container tạm thời (xóa sau khi dừng) từ image Besu.
--network besu-network-ibft-2 \                // Gán container vào mạng Docker tên là besu-network-ibft-2, giúp các node trong cùng mạng này giao tiếp với nhau.
-v D:\Besu-Private\IBFT-Network:/config \      // (Mount) Gán thư mục trên máy host (D:\Besu-Private\IBFT-Network) vào thư mục /config trong container, giúp lưu trữ dữ liệu và cấu hình.
-p 8545:8545 \                                 // Chuyển tiếp cổng 8545 từ container ra máy host, cho phép truy cập RPC từ bên ngoài.
hyperledger/besu:latest \                      // Sử dụng image Besu mới nhất từ Docker Hub.
--genesis-file=/config/genesis.json \          // Chỉ định tệp genesis.json chứa thông tin khởi tạo blockchain.
--rpc-http-enabled \                           // Bật giao diện RPC HTTP để tương tác với node thông qua REST API (JSON-RPC).
--host-allowlist="*" \                         // Cho phép tất cả các địa chỉ IP truy cập vào node (cần cẩn thận với tùy chọn này trong môi trường sản xuất).
--rpc-http-cors-origins="all" \                // Cho phép tất cả các nguồn gốc CORS, cho phép truy cập từ bất kỳ miền nào.
--profile=ENTERPRISE \                         // Sử dụng cấu hình mạng doanh nghiệp, tối ưu hóa cho các ứng dụng doanh nghiệp.

node 2 trở đi khác nhau ở chỗ có thêm --bootnodes và --p2p-port
-p 8547:8546                                   // Map port 8546 trong container ra ngoài là 8547, cho phép truy cập RPC từ bên ngoài. (cổng này khác với node 1 để tránh xung đột cổng).
--bootnodes:                                   // Địa chỉ của node khởi tạo (node 1) mà node này sẽ kết nối đến để tham gia mạng.
--p2p-port=30304                               // Chỉ định cổng P2P mà node này sẽ lắng nghe để nhận kết nối từ các node khác trong mạng. Mỗi node sẽ có cổng khác nhau (30304, 30305, 30306) để tránh xung đột cổng.


# Dừng container cũ trước khi chạy lệnh mới
docker run --rm --network besu-network-ibft-2 -v D:\Besu-Private\IBFT-Network:/config `
  -p 8545:8545 ` # RPC Port
  -p 9545:9545 ` # Metrics Port
  hyperledger/besu:latest `
  --data-path=/config/Node-1/data `
  --genesis-file=/config/genesis.json `
  --rpc-http-enabled `
  --rpc-http-api=ETH,NET,IBFT,ADMIN,WEB3,DEBUG,TXPOOL `
  --host-allowlist="127.0.0.1,192.168.1.100" ` # <-- Ví dụ: Cho phép host và 1 IP LAN
  --rpc-http-cors-origins="http://localhost:3000" ` # <-- Ví dụ: Cho phép frontend dev
  --rpc-http-authentication-enabled=true `         # <-- Giữ nguyên
  --rpc-http-authentication-protocol=JWT `         # <-- THAY ĐỔI/THÊM MỚI
  --rpc-http-authentication-jwt-public-key-file="/config/jwt/jwt_public.pem" ` # <-- THAY ĐỔI/THÊM MỚI
  --p2p-tls-enabled=true `
  --p2p-tls-keystore-type=JKS `
  --p2p-tls-keystore-file="/config/tls/Node-1/node1_keystore.jks" `
  --p2p-tls-keystore-password-file="/config/tls/Node-1/node1_keystore_password.txt" `
  --p2p-tls-truststore-type=JKS `
  --p2p-tls-truststore-file="/config/tls/common/truststore.jks" `
  --p2p-tls-truststore-password-file="/config/tls/common/truststore_password.txt" `
  --p2p-tls-crl-support-enabled=false `
  --metrics-enabled=true `
  --metrics-protocol=PROMETHEUS `
  --metrics-host-allowlist="127.0.0.1,IP_PROMETHEUS_SERVER" ` # <-- Thay IP Prometheus
  --profile=ENTERPRISE
  # Các cờ bootnodes, p2p-port... vẫn giữ nguyên

--Xp2p-tls-enabled=true `
--Xp2p-tls-keystore-type=PKCS12 `                     
--Xp2p-tls-keystore-file="/tls/node-X/node_keystore.p12" ` 
--Xp2p-tls-keystore-password-file="/tls/node-X/node_keystore_password.txt" ` 
--Xp2p-tls-truststore-type=PKCS12 `                  
--Xp2p-tls-truststore-file="/tls/common/common_truststore.p12" `
--Xp2p-tls-truststore-password-file="/tls/common/common_truststore_password.txt" `
--Xp2p-tls-crl-support-enabled=false `

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
    --bootnodes=enode://cc9d960ca4b4fcd1e9de2709cd9a0bc03fbc79eab436cb689514fef551592759cfb46642b8a0fac5010e2acd1b3878983e29add1ae5cca63cbbe3f2676c3ca34@172.18.0.2:30303 `
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
    --bootnodes=enode://cc9d960ca4b4fcd1e9de2709cd9a0bc03fbc79eab436cb689514fef551592759cfb46642b8a0fac5010e2acd1b3878983e29add1ae5cca63cbbe3f2676c3ca34@172.18.0.2:30303 `
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
    --bootnodes=enode://cc9d960ca4b4fcd1e9de2709cd9a0bc03fbc79eab436cb689514fef551592759cfb46642b8a0fac5010e2acd1b3878983e29add1ae5cca63cbbe3f2676c3ca34@172.18.0.2:30303 `
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



curl -X POST --data '{"jsonrpc":"2.0","method":"ibft_getValidatorsByBlockNumber","params":["latest"], "id":1}' localhost:8545/ -H "Content-Type: application/json"

Invoke-WebRequest -Uri "http://localhost:8545/" `
  -Method Post `
  -Body '{"jsonrpc":"2.0","method":"ibft_getValidatorsByBlockNumber","params":["latest"], "id":1}' `
  -Headers @{ "Content-Type" = "application/json" }


Invoke-RestMethod -Uri "http://localhost:8545/" `
  -Method Post `
  -Body '{"jsonrpc":"2.0","method":"ibft_getValidatorsByBlockNumber","params":["latest"], "id":1}' `
  -Headers @{ "Content-Type" = "application/json" }



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

# --- Hàm lấy JWT ---
# Đặt hàm Get-JwtToken này ở đây hoặc đảm bảo nó đã được định nghĩa
# trong profile PowerShell của bạn hoặc trong một file script riêng biệt được gọi từ đây.
function Get-JwtToken {
    param(
        [string]$PrivateKeyFilePath,
        [string]$PythonScriptFilePath
    )
    try {
        Write-Verbose "Generating JWT using Python script..."
        # Gọi script Python và capture output (JWT token)
        $jwt = python $PythonScriptFilePath $PrivateKeyFilePath

        # Kiểm tra xem script Python có chạy thành công và trả về token không
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($jwt)) {
            Write-Error "Python script failed to generate JWT or returned empty. Exit code: $LASTEXITCODE"
            return $null
        }
        Write-Verbose "JWT generated successfully."
        # Loại bỏ khoảng trắng thừa có thể có ở cuối output từ Python
        return $jwt.Trim()
    } catch {
        Write-Error "Error calling Python script: $($_.Exception.Message)"
        return $null
    }
}

# --- Bắt đầu script kiểm tra số block ---

# Lấy JWT cho yêu cầu hiện tại
$jwtToken = Get-JwtToken -PrivateKeyFilePath $privateKeyPath -PythonScriptFilePath $pythonScriptPath

# Kiểm tra xem có lấy được token không
if ($null -eq $jwtToken) {
    Write-Error "Could not obtain JWT. Exiting."
    exit 1 # Thoát script nếu không lấy được token
}

# --- Chuẩn bị Header với JWT ---
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $jwtToken" # <-- THÊM HEADER XÁC THỰC JWT VÀO ĐÂY
}

# --- Chuẩn bị Thân yêu cầu RPC (eth_blockNumber) ---
$rpcBody = @{
    jsonrpc = "2.0"
    method = "eth_blockNumber" # Phương thức kiểm tra số block
    params = @() # Không có tham số
    id = 1 # ID của yêu cầu
} | ConvertTo-Json -Depth 10 # Chuyển đối tượng PowerShell thành chuỗi JSON

# --- Thực hiện gọi RPC bằng Invoke-RestMethod ---
Write-Host "Calling $($besuRpcUrl) with JWT for eth_blockNumber..."
try {
    # Sử dụng Invoke-RestMethod với URL, Method, Body và Headers đã chuẩn bị
    $response = Invoke-RestMethod -Uri $besuRpcUrl `
        -Method Post `
        -Body $rpcBody `
        -Headers $headers

    # --- Xử lý kết quả ---
    Write-Host "Block Number Response:"
    # Kết quả của eth_blockNumber là một chuỗi hex biểu thị số block mới nhất
    Write-Host "Latest Block Number (hex): $($response.result)"

    # Tùy chọn: Chuyển đổi số hex sang số thập phân để dễ đọc
    try {
        # Loại bỏ tiền tố "0x" và chuyển đổi từ hệ 16 sang hệ 10
        $hexBlockNumber = $response.result.TrimStart("0x")
        # Sử dụng [System.Int64] hoặc [System.Numerics.BigInteger] nếu số block rất lớn
        $blockNumberDecimal = [System.Int32]::Parse($hexBlockNumber, "HexNumber")
        Write-Host "Latest Block Number (decimal): $blockNumberDecimal"
    } catch {
        Write-Host "Could not convert hex block number to decimal. Error: $($_.Exception.Message)"
    }


} catch {
    # Xử lý lỗi khi gọi RPC (ví dụ: lỗi kết nối, lỗi xác thực 401)
    Write-Error "Error calling RPC: $($_.Exception.Message)"
    # Hiển thị chi tiết lỗi HTTP nếu có (rất hữu ích cho lỗi 401 Unauthorized)
    if ($_.Exception.Response -ne $null) {
        Write-Error "HTTP Status Code: $($_.Exception.Response.StatusCode.Value__)"
        $errorResponse = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream()).ReadToEnd()
        Write-Error "HTTP Response Body: $($errorResponse)"
    }
}




node contracts/deploy.js

// tạo network
docker network create besu-network-ibft-2
// xóa network
docker network rm besu-network-ibft-2


// kiểm tra network
docker ps

// kiểm tra IP của container
docker inspect <container_name> | findstr "IPAddress"
vd: docker inspect unruffled_austin | findstr "IPAddress"


docker run --rm -v D:\Besu-Private\IBFT-Network:/config hyperledger/besu:latest `
  account create --data-path=/config/Node-1/data


/// tạo ví mới
mkdir besu-wallet && cd besu-wallet
npm init -y
npm install ethers

node create-wallet.js 

Remove-Item -Recurse -Force "D:\Besu-Private\IBFT-Network\Node-1\data"
Remove-Item -Recurse -Force "D:\Besu-Private\IBFT-Network\Node-2\data"
Remove-Item -Recurse -Force "D:\Besu-Private\IBFT-Network\Node-3\data"
Remove-Item -Recurse -Force "D:\Besu-Private\IBFT-Network\Node-4\data"


// kiểm tra balance của tài khoản
$body = @{
  jsonrpc = "2.0"
  method = "eth_getBalance"
  params = @("0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54", "latest")
  id = 1
} | ConvertTo-Json -Compress
Invoke-RestMethod -Uri http://localhost:8545 -Method POST -Body $body -ContentType "application/json"

// biên dịch contract
npx hardhat compile

// deploy contract
PS D:\Besu-Private\IBFT-Network> npx hardhat run scripts/deploySupplyChain.js --network besu_local                      
Deploying upgradeable SupplyChainTracking contract...
Proxy contract deployed successfully to address: 0x2b5a5176cB45Bb6caB6FbC1a17C9ADD2eA09f4C3
Note: This is the PROXY address. Interact with this address.


// gán quyền cho các tài khoản
PS D:\Besu-Private\IBFT-Network> npx hardhat run scripts/grantRoles.js --network besu_local
Attaching to SupplyChainTracking contract at 0xC4F6aD30A6537E64613B166523c72291a2a29824...
Using admin account: 0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54
Fetching role identifiers...
 - PRODUCER_ROLE: 0x8eb467f061ca67f42a2d2ca4a346fc9fb645efc0ba75056ee9f71c3a0ccc10a8
 - TRANSPORTER_ROLE: 0xddaa901e2fe3bda354fe0ede2785152d5c109282a613fe024a056a3e66c41bb3
 - DISTRIBUTOR_ROLE: 0xfbd454f36a7e1a388bd6fc3ab10d434aa4578f811acbbcf33afb1c697486313c
 - RETAILER_ROLE: 0x2a5f906c256a5d799494fcd066e1f6c077689de1cdb65052a1624de4bace99bf

Granting roles...
 -> Granting PRODUCER_ROLE to 0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54...
    Done.
 -> Granting TRANSPORTER_ROLE to 0xe83f7EA2eB8D5049d9162B1F2cfc9075a1C698D0...
    Done.
 -> Granting DISTRIBUTOR_ROLE to 0xBe85127318076116cf4C19c5Dd91C95503368FFe...
    Done.
 -> Granting RETAILER_ROLE to 0xB85a94BB5D2F97D1CD517b7ec6208b869C4b2444...
    Done.

🎉 Role granting process finished!


// deploy token contract
PS D:\Besu-Private\IBFT-Network> npx hardhat run scripts/deployToken.js --network besu_local
Compiled 7 Solidity files successfully (evm target: paris).
Deploying SupplyChainCoin with the account: 0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54
Account ETH balance: 100000000000000000000000
SupplyChainCoin (SCC) deployed to: 0x6EaB01832715a8deCdCD4F43442779C9E0a77D62
Token Owner (minter): 0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54

Minting 1000000.0 SCC to 0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54...
Minted to 0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54.
Current SCC balance of 0x8Eb326f586acf3010744Ad3B2E83cE55D2F6Cb54: 1000000.0 SCC

Minting 1000000.0 SCC to 0xe83f7EA2eB8D5049d9162B1F2cfc9075a1C698D0...
Minted to 0xe83f7EA2eB8D5049d9162B1F2cfc9075a1C698D0.
Current SCC balance of 0xe83f7EA2eB8D5049d9162B1F2cfc9075a1C698D0: 1000000.0 SCC

Minting 1000000.0 SCC to 0xBe85127318076116cf4C19c5Dd91C95503368FFe...
Minted to 0xBe85127318076116cf4C19c5Dd91C95503368FFe.
Current SCC balance of 0xBe85127318076116cf4C19c5Dd91C95503368FFe: 1000000.0 SCC

Minting 1000000.0 SCC to 0xB85a94BB5D2F97D1CD517b7ec6208b869C4b2444...
Minted to 0xB85a94BB5D2F97D1CD517b7ec6208b869C4b2444.
Current SCC balance of 0xB85a94BB5D2F97D1CD517b7ec6208b869C4b2444: 1000000.0 SCC

Minting 1000000.0 SCC to 0xAAfD5D06eAB12321852413ffE3A06233C33e8a66...
Minted to 0xAAfD5D06eAB12321852413ffE3A06233C33e8a66.
Current SCC balance of 0xAAfD5D06eAB12321852413ffE3A06233C33e8a66: 1000000.0 SCC

🎉 Token deployment and initial minting finished!

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

// test contract bằng hardhat
npx hardhat test

// test contract bằng hardhat với network besu_local
npx hardhat test --network besu_local



Remove-Item -Recurse -Force artifacts,cache

npx hardhat run scripts/interactSupplyChain.js --network besu_local


tích hợp trình phân tích bảo mật Slither vào quy trình CI/CD của bạn, bạn có thể thực hiện các bước sau:

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






// Chương 3 thêm cơ chế bảo mật
+ thêm JWT 
mở git bash 
openssl genpkey -algorithm RSA -out jwt_private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in jwt_private.pem -out jwt_public.pem

tạo 2 file jwt_private.pem và jwt_public.pem



o	Áp dụng TLS để mã hóa kết nối giữa các node.
tạo chứng chỉ TLS để mã hóa giao tiếp P2P giữa các node Besu bao gồm các bước chính sau:

Tạo một Certificate Authority (CA) tự ký (Self-Signed CA): Đây sẽ là "tổ chức" gốc cấp phát và bảo증 cho chứng chỉ của các node. Trong môi trường private network, bạn có thể tự tạo CA này.
Tạo Private Key và Certificate Signing Request (CSR) cho mỗi Node: Mỗi node cần có khóa riêng và yêu cầu cấp chứng chỉ.
Sử dụng CA để ký CSR và cấp Chứng chỉ cho mỗi Node: CA sẽ xác nhận yêu cầu và tạo chứng chỉ cho từng node.
Đóng gói Key và Chứng chỉ thành Keystore cho mỗi Node: Besu cần đọc private key và chuỗi chứng chỉ (node cert + CA cert) từ một file keystore. Định dạng phổ biến và được Besu hỗ trợ tốt là PKCS12 (.p12).
Tạo Truststore chứa CA Certificate: Các node cần một truststore chứa chứng chỉ công khai của CA để chúng có thể tin tưởng các chứng chỉ do CA đó cấp phát cho các node khác. Truststore này cũng có thể ở định dạng PKCS12.

  Bước 1: Tạo CA Key và Certificate
# 1. Tạo CA Private Key
openssl genpkey -algorithm RSA -out ca/ca-key.pem -pkeyopt rsa_keygen_bits:2048
echo "--- Đã tạo CA private key: ca/ca-key.pem ---"

# 2. Tạo CA Self-Signed Certificate (Thời hạn 10 năm)
# Thay "/CN=MyBesuNetworkCA" bằng tên định danh cho CA của bạn nếu muốn
openssl req -new -x509 -key ca/ca-key.pem -out ca/ca-cert.pem -days 3650 -subj "//CN=BesuNetworkBlockchainCA"
echo "--- Đã tạo CA certificate: ca/ca-cert.pem ---"

# Lệnh này cũng sẽ tạo file ca-cert.srl (cần thiết cho việc ký các cert sau)


  Bước 2: Tạo Node Key, CSR và Ký Cert cho Từng Node (Lặp lại 4 lần)
--- Cho Node 1 ---
# 3. Tạo Node 1 Private Key
openssl genpkey -algorithm RSA -out node1/node-key.pem -pkeyopt rsa_keygen_bits:2048
echo "--- Đã tạo Node 1 private key: node1/node-key.pem ---"

# 4. Tạo Node 1 CSR
# Thay "/CN=besu-node1.local" bằng tên định danh cho Node 1 nếu muốn
openssl req -new -key node1/node-key.pem -out node1/node.csr -subj "//CN=besu-node-1.local"
echo "--- Đã tạo Node 1 CSR: node1/node.csr ---"

# 5. Ký Node 1 Certificate bằng CA (Thời hạn 1 năm)
openssl x509 -req -in node1/node.csr -CA ca/ca-cert.pem -CAkey ca/ca-key.pem -CAcreateserial -out node1/node-cert.pem -days 365
echo "--- Đã ký Node 1 certificate: node1/node-cert.pem ---"

--- Cho Node 2 --- (Lặp lại tương tự, thay đổi đường dẫn và CN)
openssl genpkey -algorithm RSA -out node2/node-key.pem -pkeyopt rsa_keygen_bits:2048
openssl req -new -key node2/node-key.pem -out node2/node.csr -subj "//CN=besu-node-2.local"
openssl x509 -req -in node2/node.csr -CA ca/ca-cert.pem -CAkey ca/ca-key.pem -CAcreateserial -out node2/node-cert.pem -days 365
echo "--- Đã tạo và ký chứng chỉ cho Node 2 ---"

--- Cho Node 3 ---
openssl genpkey -algorithm RSA -out node3/node-key.pem -pkeyopt rsa_keygen_bits:2048
openssl req -new -key node3/node-key.pem -out node3/node.csr -subj "//CN=besu-node-3.local"
openssl x509 -req -in node3/node.csr -CA ca/ca-cert.pem -CAkey ca/ca-key.pem -CAcreateserial -out node3/node-cert.pem -days 365
echo "--- Đã tạo và ký chứng chỉ cho Node 3 ---"

--- Cho Node 4 ---
openssl genpkey -algorithm RSA -out node4/node-key.pem -pkeyopt rsa_keygen_bits:2048
openssl req -new -key node4/node-key.pem -out node4/node.csr -subj "//CN=besu-node-4.local"
openssl x509 -req -in node4/node.csr -CA ca/ca-cert.pem -CAkey ca/ca-key.pem -CAcreateserial -out node4/node-cert.pem -days 365
echo "--- Đã tạo và ký chứng chỉ cho Node 4 ---"

  Bước 3: Tạo PKCS12 Keystore cho Từng Node

PKCS12 (.p12) là định dạng keystore được Besu hỗ trợ và dễ tạo bằng openssl. Keystore này chứa private key của node và chuỗi chứng chỉ (node cert + CA cert).

!!! Quan trọng: Thay YourNodeKeystorePassword bằng mật khẩu mạnh bạn chọn cho các keystore !!!

# Tạo Keystore cho Node 1
openssl pkcs12 -export -name node1 -in node1/node-cert.pem -inkey node1/node-key.pem -certfile ca/ca-cert.pem -out node1/node_keystore.p12 -passout pass:BesuNode1Keystore
echo "--- Đã tạo Node 1 keystore: node1/node_keystore.p12 ---"

# Tạo Keystore cho Node 2
openssl pkcs12 -export -name node2 -in node2/node-cert.pem -inkey node2/node-key.pem -certfile ca/ca-cert.pem -out node2/node_keystore.p12 -passout pass:BesuNode2Keystore
echo "--- Đã tạo Node 2 keystore: node2/node_keystore.p12 ---"

# Tạo Keystore cho Node 3
openssl pkcs12 -export -name node3 -in node3/node-cert.pem -inkey node3/node-key.pem -certfile ca/ca-cert.pem -out node3/node_keystore.p12 -passout pass:BesuNode3Keystore
echo "--- Đã tạo Node 3 keystore: node3/node_keystore.p12 ---"

# Tạo Keystore cho Node 4
openssl pkcs12 -export -name node4 -in node4/node-cert.pem -inkey node4/node-key.pem -certfile ca/ca-cert.pem -out node4/node_keystore.p12 -passout pass:BesuNode4Keystore
echo "--- Đã tạo Node 4 keystore: node4/node_keystore.p12 ---"

  Bước 4: Tạo PKCS12 Truststore chung

Truststore này chỉ chứa CA certificate công khai và sẽ được tất cả các node sử dụng.

!!! Quan trọng: Thay YourTruststorePassword bằng mật khẩu mạnh bạn chọn cho truststore !!!

openssl pkcs12 -export -nokeys -in ca/ca-cert.pem -out common/common_truststore.p12 -passout pass:BesuTruststore
echo "--- Đã tạo Truststore chung: common/common_truststore.p12 ---"

  Bước 5: Tạo các file chứa mật khẩu (Để dùng với cờ Docker)

Việc này giúp bạn không cần gõ mật khẩu mỗi lần chạy container, nhưng hãy đảm bảo các file này được bảo vệ quyền đọc trên máy host.
# Tạo password file cho Keystores (giả sử dùng chung 1 mật khẩu)
echo "BesuNode1Keystore" > node1/node_keystore_password.txt
echo "BesuNode2Keystore" > node2/node_keystore_password.txt
echo "BesuNode3Keystore" > node3/node_keystore_password.txt
echo "BesuNode4Keystore" > node4/node_keystore_password.txt

# Tạo password file cho Truststore
echo "BesuTruststore" > common/common_truststore_password.txt

echo "--- Đã tạo các file mật khẩu ---"

  Bước 6: Cập nhật lại các cờ Docker cho Besu
# ... các cờ khác ...
--p2p-tls-enabled=true `
--p2p-tls-keystore-type=PKCS12 `                     # <-- Đảm bảo là PKCS12
--p2p-tls-keystore-file="/config/tls/Node-X/node_keystore.p12" ` # <-- Thay X và đảm bảo đuôi .p12
--p2p-tls-keystore-password-file="/config/tls/Node-X/node_keystore_password.txt" ` # <-- Thay X
--p2p-tls-truststore-type=PKCS12 `                   # <-- Đảm bảo là PKCS12
--p2p-tls-truststore-file="/config/tls/common/common_truststore.p12" ` # <-- Đường dẫn truststore chung
--p2p-tls-truststore-password-file="/config/tls/common/common_truststore_password.txt" ` # <-- Đường dẫn pwd truststore
--p2p-tls-crl-support-enabled=false `