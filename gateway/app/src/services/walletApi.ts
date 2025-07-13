import type { User, Transaction } from '../types';

// 钱包账户API服务，支持mock和真实API切换
const useMock = import.meta.env.VITE_USE_MOCK === 'true';
const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

// mock数据（可根据实际mockData.ts内容调整）
const mockWallets = [
  {
    file: 'CentralBank_Admin.id',
    orgName: 'CentralBank',
    orgType: 'central_bank',
    userName: 'Admin',
    fullName: 'Admin@centralbank.example.com',
    mspId: 'CentralBankMSP',
    type: 'X.509',
    version: 1
  },
  {
    file: 'CentralBank_User1.id',
    orgName: 'CentralBank',
    orgType: 'central_bank',
    userName: 'User1',
    fullName: 'User1@centralbank.example.com',
    mspId: 'CentralBankMSP',
    type: 'X.509',
    version: 1
  },
  {
    file: 'Bank1_Admin.id',
    orgName: 'Bank1',
    orgType: 'commercial_bank',
    userName: 'Admin',
    fullName: 'Admin@bank1.example.com',
    mspId: 'Bank1MSP',
    type: 'X.509',
    version: 1
  },
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
  {
    file: 'Bank2_Admin.id',
    orgName: 'Bank2',
    orgType: 'commercial_bank',
    userName: 'Admin',
    fullName: 'Admin@bank2.example.com',
    mspId: 'Bank2MSP',
    type: 'X.509',
    version: 1
  },
  {
    file: 'Bank2_User1.id',
    orgName: 'Bank2',
    orgType: 'commercial_bank',
    userName: 'User1',
    fullName: 'User1@bank2.example.com',
    mspId: 'Bank2MSP',
    type: 'X.509',
    version: 1
  },
  {
    file: 'CC1_Admin.id',
    orgName: 'CC1',
    orgType: 'commercial_bank',
    userName: 'Admin',
    fullName: 'Admin@cc1.example.com',
    mspId: 'CC1MSP',
    type: 'X.509',
    version: 1
  },
  {
    file: 'CC1_User1.id',
    orgName: 'CC1',
    orgType: 'commercial_bank',
    userName: 'User1',
    fullName: 'User1@cc1.example.com',
    mspId: 'CC1MSP',
    type: 'X.509',
    version: 1
  }
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
    // 返回mock账户ID - 模拟base64格式的真实账户ID
    const mockAccountIds: Record<string, string> = {
      'CentralBank_Admin': 'Q2VudHJhbEJhbmtBZG1pbjEyMzQ1Njc4OTBBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWjEyMzQ1Njc4OTBhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejEyMzQ1Njc4OQ==',
      'CentralBank_User1': 'Q2VudHJhbEJhbmtVc2VyMTIzNDU2Nzg5MEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaMTIzNDU2Nzg5YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODk=',
      'Bank1_Admin': 'QmFuazFBZG1pbjEyMzQ1Njc4OTBBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWjEyMzQ1Njc4OWFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MTIzNDU2Nzg5',
      'Bank1_User1': 'QmFuazFVc2VyMTIzNDU2Nzg5MEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaMTIzNDU2Nzg5YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODk=',
      'Bank2_Admin': 'QmFuazJBZG1pbjEyMzQ1Njc4OTBBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWjEyMzQ1Njc4OWFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MTIzNDU2Nzg5',
      'Bank2_User1': 'QmFuazJVc2VyMTIzNDU2Nzg5MEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaMTIzNDU2Nzg5YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODk=',
      'CC1_Admin': 'Q0MxQWRtaW4xMjM0NTY3ODkwQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVoxMjM0NTY3ODlhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejEyMzQ1Njc4OQ==',
      'CC1_User1': 'Q0MxVXNlcjEyMzQ1Njc4OTBBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWjEyMzQ1Njc4OWFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MTIzNDU2Nzg5'
    };
    
    // 根据身份名称返回对应的mock账户ID，如果没有找到则返回默认值
    return mockAccountIds[identityName] || 'RGVmYXVsdEFjY291bnRJZDEyMzQ1Njc4OTBBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWjEyMzQ1Njc4OWFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MTIzNDU2Nzg5';
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
          hash: tx.txId || tx.key,
          spender: tx.spender // 新增：支持spender字段
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
    // 在mock模式下，根据用户身份返回固定余额，避免随机数导致的计算错误
    if (identityName.includes('centralbank')) {
      return identityName.includes('Admin') ? 1101 : 99;
    } else if (identityName.includes('bank1')) {
      return 500;
    } else if (identityName.includes('bank2')) {
      return 300;
    } else if (identityName.includes('cc1')) {
      return 200;
    }
    return 100; // 默认余额
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
    // 返回固定的mock余额，避免随机数导致的计算错误
    const balances: Record<string, number> = {};
    identityNames.forEach(name => {
      if (name.includes('centralbank')) {
        balances[name] = name.includes('Admin') ? 1101 : 99;
      } else if (name.includes('bank1')) {
        balances[name] = 500;
      } else if (name.includes('bank2')) {
        balances[name] = 300;
      } else if (name.includes('cc1')) {
        balances[name] = 200;
      } else {
        balances[name] = 100; // 默认余额
      }
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

// 转账相关API
export async function transfer(recipient: string, amount: string, identityName: string): Promise<any> {
  // 🔍 添加前端地址跟踪日志
  console.log('🔍 FRONTEND TRANSFER 地址跟踪开始:');
  console.log('  📥 前端接收到的 recipient:', recipient);
  console.log('  📥 recipient 类型:', typeof recipient);
  console.log('  📥 recipient 长度:', recipient ? recipient.length : 0);
  console.log('  📥 recipient 是否为空:', !recipient);
  console.log('  📥 recipient 是否为空字符串:', recipient === '');
  console.log('  📥 recipient 是否只包含空格:', recipient && recipient.trim() === '');

  if (useMock) {
    // 返回mock转账结果
    console.log('🔍 使用 MOCK 模式');
    return {
      success: true,
      message: '转账成功',
      data: {
        from: identityName,
        to: recipient,
        amount: parseInt(amount),
        txId: 'mock-tx-id-' + Date.now()
      }
    };
  } else {
    try {
      console.log('🔍 准备发送到后端 API:');
      console.log('  📤 发送的 recipient:', recipient);
      console.log('  📤 发送的 amount:', amount);
      console.log('  📤 发送的 identityName:', identityName);

      const requestBody = { recipient, amount, identityName };
      console.log('  📤 完整的请求体:', requestBody);

      const res = await fetch(`${apiBase}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('🔍 后端响应状态:', res.status);
      const data = await res.json();
      console.log('🔍 后端响应数据:', data);
      
      return data;
    } catch (error: any) {
      console.error('❌ 转账请求失败:', error);
      return {
        success: false,
        message: '转账失败',
        error: error.message
      };
    }
  }
}

export async function transferFrom(from: string, to: string, amount: string, identityName: string): Promise<any> {
  if (useMock) {
    // 返回mock授权转账结果
    return {
      success: true,
      message: '授权转账成功',
      data: {
        from,
        to,
        spender: identityName,
        amount: parseInt(amount),
        txId: 'mock-tx-id-' + Date.now()
      }
    };
  }
    try {
      const requestBody = { from, to, amount, identityName };

      const res = await fetch(`${apiBase}/transferFrom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: '授权转账失败',
        error: error.message
      };
    }
  }

export async function approve(spender: string, amount: string, identityName: string): Promise<any> {
  if (useMock) {
    // 返回mock授权结果
    return {
      success: true,
      message: '授权成功',
      data: {
        owner: identityName,
        spender,
        amount: parseInt(amount),
        txId: 'mock-tx-id-' + Date.now()
      }
    };
  } else {
    try {
      const res = await fetch(`${apiBase}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spender, amount, identityName })
      });
      const data = await res.json();
      return data;
    } catch (error: any) {
      console.error('授权请求失败:', error);
      return {
        success: false,
        message: '授权失败',
        error: error.message
      };
    }
  }
}

export async function getAllowance(owner: string, spender: string, identityName: string): Promise<any> {
  if (useMock) {
    // 返回mock授权额度
    return {
      success: true,
      data: {
        owner,
        spender,
        allowance: Math.floor(Math.random() * 1000) + 100
      }
    };
  } else {
    try {
      const res = await fetch(`${apiBase}/allowance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, spender, identityName })
      });
      const data = await res.json();
      return data;
    } catch (error: any) {
      console.error('查询授权额度失败:', error);
      return {
        success: false,
        message: '查询授权额度失败',
        error: error.message
      };
    }
  }
}

// 铸币相关API
export async function mint(amount: string, identityName: string): Promise<any> {
  console.log('🔍 FRONTEND MINT 开始:');
  console.log('  📥 前端接收到的 amount:', amount);
  console.log('  📥 前端接收到的 identityName:', identityName);

  if (useMock) {
    // 返回mock铸币结果
    console.log('🔍 使用 MOCK 模式');
    return {
      success: true,
      message: '铸币成功',
      data: {
        amount: parseInt(amount),
        txId: 'mock-mint-tx-id-' + Date.now()
      }
    };
  } else {
    try {
      console.log('🔍 准备发送到后端 API:');
      console.log('  📤 发送的 amount:', amount);
      console.log('  📤 发送的 identityName:', identityName);

      const requestBody = { amount, identityName };
      console.log('  📤 完整的请求体:', requestBody);

      const res = await fetch(`${apiBase}/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('🔍 后端响应状态:', res.status);
      const data = await res.json();
      console.log('🔍 后端响应数据:', data);
      
      return data;
    } catch (error: any) {
      console.error('❌ 铸币请求失败:', error);
      return {
        success: false,
        message: '铸币失败',
        error: error.message
      };
    }
  }
}

// 销毁相关API
export async function burn(amount: string, identityName: string): Promise<any> {
  console.log('🔍 FRONTEND BURN 开始:');
  console.log('  📥 前端接收到的 amount:', amount);
  console.log('  📥 前端接收到的 identityName:', identityName);

  if (useMock) {
    // 返回mock销毁结果
    console.log('🔍 使用 MOCK 模式');
    return {
      success: true,
      message: '销毁成功',
      data: {
        amount: parseInt(amount),
        txId: 'mock-burn-tx-id-' + Date.now()
      }
    };
  } else {
    try {
      console.log('🔍 准备发送到后端 API:');
      console.log('  📤 发送的 amount:', amount);
      console.log('  📤 发送的 identityName:', identityName);

      const requestBody = { amount, identityName };
      console.log('  📤 完整的请求体:', requestBody);

      const res = await fetch(`${apiBase}/burn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('🔍 后端响应状态:', res.status);
      const data = await res.json();
      console.log('🔍 后端响应数据:', data);
      
      return data;
    } catch (error: any) {
      console.error('❌ 销毁请求失败:', error);
      return {
        success: false,
        message: '销毁失败',
        error: error.message
      };
    }
  }
}