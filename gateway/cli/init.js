#!/usr/bin/env node

const TokenService = require('../services/TokenService');
const readline = require('readline');

class InitCLI {
  constructor() {
    this.tokenService = new TokenService();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // 关闭 readline 接口
  close() {
    this.rl.close();
  }

  // 询问用户输入
  question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  // 解析命令行参数
  parseArgs() {
    const args = process.argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i += 2) {
      const key = args[i];
      const value = args[i + 1];

      switch (key) {
        case '-name':
        case '--name':
          options.name = value;
          break;
        case '-symbol':
        case '--symbol':
          options.symbol = value;
          break;
        case '-decimals':
        case '--decimals':
          options.decimals = value;
          break;
        case '-identity':
        case '--identity':
          options.identityName = value;
          break;
        case '-h':
        case '--help':
          this.showHelp();
          process.exit(0);
          break;
      }
    }

    return options;
  }

  // 显示帮助信息
  showHelp() {
    console.log(`
🏛️ CBDC 代币初始化工具

用法: node init.js [选项]

选项:
  -name, --name <名称>        代币名称 (默认: "Digital Yuan")
  -symbol, --symbol <符号>    代币符号 (默认: "DCEP")
  -decimals, --decimals <位数> 小数位数 (默认: "2")
  -identity, --identity <身份> 身份名称 (默认: "admin")
  -h, --help                  显示此帮助信息

示例:
  node init.js -name "Digital Yuan" -symbol "DCEP" -decimals "2"
  node init.js --name "Test Token" --symbol "TEST" --decimals "4"
  node init.js  # 交互式输入
`);
  }

  // 交互式输入
  async interactiveInput() {
    console.log('🏛️ CBDC 代币初始化工具\n');

    const name = await this.question('请输入代币名称 [默认: Digital Yuan]: ') || 'Digital Yuan';
    const symbol = await this.question('请输入代币符号 [默认: DCEP]: ') || 'DCEP';
    const decimals = await this.question('请输入小数位数 [默认: 2]: ') || '2';

    return { name, symbol, decimals };
  }

  // 验证参数
  validateParams(options) {
    const errors = [];

    if (!options.name || typeof options.name !== 'string' || options.name.trim() === '') {
      errors.push('代币名称不能为空');
    }

    if (!options.symbol || typeof options.symbol !== 'string' || options.symbol.trim() === '') {
      errors.push('代币符号不能为空');
    }

    if (!options.decimals || typeof options.decimals !== 'string') {
      errors.push('小数位数不能为空');
    } else {
      const decimalsNum = parseInt(options.decimals);
      if (isNaN(decimalsNum) || decimalsNum < 0 || decimalsNum > 18) {
        errors.push('小数位数必须是0-18之间的整数');
      }
    }

    if (errors.length > 0) {
      throw new Error(`参数验证失败:\n${errors.join('\n')}`);
    }
  }

  // 执行初始化
  async execute() {
    try {
      // 解析命令行参数
      const options = this.parseArgs();

      // 如果没有提供参数，使用交互式输入
      if (Object.keys(options).length === 0) {
        Object.assign(options, await this.interactiveInput());
      }

      // 验证参数
      this.validateParams(options);

      console.log('🚀 开始初始化 CBDC 代币...');
      console.log(`  名称: ${options.name}`);
      console.log(`  符号: ${options.symbol}`);
      console.log(`  小数位数: ${options.decimals}`);
      console.log('');

      // 执行初始化
      const result = await this.tokenService.initialize(options);

      if (result.success) {
        console.log('✅ 初始化成功!');
        console.log(`   交易ID: ${result.data.txId}`);
        console.log(`   代币名称: ${result.data.name}`);
        console.log(`   代币符号: ${result.data.symbol}`);
        console.log(`   小数位数: ${result.data.decimals}`);
      } else {
        console.log('❌ 初始化失败!');
        console.log(`   错误: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.log('❌ 执行失败!');
      console.log(`   错误: ${error.message}`);
      process.exit(1);
    } finally {
      this.close();
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const cli = new InitCLI();
  cli.execute();
}

module.exports = InitCLI; 