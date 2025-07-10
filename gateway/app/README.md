# 央行数字货币钱包 H5 应用

基于 React + Vite + Ant Design Mobile 构建的央行数字货币钱包移动端应用。

## 功能特性

### 🏦 多用户支持
- 支持切换不同银行的用户身份
- 包含中国银行、工商银行、中国人民银行等用户
- 左上角用户选择器，一键切换用户

### 💰 钱包功能
- 展示数字人民币余额
- 显示用户钱包地址
- 一键复制地址到剪贴板
- 美观的蓝色渐变卡片设计

### 🔧 区块链操作
- **转账**：向其他用户转账数字货币
- **收款**：生成收款码或地址
- **Approve**：授权操作
- **记录**：查看交易历史

### 📱 移动端优化
- 响应式设计，适配各种屏幕尺寸
- 底部导航栏，支持钱包和记录页面切换
- 瀑布流交易记录，按时间倒序显示
- 优雅的加载动画和交互反馈

## 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite 7
- **UI组件库**：Ant Design Mobile
- **路由管理**：React Router DOM
- **样式方案**：CSS Modules + 渐变背景

## 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 项目结构

```
src/
├── components/           # 通用组件
│   ├── UserSelector/    # 用户选择器
│   ├── WalletHeader/    # 钱包头部
│   ├── ActionButtons/   # 功能按钮组
│   └── TransactionList/ # 交易列表
├── pages/
│   ├── Wallet/         # 钱包页
│   └── Records/        # 记录页
├── services/           # 数据服务
│   └── mockData.ts     # 模拟数据
├── types/              # 类型定义
│   └── index.ts        # 核心类型
├── App.tsx             # 主应用组件
└── main.tsx            # 入口文件
```

## 数据模型

### 用户信息
```typescript
interface User {
  id: string;          // 用户ID
  name: string;        // 用户名
  organization: string; // 组织（银行）
  address: string;     // 钱包地址
  balance: string;     // 余额
}
```

### 交易记录
```typescript
interface Transaction {
  id: string;                                    // 交易ID
  type: 'transfer' | 'approve' | 'mint' | 'burn'; // 交易类型
  amount: string;                                // 金额
  from: string;                                  // 发送方地址
  to: string;                                    // 接收方地址
  timestamp: number;                             // 时间戳
  status: 'pending' | 'success' | 'failed';     // 状态
  hash?: string;                                 // 交易哈希
}
```

## 后续开发计划

1. **与 Gateway 服务集成**
   - 对接 `../accountService.js` 获取真实账户数据
   - 对接 `../services/TokenService.js` 实现转账功能
   - 读取 `../wallet/` 目录下的用户身份文件

2. **功能完善**
   - 实现转账、收款、Approve 的具体逻辑
   - 添加交易详情页面
   - 支持扫码转账和收款
   - 添加交易搜索和筛选功能

3. **安全优化**
   - 添加身份验证
   - 实现私钥管理
   - 加密本地存储

4. **用户体验**
   - 添加国际化支持
   - 优化加载性能
   - 添加离线缓存

## 访问地址

开发环境：http://localhost:5173/

## 注意事项

- 当前使用模拟数据，实际部署时需要对接真实的区块链服务
- 支持移动端和桌面端访问，建议使用Chrome浏览器的移动端模拟器进行测试
- 项目已配置 Node.js 20.19.0，建议使用 nvm 管理版本
