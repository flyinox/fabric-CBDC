#!/usr/bin/env node

const TokenService = require('../services/TokenService');
const readline = require('readline');

class MintCLI {
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
        case '-amount':
        case '--amount':
          options.amount = value;
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
💰 CBDC 代币铸造工具

用法: node mint.js [选项]

选项:
  -amount, --amount <数量>    铸造数量 (必须为正整数)
  -identity, --identity <身份> 身份名称 (默认: "admin")
  -h, --help                  显示此帮助信息

示例:
  node mint.js -amount "10000"
  node mint.js --amount "50000" --identity "admin"
  node mint.js  # 交互式输入

注意: 铸造操作仅限央行执行
`);
  }

  // 交互式输入
  async interactiveInput() {
    console.log('💰 CBDC 代币铸造工具\n');

    const amount = await this.question('请输入铸造数量: ');
    const identityName = await this.question('请输入身份名称 [默认: admin]: ') || 'admin';

    return { amount, identityName };
  }

  // 验证参数
  validateParams(options) {
    const errors = [];

    if (!options.amount || typeof options.amount !== 'string') {
      errors.push('铸造数量不能为空');
    } else {
      // 必须为正整数的字符串
      if (!/^[1-9]\d*$/.test(options.amount)) {
        errors.push('铸造数量必须是正整数');
      } else {
        const amountNum = parseInt(options.amount);
        if (amountNum <= 0) {
          errors.push('铸造数量必须大于0');
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`参数验证失败:\n${errors.join('\n')}`);
    }
  }

  // 执行铸造
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

      console.log('🚀 开始铸造 CBDC 代币...');
      console.log(`  数量: ${options.amount}`);
      console.log(`  身份: ${options.identityName || 'admin'}`);
      console.log('');

      // 执行铸造
      const result = await this.tokenService.mint(options);

      if (result.success) {
        console.log('✅ 铸造成功!');
        console.log(`   交易ID: ${result.data.txId}`);
        console.log(`   铸造数量: ${result.data.amount}`);
      } else {
        console.log('❌ 铸造失败!');
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
  const cli = new MintCLI();
  cli.execute();
}

module.exports = MintCLI; 