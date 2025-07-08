# CBDC Gateway

基于 Hyperledger Fabric 的央行数字货币 (CBDC) 网关服务。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 创建用户身份

首先为所有组织的所有用户创建身份文件：

```bash
npm run create:identities
```

或者直接运行：

```bash
node createAllIdentities.js
```

### 3. 选择用户身份

选择要使用的用户身份：

```bash
# 交互式选择
npm run user:select

# 或者直接指定用户
node cli/selectUser.js -select admin

# 查看当前用户
npm run user:current

# 查看所有可用用户
npm run user:list
```

### 4. 执行操作

现在可以执行各种 CBDC 操作，系统会自动使用当前选择的用户身份：

```bash
# 初始化 CBDC 代币
npm run init

# 铸造代币
npm run mint

# 销毁代币
npm run burn
```

## 📋 功能特性

### 🔐 用户身份管理

- **自动身份选择**: 一次选择，多次使用
- **身份切换**: 支持在不同用户间快速切换
- **权限提示**: 每次操作都显示当前用户身份
- **多组织支持**: 支持所有组织的所有用户

### 💰 CBDC 操作

- **初始化**: 创建 CBDC 代币合约
- **铸造**: 央行铸造新代币
- **销毁**: 央行销毁代币
- **转账**: 代币转账和授权管理
- **富查询**: 交易记录查询和分页功能
- **账户查询**: 查询账户信息、余额、用户信息等

## 🛠️ 命令行工具

### 用户管理

```bash
# 列出所有可用用户
npm run user:list

# 显示当前选择的用户
npm run user:current

# 交互式选择用户
npm run user:select

# 选择指定用户
node cli/selectUser.js -select <用户名>

# 清除当前用户选择
npm run user:clear
```

### CBDC 操作

```bash
# 初始化 CBDC 代币
npm run init

# 铸造代币
npm run mint

# 销毁代币
npm run burn

# 转账 (交互模式)
npm run transfer

# 富查询 (交互模式)
npm run query

# 账户查询 (交互模式)
npm run account

# 转账 (命令行模式)
npm run transfer -- -t transfer -to <接收者地址> -a 100                    # 直接转账
npm run transfer -- -t transferfrom -from <发送者地址> -to <接收者地址> -a 50  # 授权转账
npm run transfer -- -t approve -spender <被授权者地址> -a 200               # 批准授权

# 富查询 (命令行模式)
npm run query -- -t transactions -u <用户ID> --minamount 100 --maxamount 1000 --transactiontype transfer  # 基础富查询
npm run query -- -t transactionspage -u <用户ID> --pagesize 20 --offset 0                                # 分页查询
npm run query -- -t transactionsbookmark -u <用户ID> --pagesize 15 --bookmark <书签>                      # 书签分页查询
npm run query -- -t history -u <用户ID> --pagesize 50 --offset 0                                          # 交易历史查询

# 账户查询 (命令行模式)
npm run account -- -t account                    # 查询当前客户端账户信息
npm run account -- -t account -u <用户ID>        # 查询指定用户账户信息
npm run account -- -t userinfo                   # 查询用户基本信息
npm run account -- -t balance                    # 查询当前客户端余额
npm run account -- -t balance -a <账户地址>      # 查询指定账户余额
npm run account -- -t accountid                  # 查询客户端账户ID
npm run account -- -t allowance --owner <授权者> --spender <被授权者>  # 查询授权额度

# 带参数执行
node cli/init.js -name "Digital Yuan" -symbol "DCEP" -decimals "2"
node cli/mint.js -amount "1000"
node cli/burn.js -amount "500"
node cli/transfer.js -t transfer -to <接收者地址> -a 100
node cli/query.js -t transactions -u <用户ID> --minamount 100 --maxamount 1000
```

## 🏗️ 架构设计

### 服务层

- **BaseService**: 基础网络连接和交易服务
- **TokenService**: CBDC 代币相关操作

### 用户管理

- **身份文件**: 存储在 `wallet/` 目录
- **当前用户**: 存储在 `.current-user` 文件中
- **自动提示**: 每次操作前显示当前用户信息

### 权限控制

- **央行操作**: 铸造等敏感操作仅限央行身份
- **身份验证**: 自动验证用户身份和权限
- **操作审计**: 记录所有操作的执行用户

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行特定功能测试
npm run test:init
npm run test:mint
npm run test:burn

# 测试覆盖率
npm run test:coverage
```

## 📁 目录结构

```
gateway/
├── cli/                    # 命令行工具
│   ├── init.js            # 初始化工具
│   ├── mint.js            # 铸造工具
│   ├── burn.js            # 销毁工具
│   ├── transfer.js        # 转账工具
│   ├── query.js           # 富查询工具
│   ├── account.js         # 账户查询工具
│   └── selectUser.js      # 用户选择工具
├── services/              # 服务层
│   ├── BaseService.js     # 基础服务
│   └── TokenService.js    # 代币服务
├── tests/                 # 测试文件
├── wallet/                # 用户身份文件
├── createAllIdentities.js # 身份创建脚本
└── README.md             # 说明文档
```

## 🔧 配置

### 网络配置

系统使用根目录的 `network-config.json` 文件进行网络配置。

### 身份管理

- 身份文件存储在 `wallet/` 目录
- 当前用户信息存储在 `.current-user` 文件
- 支持所有组织的所有用户身份

## 🚨 注意事项

1. **权限控制**: 铸造操作仅限央行身份执行
2. **身份选择**: 每次操作前都会显示当前用户身份
3. **身份文件**: 确保身份文件完整且有效
4. **网络连接**: 确保 Fabric 网络正常运行

## 📞 支持

如有问题，请检查：

1. 网络配置是否正确
2. 身份文件是否存在
3. 当前用户是否已选择
4. 权限是否足够


