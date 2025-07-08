const TokenService = require('../services/TokenService');

// Mock TokenService
jest.mock('../services/TokenService');

describe('QueryCLI', () => {
  let mockTokenService;

  beforeEach(() => {
    // 清除所有mock
    jest.clearAllMocks();
    
    // 创建TokenService的mock实例
    mockTokenService = {
      queryUserTransactions: jest.fn(),
      queryUserTransactionsWithOffset: jest.fn(),
      queryUserTransactionsWithBookmark: jest.fn(),
      getUserTransactionHistory: jest.fn()
    };

    // Mock TokenService构造函数
    TokenService.mockImplementation(() => mockTokenService);
  });

  describe('executeTransactionsQuery', () => {
    it('应该成功执行基础富查询', async () => {
      mockTokenService.queryUserTransactions.mockResolvedValue({
        success: true,
        data: {
          userID: 'user123',
          queryConditions: {
            minAmount: 100,
            maxAmount: 1000,
            transactionType: 'transfer',
            counterparty: 'counterparty456'
          },
          totalCount: 5,
          transactions: [
            { txId: 'tx1', from: 'user123', to: 'counterparty456', amount: 500 }
          ]
        }
      });

      const { executeTransactionsQuery } = require('../cli/query');

      // 模拟console.log
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeTransactionsQuery({
        userId: 'user123',
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        counterparty: 'counterparty456'
      });

      expect(mockTokenService.queryUserTransactions).toHaveBeenCalledWith({
        userId: 'user123',
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        counterparty: 'counterparty456',
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 查询成功:');
      expect(consoleSpy).toHaveBeenCalledWith('用户ID:', 'user123');
      expect(consoleSpy).toHaveBeenCalledWith('总记录数:', 5);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理查询失败', async () => {
      mockTokenService.queryUserTransactions.mockResolvedValue({
        success: false,
        message: '查询失败',
        error: '权限不足'
      });

      const { executeTransactionsQuery } = require('../cli/query');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeTransactionsQuery({
        userId: 'user123'
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 查询失败:', '查询失败');
      expect(consoleErrorSpy).toHaveBeenCalledWith('错误详情:', '权限不足');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('executeTransactionsPageQuery', () => {
    it('应该成功执行分页查询', async () => {
      mockTokenService.queryUserTransactionsWithOffset.mockResolvedValue({
        success: true,
        data: {
          userID: 'user123',
          queryConditions: {
            minAmount: 100,
            maxAmount: 1000,
            transactionType: 'transfer',
            counterparty: 'counterparty456'
          },
          pagination: {
            pageSize: 20,
            offset: 0,
            totalCount: 50
          },
          totalCount: 50,
          transactions: [
            { txId: 'tx1', from: 'user123', to: 'counterparty456', amount: 500 }
          ]
        }
      });

      const { executeTransactionsPageQuery } = require('../cli/query');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeTransactionsPageQuery({
        userId: 'user123',
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        counterparty: 'counterparty456',
        pageSize: '20',
        offset: '0'
      });

      expect(mockTokenService.queryUserTransactionsWithOffset).toHaveBeenCalledWith({
        userId: 'user123',
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        counterparty: 'counterparty456',
        pageSize: '20',
        offset: '0',
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 分页查询成功:');
      expect(consoleSpy).toHaveBeenCalledWith('用户ID:', 'user123');
      expect(consoleSpy).toHaveBeenCalledWith('当前页记录数:', 1);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('executeTransactionsBookmarkQuery', () => {
    it('应该成功执行书签分页查询', async () => {
      mockTokenService.queryUserTransactionsWithBookmark.mockResolvedValue({
        success: true,
        data: {
          userID: 'user123',
          queryConditions: {
            minAmount: 100,
            maxAmount: 1000,
            transactionType: 'transfer',
            counterparty: 'counterparty456'
          },
          pagination: {
            pageSize: 15,
            nextBookmark: 'bookmark123'
          },
          totalCount: 30,
          transactions: [
            { txId: 'tx1', from: 'user123', to: 'counterparty456', amount: 500 }
          ]
        }
      });

      const { executeTransactionsBookmarkQuery } = require('../cli/query');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeTransactionsBookmarkQuery({
        userId: 'user123',
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        counterparty: 'counterparty456',
        pageSize: '15',
        bookmark: 'bookmark123'
      });

      expect(mockTokenService.queryUserTransactionsWithBookmark).toHaveBeenCalledWith({
        userId: 'user123',
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        counterparty: 'counterparty456',
        pageSize: '15',
        bookmark: 'bookmark123',
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 书签分页查询成功:');
      expect(consoleSpy).toHaveBeenCalledWith('下一页书签:', 'bookmark123');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('executeHistoryQuery', () => {
    it('应该成功执行交易历史查询', async () => {
      mockTokenService.getUserTransactionHistory.mockResolvedValue({
        success: true,
        data: {
          userID: 'user123',
          pagination: {
            pageSize: 50,
            offset: 0,
            totalCount: 100
          },
          totalCount: 100,
          transactions: [
            { txId: 'tx1', from: 'user123', to: 'counterparty456', amount: 500 }
          ]
        }
      });

      const { executeHistoryQuery } = require('../cli/query');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeHistoryQuery({
        userId: 'user123',
        pageSize: '50',
        offset: '0'
      });

      expect(mockTokenService.getUserTransactionHistory).toHaveBeenCalledWith({
        userId: 'user123',
        pageSize: '50',
        offset: '0',
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 交易历史查询成功:');
      expect(consoleSpy).toHaveBeenCalledWith('用户ID:', 'user123');
      expect(consoleSpy).toHaveBeenCalledWith('总记录数:', 100);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理交易历史查询失败', async () => {
      mockTokenService.getUserTransactionHistory.mockResolvedValue({
        success: false,
        message: '交易历史查询失败',
        error: '用户不存在'
      });

      const { executeHistoryQuery } = require('../cli/query');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeHistoryQuery({
        userId: 'user123',
        pageSize: '50',
        offset: '0'
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 交易历史查询失败:', '交易历史查询失败');
      expect(consoleErrorSpy).toHaveBeenCalledWith('错误详情:', '用户不存在');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
}); 