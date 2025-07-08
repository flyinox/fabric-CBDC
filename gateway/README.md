# CBDC Gateway Service

这是一个基于 Hyperledger Fabric 的 CBDC (中央银行数字货币) 网关服务，提供完整的账户操作功能。

## 功能特性

- ✅ **自动连接央行 peer** - 自动读取网络配置并连接央行节点
- ✅ **初始化代币** - 初始化 CBDC 代币的基本信息（名称、符号、小数位数）
- ✅ **铸造代币** - 铸造新的 CBDC 代币（仅央行）
- 🔄 **销毁代币** - 销毁 CBDC 代币（仅央行）
- 🔄 **转账** - 在账户间转移 CBDC 代币
- 🔄 **查询余额** - 查询账户余额
- 🔄 **查询历史** - 查询交易历史
- 🔄 **用户管理** - 创建和管理用户账户
- 🔄 **授权管理** - 管理用户权限和角色
- ✅ **完整的单元测试覆盖** - 所有功能都有对应的测试用例

## 项目结构

```
gateway/
├── services/           # 核心服务类
│   ├── BaseService.js  # 基础服务（网络连接、身份管理）
│   └── TokenService.js # 代币服务（init、mint、burn等）
├── cli/               # 命令行接口
│   ├── init.js        # 初始化命令
│   └── mint.js        # 铸造命令
├── tests/             # 单元测试
│   ├── BaseService.test.js
│   ├── TokenService.test.js
│   ├── InitCLI.test.js
│   └── MintCLI.test.js
├── wallet/            # 身份钱包
└── package.json       # 项目配置
```

## 安装依赖

```bash
npm install
```

## 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并监听文件变化
npm run test:watch

# 运行测试并生成覆盖率报告
npm run test:coverage

# 只运行 init 相关测试
npm run test:init

# 只运行 mint 相关测试
npm run test:mint
```

## 使用方法

### 1. 初始化 CBDC 代币

#### 命令行参数方式
```bash
# 使用默认参数
node cli/init.js

# 指定参数
node cli/init.js -name "Digital Yuan" -symbol "DCEP" -decimals "2"

# 使用长参数格式
node cli/init.js --name "Test Token" --symbol "TEST" --decimals "4"

# 指定身份
node cli/init.js -name "Test Token" -identity "user1"

# 查看帮助
node cli/init.js -h
```

#### 交互式输入方式
```bash
node cli/init.js
```
然后按提示输入参数，直接回车使用默认值。

#### 编程方式
```javascript
const TokenService = require('./services/TokenService');

const tokenService = new TokenService();

// 使用默认参数
const result = await tokenService.initialize();

// 指定参数
const result = await tokenService.initialize({
  name: 'Digital Yuan',
  symbol: 'DCEP',
  decimals: '2',
  identityName: 'admin'
});

if (result.success) {
  console.log('初始化成功:', result.data);
} else {
  console.log('初始化失败:', result.error);
}
```

### 2. 铸造 CBDC 代币

#### 命令行参数方式
```bash
# 指定铸造数量
node cli/mint.js -amount "10000"

# 指定身份
node cli/mint.js -amount "50000" -identity "admin"

# 使用长参数格式
node cli/mint.js --amount "100000" --identity "user1"

# 查看帮助
node cli/mint.js -h
```

#### 交互式输入方式
```bash
node cli/mint.js
```
然后按提示输入参数。

#### 编程方式
```javascript
const TokenService = require('./services/TokenService');

const tokenService = new TokenService();

// 铸造代币
const result = await tokenService.mint({
  amount: '10000',
  identityName: 'admin'
});

if (result.success) {
  console.log('铸造成功:', result.data);
} else {
  console.log('铸造失败:', result.error);
}
```

### 3. 获取代币信息



```javascript
const TokenService = require('./services/TokenService');

const tokenService = new TokenService();
const result = await tokenService.getTokenInfo('admin');

if (result.success) {
  console.log('代币信息:', result.data);
}
```

## 配置说明

### 网络配置

服务会自动读取根目录的 `network-config.json` 文件来获取网络配置：

### 身份配置

身份文件存储在 `wallet/` 目录下

## 开发指南

### 添加新功能

1. 在 `services/` 目录下创建新的服务类
2. 继承 `BaseService` 或使用组合模式
3. 在 `tests/` 目录下创建对应的测试文件
4. 在 `cli/` 目录下创建命令行接口（如需要）







