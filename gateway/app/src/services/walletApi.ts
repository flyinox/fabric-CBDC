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

// mock交易数据（可根据实际mockData.ts内容调整）
const mockTransactions: Transaction[] = [
  {
    id: 'tx1',
    type: 'transfer',
    amount: '100.00',
    from: 'Bank1_User1',
    to: 'Bank2_User2',
    timestamp: Date.now(),
    status: 'success',
    hash: 'hash1'
  },
  {
    id: 'tx2',
    type: 'transfer',
    amount: '50.00',
    from: 'Bank2_User2',
    to: 'Bank1_User1',
    timestamp: Date.now() - 10000,
    status: 'success',
    hash: 'hash2'
  },
  {
    id: 'tx3',
    type: 'transfer',
    amount: '200.00',
    from: 'Bank1_User1',
    to: 'Bank3_User3',
    timestamp: Date.now() - 20000,
    status: 'success',
    hash: 'hash3'
  }
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

// 获取用户真实账户ID
export async function getUserAccountId(identityName: string): Promise<string> {
  if (useMock) {
    // 返回mock账户ID
    return 'mock-account-id';
  } else {
    try {
      const res = await fetch(`${apiBase}/account/${encodeURIComponent(identityName)}`);
      const data = await res.json();
      if (data.success) {
        return data.data.accountId || '';
      } else {
        console.error('获取账户ID失败:', data.message);
        return '';
      }
    } catch (error) {
      console.error('获取账户ID请求失败:', error);
      return '';
    }
  }
}

// 获取交易记录 - 支持mock和真实API
export async function getTransactions(userId?: string, identityName?: string): Promise<Transaction[]> {
  if (useMock) {
    // 返回mock数据
    return mockTransactions;
  } else {
    if (!identityName) return [];
    
    try {
      // 如果没有提供 userId，先获取用户的真实账户ID
      let realUserId = userId;
      if (!realUserId) {
        realUserId = await getUserAccountId(identityName);
        if (!realUserId) {
          console.error('无法获取用户账户ID');
          return [];
        }
      }
      
      const res = await fetch(`${apiBase}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: realUserId, identityName })
      });
      const data = await res.json();
      if (data.success && data.data && data.data.transactions) {
        return data.data.transactions.map((tx: any) => ({
          id: tx.txId || tx.key || tx.id,
          type: tx.transactionType || tx.type,
          amount: tx.amount?.toString() || '0',
          from: tx.from,
          to: tx.to,
          timestamp: (typeof tx.timestamp === 'number' && tx.timestamp > 1e12) ? tx.timestamp : (tx.timestamp * 1000),
          status: 'success',
          hash: tx.txId || tx.key
        }));
      }
      return [];
    } catch (error) {
      console.error('获取交易记录失败:', error);
      return [];
    }
  }
}

// 获取单个用户余额
export async function getUserBalance(identityName: string): Promise<number> {
  if (useMock) {
    // 返回mock余额
    return Math.floor(Math.random() * 10000) + 1000;
  } else {
    try {
      const res = await fetch(`${apiBase}/balance/${encodeURIComponent(identityName)}`);
      const data = await res.json();
      if (data.success) {
        return data.data.balance || 0;
      } else {
        console.error('获取余额失败:', data.message);
        return 0;
      }
    } catch (error) {
      console.error('获取余额请求失败:', error);
      return 0;
    }
  }
}

// 批量获取用户余额
export async function getUsersBalances(identityNames: string[]): Promise<Record<string, number>> {
  if (useMock) {
    // 返回mock余额
    const balances: Record<string, number> = {};
    identityNames.forEach(name => {
      balances[name] = Math.floor(Math.random() * 10000) + 1000;
    });
    return balances;
  } else {
    try {
      const res = await fetch(`${apiBase}/balances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identityNames }),
      });
      const data = await res.json();
      if (data.success) {
        return data.data.balances || {};
      } else {
        console.error('批量获取余额失败:', data.message);
        return {};
      }
    } catch (error) {
      console.error('批量获取余额请求失败:', error);
      return {};
    }
  }
}

// 获取带余额的用户列表
export async function getUsersWithBalances(): Promise<User[]> {
  try {
    const wallets = await fetchWallets();
    const users = wallets.map(transformWalletToUser);
    
    // 获取所有用户的余额
    const identityNames = wallets.map((w: any) => w.file.replace('.id', ''));
    const balances = await getUsersBalances(identityNames);
    
    // 更新用户余额
    return users.map((user: any) => ({
      ...user,
      balance: (balances[user.id] || 0).toString()
    }));
  } catch (error) {
    console.error('获取用户列表和余额失败:', error);
    return [];
  }
} 