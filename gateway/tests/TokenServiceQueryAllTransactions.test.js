// Mock fabric-network 以避免依赖问题
jest.mock('fabric-network', () => ({
  Wallets: {
    newFileSystemWallet: jest.fn()
  },
  Gateway: jest.fn()
}));

const TokenService = require('../services/TokenService');

// Mock BaseService
jest.mock('../services/BaseService');

describe('TokenService queryAllTransactions', () => {
  let tokenService;
  let mockBaseService;

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();
    
    // 创建 BaseService 的 mock 实例
    mockBaseService = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      invokeTransaction: jest.fn(),
      evaluateTransaction: jest.fn(),
      loadNetworkConfig: jest.fn(),
      buildConnectionProfile: jest.fn(),
      getCurrentUser: jest.fn().mockReturnValue('test_user'),
      showCurrentUserInfo: jest.fn(),
      getCentralBankInfo: jest.fn().mockReturnValue({
        name: 'CentralBank',
        msp_id: 'CentralBankMSP',
        domain: 'centralbank.example.com',
        type: 'central_bank'
      })
    };

    // Mock BaseService 构造函数
    const BaseService = require('../services/BaseService');
    BaseService.mockImplementation(() => mockBaseService);

    tokenService = new TokenService();
    
    // 确保 TokenService 实例有正确的方法
    Object.setPrototypeOf(tokenService, TokenService.prototype);
  });

  describe('queryAllTransactions', () => {
    it('应该成功查询所有交易（央行用户）', async () => {
      // 准备mock数据
      const mockResponse = {
        queryConditions: {
          minAmount: 100,
          maxAmount: 1000,
          transactionType: 'transfer',
          counterparty: ''
        },
        pagination: {
          pageSize: 20,
          currentOffset: 0,
          nextOffset: 20,
          hasMore: true,
          totalCount: 50
        },
        currentPageCount: 20,
        transactions: [
          {
            txId: 'tx1',
            transactionType: 'transfer',
            amount: 500,
            from: 'user1',
            to: 'user2',
            timestamp: 1640995200
          }
        ],
        userRole: {
          callerID: 'centralbank_user',
          callerDomain: 'centralbank.example.com',
          isAdmin: true,
          isCentralBank: true
        }
      };

      mockBaseService.evaluateTransaction.mockResolvedValue({
        toString: () => JSON.stringify(mockResponse)
      });

      // 执行测试
      const result = await tokenService.queryAllTransactions({
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        pageSize: '20',
        offset: '0'
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.message).toBe('查询所有交易成功');
      expect(result.data).toEqual(mockResponse);

      // 验证调用
      expect(mockBaseService.connect).toHaveBeenCalledWith('test_user');
      expect(mockBaseService.disconnect).toHaveBeenCalled();
      expect(mockBaseService.evaluateTransaction).toHaveBeenCalledWith(
        'QueryAllTransactions',
        '100',
        '1000',
        'transfer',
        '',
        '20',
        '0'
      );
    });

    it('应该成功查询所有交易（银行admin用户）', async () => {
      // 准备mock数据
      const mockResponse = {
        queryConditions: {
          minAmount: 0,
          maxAmount: 0,
          transactionType: '',
          counterparty: ''
        },
        pagination: {
          pageSize: 10,
          currentOffset: 0,
          nextOffset: -1,
          hasMore: false,
          totalCount: 5
        },
        currentPageCount: 5,
        transactions: [
          {
            txId: 'tx1',
            transactionType: 'transfer',
            amount: 100,
            from: 'bank1_user1',
            to: 'bank1_user2',
            timestamp: 1640995200
          }
        ],
        userRole: {
          callerID: 'bank1_admin',
          callerDomain: 'bank1.example.com',
          isAdmin: true,
          isCentralBank: false
        }
      };

      mockBaseService.evaluateTransaction.mockResolvedValue({
        toString: () => JSON.stringify(mockResponse)
      });

      // 执行测试
      const result = await tokenService.queryAllTransactions({
        pageSize: '10',
        offset: '0'
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.message).toBe('查询所有交易成功');
      expect(result.data).toEqual(mockResponse);

      // 验证调用
      expect(mockBaseService.connect).toHaveBeenCalledWith('test_user');
      expect(mockBaseService.disconnect).toHaveBeenCalled();
      expect(mockBaseService.evaluateTransaction).toHaveBeenCalledWith(
        'QueryAllTransactions',
        '0',
        '0',
        '',
        '',
        '10',
        '0'
      );
    });

    it('应该成功查询所有交易（普通用户）', async () => {
      // 准备mock数据
      const mockResponse = {
        queryConditions: {
          minAmount: 0,
          maxAmount: 0,
          transactionType: '',
          counterparty: ''
        },
        pagination: {
          pageSize: 20,
          currentOffset: 0,
          nextOffset: -1,
          hasMore: false,
          totalCount: 2
        },
        currentPageCount: 2,
        transactions: [
          {
            txId: 'tx1',
            transactionType: 'transfer',
            amount: 50,
            from: 'user1',
            to: 'user2',
            timestamp: 1640995200
          }
        ],
        userRole: {
          callerID: 'user1',
          callerDomain: 'bank1.example.com',
          isAdmin: false,
          isCentralBank: false
        }
      };

      mockBaseService.evaluateTransaction.mockResolvedValue({
        toString: () => JSON.stringify(mockResponse)
      });

      // 执行测试
      const result = await tokenService.queryAllTransactions({
        pageSize: '20',
        offset: '0'
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.message).toBe('查询所有交易成功');
      expect(result.data).toEqual(mockResponse);

      // 验证调用
      expect(mockBaseService.connect).toHaveBeenCalledWith('test_user');
      expect(mockBaseService.disconnect).toHaveBeenCalled();
      expect(mockBaseService.evaluateTransaction).toHaveBeenCalledWith(
        'QueryAllTransactions',
        '0',
        '0',
        '',
        '',
        '20',
        '0'
      );
    });

    it('应该使用指定的身份名称', async () => {
      // 准备mock数据
      const mockResponse = {
        queryConditions: {},
        pagination: {
          pageSize: 20,
          currentOffset: 0,
          nextOffset: -1,
          hasMore: false,
          totalCount: 0
        },
        currentPageCount: 0,
        transactions: [],
        userRole: {
          callerID: 'custom_user',
          callerDomain: 'custom.example.com',
          isAdmin: false,
          isCentralBank: false
        }
      };

      mockBaseService.evaluateTransaction.mockResolvedValue({
        toString: () => JSON.stringify(mockResponse)
      });

      // 执行测试
      const result = await tokenService.queryAllTransactions({
        identityName: 'custom_user'
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.message).toBe('查询所有交易成功');

      // 验证调用
      expect(mockBaseService.connect).toHaveBeenCalledWith('custom_user');
      expect(mockBaseService.disconnect).toHaveBeenCalled();
    });

    it('应该处理查询失败的情况', async () => {
      // 准备mock异常
      const mockError = new Error('权限不足');
      mockBaseService.evaluateTransaction.mockRejectedValue(mockError);

      // 执行测试
      const result = await tokenService.queryAllTransactions({
        pageSize: '20',
        offset: '0'
      });

      // 验证结果
      expect(result.success).toBe(false);
      expect(result.message).toBe('查询所有交易失败');
      expect(result.error).toBe('权限不足');

      // 验证调用
      expect(mockBaseService.connect).toHaveBeenCalledWith('test_user');
      expect(mockBaseService.disconnect).toHaveBeenCalled();
    });

    it('应该处理JSON解析失败的情况', async () => {
      // 准备无效的JSON响应
      mockBaseService.evaluateTransaction.mockResolvedValue({
        toString: () => 'invalid json'
      });

      // 执行测试
      const result = await tokenService.queryAllTransactions({
        pageSize: '20',
        offset: '0'
      });

      // 验证结果
      expect(result.success).toBe(false);
      expect(result.message).toBe('查询所有交易失败');
      expect(result.error).toContain('Unexpected token');

      // 验证调用
      expect(mockBaseService.connect).toHaveBeenCalledWith('test_user');
      expect(mockBaseService.disconnect).toHaveBeenCalled();
    });

    it('应该使用默认参数值', async () => {
      // 准备mock数据
      const mockResponse = {
        queryConditions: {
          minAmount: 0,
          maxAmount: 0,
          transactionType: '',
          counterparty: ''
        },
        pagination: {
          pageSize: 20,
          currentOffset: 0,
          nextOffset: -1,
          hasMore: false,
          totalCount: 0
        },
        currentPageCount: 0,
        transactions: [],
        userRole: {
          callerID: 'test_user',
          callerDomain: 'test.example.com',
          isAdmin: false,
          isCentralBank: false
        }
      };

      mockBaseService.evaluateTransaction.mockResolvedValue({
        toString: () => JSON.stringify(mockResponse)
      });

      // 执行测试（不传递任何参数）
      const result = await tokenService.queryAllTransactions();

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.message).toBe('查询所有交易成功');

      // 验证调用（使用默认参数）
      expect(mockBaseService.connect).toHaveBeenCalledWith('test_user');
      expect(mockBaseService.disconnect).toHaveBeenCalled();
      expect(mockBaseService.evaluateTransaction).toHaveBeenCalledWith(
        'QueryAllTransactions',
        '0',
        '0',
        '',
        '',
        '20',
        '0'
      );
    });

    it('应该验证分页参数', async () => {
      // 准备mock数据
      const mockResponse = {
        queryConditions: {},
        pagination: {
          pageSize: 50,
          currentOffset: 10,
          nextOffset: -1,
          hasMore: false,
          totalCount: 0
        },
        currentPageCount: 0,
        transactions: [],
        userRole: {
          callerID: 'test_user',
          callerDomain: 'test.example.com',
          isAdmin: false,
          isCentralBank: false
        }
      };

      mockBaseService.evaluateTransaction.mockResolvedValue({
        toString: () => JSON.stringify(mockResponse)
      });

      // 执行测试
      const result = await tokenService.queryAllTransactions({
        pageSize: '50',
        offset: '10'
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.message).toBe('查询所有交易成功');

      // 验证参数验证被调用
      expect(mockBaseService.connect).toHaveBeenCalledWith('test_user');
      expect(mockBaseService.disconnect).toHaveBeenCalled();
    });
  });
}); 