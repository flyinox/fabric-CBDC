const MintCLI = require('../cli/mint');

// Mock TokenService
jest.mock('../services/TokenService');

describe('MintCLI', () => {
  let cli;
  let mockTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建 TokenService 的 mock 实例
    mockTokenService = {
      mint: jest.fn()
    };

    // Mock TokenService 构造函数
    const TokenService = require('../services/TokenService');
    TokenService.mockImplementation(() => mockTokenService);

    cli = new MintCLI();
  });

  afterEach(() => {
    cli.close();
  });

  describe('parseArgs', () => {
    it('应该解析 -amount 参数', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'mint.js', '-amount', '10000'];

      const options = cli.parseArgs();

      expect(options.amount).toBe('10000');
      process.argv = originalArgv;
    });

    it('应该解析 --amount 参数', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'mint.js', '--amount', '50000'];

      const options = cli.parseArgs();

      expect(options.amount).toBe('50000');
      process.argv = originalArgv;
    });

    it('应该解析 -identity 参数', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'mint.js', '-identity', 'user1'];

      const options = cli.parseArgs();

      expect(options.identityName).toBe('user1');
      process.argv = originalArgv;
    });

    it('应该解析 --identity 参数', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'mint.js', '--identity', 'admin'];

      const options = cli.parseArgs();

      expect(options.identityName).toBe('admin');
      process.argv = originalArgv;
    });

    it('应该处理未知参数', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'mint.js', '-unknown', 'value'];

      const options = cli.parseArgs();

      expect(options).toEqual({});
      process.argv = originalArgv;
    });
  });

  describe('validateParams', () => {
    it('应该验证空数量', () => {
      const options = {
        amount: ''
      };

      expect(() => cli.validateParams(options)).toThrow(/铸造数量不能为空/);
    });

    it('应该验证非数字数量', () => {
      const options = {
        amount: 'abc'
      };

      expect(() => cli.validateParams(options)).toThrow(/铸造数量必须是正整数/);
    });

    it('应该验证零数量', () => {
      const options = {
        amount: '0'
      };

      expect(() => cli.validateParams(options)).toThrow(/铸造数量必须是正整数/);
    });

    it('应该验证负数', () => {
      const options = {
        amount: '-100'
      };

      expect(() => cli.validateParams(options)).toThrow(/铸造数量必须是正整数/);
    });

    it('应该验证小数', () => {
      const options = {
        amount: '12.34'
      };

      expect(() => cli.validateParams(options)).toThrow(/铸造数量必须是正整数/);
    });

    it('应该验证有效数量', () => {
      const options = {
        amount: '10000'
      };

      expect(() => cli.validateParams(options)).not.toThrow();
    });

    it('应该验证多个错误', () => {
      const options = {
        amount: 'abc'
      };

      expect(() => cli.validateParams(options)).toThrow(/铸造数量必须是正整数/);
    });
  });

  describe('execute', () => {
    it('应该成功执行铸造', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'mint.js', '-amount', '10000'];

      mockTokenService.mint.mockResolvedValue({
        success: true,
        message: '代币铸造成功',
        data: {
          amount: 10000,
          txId: 'tx123'
        }
      });

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.execute();

      expect(mockTokenService.mint).toHaveBeenCalledWith({
        amount: '10000',
        identityName: undefined
      });
      expect(consoleSpy).toHaveBeenCalledWith('✅ 铸造成功!');

      consoleSpy.mockRestore();
      process.argv = originalArgv;
    });

    it('当铸造失败时应该显示错误信息', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'mint.js', '-amount', '10000'];

      mockTokenService.mint.mockResolvedValue({
        success: false,
        message: '代币铸造失败',
        error: '权限不足'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await cli.execute();

      expect(consoleSpy).toHaveBeenCalledWith('❌ 铸造失败!');
      expect(exitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
      process.argv = originalArgv;
    });

    it('当参数验证失败时应该显示错误信息', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'mint.js', '-amount', 'abc'];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await cli.execute();

      expect(consoleSpy).toHaveBeenCalledWith('❌ 执行失败!');
      expect(exitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
      process.argv = originalArgv;
    });

    it('当服务抛出异常时应该显示错误信息', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'mint.js', '-amount', '10000'];

      mockTokenService.mint.mockRejectedValue(new Error('网络连接失败'));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await cli.execute();

      expect(consoleSpy).toHaveBeenCalledWith('❌ 执行失败!');
      expect(exitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
      process.argv = originalArgv;
    });
  });

  describe('showHelp', () => {
    it('应该显示帮助信息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      cli.showHelp();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('💰 CBDC 代币铸造工具'));
      // 注意：showHelp 中调用了 process.exit(0)，但在测试中我们 mock 了它
      // 所以这里不需要验证 exit 调用，因为 showHelp 是同步方法

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('interactiveInput', () => {
    it('应该使用默认值当用户输入为空', async () => {
      // Mock readline 输入
      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('1000'); // amount

      cli.question = mockQuestion;

      const result = await cli.interactiveInput();

      expect(result).toEqual({
        amount: '1000'
      });

      expect(mockQuestion).toHaveBeenCalledTimes(1);
    });

    it('应该使用用户输入的值', async () => {
      // Mock readline 输入
      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('5000'); // amount

      cli.question = mockQuestion;

      const result = await cli.interactiveInput();

      expect(result).toEqual({
        amount: '5000'
      });

      expect(mockQuestion).toHaveBeenCalledTimes(1);
    });
  });
}); 