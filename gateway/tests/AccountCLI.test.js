const TokenService = require('../services/TokenService');

// Mock TokenService
jest.mock('../services/TokenService');

describe('AccountCLI', () => {
  let mockTokenService;

  beforeEach(() => {
    // 清除所有mock
    jest.clearAllMocks();
    
    // 创建TokenService的mock实例
    mockTokenService = {
      getAccountInfo: jest.fn(),
      getUserInfo: jest.fn(),
      getBalance: jest.fn(),
      getClientAccountId: jest.fn(),
      getAllowance: jest.fn()
    };

    // Mock TokenService构造函数
    TokenService.mockImplementation(() => mockTokenService);
  });

  describe('queryAccountInfo', () => {
    it('应该成功查询当前客户端账户信息', async () => {
      const mockAccountInfo = {
        userId: 'user123',
        balance: 1000,
        orgMsp: 'CentralBankMSP'
      };

      mockTokenService.getAccountInfo.mockResolvedValue({
        success: true,
        data: mockAccountInfo
      });

      const { queryAccountInfo } = require('../cli/account');

      // 模拟console.log
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryAccountInfo({});

      expect(mockTokenService.getAccountInfo).toHaveBeenCalledWith({
        userId: undefined,
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 账户信息查询成功:');
      expect(consoleSpy).toHaveBeenCalledWith('用户ID:', 'user123');
      expect(consoleSpy).toHaveBeenCalledWith('余额:', 1000);
      expect(consoleSpy).toHaveBeenCalledWith('组织MSP:', 'CentralBankMSP');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该成功查询指定用户账户信息', async () => {
      const mockAccountInfo = {
        userId: 'user456',
        balance: 2000,
        orgMsp: 'Bank1MSP'
      };

      mockTokenService.getAccountInfo.mockResolvedValue({
        success: true,
        data: mockAccountInfo
      });

      const { queryAccountInfo } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryAccountInfo({ userId: 'user456' });

      expect(mockTokenService.getAccountInfo).toHaveBeenCalledWith({
        userId: 'user456',
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('用户ID:', 'user456');
      expect(consoleSpy).toHaveBeenCalledWith('余额:', 2000);
      expect(consoleSpy).toHaveBeenCalledWith('组织MSP:', 'Bank1MSP');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理查询失败', async () => {
      mockTokenService.getAccountInfo.mockResolvedValue({
        success: false,
        message: '查询失败',
        error: '权限不足'
      });

      const { queryAccountInfo } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryAccountInfo({});

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 账户信息查询失败:', '查询失败');
      expect(consoleErrorSpy).toHaveBeenCalledWith('错误详情:', '权限不足');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理异常', async () => {
      mockTokenService.getAccountInfo.mockRejectedValue(new Error('网络错误'));

      const { queryAccountInfo } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryAccountInfo({});

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 查询过程中发生错误:', '网络错误');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('queryUserInfo', () => {
    it('应该成功查询用户信息', async () => {
      const mockUserInfo = {
        clientId: 'client123',
        userName: 'User1',
        orgName: 'CentralBank',
        orgUnit: 'client',
        mspId: 'CentralBankMSP',
        txId: 'tx123',
        channelId: 'cbdc-channel'
      };

      mockTokenService.getUserInfo.mockResolvedValue({
        success: true,
        data: mockUserInfo
      });

      const { queryUserInfo } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryUserInfo({});

      expect(mockTokenService.getUserInfo).toHaveBeenCalledWith(undefined);

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 用户信息查询成功:');
      expect(consoleSpy).toHaveBeenCalledWith('客户端ID:', 'client123');
      expect(consoleSpy).toHaveBeenCalledWith('用户名:', 'User1');
      expect(consoleSpy).toHaveBeenCalledWith('组织名:', 'CentralBank');
      expect(consoleSpy).toHaveBeenCalledWith('组织单元:', 'client');
      expect(consoleSpy).toHaveBeenCalledWith('MSP ID:', 'CentralBankMSP');
      expect(consoleSpy).toHaveBeenCalledWith('交易ID:', 'tx123');
      expect(consoleSpy).toHaveBeenCalledWith('通道ID:', 'cbdc-channel');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理查询失败', async () => {
      mockTokenService.getUserInfo.mockResolvedValue({
        success: false,
        message: '查询失败',
        error: '用户不存在'
      });

      const { queryUserInfo } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryUserInfo({});

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 用户信息查询失败:', '查询失败');
      expect(consoleErrorSpy).toHaveBeenCalledWith('错误详情:', '用户不存在');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('queryBalance', () => {
    it('应该成功查询当前客户端余额', async () => {
      mockTokenService.getBalance.mockResolvedValue({
        success: true,
        data: {
          account: 'current',
          balance: 1000
        }
      });

      const { queryBalance } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryBalance({});

      expect(mockTokenService.getBalance).toHaveBeenCalledWith({
        account: undefined,
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 余额查询成功:');
      expect(consoleSpy).toHaveBeenCalledWith('账户:', 'current');
      expect(consoleSpy).toHaveBeenCalledWith('余额:', 1000);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该成功查询指定账户余额', async () => {
      mockTokenService.getBalance.mockResolvedValue({
        success: true,
        data: {
          account: 'user456',
          balance: 2000
        }
      });

      const { queryBalance } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryBalance({ account: 'user456' });

      expect(mockTokenService.getBalance).toHaveBeenCalledWith({
        account: 'user456',
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('账户:', 'user456');
      expect(consoleSpy).toHaveBeenCalledWith('余额:', 2000);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理查询失败', async () => {
      mockTokenService.getBalance.mockResolvedValue({
        success: false,
        message: '查询失败',
        error: '账户不存在'
      });

      const { queryBalance } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryBalance({});

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 余额查询失败:', '查询失败');
      expect(consoleErrorSpy).toHaveBeenCalledWith('错误详情:', '账户不存在');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('queryAccountId', () => {
    it('应该成功查询客户端账户ID', async () => {
      mockTokenService.getClientAccountId.mockResolvedValue({
        success: true,
        data: {
          accountId: 'client123'
        }
      });

      const { queryAccountId } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryAccountId({});

      expect(mockTokenService.getClientAccountId).toHaveBeenCalledWith(undefined);

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 账户ID查询成功:');
      expect(consoleSpy).toHaveBeenCalledWith('账户ID:', 'client123');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理查询失败', async () => {
      mockTokenService.getClientAccountId.mockResolvedValue({
        success: false,
        message: '查询失败',
        error: '身份验证失败'
      });

      const { queryAccountId } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryAccountId({});

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 账户ID查询失败:', '查询失败');
      expect(consoleErrorSpy).toHaveBeenCalledWith('错误详情:', '身份验证失败');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('queryAllowance', () => {
    it('应该成功查询授权额度', async () => {
      mockTokenService.getAllowance.mockResolvedValue({
        success: true,
        data: {
          owner: 'owner123',
          spender: 'spender456',
          allowance: 500
        }
      });

      const { queryAllowance } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryAllowance({
        owner: 'owner123',
        spender: 'spender456'
      });

      expect(mockTokenService.getAllowance).toHaveBeenCalledWith({
        owner: 'owner123',
        spender: 'spender456',
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 授权额度查询成功:');
      expect(consoleSpy).toHaveBeenCalledWith('授权者:', 'owner123');
      expect(consoleSpy).toHaveBeenCalledWith('被授权者:', 'spender456');
      expect(consoleSpy).toHaveBeenCalledWith('授权额度:', 500);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理查询失败', async () => {
      mockTokenService.getAllowance.mockResolvedValue({
        success: false,
        message: '查询失败',
        error: '授权记录不存在'
      });

      const { queryAllowance } = require('../cli/account');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await queryAllowance({
        owner: 'owner123',
        spender: 'spender456'
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 授权额度查询失败:', '查询失败');
      expect(consoleErrorSpy).toHaveBeenCalledWith('错误详情:', '授权记录不存在');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
}); 