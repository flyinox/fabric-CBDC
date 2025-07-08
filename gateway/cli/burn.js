#!/usr/bin/env node

const readline = require('readline');
const TokenService = require('../services/TokenService');

class BurnCLI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.tokenService = new TokenService();
  }

  close() {
    this.rl.close();
  }

  question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  // 显示帮助信息
  showHelp() {
    console.log(`
🔥 CBDC 代币销毁工具

用法: node burn.js [选项]

选项:
  -amount <数量>    指定销毁数量
  -h, --help        显示此帮助信息

示例:
  node burn.js -amount 1000
  node burn.js  # 交互式输入
`);
  }

  // 解析命令行参数
  parseArgs() {
    const args = process.argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '-amount':
          if (i + 1 < args.length) {
            options.amount = args[i + 1];
            i++;
          } else {
            console.log('❌ 请指定销毁数量');
            return null;
          }
          break;

        case '-h':
        case '--help':
          this.showHelp();
          return null;

        default:
          console.log(`❌ 未知参数: ${arg}`);
          this.showHelp();
          return null;
      }
    }

    return options;
  }

  // 交互式输入
  async interactiveInput() {
    console.log('🔥 CBDC 代币销毁工具\n');

    const amount = await this.question('请输入销毁数量: ');

    return { amount };
  }

  // 验证参数
  validateOptions(options) {
    if (!options.amount) {
      console.log('❌ 销毁数量不能为空');
      return false;
    }

    if (!/^\d+$/.test(options.amount)) {
      console.log('❌ 销毁数量必须是正整数');
      return false;
    }

    const numAmount = parseInt(options.amount);
    if (numAmount <= 0) {
      console.log('❌ 销毁数量必须大于0');
      return false;
    }

    return true;
  }

  // 执行销毁
  async execute() {
    try {
      // 解析命令行参数
      let options = this.parseArgs();

      if (options === null) {
        return;
      }

      // 如果没有提供参数，使用交互式输入
      if (!options.amount) {
        options = await this.interactiveInput();
      }

      // 验证参数
      if (!this.validateOptions(options)) {
        return;
      }

      console.log('🚀 开始销毁 CBDC 代币...');
      console.log(`  数量: ${options.amount}`);
      console.log('');

      // 执行销毁
      const result = await this.tokenService.burn(options);

      if (result.success) {
        console.log('✅ 销毁成功!');
        console.log(`   交易ID: ${result.data.txId}`);
        console.log(`   销毁数量: ${result.data.amount}`);
      } else {
        console.log('❌ 销毁失败!');
        console.log(`   错误: ${result.error}`);
      }

    } catch (error) {
      console.log('❌ 执行失败:', error.message);
    } finally {
      this.close();
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const cli = new BurnCLI();
  cli.execute();
}

module.exports = BurnCLI; 