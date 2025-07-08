#!/usr/bin/env node

const readline = require('readline');
const TokenService = require('../services/TokenService');

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      case '--type':
      case '-t':
        options.type = args[++i];
        break;
      case '--to':
        options.to = args[++i];
        break;
      case '--from':
        options.from = args[++i];
        break;
      case '--amount':
      case '-a':
        options.amount = args[++i];
        break;
      case '--spender':
        options.spender = args[++i];
        break;
      case '--identity':
      case '-i':
        options.identityName = args[++i];
        break;
      default:
        console.error(`未知参数: ${args[i]}`);
        showHelp();
        process.exit(1);
    }
  }
  
  return options;
}

// 显示帮助信息
function showHelp() {
  console.log(`
🏛️ CBDC 转账工具

用法: node transfer.js [选项]

转账类型 (--type):
  transfer     - 直接转账 (从当前用户到指定接收者)
  transferfrom - 授权转账 (从指定账户到指定接收者，需要授权)
  approve      - 批准授权 (允许指定用户使用自己的代币)

选项:
  -t, --type <类型>      - 转账类型 (必需)
  --to <地址>            - 接收者地址 (transfer/transferfrom)
  --from <地址>          - 发送者地址 (transferfrom)
  --spender <地址>       - 被授权者地址 (approve)
  -a, --amount <数量>    - 转账/授权数量
  -i, --identity <身份>  - 指定身份名称
  -h, --help            - 显示此帮助信息

示例:
  # 直接转账
  node transfer.js -t transfer -to <接收者地址> -a 100

  # 授权转账
  node transfer.js -t transferfrom -from <发送者地址> -to <接收者地址> -a 50

  # 批准授权
  node transfer.js -t approve -spender <被授权者地址> -a 200

  # 交互模式
  node transfer.js
`);
}

// 交互式输入
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// 执行直接转账
async function executeTransfer(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.transfer({
      recipient: options.to,
      amount: options.amount,
      identityName: options.identityName
    });

    if (result.success) {
      console.log('\n✅ 转账成功:');
      console.log('发送者:', result.data.from);
      console.log('接收者:', result.data.to);
      console.log('数量:', result.data.amount);
      console.log('交易ID:', result.data.txId);
    } else {
      console.error('\n❌ 转账失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 转账过程中发生错误:', error.message);
  }
}

// 执行授权转账
async function executeTransferFrom(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.transferFrom({
      from: options.from,
      to: options.to,
      amount: options.amount,
      identityName: options.identityName
    });

    if (result.success) {
      console.log('\n✅ 授权转账成功:');
      console.log('发送者:', result.data.from);
      console.log('接收者:', result.data.to);
      console.log('执行者:', result.data.spender);
      console.log('数量:', result.data.amount);
      console.log('交易ID:', result.data.txId);
    } else {
      console.error('\n❌ 授权转账失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 授权转账过程中发生错误:', error.message);
  }
}

// 执行授权批准
async function executeApprove(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.approve({
      spender: options.spender,
      amount: options.amount,
      identityName: options.identityName
    });

    if (result.success) {
      console.log('\n✅ 授权批准成功:');
      console.log('授权者:', result.data.owner);
      console.log('被授权者:', result.data.spender);
      console.log('授权数量:', result.data.amount);
      console.log('交易ID:', result.data.txId);
    } else {
      console.error('\n❌ 授权批准失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 授权批准过程中发生错误:', error.message);
  }
}

// 交互式转账
async function interactiveTransfer() {
  console.log('\n🏛️ CBDC 转账工具 (交互模式)');
  console.log('请选择转账类型:');
  console.log('1. 直接转账 (从当前用户到指定接收者)');
  console.log('2. 授权转账 (从指定账户到指定接收者，需要授权)');
  console.log('3. 批准授权 (允许指定用户使用自己的代币)');
  console.log('0. 退出');

  const choice = await askQuestion('\n请输入选择 (0-3): ');

  switch (choice) {
    case '1':
      await interactiveDirectTransfer();
      break;
    case '2':
      await interactiveTransferFrom();
      break;
    case '3':
      await interactiveApprove();
      break;
    case '0':
      console.log('再见!');
      rl.close();
      return;
    default:
      console.log('无效选择，请重新输入');
      await interactiveTransfer();
      return;
  }

  // 询问是否继续
  const continueChoice = await askQuestion('\n是否继续转账？(y/n): ');
  if (continueChoice.toLowerCase() === 'y' || continueChoice.toLowerCase() === 'yes') {
    await interactiveTransfer();
  } else {
    console.log('再见!');
    rl.close();
  }
}

// 交互式直接转账
async function interactiveDirectTransfer() {
  console.log('\n💸 直接转账');
  
  const to = await askQuestion('请输入接收者地址: ');
  if (!to) {
    console.log('❌ 接收者地址不能为空');
    return;
  }
  
  const amount = await askQuestion('请输入转账数量: ');
  if (!amount) {
    console.log('❌ 转账数量不能为空');
    return;
  }
  
  await executeTransfer({ to, amount });
}

// 交互式授权转账
async function interactiveTransferFrom() {
  console.log('\n🔐 授权转账');
  
  const from = await askQuestion('请输入发送者地址: ');
  if (!from) {
    console.log('❌ 发送者地址不能为空');
    return;
  }
  
  const to = await askQuestion('请输入接收者地址: ');
  if (!to) {
    console.log('❌ 接收者地址不能为空');
    return;
  }
  
  const amount = await askQuestion('请输入转账数量: ');
  if (!amount) {
    console.log('❌ 转账数量不能为空');
    return;
  }
  
  await executeTransferFrom({ from, to, amount });
}

// 交互式授权批准
async function interactiveApprove() {
  console.log('\n✅ 批准授权');
  
  const spender = await askQuestion('请输入被授权者地址: ');
  if (!spender) {
    console.log('❌ 被授权者地址不能为空');
    return;
  }
  
  const amount = await askQuestion('请输入授权数量: ');
  if (!amount) {
    console.log('❌ 授权数量不能为空');
    return;
  }
  
  await executeApprove({ spender, amount });
}

// 主函数
async function main() {
  const options = parseArgs();
  
  if (!options.type) {
    // 如果没有指定类型，进入交互模式
    await interactiveTransfer();
    return;
  }

  // 根据类型执行相应的转账
  switch (options.type.toLowerCase()) {
    case 'transfer':
      if (!options.to || !options.amount) {
        console.error('❌ 直接转账需要提供 --to 和 --amount 参数');
        process.exit(1);
      }
      await executeTransfer(options);
      break;
    case 'transferfrom':
      if (!options.from || !options.to || !options.amount) {
        console.error('❌ 授权转账需要提供 --from、--to 和 --amount 参数');
        process.exit(1);
      }
      await executeTransferFrom(options);
      break;
    case 'approve':
      if (!options.spender || !options.amount) {
        console.error('❌ 授权批准需要提供 --spender 和 --amount 参数');
        process.exit(1);
      }
      await executeApprove(options);
      break;
    default:
      console.error(`❌ 未知的转账类型: ${options.type}`);
      showHelp();
      process.exit(1);
  }

  rl.close();
}

// 如果直接运行此脚本，则执行主函数
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 程序执行失败:', error.message);
    process.exit(1);
  });
}

module.exports = {
  executeTransfer,
  executeTransferFrom,
  executeApprove
}; 