const InitCLI = require('../cli/init');
const TokenService = require('../services/TokenService');

// Mock TokenService
jest.mock('../services/TokenService');

describe('InitCLI', () => {
  let cli;
  let mockTokenService;

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();
    
    // 创建 mock TokenService
    mockTokenService = {
      initialize: jest.fn()
    };

    // Mock TokenService 构造函数
    TokenService.mockImplementation(() => mockTokenService);

    cli = new InitCLI();
  });

  afterEach(() => {
    cli.close();
  });

  describe('parseArgs', () => {
    it('应该正确解析命令行参数', () => {
      // 模拟命令行参数
      const originalArgv = process.argv;
      process.argv = ['node', 'init.js', '-name', 'Test Token', '-symbol', 'TEST', '-decimals', '4'];

      const options = cli.parseArgs();

      expect(options).toEqual({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '4'
      });

      // 恢复原始 argv
      process.argv = originalArgv;
    });

    it('应该支持长参数格式', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'init.js', '--name', 'Test Token', '--symbol', 'TEST', '--decimals', '4'];

      const options = cli.parseArgs();

      expect(options).toEqual({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '4'
      });

      process.argv = originalArgv;
    });

    it('应该解析身份参数', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'init.js', '-identity', 'user1'];

      const options = cli.parseArgs();

      expect(options).toEqual({
        identityName: 'user1'
      });

      process.argv = originalArgv;
    });

    it('应该处理空参数', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'init.js'];

      const options = cli.parseArgs();

      expect(options).toEqual({});

      process.argv = originalArgv;
    });
  });

  describe('validateParams', () => {
    it('应该验证有效参数', () => {
      const options = {
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '2'
      };

      expect(() => cli.validateParams(options)).not.toThrow();
    });

    it('应该验证空名称', () => {
      const options = {
        name: '',
        symbol: 'TEST',
        decimals: '2'
      };

      expect(() => cli.validateParams(options)).toThrow(/代币名称不能为空/);
    });

    it('应该验证空符号', () => {
      const options = {
        name: 'Test Token',
        symbol: '',
        decimals: '2'
      };

      expect(() => cli.validateParams(options)).toThrow(/代币符号不能为空/);
    });

    it('应该验证无效小数位数', () => {
      const options = {
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '19'
      };

      expect(() => cli.validateParams(options)).toThrow('小数位数必须是0-18之间的整数');
    });

    it('应该验证多个错误', () => {
      const options = {
        name: '',
        symbol: '',
        decimals: 'abc'
      };

      expect(() => cli.validateParams(options)).toThrow(/代币名称不能为空/);
    });
  });

  describe('interactiveInput', () => {
    it('应该使用默认值当用户输入为空', async () => {
      // Mock readline 输入
      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('') // name
        .mockResolvedValueOnce('') // symbol
        .mockResolvedValueOnce('') // decimals
        .mockResolvedValueOnce(''); // identityName

      cli.question = mockQuestion;

      const result = await cli.interactiveInput();

      expect(result).toEqual({
        name: 'Digital Yuan',
        symbol: 'DCEP',
        decimals: '2',
        identityName: 'admin'
      });
    });

    it('应该使用用户输入的值', async () => {
      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('Custom Token')
        .mockResolvedValueOnce('CTK')
        .mockResolvedValueOnce('6')
        .mockResolvedValueOnce('user1');

      cli.question = mockQuestion;

      const result = await cli.interactiveInput();

      expect(result).toEqual({
        name: 'Custom Token',
        symbol: 'CTK',
        decimals: '6',
        identityName: 'user1'
      });
    });
  });

  describe('execute', () => {
    it('应该成功执行初始化', async () => {
      // Mock 成功响应
      mockTokenService.initialize.mockResolvedValue({
        success: true,
        data: {
          txId: 'tx123',
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 4
        }
      });

      // Mock 参数解析
      cli.parseArgs = jest.fn().mockReturnValue({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '4'
      });

      // Mock console.log 来捕获输出
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.execute();

      expect(mockTokenService.initialize).toHaveBeenCalledWith({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '4'
      });

      expect(consoleSpy).toHaveBeenCalledWith('✅ 初始化成功!');

      consoleSpy.mockRestore();
    });

    it('应该处理初始化失败', async () => {
      // Mock 失败响应
      mockTokenService.initialize.mockResolvedValue({
        success: false,
        error: 'Chaincode error'
      });

      cli.parseArgs = jest.fn().mockReturnValue({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '2'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await cli.execute();

      expect(consoleSpy).toHaveBeenCalledWith('❌ 初始化失败!');
      expect(exitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('应该处理参数验证错误', async () => {
      cli.parseArgs = jest.fn().mockReturnValue({
        name: '',
        symbol: 'TEST',
        decimals: '2'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await cli.execute();

      expect(consoleSpy).toHaveBeenCalledWith('❌ 执行失败!');
      expect(exitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('应该处理服务异常', async () => {
      mockTokenService.initialize.mockRejectedValue(new Error('Service error'));

      cli.parseArgs = jest.fn().mockReturnValue({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '2'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await cli.execute();

      expect(consoleSpy).toHaveBeenCalledWith('❌ 执行失败!');
      expect(exitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('showHelp', () => {
    it('应该显示帮助信息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      cli.showHelp();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🏛️ CBDC 代币初始化工具'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('用法: node init.js [选项]'));

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
}); 