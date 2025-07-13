const { queryAllTransactions } = require('../cli/query');
const TokenService = require('../services/TokenService');

// Mock TokenService
jest.mock('../services/TokenService');

describe('QueryAllTransactions CLI', () => {
  let mockTokenService;

  beforeEach(() => {
    // 清除所有mock
    jest.clearAllMocks();
    
    // 创建mock实例
    mockTokenService = {
      queryAllTransactions: jest.fn(),
      showCurrentUserInfo: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn()
    };
    
    // 设置TokenService构造函数返回mock实例
    TokenService.mockImplementation(() => mockTokenService);
  });

  describe('queryAllTransactions', () => {
    it('应该成功查询所有交易（央行用户）', async () => {
      // 准备mock数据
      const mockResult = {
        success: true,
        message: '查询所有交易成功',
        data: {
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
        }
      };

      mockTokenService.queryAllTransactions.mockResolvedValue(mockResult);

      // 模拟console.log
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // 执行测试
      await queryAllTransactions({
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        pageSize: '20',
        offset: '0'
      });

      // 验证调用
      expect(mockTokenService.queryAllTransactions).toHaveBeenCalledWith({
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        counterparty: '',
        pageSize: '20',
        offset: '0',
        identityName: undefined
      });

      // 验证输出
      expect(consoleSpy).toHaveBeenCalledWith('✅ 查询成功');
      expect(consoleSpy).toHaveBeenCalledWith('📊 查询结果:');
      expect(consoleSpy).toHaveBeenCalledWith('  - 总交易数: 50');
      expect(consoleSpy).toHaveBeenCalledWith('  - 当前页交易数: 20');
      expect(consoleSpy).toHaveBeenCalledWith('  - 页面大小: 20');
      expect(consoleSpy).toHaveBeenCalledWith('  - 当前偏移量: 0');
      expect(consoleSpy).toHaveBeenCalledWith('  - 是否有更多: true');

      // 验证用户角色信息输出
      expect(consoleSpy).toHaveBeenCalledWith('👤 用户角色信息:');
      expect(consoleSpy).toHaveBeenCalledWith('  - 调用者ID: centralbank_user');
      expect(consoleSpy).toHaveBeenCalledWith('  - 调用者Domain: centralbank.example.com');
      expect(consoleSpy).toHaveBeenCalledWith('  - 是否Admin: true');
      expect(consoleSpy).toHaveBeenCalledWith('  - 是否央行: true');

      // 验证交易列表输出
      expect(consoleSpy).toHaveBeenCalledWith('\n📋 交易列表:');
      expect(consoleSpy).toHaveBeenCalledWith('\n  1. 交易ID: tx1');
      expect(consoleSpy).toHaveBeenCalledWith('     类型: transfer');
      expect(consoleSpy).toHaveBeenCalledWith('     金额: 500');
      expect(consoleSpy).toHaveBeenCalledWith('     发送方: user1');
      expect(consoleSpy).toHaveBeenCalledWith('     接收方: user2');

      // 验证分页信息输出
      expect(consoleSpy).toHaveBeenCalledWith('\n📄 分页信息:');
      expect(consoleSpy).toHaveBeenCalledWith('  - 下一页偏移量: 20');
      expect(consoleSpy).toHaveBeenCalledWith('  - 使用命令查看下一页: --offset 20');

      // 清理
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该成功查询所有交易（银行admin用户）', async () => {
      // 准备mock数据
      const mockResult = {
        success: true,
        message: '查询所有交易成功',
        data: {
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
        }
      };

      mockTokenService.queryAllTransactions.mockResolvedValue(mockResult);

      // 模拟console.log
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // 执行测试
      await queryAllTransactions({
        pageSize: '10',
        offset: '0'
      });

      // 验证调用
      expect(mockTokenService.queryAllTransactions).toHaveBeenCalledWith({
        minAmount: '0',
        maxAmount: '0',
        transactionType: '',
        counterparty: '',
        pageSize: '10',
        offset: '0',
        identityName: undefined
      });

      // 验证输出
      expect(consoleSpy).toHaveBeenCalledWith('✅ 查询成功');
      expect(consoleSpy).toHaveBeenCalledWith('  - 总交易数: 5');
      expect(consoleSpy).toHaveBeenCalledWith('  - 当前页交易数: 5');
      expect(consoleSpy).toHaveBeenCalledWith('  - 是否有更多: false');

      // 验证用户角色信息输出
      expect(consoleSpy).toHaveBeenCalledWith('  - 调用者Domain: bank1.example.com');
      expect(consoleSpy).toHaveBeenCalledWith('  - 是否Admin: true');
      expect(consoleSpy).toHaveBeenCalledWith('  - 是否央行: false');

      // 清理
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该成功查询所有交易（普通用户）', async () => {
      // 准备mock数据
      const mockResult = {
        success: true,
        message: '查询所有交易成功',
        data: {
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
        }
      };

      mockTokenService.queryAllTransactions.mockResolvedValue(mockResult);

      // 模拟console.log
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // 执行测试
      await queryAllTransactions({
        pageSize: '20',
        offset: '0'
      });

      // 验证调用
      expect(mockTokenService.queryAllTransactions).toHaveBeenCalledWith({
        minAmount: '0',
        maxAmount: '0',
        transactionType: '',
        counterparty: '',
        pageSize: '20',
        offset: '0',
        identityName: undefined
      });

      // 验证输出
      expect(consoleSpy).toHaveBeenCalledWith('✅ 查询成功');
      expect(consoleSpy).toHaveBeenCalledWith('  - 总交易数: 2');
      expect(consoleSpy).toHaveBeenCalledWith('  - 当前页交易数: 2');
      expect(consoleSpy).toHaveBeenCalledWith('  - 是否有更多: false');

      // 验证用户角色信息输出
      expect(consoleSpy).toHaveBeenCalledWith('  - 调用者ID: user1');
      expect(consoleSpy).toHaveBeenCalledWith('  - 调用者Domain: bank1.example.com');
      expect(consoleSpy).toHaveBeenCalledWith('  - 是否Admin: false');
      expect(consoleSpy).toHaveBeenCalledWith('  - 是否央行: false');

      // 清理
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理查询失败的情况', async () => {
      // 准备mock数据
      const mockResult = {
        success: false,
        message: '查询所有交易失败',
        error: '权限不足'
      };

      mockTokenService.queryAllTransactions.mockResolvedValue(mockResult);

      // 模拟console.log和console.error
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // 执行测试
      await queryAllTransactions({
        pageSize: '20',
        offset: '0'
      });

      // 验证调用
      expect(mockTokenService.queryAllTransactions).toHaveBeenCalledWith({
        minAmount: '0',
        maxAmount: '0',
        transactionType: '',
        counterparty: '',
        pageSize: '20',
        offset: '0',
        identityName: undefined
      });

      // 验证错误输出
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ 查询失败:', '查询所有交易失败');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   错误详情:', '权限不足');

      // 清理
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理查询过程中发生错误的情况', async () => {
      // 准备mock异常
      const mockError = new Error('网络连接失败');
      mockTokenService.queryAllTransactions.mockRejectedValue(mockError);

      // 模拟console.log和console.error
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // 执行测试
      await queryAllTransactions({
        pageSize: '20',
        offset: '0'
      });

      // 验证调用
      expect(mockTokenService.queryAllTransactions).toHaveBeenCalledWith({
        minAmount: '0',
        maxAmount: '0',
        transactionType: '',
        counterparty: '',
        pageSize: '20',
        offset: '0',
        identityName: undefined
      });

      // 验证错误输出
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ 查询过程中发生错误:', '网络连接失败');

      // 清理
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理空交易列表的情况', async () => {
      // 准备mock数据
      const mockResult = {
        success: true,
        message: '查询所有交易成功',
        data: {
          queryConditions: {
            minAmount: 1000,
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
            callerID: 'user1',
            callerDomain: 'bank1.example.com',
            isAdmin: false,
            isCentralBank: false
          }
        }
      };

      mockTokenService.queryAllTransactions.mockResolvedValue(mockResult);

      // 模拟console.log
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // 执行测试
      await queryAllTransactions({
        minAmount: '1000',
        pageSize: '20',
        offset: '0'
      });

      // 验证调用
      expect(mockTokenService.queryAllTransactions).toHaveBeenCalledWith({
        minAmount: '1000',
        maxAmount: '0',
        transactionType: '',
        counterparty: '',
        pageSize: '20',
        offset: '0',
        identityName: undefined
      });

      // 验证输出
      expect(consoleSpy).toHaveBeenCalledWith('✅ 查询成功');
      expect(consoleSpy).toHaveBeenCalledWith('  - 总交易数: 0');
      expect(consoleSpy).toHaveBeenCalledWith('  - 当前页交易数: 0');
      expect(consoleSpy).toHaveBeenCalledWith('\n📋 没有找到符合条件的交易记录');

      // 清理
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
}); 