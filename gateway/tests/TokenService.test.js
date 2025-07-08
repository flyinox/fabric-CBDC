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

describe('TokenService', () => {
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

  describe('initialize', () => {
    it('应该成功初始化代币', async () => {
      // Mock 成功响应
      mockBaseService.invokeTransaction.mockResolvedValue(Buffer.from('tx123'));

      const result = await tokenService.initialize({
        name: 'Digital Yuan',
        symbol: 'DCEP',
        decimals: '2'
      });

      expect(mockBaseService.connect).toHaveBeenCalledWith('admin');
      expect(mockBaseService.invokeTransaction).toHaveBeenCalledWith('Initialize', 'Digital Yuan', 'DCEP', '2');
      expect(mockBaseService.disconnect).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'CBDC 代币初始化成功',
        data: {
          name: 'Digital Yuan',
          symbol: 'DCEP',
          decimals: 2,
          txId: 'tx123'
        }
      });
    });

    it('应该使用默认参数初始化代币', async () => {
      mockBaseService.invokeTransaction.mockResolvedValue(Buffer.from('tx456'));

      const result = await tokenService.initialize();

      expect(mockBaseService.invokeTransaction).toHaveBeenCalledWith('Initialize', 'Digital Yuan', 'DCEP', '2');
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Digital Yuan');
      expect(result.data.symbol).toBe('DCEP');
      expect(result.data.decimals).toBe(2);
    });

    it('应该使用自定义身份初始化代币', async () => {
      mockBaseService.invokeTransaction.mockResolvedValue(Buffer.from('tx789'));

      const result = await tokenService.initialize({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '4',
        identityName: 'user1'
      });

      expect(mockBaseService.connect).toHaveBeenCalledWith('user1');
      expect(mockBaseService.invokeTransaction).toHaveBeenCalledWith('Initialize', 'Test Token', 'TEST', '4');
      expect(result.success).toBe(true);
    });

    it('当链码调用失败时应该返回错误信息', async () => {
      const error = new Error('Chaincode error');
      mockBaseService.invokeTransaction.mockRejectedValue(error);

      const result = await tokenService.initialize({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '2'
      });

      expect(result).toEqual({
        success: false,
        message: 'CBDC 代币初始化失败',
        error: 'Chaincode error'
      });
      expect(mockBaseService.disconnect).toHaveBeenCalled();
    });

    it('当连接失败时应该返回错误信息', async () => {
      const error = new Error('Connection failed');
      mockBaseService.connect.mockRejectedValue(error);

      const result = await tokenService.initialize({
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '2'
      });

      expect(result).toEqual({
        success: false,
        message: 'CBDC 代币初始化失败',
        error: 'Connection failed'
      });
      expect(mockBaseService.disconnect).toHaveBeenCalled();
    });
  });

  describe('_validateInitParams', () => {
    it('应该验证空名称', () => {
      expect(() => tokenService._validateInitParams('', 'TEST', '2')).toThrow('代币名称不能为空');
      expect(() => tokenService._validateInitParams(null, 'TEST', '2')).toThrow('代币名称不能为空');
      expect(() => tokenService._validateInitParams(undefined, 'TEST', '2')).toThrow('代币名称不能为空');
    });

    it('应该验证空符号', () => {
      expect(() => tokenService._validateInitParams('Test Token', '', '2')).toThrow('代币符号不能为空');
      expect(() => tokenService._validateInitParams('Test Token', null, '2')).toThrow('代币符号不能为空');
      expect(() => tokenService._validateInitParams('Test Token', undefined, '2')).toThrow('代币符号不能为空');
    });

    it('应该验证空小数位数', () => {
      expect(() => tokenService._validateInitParams('Test Token', 'TEST', '')).toThrow('小数位数不能为空');
      expect(() => tokenService._validateInitParams('Test Token', 'TEST', null)).toThrow('小数位数不能为空');
      expect(() => tokenService._validateInitParams('Test Token', 'TEST', undefined)).toThrow('小数位数不能为空');
    });

    it('应该验证小数位数范围', () => {
      // 有效的小数位数
      expect(() => tokenService._validateInitParams('Test Token', 'TEST', '0')).not.toThrow();
      expect(() => tokenService._validateInitParams('Test Token', 'TEST', '18')).not.toThrow();
      expect(() => tokenService._validateInitParams('Test Token', 'TEST', '2')).not.toThrow();

      // 无效的小数位数
      expect(() => tokenService._validateInitParams('Test Token', 'TEST', '-1')).toThrow('小数位数必须是0-18之间的整数');
      expect(() => tokenService._validateInitParams('Test Token', 'TEST', '19')).toThrow('小数位数必须是0-18之间的整数');
      expect(() => tokenService._validateInitParams('Test Token', 'TEST', 'abc')).toThrow('小数位数必须是0-18之间的整数');
      expect(() => tokenService._validateInitParams('Test Token', 'TEST', '2.5')).toThrow('小数位数必须是0-18之间的整数');
    });

    it('应该验证有效参数', () => {
      expect(() => tokenService._validateInitParams('Digital Yuan', 'DCEP', '2')).not.toThrow();
      expect(() => tokenService._validateInitParams('Test Token', 'TEST', '0')).not.toThrow();
      expect(() => tokenService._validateInitParams('Another Token', 'ATK', '18')).not.toThrow();
    });
  });

  describe('getTokenInfo', () => {
    it('应该成功获取代币信息', async () => {
      // Mock 查询结果
      mockBaseService.evaluateTransaction
        .mockResolvedValueOnce(Buffer.from('Digital Yuan'))
        .mockResolvedValueOnce(Buffer.from('DCEP'))
        .mockResolvedValueOnce(Buffer.from('2'))
        .mockResolvedValueOnce(Buffer.from('1000000'));

      const result = await tokenService.getTokenInfo('admin');

      expect(mockBaseService.connect).toHaveBeenCalledWith('admin');
      expect(mockBaseService.evaluateTransaction).toHaveBeenCalledWith('Name');
      expect(mockBaseService.evaluateTransaction).toHaveBeenCalledWith('Symbol');
      expect(mockBaseService.evaluateTransaction).toHaveBeenCalledWith('Decimals');
      expect(mockBaseService.evaluateTransaction).toHaveBeenCalledWith('TotalSupply');
      expect(mockBaseService.disconnect).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        data: {
          name: 'Digital Yuan',
          symbol: 'DCEP',
          decimals: 2,
          totalSupply: 1000000
        }
      });
    });

    it('当查询失败时应该返回错误信息', async () => {
      const error = new Error('Query failed');
      mockBaseService.evaluateTransaction.mockRejectedValue(error);

      const result = await tokenService.getTokenInfo('admin');

      expect(result).toEqual({
        success: false,
        message: '获取代币信息失败',
        error: 'Query failed'
      });
      expect(mockBaseService.disconnect).toHaveBeenCalled();
    });

    it('应该使用默认身份获取代币信息', async () => {
      mockBaseService.evaluateTransaction
        .mockResolvedValueOnce(Buffer.from('Test'))
        .mockResolvedValueOnce(Buffer.from('TST'))
        .mockResolvedValueOnce(Buffer.from('4'))
        .mockResolvedValueOnce(Buffer.from('500000'));

      await tokenService.getTokenInfo();

      expect(mockBaseService.connect).toHaveBeenCalledWith('admin');
    });
  });

  describe('mint', () => {
    it('应该成功铸造代币', async () => {
      mockBaseService.invokeTransaction.mockResolvedValue(Buffer.from('tx123'));

      const result = await tokenService.mint({
        amount: '10000'
      });

      expect(mockBaseService.connect).toHaveBeenCalledWith('admin');
      expect(mockBaseService.invokeTransaction).toHaveBeenCalledWith('Mint', '10000');
      expect(mockBaseService.disconnect).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: '代币铸造成功',
        data: {
          amount: 10000,
          txId: 'tx123'
        }
      });
    });

    it('应该使用自定义身份铸造代币', async () => {
      mockBaseService.invokeTransaction.mockResolvedValue(Buffer.from('tx456'));

      const result = await tokenService.mint({
        amount: '50000',
        identityName: 'user1'
      });

      expect(mockBaseService.connect).toHaveBeenCalledWith('user1');
      expect(mockBaseService.invokeTransaction).toHaveBeenCalledWith('Mint', '50000');
      expect(result.success).toBe(true);
    });

    it('当链码调用失败时应该返回错误信息', async () => {
      const error = new Error('Chaincode error');
      mockBaseService.invokeTransaction.mockRejectedValue(error);

      const result = await tokenService.mint({
        amount: '10000'
      });

      expect(result).toEqual({
        success: false,
        message: '代币铸造失败',
        error: 'Chaincode error'
      });
      expect(mockBaseService.disconnect).toHaveBeenCalled();
    });

    it('当连接失败时应该返回错误信息', async () => {
      const error = new Error('Connection failed');
      mockBaseService.connect.mockRejectedValue(error);

      const result = await tokenService.mint({
        amount: '10000'
      });

      expect(result).toEqual({
        success: false,
        message: '代币铸造失败',
        error: 'Connection failed'
      });
      expect(mockBaseService.disconnect).toHaveBeenCalled();
    });
  });

  describe('_validateMintParams', () => {
    it('应该验证空数量', () => {
      expect(() => tokenService._validateMintParams('')).toThrow('铸造数量不能为空');
      expect(() => tokenService._validateMintParams(null)).toThrow('铸造数量不能为空');
      expect(() => tokenService._validateMintParams(undefined)).toThrow('铸造数量不能为空');
    });

    it('应该验证非数字数量', () => {
      expect(() => tokenService._validateMintParams('abc')).toThrow('铸造数量必须是正整数');
      expect(() => tokenService._validateMintParams('12.34')).toThrow('铸造数量必须是正整数');
      expect(() => tokenService._validateMintParams('-100')).toThrow('铸造数量必须是正整数');
    });

    it('应该验证零和负数', () => {
      expect(() => tokenService._validateMintParams('0')).toThrow('铸造数量必须是正整数');
      expect(() => tokenService._validateMintParams('-1')).toThrow('铸造数量必须是正整数');
    });

    it('应该验证有效数量', () => {
      expect(() => tokenService._validateMintParams('1')).not.toThrow();
      expect(() => tokenService._validateMintParams('100')).not.toThrow();
      expect(() => tokenService._validateMintParams('1000000')).not.toThrow();
    });
  });

  describe('继承 BaseService 方法', () => {
    it('应该能够调用 BaseService 的方法', () => {
      const centralBankInfo = { name: 'CentralBank', msp_id: 'CentralBankMSP' };
      mockBaseService.getCentralBankInfo.mockReturnValue(centralBankInfo);

      const result = tokenService.getCentralBankInfo();

      expect(mockBaseService.getCentralBankInfo).toHaveBeenCalled();
      expect(result).toEqual(centralBankInfo);
    });
  });
}); 