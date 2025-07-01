# 央行数字货币（CBDC）区块链网络

基于Hyperledger Fabric构建的央行数字货币系统

## 🏛️ 项目概述

### 核心特性
- **隐私保护**：使用Private Data Collections实现数据隔离
- **央行监管**：央行可以查看所有交易数据
- **用户隐私**：用户只能查看与自己相关的交易
- **组织隔离**：不同银行组织只能查看涉及自己的交易
- **ERC-20兼容**：完整的代币标准接口实现

### 网络架构示例(银行组织可以通过 setup 动态的配置)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CentralBank   │    │      aa1        │    │      bb2        │
│   (央行组织)     │    │   (银行A)       │    │   (银行B)       │
│                 │    │                 │    │                 │
│  peer0.central  │    │  peer0.aa1      │    │  peer0.bb2      │
│  bank.example   │    │  .example.com   │    │  .example.com   │
│  .com:7051      │    │  :8051          │    │  :9051          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Orderer       │
                    │   (排序节点)     │
                    │                 │
                    │ orderer.example │
                    │ .com:7050       │
                    └─────────────────┘
```

### 隐私设计
- **私有数据集合**：`central_bank_full_data`
- **数据存储策略**：所有敏感数据只存储在央行peer
- **访问控制**：通过MSP身份验证实现细粒度权限控制
- **哈希验证**：其他peer只存储数据哈希

## 🚀 快速开始

### 1. 环境要求

- **操作系统**：macOS 10.15+ / Ubuntu 18.04+ / CentOS 7+
- **Docker**：20.10+
- **Docker Compose**：2.0+
- **内存**：至少4GB可用内存
- **磁盘空间**：至少2GB可用空间

### 2. 环境安装

#### 自动安装（推荐）
```bash
# 克隆项目
git clone git@github.com:flyinox/fabric-CBDC.git
cd bank-network

# 运行环境安装脚本
./setup-fabric-env.sh
```

### 3. 启动网络

```bash

# 配置网络
./network.sh setup 

# 启动完整的CBDC网络（包含网络启动、频道创建和智能合约部署）
./network.sh start

# 或者分步执行
./network.sh up                    # 启动网络节点
./network.sh createChannel         # 创建频道
./network.sh deployCC              # 部署智能合约


# 网络清理（如果希望清理所有的区块和配置，请用这个命令）
./network.sh clean
```

## 📋 网络管理命令

### 基础网络操作

```bash
# 启动网络
./network.sh up

# 停止网络
./network.sh down

# 重启网络
./network.sh restart

# 查看网络状态
./network.sh status
```

### 频道管理

```bash
# 创建频道
./network.sh createChannel

# 加入频道
./network.sh joinChannel

# 更新频道配置
./network.sh updateChannel
```

### 智能合约管理

```bash
# 部署智能合约
./network.sh deployCC

# 升级智能合约
./network.sh upgradeCC

# 查询已安装的智能合约
./network.sh cc queryinstalled
```

## 💰 CBDC智能合约操作

### 初始化代币

```bash
# 初始化CBDC代币
./network.sh ccc init -name "Digital Yuan" -symbol "DCEP" -decimals "2"

# 或者使用交互模式
./network.sh ccc init
```

### 代币操作

```bash
# 铸造代币（仅央行）
./network.sh ccc mint -amount 10000

# 销毁代币（仅央行）
./network.sh ccc burn -amount 1000

# 转账代币
./network.sh ccc transfer -to <接收方地址> -amount 100

# 查询余额
./network.sh ccc balance -account <账户地址>

# 查询总供应量
./network.sh ccc supply
```

### 授权操作

```bash
# 批准授权
./network.sh ccc approve -spender <被授权地址> -value 500

# 查询授权额度
./network.sh ccc allowance -owner <所有者地址> -spender <被授权地址>

# 使用授权转账
./network.sh ccc transferFrom -from <所有者地址> -to <接收方地址> -value 200
```

### 用户信息

```bash
# 获取用户信息
./network.sh ccc userinfo

返回示例：
{"clientId":"eDUwOTo6Q049QWRtaW5AY2VudHJhbGJhbmsuZXhhbXBsZS5jb20sT1U9YWRtaW4sTD1TYW4gRnJhbmNpc2NvLFNUPUNhbGlmb3JuaWEsQz1VUzo6Q049Y2EuY2VudHJhbGJhbmsuZXhhbXBsZS5jb20sTz1jZW50cmFsYmFuay5leGFtcGxlLmNvbSxMPVNhbiBGcmFuY2lzY28sU1Q9Q2FsaWZvcm5pYSxDPVVT","decodedClientId":"x509::CN=Admin@centralbank.example.com,OU=admin,L=San Francisco,ST=California,C=US::CN=ca.centralbank.example.com,O=centralbank.example.com,L=San Francisco,ST=California,C=US","userName":"Admin","orgName":"centralbank.example.com","orgUnit":"admin","mspId":"CentralBankMSP","txId":"9279fd4d218dd969cf013990cba9cca5f56ae5603c998a7390a7c363c577ce90","channelId":"cbdc-channel"}
请注意，其中的clientId就是用户的地址

# 获取当前用户账户ID
./network.sh ccc user
```

### 用户管理

```bash
# 添加新用户
./network.sh adduser create -org <组织名> -user <用户名>

# 删除用户
./network.sh adduser delete -org <组织名> -user <用户名>

# 列出组织用户
./network.sh adduser list -org <组织名>
```

# 查看特定容器日志
docker logs peer0.centralbank.example.com
```

## 🔒 隐私功能详解

### 私有数据集合配置

```json
{
  "name": "central_bank_full_data",
  "policy": "OR('CentralBankMSP.member')",
  "requiredPeerCount": 0,
  "maxPeerCount": 1,
  "blockToLive": 0,
  "memberOnlyRead": false,
  "memberOnlyWrite": false
}
```

### 数据访问控制

- **央行（CentralBankMSP）**：可以读写所有私有数据
- **银行A（aa1MSP）**：只能通过央行peer访问相关数据
- **银行B（bb2MSP）**：只能通过央行peer访问相关数据

### 隐私转账流程

1. 用户发起转账请求
2. 请求通过央行peer处理
3. 私有数据存储在央行peer
4. 其他peer只存储数据哈希
5. 交易完成，隐私得到保护

### 验证隐私保护

```bash
# 在央行peer查询数据
export $(./setOrgEnv.sh CentralBank | xargs)
peer chaincode query -C cbdc-channel -n cbdc -c '{"Args":["BalanceOf","<账户地址>"]}'

# 在其他peer查询（应该失败）
export $(./setOrgEnv.sh aa1 | xargs)
peer chaincode query -C cbdc-channel -n cbdc -c '{"Args":["BalanceOf","<账户地址>"]}'
```

## 🛠️ 开发指南

### 智能合约开发

```bash
# 合约代码
chaincode/chaincode/token_contract.go
合约代码是动态生成的，非测试不要更改，而是更改下面介绍的合约模板代码

# 合约模板代码
chaincode/chaincode/token_contract.go.template
请注意，如果更改了合约，一定要更改到模板,否则 start 的时候会覆盖token_contract.go导致更新代码失败

# 重新生成模板
./scripts/templateGenerator.sh generate_chaincode_from_template CentralBank


# 重新部署合约
./network.sh deployCC
```

### 网络配置修改

```bash
# 修改网络配置
vim network-config.json

# 重新生成配置文件
./scripts/templateGenerator.sh

```

### 添加新功能

1. 在`token_contract.go`中添加新函数
2. 在`network.sh`中添加对应的命令
3. 更新文档和测试脚本

## 📁 项目结构

```
bank-network/
├── bin/                          # Fabric二进制文件
├── chaincode/                    # 智能合约代码
│   ├── chaincode/
│   │   ├── token_contract.go     # 主合约文件
│   │   └── token_contract.go.template  # 合约模板
│   ├── collections_config.json   # 私有集合配置
│   └── go.mod                    # Go模块文件
├── compose/                      # Docker Compose配置
├── configtx/                     # 配置交易文件
├── organizations/                # 组织证书和配置
├── scripts/                      # 管理脚本
│   ├── deployCC.sh              # 链码部署脚本
│   ├── templateGenerator.sh     # 模板生成脚本
│   └── ccutils.sh               # 链码工具脚本
├── network.sh                   # 主网络管理脚本
├── setup-fabric-env.sh         # 环境安装脚本
└── README.md                    # 项目文档
```

### 日志查看

```bash
# 查看所有容器日志
docker-compose logs

# 查看特定服务日志
docker-compose logs peer0.centralbank.example.com

# 实时查看日志
docker-compose logs -f
```

### 其他
目前只是通过cryptgen 生成的证书（同时这种方式对于生成的组织中的用户，名字也只能固化成user[数字]），如果需要在实际环境中，需要更换成 CA