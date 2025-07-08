const BurnCLI = require('../cli/burn');
const TokenService = require('../services/TokenService');

// Mock TokenService
jest.mock('../services/TokenService');

describe('BurnCLI', () => {
  let cli;
  let mockTokenService;

  beforeEach(() => {
    // 清除所有 mock
    jest.clearAllMocks();

    // 创建 mock TokenService
    mockTokenService = {
      burn: jest.fn()
    };
    TokenService.mockImplementation(() => mockTokenService);

    // 创建 CLI 实例
    cli = new BurnCLI();
  });

  afterEach(() => {
    cli.close();
  });

  describe('showHelp', () => {
    it('应该显示帮助信息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      cli.showHelp();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔥 CBDC 代币销毁工具'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('用法: node burn.js'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('parseArgs', () => {
    it('应该解析 -amount 参数', () => {
      const originalArgs = process.argv;
      process.argv = ['node', 'burn.js', '-amount', '1000'];

      const result = cli.parseArgs();

      expect(result).toEqual({ amount: '1000' });

      process.argv = originalArgs;
    });

    it('应该解析 -h 参数并显示帮助', () => {
      const originalArgs = process.argv;
      process.argv = ['node', 'burn.js', '-h'];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = cli.parseArgs();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔥 CBDC 代币销毁工具'));

      process.argv = originalArgs;
      consoleSpy.mockRestore();
    });

    it('应该处理未知参数', () => {
      const originalArgs = process.argv;
      process.argv = ['node', 'burn.js', '-unknown'];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = cli.parseArgs();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('❌ 未知参数: -unknown');

      process.argv = originalArgs;
      consoleSpy.mockRestore();
    });

    it('应该处理缺少参数值的情况', () => {
      const originalArgs = process.argv;
      process.argv = ['node', 'burn.js', '-amount'];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = cli.parseArgs();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('❌ 请指定销毁数量');

      process.argv = originalArgs;
      consoleSpy.mockRestore();
    });
  });

  describe('interactiveInput', () => {
    it('应该获取用户输入', async () => {
      // Mock readline 输入
      const mockQuestion = jest.fn().mockResolvedValue('1000');
      cli.question = mockQuestion;

      const result = await cli.interactiveInput();

      expect(result).toEqual({ amount: '1000' });
      expect(mockQuestion).toHaveBeenCalledWith('请输入销毁数量: ');
    });
  });

  describe('validateOptions', () => {
    it('应该验证有效的选项', () => {
      const options = { amount: '1000' };
      const result = cli.validateOptions(options);
      expect(result).toBe(true);
    });

    it('应该拒绝空数量', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const options = { amount: '' };
      const result = cli.validateOptions(options);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('❌ 销毁数量不能为空');

      consoleSpy.mockRestore();
    });

    it('应该拒绝非数字', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const options = { amount: 'abc' };
      const result = cli.validateOptions(options);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('❌ 销毁数量必须是正整数');

      consoleSpy.mockRestore();
    });

    it('应该拒绝零或负数', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const options1 = { amount: '0' };
      const result1 = cli.validateOptions(options1);
      expect(result1).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('❌ 销毁数量必须大于0');

      const options2 = { amount: '-100' };
      const result2 = cli.validateOptions(options2);
      expect(result2).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('❌ 销毁数量必须是正整数');

      consoleSpy.mockRestore();
    });
  });

  describe('execute', () => {
    it('应该成功执行销毁', async () => {
      // Mock 参数解析
      jest.spyOn(cli, 'parseArgs').mockReturnValue({ amount: '1000' });
      jest.spyOn(cli, 'validateOptions').mockReturnValue(true);

      // Mock TokenService 返回成功结果
      mockTokenService.burn.mockResolvedValue({
        success: true,
        data: {
          amount: 1000,
          txId: 'test_tx_id'
        }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.execute();

      expect(mockTokenService.burn).toHaveBeenCalledWith({ amount: '1000' });
      expect(consoleSpy).toHaveBeenCalledWith('✅ 销毁成功!');
      expect(consoleSpy).toHaveBeenCalledWith('   交易ID: test_tx_id');
      expect(consoleSpy).toHaveBeenCalledWith('   销毁数量: 1000');

      consoleSpy.mockRestore();
    });

    it('应该处理销毁失败', async () => {
      // Mock 参数解析
      jest.spyOn(cli, 'parseArgs').mockReturnValue({ amount: '1000' });
      jest.spyOn(cli, 'validateOptions').mockReturnValue(true);

      // Mock TokenService 返回失败结果
      mockTokenService.burn.mockResolvedValue({
        success: false,
        error: '销毁失败'
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.execute();

      expect(consoleSpy).toHaveBeenCalledWith('❌ 销毁失败!');
      expect(consoleSpy).toHaveBeenCalledWith('   错误: 销毁失败');

      consoleSpy.mockRestore();
    });

    it('应该处理参数验证失败', async () => {
      // Mock 参数解析
      jest.spyOn(cli, 'parseArgs').mockReturnValue({ amount: 'invalid' });
      jest.spyOn(cli, 'validateOptions').mockReturnValue(false);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.execute();

      expect(mockTokenService.burn).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('应该处理解析参数返回 null', async () => {
      // Mock 参数解析返回 null（如显示帮助）
      jest.spyOn(cli, 'parseArgs').mockReturnValue(null);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.execute();

      expect(mockTokenService.burn).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('应该处理异常', async () => {
      // Mock 参数解析抛出异常
      jest.spyOn(cli, 'parseArgs').mockImplementation(() => {
        throw new Error('测试异常');
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await cli.execute();

      expect(consoleSpy).toHaveBeenCalledWith('❌ 执行失败:', '测试异常');

      consoleSpy.mockRestore();
    });
  });
}); 