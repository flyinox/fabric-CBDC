import type { User, Transaction } from '../types';

// 钱包账户API服务，支持mock和真实API切换
const useMock = import.meta.env.VITE_USE_MOCK === 'true';
const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

// mock数据（可根据实际mockData.ts内容调整）
const mockWallets = [
  {
    file: 'Bank1_User1.id',
    orgName: 'Bank1',
    orgType: 'commercial_bank',
    userName: 'User1',
    fullName: 'User1@bank1.example.com',
    mspId: 'Bank1MSP',
    type: 'X.509',
    version: 1
  },
  // ... 其他mock数据 ...
];

// 将API返回的钱包数据转换为User格式
function transformWalletToUser(wallet: any): User {
  return {
    id: wallet.file.replace('.id', ''),
    name: wallet.fullName,
    organization: wallet.orgName === 'CentralBank' ? '中国人民银行' : 
                  wallet.orgName === 'Bank1' ? '中国银行' : 
                  wallet.orgName === 'Bank2' ? '工商银行' : wallet.orgName,
    address: `${wallet.mspId}...${wallet.userName}`,
    balance: '1000.00' // 默认余额，实际应该从区块链获取
  };
}

export async function fetchWallets() {
  if (useMock) {
    // 返回mock数据
    return mockWallets;
  } else {
    // 请求真实API
    const res = await fetch(`${apiBase}/wallets`);
    const data = await res.json();
    return data.wallets;
  }
}

// 获取用户列表 - 适配现有前端接口
export async function getUsers(): Promise<User[]> {
  try {
    const wallets = await fetchWallets();
    return wallets.map(transformWalletToUser);
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return [];
  }
}

// 获取交易记录 - 暂时返回空数组，后续可以对接真实交易数据
export async function getTransactions(): Promise<Transaction[]> {
  return [];
} 