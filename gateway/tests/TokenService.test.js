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

  describe('burn', () => {
    it('应该成功销毁代币', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from('tx123');
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.getCentralBankInfo = jest.fn().mockReturnValue({ name: 'CentralBank' });
      tokenService.invokeTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.burn({ amount: '1000' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('代币销毁成功');
      expect(result.data.amount).toBe(1000);
      expect(result.data.txId).toBe('tx123');
      expect(tokenService.invokeTransaction).toHaveBeenCalledWith('Burn', '1000');
    });

    it('应该验证销毁参数', async () => {
      const tokenService = new TokenService();

      await expect(tokenService.burn({ amount: '' })).rejects.toThrow('销毁数量不能为空');
      await expect(tokenService.burn({ amount: 'abc' })).rejects.toThrow('销毁数量必须是非负整数');
      await expect(tokenService.burn({ amount: '-100' })).rejects.toThrow('销毁数量必须是非负整数');
    });

    it('应该处理销毁失败', async () => {
      const tokenService = new TokenService();
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.getCentralBankInfo = jest.fn().mockReturnValue({ name: 'CentralBank' });
      tokenService.invokeTransaction = jest.fn().mockRejectedValue(new Error('销毁失败'));

      const result = await tokenService.burn({ amount: '1000' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('代币销毁失败');
      expect(result.error).toBe('销毁失败');
    });
  });

  describe('getAccountInfo', () => {
    it('应该成功获取当前客户端账户信息', async () => {
      const tokenService = new TokenService();
      const mockAccountInfo = {
        userId: 'user123',
        balance: 1000,
        orgMsp: 'CentralBankMSP'
      };
      const mockResult = Buffer.from(JSON.stringify(mockAccountInfo));
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.getAccountInfo();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAccountInfo);
      expect(tokenService.evaluateTransaction).toHaveBeenCalledWith('GetClientAccountInfo');
    });

    it('应该成功获取指定用户账户信息', async () => {
      const tokenService = new TokenService();
      const mockAccountInfo = {
        userId: 'user456',
        balance: 2000,
        orgMsp: 'Bank1MSP'
      };
      const mockResult = Buffer.from(JSON.stringify(mockAccountInfo));
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.getAccountInfo({ userId: 'user456' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAccountInfo);
      expect(tokenService.evaluateTransaction).toHaveBeenCalledWith('GetUserAccountInfo', 'user456');
    });

    it('应该处理查询失败', async () => {
      const tokenService = new TokenService();
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockRejectedValue(new Error('查询失败'));

      const result = await tokenService.getAccountInfo();

      expect(result.success).toBe(false);
      expect(result.message).toBe('获取账户信息失败');
      expect(result.error).toBe('查询失败');
    });
  });

  describe('getUserInfo', () => {
    it('应该成功获取用户信息', async () => {
      const tokenService = new TokenService();
      const mockUserInfo = {
        clientId: 'client123',
        userName: 'User1',
        orgName: 'CentralBank',
        orgUnit: 'client',
        mspId: 'CentralBankMSP',
        txId: 'tx123',
        channelId: 'cbdc-channel'
      };
      const mockResult = Buffer.from(JSON.stringify(mockUserInfo));
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.getUserInfo();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUserInfo);
      expect(tokenService.evaluateTransaction).toHaveBeenCalledWith('GetUserInfo');
    });

    it('应该处理查询失败', async () => {
      const tokenService = new TokenService();
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockRejectedValue(new Error('查询失败'));

      const result = await tokenService.getUserInfo();

      expect(result.success).toBe(false);
      expect(result.message).toBe('获取用户信息失败');
      expect(result.error).toBe('查询失败');
    });
  });

  describe('getBalance', () => {
    it('应该成功获取当前客户端余额', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from('1000');
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.getBalance();

      expect(result.success).toBe(true);
      expect(result.data.account).toBe('current');
      expect(result.data.balance).toBe(1000);
      expect(tokenService.evaluateTransaction).toHaveBeenCalledWith('ClientAccountBalance');
    });

    it('应该成功获取指定账户余额', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from('2000');
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.getBalance({ account: 'user456' });

      expect(result.success).toBe(true);
      expect(result.data.account).toBe('user456');
      expect(result.data.balance).toBe(2000);
      expect(tokenService.evaluateTransaction).toHaveBeenCalledWith('BalanceOf', 'user456');
    });

    it('应该处理查询失败', async () => {
      const tokenService = new TokenService();
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockRejectedValue(new Error('查询失败'));

      const result = await tokenService.getBalance();

      expect(result.success).toBe(false);
      expect(result.message).toBe('获取余额失败');
      expect(result.error).toBe('查询失败');
    });
  });

  describe('getClientAccountId', () => {
    it('应该成功获取客户端账户ID', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from('client123');
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.getClientAccountId();

      expect(result.success).toBe(true);
      expect(result.data.accountId).toBe('client123');
      expect(tokenService.evaluateTransaction).toHaveBeenCalledWith('ClientAccountID');
    });

    it('应该处理查询失败', async () => {
      const tokenService = new TokenService();
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockRejectedValue(new Error('查询失败'));

      const result = await tokenService.getClientAccountId();

      expect(result.success).toBe(false);
      expect(result.message).toBe('获取账户ID失败');
      expect(result.error).toBe('查询失败');
    });
  });

  describe('getAllowance', () => {
    it('应该成功获取授权额度', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from('500');
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.getAllowance({
        owner: 'owner123',
        spender: 'spender456'
      });

      expect(result.success).toBe(true);
      expect(result.data.owner).toBe('owner123');
      expect(result.data.spender).toBe('spender456');
      expect(result.data.allowance).toBe(500);
      expect(tokenService.evaluateTransaction).toHaveBeenCalledWith('Allowance', 'owner123', 'spender456');
    });

    it('应该验证授权参数', async () => {
      const tokenService = new TokenService();

      await expect(tokenService.getAllowance({ owner: '', spender: 'spender456' })).rejects.toThrow('授权者地址不能为空');
      await expect(tokenService.getAllowance({ owner: 'owner123', spender: '' })).rejects.toThrow('被授权者地址不能为空');
    });

    it('应该处理查询失败', async () => {
      const tokenService = new TokenService();
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockRejectedValue(new Error('查询失败'));

      const result = await tokenService.getAllowance({
        owner: 'owner123',
        spender: 'spender456'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('获取授权额度失败');
      expect(result.error).toBe('查询失败');
    });
  });

  describe('transfer', () => {
    it('应该成功转账', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from('tx123');
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.invokeTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.transfer({
        recipient: 'recipient123',
        amount: '1000'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('转账成功');
      expect(result.data.from).toBe('CentralBank_Admin');
      expect(result.data.to).toBe('recipient123');
      expect(result.data.amount).toBe(1000);
      expect(result.data.txId).toBe('tx123');
      expect(tokenService.invokeTransaction).toHaveBeenCalledWith('Transfer', 'recipient123', '1000');
    });

    it('应该验证转账参数', async () => {
      const tokenService = new TokenService();

      await expect(tokenService.transfer({ recipient: '', amount: '1000' })).rejects.toThrow('接收者地址不能为空');
      await expect(tokenService.transfer({ recipient: 'recipient123', amount: '' })).rejects.toThrow('转账数量不能为空');
      await expect(tokenService.transfer({ recipient: 'recipient123', amount: 'abc' })).rejects.toThrow('转账数量必须是正整数');
      await expect(tokenService.transfer({ recipient: 'recipient123', amount: '0' })).rejects.toThrow('转账数量必须是正整数');
      await expect(tokenService.transfer({ recipient: 'recipient123', amount: '-100' })).rejects.toThrow('转账数量必须是正整数');
    });

    it('应该处理转账失败', async () => {
      const tokenService = new TokenService();
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.invokeTransaction = jest.fn().mockRejectedValue(new Error('余额不足'));

      const result = await tokenService.transfer({
        recipient: 'recipient123',
        amount: '1000'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('转账失败');
      expect(result.error).toBe('余额不足');
    });
  });

  describe('transferFrom', () => {
    it('应该成功授权转账', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from('tx456');
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.invokeTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.transferFrom({
        from: 'from123',
        to: 'to456',
        amount: '500'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('授权转账成功');
      expect(result.data.from).toBe('from123');
      expect(result.data.to).toBe('to456');
      expect(result.data.spender).toBe('CentralBank_Admin');
      expect(result.data.amount).toBe(500);
      expect(result.data.txId).toBe('tx456');
      expect(tokenService.invokeTransaction).toHaveBeenCalledWith('TransferFrom', 'from123', 'to456', '500');
    });

    it('应该验证授权转账参数', async () => {
      const tokenService = new TokenService();

      await expect(tokenService.transferFrom({ from: '', to: 'to456', amount: '500' })).rejects.toThrow('发送者地址不能为空');
      await expect(tokenService.transferFrom({ from: 'from123', to: '', amount: '500' })).rejects.toThrow('接收者地址不能为空');
      await expect(tokenService.transferFrom({ from: 'from123', to: 'to456', amount: '' })).rejects.toThrow('转账数量不能为空');
      await expect(tokenService.transferFrom({ from: 'from123', to: 'to456', amount: 'abc' })).rejects.toThrow('转账数量必须是正整数');
      await expect(tokenService.transferFrom({ from: 'from123', to: 'to456', amount: '0' })).rejects.toThrow('转账数量必须是正整数');
    });

    it('应该处理授权转账失败', async () => {
      const tokenService = new TokenService();
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.invokeTransaction = jest.fn().mockRejectedValue(new Error('授权不足'));

      const result = await tokenService.transferFrom({
        from: 'from123',
        to: 'to456',
        amount: '500'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('授权转账失败');
      expect(result.error).toBe('授权不足');
    });
  });

  describe('approve', () => {
    it('应该成功批准授权', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from('tx789');
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.invokeTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.approve({
        spender: 'spender123',
        amount: '200'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('授权成功');
      expect(result.data.owner).toBe('CentralBank_Admin');
      expect(result.data.spender).toBe('spender123');
      expect(result.data.amount).toBe(200);
      expect(result.data.txId).toBe('tx789');
      expect(tokenService.invokeTransaction).toHaveBeenCalledWith('Approve', 'spender123', '200');
    });

    it('应该验证授权参数', async () => {
      const tokenService = new TokenService();

      await expect(tokenService.approve({ spender: '', amount: '200' })).rejects.toThrow('被授权者地址不能为空');
      await expect(tokenService.approve({ spender: 'spender123', amount: '' })).rejects.toThrow('授权数量不能为空');
      await expect(tokenService.approve({ spender: 'spender123', amount: 'abc' })).rejects.toThrow('授权数量必须是非负整数');
      await expect(tokenService.approve({ spender: 'spender123', amount: '-100' })).rejects.toThrow('授权数量必须是非负整数');
    });

    it('应该处理授权失败', async () => {
      const tokenService = new TokenService();
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.invokeTransaction = jest.fn().mockRejectedValue(new Error('授权失败'));

      const result = await tokenService.approve({
        spender: 'spender123',
        amount: '200'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('授权失败');
      expect(result.error).toBe('授权失败');
    });
  });

  describe('queryUserTransactions', () => {
    it('应该成功查询用户交易记录', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from(JSON.stringify({
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
      }));
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.queryUserTransactions({
        userId: 'user123',
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        counterparty: 'counterparty456'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('查询成功');
      expect(result.data.userID).toBe('user123');
      expect(result.data.totalCount).toBe(5);
      expect(tokenService.evaluateTransaction).toHaveBeenCalledWith(
        'QueryUserTransactions',
        'user123',
        '100',
        '1000',
        'transfer',
        'counterparty456'
      );
    });

    it('应该验证查询参数', async () => {
      const tokenService = new TokenService();

      await expect(tokenService.queryUserTransactions({ userId: '', minAmount: '100' })).rejects.toThrow('用户ID不能为空');
      await expect(tokenService.queryUserTransactions({ userId: 'user123', minAmount: '-100' })).rejects.toThrow('最小金额必须是非负整数');
      await expect(tokenService.queryUserTransactions({ userId: 'user123', maxAmount: '-100' })).rejects.toThrow('最大金额必须是非负整数');
      await expect(tokenService.queryUserTransactions({ userId: 'user123', minAmount: '1000', maxAmount: '100' })).rejects.toThrow('最小金额不能大于最大金额');
    });

    it('应该处理查询失败', async () => {
      const tokenService = new TokenService();
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockRejectedValue(new Error('查询失败'));

      const result = await tokenService.queryUserTransactions({
        userId: 'user123'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('查询失败');
      expect(result.error).toBe('查询失败');
    });
  });

  describe('queryUserTransactionsWithOffset', () => {
    it('应该成功执行分页查询', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from(JSON.stringify({
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
      }));
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.queryUserTransactionsWithOffset({
        userId: 'user123',
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        counterparty: 'counterparty456',
        pageSize: '20',
        offset: '0'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('分页查询成功');
      expect(result.data.userID).toBe('user123');
      expect(result.data.pagination.pageSize).toBe(20);
      expect(tokenService.evaluateTransaction).toHaveBeenCalledWith(
        'QueryUserTransactionsWithOffset',
        'user123',
        '100',
        '1000',
        'transfer',
        'counterparty456',
        '20',
        '0'
      );
    });

    it('应该验证分页参数', async () => {
      const tokenService = new TokenService();

      await expect(tokenService.queryUserTransactionsWithOffset({ 
        userId: 'user123', 
        pageSize: '0' 
      })).rejects.toThrow('页面大小必须是1-100之间的正整数');
      
      await expect(tokenService.queryUserTransactionsWithOffset({ 
        userId: 'user123', 
        pageSize: '101' 
      })).rejects.toThrow('页面大小必须是1-100之间的正整数');
      
      await expect(tokenService.queryUserTransactionsWithOffset({ 
        userId: 'user123', 
        offset: '-1' 
      })).rejects.toThrow('偏移量必须是非负整数');
    });
  });

  describe('queryUserTransactionsWithBookmark', () => {
    it('应该成功执行书签分页查询', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from(JSON.stringify({
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
      }));
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.queryUserTransactionsWithBookmark({
        userId: 'user123',
        minAmount: '100',
        maxAmount: '1000',
        transactionType: 'transfer',
        counterparty: 'counterparty456',
        pageSize: '15',
        bookmark: 'bookmark123'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('书签分页查询成功');
      expect(result.data.userID).toBe('user123');
      expect(result.data.pagination.nextBookmark).toBe('bookmark123');
      expect(tokenService.evaluateTransaction).toHaveBeenCalledWith(
        'QueryUserTransactionsWithBookmark',
        'user123',
        '100',
        '1000',
        'transfer',
        'counterparty456',
        '15',
        'bookmark123'
      );
    });
  });

  describe('getUserTransactionHistory', () => {
    it('应该成功获取用户交易历史', async () => {
      const tokenService = new TokenService();
      const mockResult = Buffer.from(JSON.stringify({
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
      }));
      
      tokenService.connect = jest.fn().mockResolvedValue();
      tokenService.disconnect = jest.fn().mockResolvedValue();
      tokenService.getCurrentUser = jest.fn().mockReturnValue('CentralBank_Admin');
      tokenService.showCurrentUserInfo = jest.fn();
      tokenService.evaluateTransaction = jest.fn().mockResolvedValue(mockResult);

      const result = await tokenService.getUserTransactionHistory({
        userId: 'user123',
        pageSize: '50',
        offset: '0'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('交易历史查询成功');
      expect(result.data.userID).toBe('user123');
      expect(result.data.pagination.pageSize).toBe(50);
      expect(tokenService.evaluateTransaction).toHaveBeenCalledWith(
        'GetUserTransactionHistoryWithPagination',
        'user123',
        '50',
        '0'
      );
    });

    it('应该验证交易历史查询参数', async () => {
      const tokenService = new TokenService();

      await expect(tokenService.getUserTransactionHistory({ userId: '' })).rejects.toThrow('用户ID不能为空');
      await expect(tokenService.getUserTransactionHistory({ 
        userId: 'user123', 
        pageSize: '1001' 
      })).rejects.toThrow('页面大小必须是1-1000之间的正整数');
    });
  });

  describe('getName', () => {
    it('应该成功获取代币名称', async () => {
      const mockName = 'Digital Yuan';
      mockBaseService.evaluateTransaction.mockResolvedValue(Buffer.from(mockName));

      const result = await tokenService.getName();

      expect(result.success).toBe(true);
      expect(result.data.name).toBe(mockName);
      expect(mockBaseService.evaluateTransaction).toHaveBeenCalledWith('Name');
    });

    it('应该处理获取代币名称失败的情况', async () => {
      const errorMessage = 'Failed to get name';
      mockBaseService.evaluateTransaction.mockRejectedValue(new Error(errorMessage));

      const result = await tokenService.getName();

      expect(result.success).toBe(false);
      expect(result.error).toContain('获取代币名称失败');
      expect(result.error).toContain(errorMessage);
    });
  });

  describe('getSymbol', () => {
    it('应该成功获取代币符号', async () => {
      const mockSymbol = 'DCEP';
      mockBaseService.evaluateTransaction.mockResolvedValue(Buffer.from(mockSymbol));

      const result = await tokenService.getSymbol();

      expect(result.success).toBe(true);
      expect(result.data.symbol).toBe(mockSymbol);
      expect(mockBaseService.evaluateTransaction).toHaveBeenCalledWith('Symbol');
    });

    it('应该处理获取代币符号失败的情况', async () => {
      const errorMessage = 'Failed to get symbol';
      mockBaseService.evaluateTransaction.mockRejectedValue(new Error(errorMessage));

      const result = await tokenService.getSymbol();

      expect(result.success).toBe(false);
      expect(result.error).toContain('获取代币符号失败');
      expect(result.error).toContain(errorMessage);
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