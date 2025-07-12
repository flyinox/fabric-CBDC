import type { User, Transaction } from '../types';

// 模拟从 gateway/wallet 读取的用户数据
export const mockUsers: User[] = [
  {
    id: 'user1',
    name: 'User1@bank1.example.com',
    organization: '中国银行',
    address: '0xE7762F60...c08b0d3088',
    balance: '1680.09'
  },
  {
    id: 'user2',
    name: 'User1@bank2.example.com',
    organization: '工商银行',
    address: '0xA1234567...d09c1e4099',
    balance: '2350.50'
  },
  {
    id: 'admin1',
    name: 'Admin@bank1.example.com',
    organization: '中国银行',
    address: '0xB9876543...e10d2f5100',
    balance: '5000.00'
  },
  {
    id: 'admin2',
    name: 'Admin@bank2.example.com',
    organization: '工商银行',
    address: '0xC5432109...f21e3g6211',
    balance: '3200.75'
  },
  {
    id: 'cc1',
    name: 'Admin@cc1.example.com',
    organization: '中国人民银行',
    address: '0xD1098765...g32f4h7322',
    balance: '10000.00'
  }
];

// 模拟交易记录
export const mockTransactions: Transaction[] = [
  {
    id: 'tx1',
    type: 'transfer',
    amount: '100.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xA1234567...d09c1e4099',
    timestamp: Date.now() - 1000 * 60 * 30,
    status: 'success',
    hash: '0x1234567890abcdef'
  },
  {
    id: 'tx2',
    type: 'approve',
    amount: '500.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xB9876543...e10d2f5100',
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
    status: 'success',
    hash: '0x2345678901bcdef0',
    spender: '0xB9876543...e10d2f5100'
  },
  {
    id: 'tx3',
    type: 'transferFrom',
    amount: '200.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xC5555555...f11e3g6111',
    timestamp: Date.now() - 1000 * 60 * 60 * 4,
    status: 'success',
    hash: '0x3456789012cdef01',
    spender: '0xB9876543...e10d2f5100'
  },
  {
    id: 'tx4',
    type: 'mint',
    amount: '1000.00',
    from: '0xD1098765...g32f4h7322',
    to: '0xE7762F60...c08b0d3088',
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
    status: 'success',
    hash: '0x3456789012cdef01'
  }
];

// 获取用户列表
export const getUsers = (): Promise<User[]> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockUsers), 500);
  });
};

// 获取交易记录
export const getTransactions = (): Promise<Transaction[]> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockTransactions), 500);
  });
};

// 根据用户ID获取用户信息
export const getUserById = (id: string): User | undefined => {
  return mockUsers.find(user => user.id === id);
}; 