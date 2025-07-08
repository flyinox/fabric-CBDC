#!/usr/bin/env node

const { BaseService } = require('../services/BaseService');
const { TokenService } = require('../services/TokenService');

class TokenCLI {
  constructor(baseService = null, tokenService = null) {
    this.baseService = baseService || new BaseService();
    this.tokenService = tokenService || new TokenService();
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log('🔍 CBDC 代币信息查询工具');
    console.log();
    console.log('用法:');
    console.log('  node token.js [选项] [子命令]');
    console.log();
    console.log('子命令:');
    console.log('  name     - 查询代币名称');
    console.log('  symbol   - 查询代币符号');
    console.log('  supply   - 查询代币总供应量');
    console.log('  info     - 查询代币完整信息（名称、符号、总供应量）');
    console.log('  help     - 显示此帮助信息');
    console.log();
    console.log('选项:');
    console.log('  -identityName <身份名>  - 指定身份名称');
    console.log();
    console.log('示例:');
    console.log('  node token.js name');
    console.log('  node token.js symbol');
    console.log('  node token.js supply');
    console.log('  node token.js info');
    console.log('  node token.js -identityName CentralBank_Admin name');
    console.log();
    console.log('注意:');
    console.log('  - 如果不提供子命令，将进入交互模式');
    console.log('  - 所有查询操作都是只读的，不需要特殊权限');
  }

  /**
   * 查询代币名称
   */
  async queryName() {
    try {
      console.log('🔍 查询代币名称...');
      
      const result = await this.tokenService.getName();
      
      if (result.success) {
        console.log('✅ 查询成功');
        console.log(`   代币名称: ${result.data.name}`);
      } else {
        console.log('❌ 查询失败');
        console.log(`   错误: ${result.error}`);
      }
    } catch (error) {
      console.log('❌ 查询失败');
      console.log(`   错误: ${error.message}`);
    }
  }

  /**
   * 查询代币符号
   */
  async querySymbol() {
    try {
      console.log('🔍 查询代币符号...');
      
      const result = await this.tokenService.getSymbol();
      
      if (result.success) {
        console.log('✅ 查询成功');
        console.log(`   代币符号: ${result.data.symbol}`);
      } else {
        console.log('❌ 查询失败');
        console.log(`   错误: ${result.error}`);
      }
    } catch (error) {
      console.log('❌ 查询失败');
      console.log(`   错误: ${error.message}`);
    }
  }

  /**
   * 查询代币总供应量
   */
  async querySupply() {
    try {
      console.log('🔍 查询代币总供应量...');
      
      const result = await this.tokenService.getTotalSupply();
      
      if (result.success) {
        console.log('✅ 查询成功');
        console.log(`   总供应量: ${result.data.totalSupply}`);
      } else {
        console.log('❌ 查询失败');
        console.log(`   错误: ${result.error}`);
      }
    } catch (error) {
      console.log('❌ 查询失败');
      console.log(`   错误: ${error.message}`);
    }
  }

  /**
   * 查询代币完整信息
   */
  async queryInfo() {
    try {
      console.log('🔍 查询代币完整信息...');
      
      const [nameResult, symbolResult, supplyResult] = await Promise.all([
        this.tokenService.getName(),
        this.tokenService.getSymbol(),
        this.tokenService.getTotalSupply()
      ]);
      
      console.log('✅ 查询成功');
      console.log();
      console.log('📋 代币信息:');
      
      if (nameResult.success) {
        console.log(`   名称: ${nameResult.data.name}`);
      } else {
        console.log(`   名称: 查询失败 - ${nameResult.error}`);
      }
      
      if (symbolResult.success) {
        console.log(`   符号: ${symbolResult.data.symbol}`);
      } else {
        console.log(`   符号: 查询失败 - ${symbolResult.error}`);
      }
      
      if (supplyResult.success) {
        console.log(`   总供应量: ${supplyResult.data.totalSupply}`);
      } else {
        console.log(`   总供应量: 查询失败 - ${supplyResult.error}`);
      }
    } catch (error) {
      console.log('❌ 查询失败');
      console.log(`   错误: ${error.message}`);
    }
  }

  /**
   * 交互式查询
   */
  async interactiveQuery() {
    console.log('🔍 CBDC 代币信息查询工具');
    console.log();
    console.log('请选择要查询的信息:');
    console.log('1. 代币名称');
    console.log('2. 代币符号');
    console.log('3. 代币总供应量');
    console.log('4. 代币完整信息');
    console.log('5. 退出');
    console.log();
    
    const choice = await this.baseService.question('请输入选择 (1-5): ');
    
    switch (choice.trim()) {
      case '1':
        await this.queryName();
        break;
      case '2':
        await this.querySymbol();
        break;
      case '3':
        await this.querySupply();
        break;
      case '4':
        await this.queryInfo();
        break;
      case '5':
        console.log('👋 再见！');
        return;
      default:
        console.log('❌ 无效选择，请重新输入');
        await this.interactiveQuery();
        return;
    }
    
    console.log();
    const continueChoice = await this.baseService.question('是否继续查询？(y/n): ');
    if (continueChoice.toLowerCase() === 'y' || continueChoice.toLowerCase() === 'yes') {
      await this.interactiveQuery();
    } else {
      console.log('👋 再见！');
    }
  }

  /**
   * 解析命令行参数
   */
  parseArgs(args) {
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const value = args[i + 1];
      
      switch (arg) {
        case '-identityName':
        case '--identityName':
          options.identityName = value;
          i++;
          break;
        case '-h':
        case '--help':
        case 'help':
          options.help = true;
          break;
        default:
          if (!options.command) {
            options.command = arg;
          }
          break;
      }
    }
    
    return options;
  }

  /**
   * 主执行函数
   */
  async execute(args) {
    const options = this.parseArgs(args);
    
    // 显示帮助信息
    if (options.help) {
      this.showHelp();
      return;
    }
    
    // 设置身份
    if (options.identityName) {
      this.baseService.setIdentityName(options.identityName);
      this.tokenService.setIdentityName(options.identityName);
    }
    
    // 显示当前用户
    const currentUser = this.baseService.getCurrentUser();
    if (currentUser) {
      console.log(`👤 当前用户: ${currentUser}`);
      console.log();
    }
    
    // 执行命令
    switch (options.command) {
      case 'name':
        await this.queryName();
        break;
      case 'symbol':
        await this.querySymbol();
        break;
      case 'supply':
        await this.querySupply();
        break;
      case 'info':
        await this.queryInfo();
        break;
      default:
        // 如果没有指定命令，进入交互模式
        await this.interactiveQuery();
        break;
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const cli = new TokenCLI();
  cli.execute(process.argv.slice(2)).catch(error => {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  });
}

module.exports = { TokenCLI }; 