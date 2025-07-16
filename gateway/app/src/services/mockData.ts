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
    organization: 'c1',
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
  },
  {
    id: 'tx5',
    type: 'transfer',
    amount: '50.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xA1234567...d09c1e4099',
    timestamp: Date.now() - 1000 * 60 * 60 * 6,
    status: 'success',
    hash: '0x4567890123def012'
  },
  {
    id: 'tx6',
    type: 'burn',
    amount: '25.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0x0000000000000000',
    timestamp: Date.now() - 1000 * 60 * 60 * 8,
    status: 'success',
    hash: '0x5678901234ef0123'
  },
  {
    id: 'tx7',
    type: 'approve',
    amount: '300.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xC5432109...f21e3g6211',
    timestamp: Date.now() - 1000 * 60 * 60 * 12,
    status: 'success',
    hash: '0x6789012345f01234',
    spender: '0xC5432109...f21e3g6211'
  },
  {
    id: 'tx8',
    type: 'transferFrom',
    amount: '150.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xD1098765...g32f4h7322',
    timestamp: Date.now() - 1000 * 60 * 60 * 16,
    status: 'success',
    hash: '0x7890123456f01234',
    spender: '0xC5432109...f21e3g6211'
  },
  {
    id: 'tx9',
    type: 'transfer',
    amount: '75.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xB9876543...e10d2f5100',
    timestamp: Date.now() - 1000 * 60 * 60 * 20,
    status: 'success',
    hash: '0x8901234567f01234'
  },
  {
    id: 'tx10',
    type: 'mint',
    amount: '500.00',
    from: '0xD1098765...g32f4h7322',
    to: '0xE7762F60...c08b0d3088',
    timestamp: Date.now() - 1000 * 60 * 60 * 28,
    status: 'success',
    hash: '0x9012345678f01234'
  },
  {
    id: 'tx11',
    type: 'transfer',
    amount: '120.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xA1234567...d09c1e4099',
    timestamp: Date.now() - 1000 * 60 * 60 * 32,
    status: 'success',
    hash: '0xa012345679f01234'
  },
  {
    id: 'tx12',
    type: 'burn',
    amount: '30.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0x0000000000000000',
    timestamp: Date.now() - 1000 * 60 * 60 * 36,
    status: 'success',
    hash: '0xb01234567af01234'
  },
  {
    id: 'tx13',
    type: 'approve',
    amount: '400.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xD1098765...g32f4h7322',
    timestamp: Date.now() - 1000 * 60 * 60 * 40,
    status: 'success',
    hash: '0xc01234567bf01234',
    spender: '0xD1098765...g32f4h7322'
  },
  {
    id: 'tx14',
    type: 'transferFrom',
    amount: '180.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xC5432109...f21e3g6211',
    timestamp: Date.now() - 1000 * 60 * 60 * 44,
    status: 'success',
    hash: '0xd01234567cf01234',
    spender: '0xD1098765...g32f4h7322'
  },
  {
    id: 'tx15',
    type: 'transfer',
    amount: '90.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xB9876543...e10d2f5100',
    timestamp: Date.now() - 1000 * 60 * 60 * 48,
    status: 'success',
    hash: '0xe01234567df01234'
  },
  {
    id: 'tx16',
    type: 'mint',
    amount: '800.00',
    from: '0xD1098765...g32f4h7322',
    to: '0xE7762F60...c08b0d3088',
    timestamp: Date.now() - 1000 * 60 * 60 * 52,
    status: 'success',
    hash: '0xf01234567ef01234'
  },
  {
    id: 'tx17',
    type: 'transfer',
    amount: '60.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xA1234567...d09c1e4099',
    timestamp: Date.now() - 1000 * 60 * 60 * 56,
    status: 'success',
    hash: '0x001234567ff01234'
  },
  {
    id: 'tx18',
    type: 'burn',
    amount: '20.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0x0000000000000000',
    timestamp: Date.now() - 1000 * 60 * 60 * 60,
    status: 'success',
    hash: '0x1012345670f01234'
  },
  {
    id: 'tx19',
    type: 'approve',
    amount: '250.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xB9876543...e10d2f5100',
    timestamp: Date.now() - 1000 * 60 * 60 * 64,
    status: 'success',
    hash: '0x2012345671f01234',
    spender: '0xB9876543...e10d2f5100'
  },
  {
    id: 'tx20',
    type: 'transferFrom',
    amount: '100.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xD1098765...g32f4h7322',
    timestamp: Date.now() - 1000 * 60 * 60 * 68,
    status: 'success',
    hash: '0x3012345672f01234',
    spender: '0xB9876543...e10d2f5100'
  },
  // 添加更多数据用于测试瀑布流
  {
    id: 'tx21',
    type: 'transfer',
    amount: '85.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xA1234567...d09c1e4099',
    timestamp: Date.now() - 1000 * 60 * 60 * 72,
    status: 'success',
    hash: '0x4012345673f01234'
  },
  {
    id: 'tx22',
    type: 'mint',
    amount: '600.00',
    from: '0xD1098765...g32f4h7322',
    to: '0xE7762F60...c08b0d3088',
    timestamp: Date.now() - 1000 * 60 * 60 * 76,
    status: 'success',
    hash: '0x5012345674f01234'
  },
  {
    id: 'tx23',
    type: 'transfer',
    amount: '95.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xC5432109...f21e3g6211',
    timestamp: Date.now() - 1000 * 60 * 60 * 80,
    status: 'success',
    hash: '0x6012345675f01234'
  },
  {
    id: 'tx24',
    type: 'burn',
    amount: '15.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0x0000000000000000',
    timestamp: Date.now() - 1000 * 60 * 60 * 84,
    status: 'success',
    hash: '0x7012345676f01234'
  },
  {
    id: 'tx25',
    type: 'approve',
    amount: '350.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xD1098765...g32f4h7322',
    timestamp: Date.now() - 1000 * 60 * 60 * 88,
    status: 'success',
    hash: '0x8012345677f01234',
    spender: '0xD1098765...g32f4h7322'
  },
  {
    id: 'tx26',
    type: 'transferFrom',
    amount: '125.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xB9876543...e10d2f5100',
    timestamp: Date.now() - 1000 * 60 * 60 * 92,
    status: 'success',
    hash: '0x9012345678f01234',
    spender: '0xD1098765...g32f4h7322'
  },
  {
    id: 'tx27',
    type: 'transfer',
    amount: '70.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xA1234567...d09c1e4099',
    timestamp: Date.now() - 1000 * 60 * 60 * 96,
    status: 'success',
    hash: '0xa012345679f01234'
  },
  {
    id: 'tx28',
    type: 'mint',
    amount: '450.00',
    from: '0xD1098765...g32f4h7322',
    to: '0xE7762F60...c08b0d3088',
    timestamp: Date.now() - 1000 * 60 * 60 * 100,
    status: 'success',
    hash: '0xb01234567af01234'
  },
  {
    id: 'tx29',
    type: 'transfer',
    amount: '110.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xC5432109...f21e3g6211',
    timestamp: Date.now() - 1000 * 60 * 60 * 104,
    status: 'success',
    hash: '0xc01234567bf01234'
  },
  {
    id: 'tx30',
    type: 'burn',
    amount: '35.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0x0000000000000000',
    timestamp: Date.now() - 1000 * 60 * 60 * 108,
    status: 'success',
    hash: '0xd01234567cf01234'
  },
  {
    id: 'tx31',
    type: 'approve',
    amount: '280.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xB9876543...e10d2f5100',
    timestamp: Date.now() - 1000 * 60 * 60 * 112,
    status: 'success',
    hash: '0xe01234567df01234',
    spender: '0xB9876543...e10d2f5100'
  },
  {
    id: 'tx32',
    type: 'transferFrom',
    amount: '140.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xD1098765...g32f4h7322',
    timestamp: Date.now() - 1000 * 60 * 60 * 116,
    status: 'success',
    hash: '0xf01234567ef01234',
    spender: '0xB9876543...e10d2f5100'
  },
  {
    id: 'tx33',
    type: 'transfer',
    amount: '65.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xA1234567...d09c1e4099',
    timestamp: Date.now() - 1000 * 60 * 60 * 120,
    status: 'success',
    hash: '0x001234567ff01234'
  },
  {
    id: 'tx34',
    type: 'mint',
    amount: '700.00',
    from: '0xD1098765...g32f4h7322',
    to: '0xE7762F60...c08b0d3088',
    timestamp: Date.now() - 1000 * 60 * 60 * 124,
    status: 'success',
    hash: '0x1012345670f01234'
  },
  {
    id: 'tx35',
    type: 'transfer',
    amount: '80.00',
    from: '0xE7762F60...c08b0d3088',
    to: '0xC5432109...f21e3g6211',
    timestamp: Date.now() - 1000 * 60 * 60 * 128,
    status: 'success',
    hash: '0x2012345671f01234'
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