const TokenService = require('../services/TokenService');

// Mock TokenService
jest.mock('../services/TokenService');

describe('TransferCLI', () => {
  let mockTokenService;

  beforeEach(() => {
    // 清除所有mock
    jest.clearAllMocks();
    
    // 创建TokenService的mock实例
    mockTokenService = {
      transfer: jest.fn(),
      transferFrom: jest.fn(),
      approve: jest.fn()
    };

    // Mock TokenService构造函数
    TokenService.mockImplementation(() => mockTokenService);
  });

  describe('executeTransfer', () => {
    it('应该成功执行直接转账', async () => {
      mockTokenService.transfer.mockResolvedValue({
        success: true,
        data: {
          from: 'CentralBank_Admin',
          to: 'recipient123',
          amount: 1000,
          txId: 'tx123'
        }
      });

      const { executeTransfer } = require('../cli/transfer');

      // 模拟console.log
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeTransfer({
        to: 'recipient123',
        amount: '1000'
      });

      expect(mockTokenService.transfer).toHaveBeenCalledWith({
        recipient: 'recipient123',
        amount: '1000',
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 转账成功:');
      expect(consoleSpy).toHaveBeenCalledWith('发送者:', 'CentralBank_Admin');
      expect(consoleSpy).toHaveBeenCalledWith('接收者:', 'recipient123');
      expect(consoleSpy).toHaveBeenCalledWith('数量:', 1000);
      expect(consoleSpy).toHaveBeenCalledWith('交易ID:', 'tx123');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理转账失败', async () => {
      mockTokenService.transfer.mockResolvedValue({
        success: false,
        message: '转账失败',
        error: '余额不足'
      });

      const { executeTransfer } = require('../cli/transfer');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeTransfer({
        to: 'recipient123',
        amount: '1000'
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 转账失败:', '转账失败');
      expect(consoleErrorSpy).toHaveBeenCalledWith('错误详情:', '余额不足');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理异常', async () => {
      mockTokenService.transfer.mockRejectedValue(new Error('网络错误'));

      const { executeTransfer } = require('../cli/transfer');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeTransfer({
        to: 'recipient123',
        amount: '1000'
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 转账过程中发生错误:', '网络错误');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('executeTransferFrom', () => {
    it('应该成功执行授权转账', async () => {
      mockTokenService.transferFrom.mockResolvedValue({
        success: true,
        data: {
          from: 'from123',
          to: 'to456',
          spender: 'CentralBank_Admin',
          amount: 500,
          txId: 'tx456'
        }
      });

      const { executeTransferFrom } = require('../cli/transfer');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeTransferFrom({
        from: 'from123',
        to: 'to456',
        amount: '500'
      });

      expect(mockTokenService.transferFrom).toHaveBeenCalledWith({
        from: 'from123',
        to: 'to456',
        amount: '500',
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 授权转账成功:');
      expect(consoleSpy).toHaveBeenCalledWith('发送者:', 'from123');
      expect(consoleSpy).toHaveBeenCalledWith('接收者:', 'to456');
      expect(consoleSpy).toHaveBeenCalledWith('执行者:', 'CentralBank_Admin');
      expect(consoleSpy).toHaveBeenCalledWith('数量:', 500);
      expect(consoleSpy).toHaveBeenCalledWith('交易ID:', 'tx456');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理授权转账失败', async () => {
      mockTokenService.transferFrom.mockResolvedValue({
        success: false,
        message: '授权转账失败',
        error: '授权不足'
      });

      const { executeTransferFrom } = require('../cli/transfer');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeTransferFrom({
        from: 'from123',
        to: 'to456',
        amount: '500'
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 授权转账失败:', '授权转账失败');
      expect(consoleErrorSpy).toHaveBeenCalledWith('错误详情:', '授权不足');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('executeApprove', () => {
    it('应该成功执行授权批准', async () => {
      mockTokenService.approve.mockResolvedValue({
        success: true,
        data: {
          owner: 'CentralBank_Admin',
          spender: 'spender123',
          amount: 200,
          txId: 'tx789'
        }
      });

      const { executeApprove } = require('../cli/transfer');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeApprove({
        spender: 'spender123',
        amount: '200'
      });

      expect(mockTokenService.approve).toHaveBeenCalledWith({
        spender: 'spender123',
        amount: '200',
        identityName: undefined
      });

      expect(consoleSpy).toHaveBeenCalledWith('\n✅ 授权批准成功:');
      expect(consoleSpy).toHaveBeenCalledWith('授权者:', 'CentralBank_Admin');
      expect(consoleSpy).toHaveBeenCalledWith('被授权者:', 'spender123');
      expect(consoleSpy).toHaveBeenCalledWith('授权数量:', 200);
      expect(consoleSpy).toHaveBeenCalledWith('交易ID:', 'tx789');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('应该处理授权批准失败', async () => {
      mockTokenService.approve.mockResolvedValue({
        success: false,
        message: '授权批准失败',
        error: '授权失败'
      });

      const { executeApprove } = require('../cli/transfer');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await executeApprove({
        spender: 'spender123',
        amount: '200'
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ 授权批准失败:', '授权批准失败');
      expect(consoleErrorSpy).toHaveBeenCalledWith('错误详情:', '授权失败');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
}); 