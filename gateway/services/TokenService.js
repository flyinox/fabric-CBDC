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
   * @param {string} options.identityName - 身份名称，默认为 'admin'
   * @returns {Promise<Object>} 初始化结果
   */
  async initialize(options = {}) {
    const {
      name = 'Digital Yuan',
      symbol = 'DCEP',
      decimals = '2',
      identityName = 'admin'
    } = options;

    // 参数验证
    this._validateInitParams(name, symbol, decimals);

    try {
      // 连接网络
      await this.connect(identityName);

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
   * @param {string} identityName - 身份名称，默认为 'admin'
   * @returns {Promise<Object>} 代币信息
   */
  async getTokenInfo(identityName = 'admin') {
    try {
      await this.connect(identityName);

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
   * @param {string} options.identityName - 身份名称，默认为 'admin'
   * @returns {Promise<Object>} 铸造结果
   */
  async mint(options = {}) {
    const {
      amount,
      identityName = 'admin'
    } = options;

    // 参数验证
    this._validateMintParams(amount);

    try {
      // 连接网络
      await this.connect(identityName);

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
}

module.exports = TokenService; 