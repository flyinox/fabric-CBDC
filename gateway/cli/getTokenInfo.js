#!/usr/bin/env node

const TokenService = require('../services/TokenService');

class TokenInfoCLI {
  constructor() {
    this.tokenService = new TokenService();
  }

  // 显示帮助信息
  showHelp() {
    console.log(`
🏛️ CBDC 代币信息查询工具

用法: node getTokenInfo.js [选项]

选项:
  -name, --name        查询代币名称
  -symbol, --symbol    查询代币符号
  -supply, --supply    查询代币总供应量
  -all, --all          查询所有代币信息
  -h, --help           显示此帮助信息

示例:
  node getTokenInfo.js -name
  node getTokenInfo.js -symbol
  node getTokenInfo.js -supply
  node getTokenInfo.js -all
`);
  }

  // 解析命令行参数
  parseArgs() {
    const args = process.argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '-name':
        case '--name':
          options.queryName = true;
          break;
        case '-symbol':
        case '--symbol':
          options.querySymbol = true;
          break;
        case '-supply':
        case '--supply':
          options.querySupply = true;
          break;
        case '-all':
        case '--all':
          options.queryAll = true;
          break;
        case '-h':
        case '--help':
          this.showHelp();
          process.exit(0);
          break;
        default:
          console.error(`未知参数: ${arg}`);
          this.showHelp();
          process.exit(1);
      }
    }

    return options;
  }

  // 执行查询
  async execute() {
    try {
      const options = this.parseArgs();

      // 如果没有指定查询类型，默认查询所有信息
      if (Object.keys(options).length === 0) {
        options.queryAll = true;
      }

      console.log('🔍 开始查询 CBDC 代币信息...\n');

      if (options.queryName || options.queryAll) {
        try {
          const result = await this.tokenService.getName();
          if (result.success) {
            console.log(`✅ 代币名称: ${result.data.name}`);
          } else {
            console.log(`❌ 查询代币名称失败: ${result.error}`);
          }
        } catch (error) {
          console.log(`❌ 查询代币名称异常: ${error.message}`);
        }
      }

      if (options.querySymbol || options.queryAll) {
        try {
          const result = await this.tokenService.getSymbol();
          if (result.success) {
            console.log(`✅ 代币符号: ${result.data.symbol}`);
          } else {
            console.log(`❌ 查询代币符号失败: ${result.error}`);
          }
        } catch (error) {
          console.log(`❌ 查询代币符号异常: ${error.message}`);
        }
      }

      if (options.querySupply || options.queryAll) {
        try {
          const result = await this.tokenService.getTotalSupply();
          if (result.success) {
            console.log(`✅ 代币总供应量: ${result.data.supply}`);
          } else {
            console.log(`❌ 查询代币总供应量失败: ${result.error}`);
          }
        } catch (error) {
          console.log(`❌ 查询代币总供应量异常: ${error.message}`);
        }
      }

      console.log('\n✅ 查询完成');
    } catch (error) {
      console.log('❌ 查询失败:', error.message);
      process.exit(1);
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const cli = new TokenInfoCLI();
  cli.execute();
}

module.exports = TokenInfoCLI;
