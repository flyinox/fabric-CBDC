# 银行数字货币网络 (CBDC Network)

基于 Hyperledger Fabric 的银行数字货币网络架构，支持央行发行数字货币和银行间交易。

## 网络架构

### 参与方
- **央行 (CentralBank)**: 作为排序节点和货币发行方
- **商业银行（默认，可以配置）**: ICBC（工商银行）、CCB（建设银行）、ABC（农业银行）、BOC（中国银行）

### 网络组件
- 1个排序节点（央行运营）
- 5个Peer节点（央行1个 + 各银行各1个）
- 5个CouchDB数据库
- 1个应用频道（cbdc-channel）

## 目录结构

```
bank-network/
├── chaincode/              # 智能合约
│   ├── cbdc-chaincode.go   # 数字货币合约
│   └── go.mod              # Go模块文件
├── compose/                # Docker配置
│   └── docker-compose.yaml # 网络部署文件
├── configtx/               # 网络配置
│   ├── configtx.yaml       # Fabric网络配置
│   └── network-config.json # 网络参数配置
├── organizations/          # 组织证书目录（运行时生成）
└── scripts/                # 管理脚本
    ├── cbdc-network.sh     # 主控制脚本
    ├── network-config.sh   # 网络配置生成
    ├── generate-configtx.sh # 配置文件生成
    └── generate-compose.sh  # Docker文件生成
```

## 快速开始

### 1. 生成网络配置

```bash
# 生成基础网络配置
./cbdc-network.sh config cbdc-channel CentralBank ICBC CCB ABC BOC

# 或使用默认配置
./cbdc-network.sh config
```

### 2. 启动网络

```bash
# 启动所有服务
./cbdc-network.sh up

# 后台启动
./cbdc-network.sh up -d
```

### 3. 创建频道

```bash
# 创建应用频道
./cbdc-network.sh channel create

# 加入频道
./cbdc-network.sh channel join
```

### 4. 部署智能合约

```bash
# 打包合约
./cbdc-network.sh chaincode package

# 安装合约
./cbdc-network.sh chaincode install

# 批准合约
./cbdc-network.sh chaincode approve

# 提交合约
./cbdc-network.sh chaincode commit
```

### 5. 测试网络

```bash
# 初始化账本
./cbdc-network.sh chaincode invoke InitLedger

# 查看所有账户
./cbdc-network.sh chaincode query GetAllAccounts

# 创建新账户
./cbdc-network.sh chaincode invoke CreateAccount ICBC-USER-001 ICBC

# 央行发行数字货币
./cbdc-network.sh chaincode invoke Issue ICBC-RESERVE-001 1000000 "Initial issuance"

# 转账交易
./cbdc-network.sh chaincode invoke Transfer ICBC-RESERVE-001 ICBC-USER-001 10000 "Transfer to user"

# 查询账户余额
./cbdc-network.sh chaincode query GetAccountBalance ICBC-USER-001
```

## 网络管理

### 查看网络状态

```bash
# 查看运行状态
./cbdc-network.sh status

# 查看日志
./cbdc-network.sh logs [service-name]

# 查看网络信息
./cbdc-network.sh info
```

### 停止和清理

```bash
# 停止网络
./cbdc-network.sh down

# 清理所有数据
./cbdc-network.sh clean

# 重启网络
./cbdc-network.sh restart
```

## 端口配置

| 服务 | 组织 | 端口 |
|------|------|------|
| Orderer | CentralBank | 7050, 7443 |
| Peer | CentralBank | 7051, 9443 |
| CouchDB | CentralBank | 5984 |
| Peer | ICBC | 8051, 10443 |
| CouchDB | ICBC | 6984 |
| Peer | CCB | 9051, 11443 |
| CouchDB | CCB | 7984 |
| Peer | ABC | 10051, 12443 |
| CouchDB | ABC | 8984 |
| Peer | BOC | 11051, 13443 |
| CouchDB | BOC | 9984 |

## 网络配置

网络配置存储在 `configtx/network-config.json` 文件中，包含：
- 频道名称
- 央行配置
- 各银行配置和端口分配

可以通过修改此文件来调整网络参数，然后重新生成配置文件。

## 故障排除

### 常见问题

1. **端口冲突**: 检查端口是否被其他服务占用
2. **Docker权限**: 确保当前用户有Docker执行权限
3. **磁盘空间**: 确保有足够的磁盘空间存储区块链数据
4. **网络连接**: 检查Docker网络配置

### 日志查看

```bash
# 查看所有服务日志
docker-compose -f compose/docker-compose.yaml logs

# 查看特定服务日志
docker-compose -f compose/docker-compose.yaml logs orderer.centralbank.cbdc.com

# 实时查看日志
docker-compose -f compose/docker-compose.yaml logs -f peer0.icbc.cbdc.com
```

## 开发指南

### 添加新银行

1. 修改 `configtx/network-config.json`
2. 重新生成配置：`./cbdc-network.sh config`
3. 重新部署网络：`./cbdc-network.sh restart`

### 修改智能合约

1. 编辑 `chaincode/cbdc-chaincode.go`
2. 重新打包和部署：`./cbdc-network.sh chaincode upgrade`

### 自定义配置

可以通过环境变量或修改脚本来自定义网络配置：
- 频道名称
- 组织名称
- 端口分配
- 资源限制

## 安全考虑

- 所有通信使用TLS加密
- 基于MSP的身份验证
- 智能合约权限控制
- 账户状态管理（活跃/冻结）
- 交易记录不可篡改

## 许可证

Apache License 2.0 