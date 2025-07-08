const BaseService = require('./BaseService');

class TokenService extends BaseService {
  constructor() {
    super();
  }

  /**
   * 初始化 CBDC 代币
   * @param {Object} options - 初始化选项
   * @param {string} options.name - 代币名称
   * @param {string} options.symbol - 代币符号
   * @param {string} options.decimals - 小数位数
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 初始化结果
   */
  async initialize(options = {}) {
    const {
      name = 'Digital Yuan',
      symbol = 'DCEP',
      decimals = '2',
      identityName
    } = options;

    // 参数验证
    this._validateInitParams(name, symbol, decimals);

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      // 连接网络
      await this.connect(currentUser);

      // 执行初始化
      const result = await this.invokeTransaction('Initialize', name, symbol, decimals);

      return {
        success: true,
        message: 'CBDC 代币初始化成功',
        data: {
          name,
          symbol,
          decimals: parseInt(decimals),
          txId: result.toString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'CBDC 代币初始化失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 验证初始化参数
   * @param {string} name - 代币名称
   * @param {string} symbol - 代币符号
   * @param {string} decimals - 小数位数
   * @private
   */
  _validateInitParams(name, symbol, decimals) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('代币名称不能为空');
    }

    if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
      throw new Error('代币符号不能为空');
    }

    if (!decimals || typeof decimals !== 'string') {
      throw new Error('小数位数不能为空');
    }

    // 必须为非负整数的字符串，且在0-18之间
    if (!/^(0|[1-9]\d*)$/.test(decimals)) {
      throw new Error('小数位数必须是0-18之间的整数');
    }
    const decimalsNum = Number(decimals);
    if (decimalsNum < 0 || decimalsNum > 18) {
      throw new Error('小数位数必须是0-18之间的整数');
    }
  }

  /**
   * 获取代币信息
   * @param {string} identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 代币信息
   */
  async getTokenInfo(identityName) {
    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      await this.connect(currentUser);

      // 查询代币信息（这里假设链码有相应的查询函数）
      const nameResult = await this.evaluateTransaction('Name');
      const symbolResult = await this.evaluateTransaction('Symbol');
      const decimalsResult = await this.evaluateTransaction('Decimals');
      const totalSupplyResult = await this.evaluateTransaction('TotalSupply');

      return {
        success: true,
        data: {
          name: nameResult.toString(),
          symbol: symbolResult.toString(),
          decimals: parseInt(decimalsResult.toString()),
          totalSupply: parseInt(totalSupplyResult.toString())
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '获取代币信息失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 铸造新代币
   * @param {Object} options - 铸造选项
   * @param {string} options.amount - 铸造数量
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 铸造结果
   */
  async mint(options = {}) {
    const {
      amount,
      identityName
    } = options;

    // 参数验证
    this._validateMintParams(amount);

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      // 连接网络
      await this.connect(currentUser);

      // 验证是否为央行身份
      const centralBankInfo = this.getCentralBankInfo();
      if (!centralBankInfo) {
        throw new Error('无法获取央行组织信息');
      }

      // 检查当前身份是否为央行身份
      // 注意：这里假设钱包中的身份文件包含正确的 MSP ID
      // 在实际环境中，可能需要更严格的身份验证
      console.log(`⚠️  注意：铸造操作仅限央行身份执行，当前使用身份: ${currentUser}`);

      // 执行铸造
      const result = await this.invokeTransaction('Mint', amount);

      return {
        success: true,
        message: '代币铸造成功',
        data: {
          amount: parseInt(amount),
          txId: result.toString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '代币铸造失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 验证铸造参数
   * @param {string} amount - 铸造数量
   * @private
   */
  _validateMintParams(amount) {
    if (!amount || typeof amount !== 'string') {
      throw new Error('铸造数量不能为空');
    }

    // 必须为正整数的字符串
    if (!/^[1-9]\d*$/.test(amount)) {
      throw new Error('铸造数量必须是正整数');
    }

    const amountNum = parseInt(amount);
    if (amountNum <= 0) {
      throw new Error('铸造数量必须大于0');
    }
  }

  /**
   * 销毁代币
   * @param {Object} options - 销毁选项
   * @param {string} options.amount - 销毁数量
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 销毁结果
   */
  async burn(options = {}) {
    const {
      amount,
      identityName
    } = options;

    // 参数验证
    this._validateBurnParams(amount);

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      // 连接网络
      await this.connect(currentUser);

      // 验证是否为央行身份
      const centralBankInfo = this.getCentralBankInfo();
      if (!centralBankInfo) {
        throw new Error('无法获取央行组织信息');
      }

      // 检查当前身份是否为央行身份
      console.log(`⚠️  注意：销毁操作仅限央行身份执行，当前使用身份: ${currentUser}`);

      // 执行销毁
      const result = await this.invokeTransaction('Burn', amount);

      return {
        success: true,
        message: '代币销毁成功',
        data: {
          amount: parseInt(amount),
          txId: result.toString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '代币销毁失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 验证销毁参数
   * @param {string} amount - 销毁数量
   * @private
   */
  _validateBurnParams(amount) {
    if (!amount || typeof amount !== 'string') {
      throw new Error('销毁数量不能为空');
    }

    // 必须为非负整数的字符串
    if (!/^(0|[1-9]\d*)$/.test(amount)) {
      throw new Error('销毁数量必须是非负整数');
    }

    const amountNum = Number(amount);
    if (amountNum < 0) {
      throw new Error('销毁数量必须是非负整数');
    }
  }

  /**
   * 获取账户信息（统一接口）
   * @param {Object} options - 查询选项
   * @param {string} options.userId - 用户ID，不提供则查询当前客户端
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 账户信息
   */
  async getAccountInfo(options = {}) {
    const {
      userId,
      identityName
    } = options;

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      await this.connect(currentUser);

      let result;
      if (userId) {
        // 查询指定用户的账户信息
        result = await this.evaluateTransaction('GetUserAccountInfo', userId);
      } else {
        // 查询当前客户端的账户信息
        result = await this.evaluateTransaction('GetClientAccountInfo');
      }

      const accountInfo = JSON.parse(result.toString());

      return {
        success: true,
        data: accountInfo
      };
    } catch (error) {
      return {
        success: false,
        message: '获取账户信息失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 获取用户基本信息（身份信息）
   * @param {string} identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 用户基本信息
   */
  async getUserInfo(identityName) {
    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      await this.connect(currentUser);

      const result = await this.evaluateTransaction('GetUserInfo');
      const userInfo = JSON.parse(result.toString());

      return {
        success: true,
        data: userInfo
      };
    } catch (error) {
      return {
        success: false,
        message: '获取用户信息失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 获取账户余额
   * @param {Object} options - 查询选项
   * @param {string} options.account - 账户地址，不提供则查询当前客户端
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 余额信息
   */
  async getBalance(options = {}) {
    const {
      account,
      identityName
    } = options;

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      await this.connect(currentUser);

      let result;
      if (account) {
        // 查询指定账户的余额
        result = await this.evaluateTransaction('BalanceOf', account);
      } else {
        // 查询当前客户端的余额
        result = await this.evaluateTransaction('ClientAccountBalance');
      }

      const balance = parseInt(result.toString());

      return {
        success: true,
        data: {
          account: account || 'current',
          balance: balance
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '获取余额失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 获取客户端账户ID
   * @param {string} identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 账户ID信息
   */
  async getClientAccountId(identityName) {
    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      await this.connect(currentUser);

      const result = await this.evaluateTransaction('ClientAccountID');
      const accountId = result.toString();

      return {
        success: true,
        data: {
          accountId: accountId
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '获取账户ID失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 获取授权额度
   * @param {Object} options - 查询选项
   * @param {string} options.owner - 授权者地址
   * @param {string} options.spender - 被授权者地址
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 授权额度信息
   */
  async getAllowance(options = {}) {
    const {
      owner,
      spender,
      identityName
    } = options;

    // 参数验证
    if (!owner || typeof owner !== 'string' || owner.trim() === '') {
      throw new Error('授权者地址不能为空');
    }

    if (!spender || typeof spender !== 'string' || spender.trim() === '') {
      throw new Error('被授权者地址不能为空');
    }

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      await this.connect(currentUser);

      const result = await this.evaluateTransaction('Allowance', owner, spender);
      const allowance = parseInt(result.toString());

      return {
        success: true,
        data: {
          owner: owner,
          spender: spender,
          allowance: allowance
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '获取授权额度失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 转账代币
   * @param {Object} options - 转账选项
   * @param {string} options.recipient - 接收者地址
   * @param {string} options.amount - 转账数量
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 转账结果
   */
  async transfer(options = {}) {
    const {
      recipient,
      amount,
      identityName
    } = options;

    // 参数验证
    this._validateTransferParams(recipient, amount);

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      // 连接网络
      await this.connect(currentUser);

      // 执行转账
      const result = await this.invokeTransaction('Transfer', recipient, amount);

      return {
        success: true,
        message: '转账成功',
        data: {
          from: currentUser,
          to: recipient,
          amount: parseInt(amount),
          txId: result.toString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '转账失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 验证转账参数
   * @param {string} recipient - 接收者地址
   * @param {string} amount - 转账数量
   * @private
   */
  _validateTransferParams(recipient, amount) {
    if (!recipient || typeof recipient !== 'string' || recipient.trim() === '') {
      throw new Error('接收者地址不能为空');
    }

    if (!amount || typeof amount !== 'string') {
      throw new Error('转账数量不能为空');
    }

    // 必须为正整数的字符串
    if (!/^[1-9]\d*$/.test(amount)) {
      throw new Error('转账数量必须是正整数');
    }

    const amountNum = Number(amount);
    if (amountNum <= 0) {
      throw new Error('转账数量必须大于0');
    }

    if (amountNum > Number.MAX_SAFE_INTEGER) {
      throw new Error('转账数量超出安全范围');
    }
  }

  /**
   * 授权转账（从指定账户转账到指定接收者）
   * @param {Object} options - 授权转账选项
   * @param {string} options.from - 发送者地址
   * @param {string} options.to - 接收者地址
   * @param {string} options.amount - 转账数量
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 授权转账结果
   */
  async transferFrom(options = {}) {
    const {
      from,
      to,
      amount,
      identityName
    } = options;

    // 参数验证
    this._validateTransferFromParams(from, to, amount);

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      // 连接网络
      await this.connect(currentUser);

      // 执行授权转账
      const result = await this.invokeTransaction('TransferFrom', from, to, amount);

      return {
        success: true,
        message: '授权转账成功',
        data: {
          from: from,
          to: to,
          spender: currentUser,
          amount: parseInt(amount),
          txId: result.toString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '授权转账失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 验证授权转账参数
   * @param {string} from - 发送者地址
   * @param {string} to - 接收者地址
   * @param {string} amount - 转账数量
   * @private
   */
  _validateTransferFromParams(from, to, amount) {
    if (!from || typeof from !== 'string' || from.trim() === '') {
      throw new Error('发送者地址不能为空');
    }

    if (!to || typeof to !== 'string' || to.trim() === '') {
      throw new Error('接收者地址不能为空');
    }

    if (!amount || typeof amount !== 'string') {
      throw new Error('转账数量不能为空');
    }

    // 必须为正整数的字符串
    if (!/^[1-9]\d*$/.test(amount)) {
      throw new Error('转账数量必须是正整数');
    }

    const amountNum = Number(amount);
    if (amountNum <= 0) {
      throw new Error('转账数量必须大于0');
    }

    if (amountNum > Number.MAX_SAFE_INTEGER) {
      throw new Error('转账数量超出安全范围');
    }
  }

  /**
   * 批准代币授权
   * @param {Object} options - 授权选项
   * @param {string} options.spender - 被授权者地址
   * @param {string} options.amount - 授权数量
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 授权结果
   */
  async approve(options = {}) {
    const {
      spender,
      amount,
      identityName
    } = options;

    // 参数验证
    this._validateApproveParams(spender, amount);

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      // 连接网络
      await this.connect(currentUser);

      // 执行授权
      const result = await this.invokeTransaction('Approve', spender, amount);

      return {
        success: true,
        message: '授权成功',
        data: {
          owner: currentUser,
          spender: spender,
          amount: parseInt(amount),
          txId: result.toString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: '授权失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 验证授权参数
   * @param {string} spender - 被授权者地址
   * @param {string} amount - 授权数量
   * @private
   */
  _validateApproveParams(spender, amount) {
    if (!spender || typeof spender !== 'string' || spender.trim() === '') {
      throw new Error('被授权者地址不能为空');
    }

    if (!amount || typeof amount !== 'string') {
      throw new Error('授权数量不能为空');
    }

    // 必须为非负整数的字符串
    if (!/^(0|[1-9]\d*)$/.test(amount)) {
      throw new Error('授权数量必须是非负整数');
    }

    const amountNum = Number(amount);
    if (amountNum < 0) {
      throw new Error('授权数量必须是非负整数');
    }
  }

  /**
   * 查询用户交易记录（富查询，支持多条件筛选）
   * @param {Object} options - 查询选项
   * @param {string} options.userId - 用户ID
   * @param {string} options.minAmount - 最小金额（可选）
   * @param {string} options.maxAmount - 最大金额（可选）
   * @param {string} options.transactionType - 交易类型（可选）
   * @param {string} options.counterparty - 交易对手方（可选）
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 查询结果
   */
  async queryUserTransactions(options = {}) {
    const {
      userId,
      minAmount = '0',
      maxAmount = '0',
      transactionType = '',
      counterparty = '',
      identityName
    } = options;

    // 参数验证
    this._validateQueryParams(userId, minAmount, maxAmount);

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      // 连接网络
      await this.connect(currentUser);

      // 执行查询
      const result = await this.evaluateTransaction(
        'QueryUserTransactions',
        userId,
        minAmount,
        maxAmount,
        transactionType,
        counterparty
      );

      // 解析结果
      const queryResult = JSON.parse(result.toString());

      return {
        success: true,
        message: '查询成功',
        data: queryResult
      };
    } catch (error) {
      return {
        success: false,
        message: '查询失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 查询用户交易记录（分页查询，使用偏移量）
   * @param {Object} options - 查询选项
   * @param {string} options.userId - 用户ID
   * @param {string} options.minAmount - 最小金额（可选）
   * @param {string} options.maxAmount - 最大金额（可选）
   * @param {string} options.transactionType - 交易类型（可选）
   * @param {string} options.counterparty - 交易对手方（可选）
   * @param {string} options.pageSize - 页面大小（可选，默认20）
   * @param {string} options.offset - 偏移量（可选，默认0）
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 查询结果
   */
  async queryUserTransactionsWithOffset(options = {}) {
    const {
      userId,
      minAmount = '0',
      maxAmount = '0',
      transactionType = '',
      counterparty = '',
      pageSize = '20',
      offset = '0',
      identityName
    } = options;

    // 参数验证
    this._validateQueryParams(userId, minAmount, maxAmount);
    this._validatePaginationParams(pageSize, offset);

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      // 连接网络
      await this.connect(currentUser);

      // 执行查询
      const result = await this.evaluateTransaction(
        'QueryUserTransactionsWithOffset',
        userId,
        minAmount,
        maxAmount,
        transactionType,
        counterparty,
        pageSize,
        offset
      );

      // 解析结果
      const queryResult = JSON.parse(result.toString());

      return {
        success: true,
        message: '分页查询成功',
        data: queryResult
      };
    } catch (error) {
      return {
        success: false,
        message: '分页查询失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 查询用户交易记录（分页查询，使用书签）
   * @param {Object} options - 查询选项
   * @param {string} options.userId - 用户ID
   * @param {string} options.minAmount - 最小金额（可选）
   * @param {string} options.maxAmount - 最大金额（可选）
   * @param {string} options.transactionType - 交易类型（可选）
   * @param {string} options.counterparty - 交易对手方（可选）
   * @param {string} options.pageSize - 页面大小（可选，默认20）
   * @param {string} options.bookmark - 书签（可选）
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 查询结果
   */
  async queryUserTransactionsWithBookmark(options = {}) {
    const {
      userId,
      minAmount = '0',
      maxAmount = '0',
      transactionType = '',
      counterparty = '',
      pageSize = '20',
      bookmark = '',
      identityName
    } = options;

    // 参数验证
    this._validateQueryParams(userId, minAmount, maxAmount);
    this._validatePaginationParams(pageSize, '0'); // 只验证pageSize

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      // 连接网络
      await this.connect(currentUser);

      // 执行查询
      const result = await this.evaluateTransaction(
        'QueryUserTransactionsWithBookmark',
        userId,
        minAmount,
        maxAmount,
        transactionType,
        counterparty,
        pageSize,
        bookmark
      );

      // 解析结果
      const queryResult = JSON.parse(result.toString());

      return {
        success: true,
        message: '书签分页查询成功',
        data: queryResult
      };
    } catch (error) {
      return {
        success: false,
        message: '书签分页查询失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 获取用户交易历史（分页查询）
   * @param {Object} options - 查询选项
   * @param {string} options.userId - 用户ID
   * @param {string} options.pageSize - 页面大小（可选，默认50）
   * @param {string} options.offset - 偏移量（可选，默认0）
   * @param {string} options.identityName - 身份名称，默认为当前选择的用户
   * @returns {Promise<Object>} 查询结果
   */
  async getUserTransactionHistory(options = {}) {
    const {
      userId,
      pageSize = '50',
      offset = '0',
      identityName
    } = options;

    // 参数验证
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('用户ID不能为空');
    }

    this._validatePaginationParams(pageSize, offset, 1000); // 最大1000

    // 获取当前用户或使用指定用户
    const currentUser = identityName || this.getCurrentUser() || 'admin';
    
    // 显示当前用户信息
    this.showCurrentUserInfo();

    try {
      // 连接网络
      await this.connect(currentUser);

      // 执行查询
      const result = await this.evaluateTransaction(
        'GetUserTransactionHistoryWithPagination',
        userId,
        pageSize,
        offset
      );

      // 解析结果
      const queryResult = JSON.parse(result.toString());

      return {
        success: true,
        message: '交易历史查询成功',
        data: queryResult
      };
    } catch (error) {
      return {
        success: false,
        message: '交易历史查询失败',
        error: error.message
      };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 验证查询参数
   * @param {string} userId - 用户ID
   * @param {string} minAmount - 最小金额
   * @param {string} maxAmount - 最大金额
   * @private
   */
  _validateQueryParams(userId, minAmount, maxAmount) {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('用户ID不能为空');
    }

    if (minAmount && (!/^(0|[1-9]\d*)$/.test(minAmount) || Number(minAmount) < 0)) {
      throw new Error('最小金额必须是非负整数');
    }

    if (maxAmount && (!/^(0|[1-9]\d*)$/.test(maxAmount) || Number(maxAmount) < 0)) {
      throw new Error('最大金额必须是非负整数');
    }

    if (minAmount && maxAmount && Number(minAmount) > Number(maxAmount)) {
      throw new Error('最小金额不能大于最大金额');
    }
  }

  /**
   * 验证分页参数
   * @param {string} pageSize - 页面大小
   * @param {string} offset - 偏移量
   * @param {number} maxPageSize - 最大页面大小（默认100）
   * @private
   */
  _validatePaginationParams(pageSize, offset, maxPageSize = 100) {
    if (pageSize && (!/^[1-9]\d*$/.test(pageSize) || Number(pageSize) < 1 || Number(pageSize) > maxPageSize)) {
      throw new Error(`页面大小必须是1-${maxPageSize}之间的正整数`);
    }

    if (offset && (!/^(0|[1-9]\d*)$/.test(offset) || Number(offset) < 0)) {
      throw new Error('偏移量必须是非负整数');
    }
  }

  /**
   * 获取代币名称
   * @returns {Promise<Object>} 代币名称信息
   */
  async getName() {
    try {
      const nameResult = await this.evaluateTransaction('Name');
      
      return {
        success: true,
        data: {
          name: nameResult.toString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `获取代币名称失败: ${error.message}`
      };
    }
  }

  /**
   * 获取代币符号
   * @returns {Promise<Object>} 代币符号信息
   */
  async getSymbol() {
    try {
      const symbolResult = await this.evaluateTransaction('Symbol');
      
      return {
        success: true,
        data: {
          symbol: symbolResult.toString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `获取代币符号失败: ${error.message}`
      };
    }
  }
}

module.exports = TokenService; 