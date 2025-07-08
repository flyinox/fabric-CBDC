// 不再 mock fabric-network
const { TokenCLI } = require('../cli/token');

describe('TokenCLI', () => {
  let tokenCLI;
  let mockBaseService;
  let mockTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建 mock 实例
    mockBaseService = {
      setIdentityName: jest.fn(),
      getCurrentUser: jest.fn(),
      question: jest.fn()
    };
    
    mockTokenService = {
      setIdentityName: jest.fn(),
      getName: jest.fn(),
      getSymbol: jest.fn(),
      getTotalSupply: jest.fn()
    };
    
    // 使用依赖注入创建 TokenCLI 实例
    tokenCLI = new TokenCLI(mockBaseService, mockTokenService);
  });

  describe('showHelp', () => {
    it('应该显示帮助信息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      tokenCLI.showHelp();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CBDC 代币信息查询工具'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('name'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('symbol'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('supply'));

      consoleSpy.mockRestore();
    });
  });

  describe('queryName', () => {
    it('应该成功查询代币名称', async () => {
      const mockName = 'Digital Yuan';
      mockTokenService.getName.mockResolvedValue({
        success: true,
        data: { name: mockName }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.queryName();

      expect(mockTokenService.getName).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('查询成功'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(mockName));

      consoleSpy.mockRestore();
    });

    it('应该处理查询代币名称失败的情况', async () => {
      const errorMessage = 'Failed to get name';
      mockTokenService.getName.mockResolvedValue({
        success: false,
        error: errorMessage
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.queryName();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('查询失败'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));

      consoleSpy.mockRestore();
    });

    it('应该处理异常情况', async () => {
      const errorMessage = 'Network error';
      mockTokenService.getName.mockRejectedValue(new Error(errorMessage));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.queryName();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('查询失败'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));

      consoleSpy.mockRestore();
    });
  });

  describe('querySymbol', () => {
    it('应该成功查询代币符号', async () => {
      const mockSymbol = 'DCEP';
      mockTokenService.getSymbol.mockResolvedValue({
        success: true,
        data: { symbol: mockSymbol }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.querySymbol();

      expect(mockTokenService.getSymbol).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('查询成功'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(mockSymbol));

      consoleSpy.mockRestore();
    });

    it('应该处理查询代币符号失败的情况', async () => {
      const errorMessage = 'Failed to get symbol';
      mockTokenService.getSymbol.mockResolvedValue({
        success: false,
        error: errorMessage
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.querySymbol();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('查询失败'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));

      consoleSpy.mockRestore();
    });
  });

  describe('querySupply', () => {
    it('应该成功查询代币总供应量', async () => {
      const mockSupply = 1000000;
      mockTokenService.getTotalSupply.mockResolvedValue({
        success: true,
        data: { totalSupply: mockSupply }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.querySupply();

      expect(mockTokenService.getTotalSupply).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('查询成功'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(mockSupply.toString()));

      consoleSpy.mockRestore();
    });

    it('应该处理查询代币总供应量失败的情况', async () => {
      const errorMessage = 'Failed to get supply';
      mockTokenService.getTotalSupply.mockResolvedValue({
        success: false,
        error: errorMessage
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.querySupply();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('查询失败'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));

      consoleSpy.mockRestore();
    });
  });

  describe('queryInfo', () => {
    it('应该成功查询代币完整信息', async () => {
      const mockName = 'Digital Yuan';
      const mockSymbol = 'DCEP';
      const mockSupply = 1000000;

      mockTokenService.getName.mockResolvedValue({
        success: true,
        data: { name: mockName }
      });
      mockTokenService.getSymbol.mockResolvedValue({
        success: true,
        data: { symbol: mockSymbol }
      });
      mockTokenService.getTotalSupply.mockResolvedValue({
        success: true,
        data: { totalSupply: mockSupply }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.queryInfo();

      expect(mockTokenService.getName).toHaveBeenCalled();
      expect(mockTokenService.getSymbol).toHaveBeenCalled();
      expect(mockTokenService.getTotalSupply).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('查询成功'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(mockName));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(mockSymbol));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(mockSupply.toString()));

      consoleSpy.mockRestore();
    });

    it('应该处理部分查询失败的情况', async () => {
      const mockName = 'Digital Yuan';
      const errorMessage = 'Failed to get symbol';

      mockTokenService.getName.mockResolvedValue({
        success: true,
        data: { name: mockName }
      });
      mockTokenService.getSymbol.mockResolvedValue({
        success: false,
        error: errorMessage
      });
      mockTokenService.getTotalSupply.mockResolvedValue({
        success: true,
        data: { totalSupply: 1000000 }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.queryInfo();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('查询成功'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(mockName));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('查询失败'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));

      consoleSpy.mockRestore();
    });
  });

  describe('parseArgs', () => {
    it('应该正确解析命令行参数', () => {
      const args = ['-identityName', 'CentralBank_Admin', 'name'];
      const result = tokenCLI.parseArgs(args);

      expect(result.identityName).toBe('CentralBank_Admin');
      expect(result.command).toBe('name');
    });

    it('应该识别帮助参数', () => {
      const args = ['--help'];
      const result = tokenCLI.parseArgs(args);

      expect(result.help).toBe(true);
    });

    it('应该处理没有参数的情况', () => {
      const args = [];
      const result = tokenCLI.parseArgs(args);

      expect(result.command).toBeUndefined();
      expect(result.help).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('应该显示帮助信息当指定help选项时', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.execute(['--help']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CBDC 代币信息查询工具'));

      consoleSpy.mockRestore();
    });

    it('应该设置身份名称当指定identityName选项时', async () => {
      mockTokenService.getName.mockResolvedValue({
        success: true,
        data: { name: 'Test' }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.execute(['-identityName', 'CentralBank_Admin', 'name']);

      expect(mockBaseService.setIdentityName).toHaveBeenCalledWith('CentralBank_Admin');
      expect(mockTokenService.setIdentityName).toHaveBeenCalledWith('CentralBank_Admin');

      consoleSpy.mockRestore();
    });

    it('应该显示当前用户信息', async () => {
      mockBaseService.getCurrentUser.mockReturnValue('CentralBank_Admin');
      mockTokenService.getName.mockResolvedValue({
        success: true,
        data: { name: 'Test' }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.execute(['name']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('当前用户: CentralBank_Admin'));

      consoleSpy.mockRestore();
    });

    it('应该执行name命令', async () => {
      mockTokenService.getName.mockResolvedValue({
        success: true,
        data: { name: 'Test' }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.execute(['name']);

      expect(mockTokenService.getName).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('应该执行symbol命令', async () => {
      mockTokenService.getSymbol.mockResolvedValue({
        success: true,
        data: { symbol: 'TEST' }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.execute(['symbol']);

      expect(mockTokenService.getSymbol).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('应该执行supply命令', async () => {
      mockTokenService.getTotalSupply.mockResolvedValue({
        success: true,
        data: { totalSupply: 1000000 }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.execute(['supply']);

      expect(mockTokenService.getTotalSupply).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('应该执行info命令', async () => {
      mockTokenService.getName.mockResolvedValue({
        success: true,
        data: { name: 'Test' }
      });
      mockTokenService.getSymbol.mockResolvedValue({
        success: true,
        data: { symbol: 'TEST' }
      });
      mockTokenService.getTotalSupply.mockResolvedValue({
        success: true,
        data: { totalSupply: 1000000 }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.execute(['info']);

      expect(mockTokenService.getName).toHaveBeenCalled();
      expect(mockTokenService.getSymbol).toHaveBeenCalled();
      expect(mockTokenService.getTotalSupply).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('应该进入交互模式当没有指定命令时', async () => {
      mockBaseService.question
        .mockResolvedValueOnce('1') // 选择查询名称
        .mockResolvedValueOnce('n'); // 不继续查询

      mockTokenService.getName.mockResolvedValue({
        success: true,
        data: { name: 'Test' }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await tokenCLI.execute([]);

      expect(mockBaseService.question).toHaveBeenCalledWith(expect.stringContaining('请输入选择'));
      expect(mockTokenService.getName).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
}); 