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
- **查询**: 获取代币信息和余额

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

# 带参数执行
node cli/init.js -name "Digital Yuan" -symbol "DCEP" -decimals "2"
node cli/mint.js -amount "1000"
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

# 测试覆盖率
npm run test:coverage
```

## 📁 目录结构

```
gateway/
├── cli/                    # 命令行工具
│   ├── init.js            # 初始化工具
│   ├── mint.js            # 铸造工具
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


