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
      case '--userid':
      case '-u':
        options.userId = args[++i];
        break;
      case '--account':
      case '-a':
        options.account = args[++i];
        break;
      case '--owner':
        options.owner = args[++i];
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
🏛️ CBDC 账户信息查询工具

用法: node account.js [选项]

查询类型 (--type):
  account     - 查询账户信息 (包含余额和组织MSP)
  userinfo    - 查询用户基本信息 (身份信息)
  balance     - 查询账户余额
  accountid   - 查询客户端账户ID
  allowance   - 查询授权额度

选项:
  -t, --type <类型>      - 查询类型 (必需)
  -u, --userid <用户ID>  - 指定用户ID (account类型)
  -a, --account <地址>   - 指定账户地址 (balance类型)
  --owner <地址>         - 授权者地址 (allowance类型)
  --spender <地址>       - 被授权者地址 (allowance类型)
  -i, --identity <身份>  - 指定身份名称
  -h, --help            - 显示此帮助信息

示例:
  # 查询当前客户端账户信息
  node account.js -t account

  # 查询指定用户账户信息
  node account.js -t account -u <用户ID>

  # 查询当前客户端余额
  node account.js -t balance

  # 查询指定账户余额
  node account.js -t balance -a <账户地址>

  # 查询用户基本信息
  node account.js -t userinfo

  # 查询客户端账户ID
  node account.js -t accountid

  # 查询授权额度
  node account.js -t allowance --owner <授权者> --spender <被授权者>
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

// 查询账户信息
async function queryAccountInfo(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.getAccountInfo({
      userId: options.userId,
      identityName: options.identityName
    });

    if (result.success) {
      console.log('\n✅ 账户信息查询成功:');
      console.log('用户ID:', result.data.userId);
      console.log('余额:', result.data.balance);
      console.log('组织MSP:', result.data.orgMsp);
    } else {
      console.error('\n❌ 账户信息查询失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 查询过程中发生错误:', error.message);
  }
}

// 查询用户信息
async function queryUserInfo(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.getUserInfo(options.identityName);

    if (result.success) {
      console.log('\n✅ 用户信息查询成功:');
      console.log('客户端ID:', result.data.clientId);
      console.log('用户名:', result.data.userName);
      console.log('组织名:', result.data.orgName);
      console.log('组织单元:', result.data.orgUnit);
      console.log('MSP ID:', result.data.mspId);
      console.log('交易ID:', result.data.txId);
      console.log('通道ID:', result.data.channelId);
    } else {
      console.error('\n❌ 用户信息查询失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 查询过程中发生错误:', error.message);
  }
}

// 查询余额
async function queryBalance(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.getBalance({
      account: options.account,
      identityName: options.identityName
    });

    if (result.success) {
      console.log('\n✅ 余额查询成功:');
      console.log('账户:', result.data.account);
      console.log('余额:', result.data.balance);
    } else {
      console.error('\n❌ 余额查询失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 查询过程中发生错误:', error.message);
  }
}

// 查询账户ID
async function queryAccountId(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.getClientAccountId(options.identityName);

    if (result.success) {
      console.log('\n✅ 账户ID查询成功:');
      console.log('账户ID:', result.data.accountId);
    } else {
      console.error('\n❌ 账户ID查询失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 查询过程中发生错误:', error.message);
  }
}

// 查询授权额度
async function queryAllowance(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.getAllowance({
      owner: options.owner,
      spender: options.spender,
      identityName: options.identityName
    });

    if (result.success) {
      console.log('\n✅ 授权额度查询成功:');
      console.log('授权者:', result.data.owner);
      console.log('被授权者:', result.data.spender);
      console.log('授权额度:', result.data.allowance);
    } else {
      console.error('\n❌ 授权额度查询失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 查询过程中发生错误:', error.message);
  }
}

// 交互式查询
async function interactiveQuery() {
  console.log('\n🏛️ CBDC 账户信息查询工具 (交互模式)');
  console.log('请选择查询类型:');
  console.log('1. 账户信息 (包含余额和组织MSP)');
  console.log('2. 用户基本信息 (身份信息)');
  console.log('3. 账户余额');
  console.log('4. 客户端账户ID');
  console.log('5. 授权额度');
  console.log('0. 退出');

  const choice = await askQuestion('\n请输入选择 (0-5): ');

  switch (choice) {
    case '1':
      await interactiveAccountInfo();
      break;
    case '2':
      await interactiveUserInfo();
      break;
    case '3':
      await interactiveBalance();
      break;
    case '4':
      await interactiveAccountId();
      break;
    case '5':
      await interactiveAllowance();
      break;
    case '0':
      console.log('再见!');
      rl.close();
      return;
    default:
      console.log('无效选择，请重新输入');
      await interactiveQuery();
      return;
  }

  // 询问是否继续
  const continueChoice = await askQuestion('\n是否继续查询？(y/n): ');
  if (continueChoice.toLowerCase() === 'y' || continueChoice.toLowerCase() === 'yes') {
    await interactiveQuery();
  } else {
    console.log('再见!');
    rl.close();
  }
}

// 交互式账户信息查询
async function interactiveAccountInfo() {
  console.log('\n📋 账户信息查询');
  
  const userId = await askQuestion('请输入用户ID (留空查询当前客户端): ');
  
  await queryAccountInfo({ userId: userId || undefined });
}

// 交互式用户信息查询
async function interactiveUserInfo() {
  console.log('\n👤 用户信息查询');
  
  await queryUserInfo({});
}

// 交互式余额查询
async function interactiveBalance() {
  console.log('\n💰 余额查询');
  
  const account = await askQuestion('请输入账户地址 (留空查询当前客户端): ');
  
  await queryBalance({ account: account || undefined });
}

// 交互式账户ID查询
async function interactiveAccountId() {
  console.log('\n🆔 账户ID查询');
  
  await queryAccountId({});
}

// 交互式授权额度查询
async function interactiveAllowance() {
  console.log('\n🔐 授权额度查询');
  
  const owner = await askQuestion('请输入授权者地址: ');
  if (!owner) {
    console.log('❌ 授权者地址不能为空');
    return;
  }
  
  const spender = await askQuestion('请输入被授权者地址: ');
  if (!spender) {
    console.log('❌ 被授权者地址不能为空');
    return;
  }
  
  await queryAllowance({ owner, spender });
}

// 主函数
async function main() {
  const options = parseArgs();
  
  if (!options.type) {
    // 如果没有指定类型，进入交互模式
    await interactiveQuery();
    return;
  }

  // 根据类型执行相应的查询
  switch (options.type.toLowerCase()) {
    case 'account':
      await queryAccountInfo(options);
      break;
    case 'userinfo':
      await queryUserInfo(options);
      break;
    case 'balance':
      await queryBalance(options);
      break;
    case 'accountid':
      await queryAccountId(options);
      break;
    case 'allowance':
      if (!options.owner || !options.spender) {
        console.error('❌ 授权额度查询需要提供 --owner 和 --spender 参数');
        process.exit(1);
      }
      await queryAllowance(options);
      break;
    default:
      console.error(`❌ 未知的查询类型: ${options.type}`);
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
  queryAccountInfo,
  queryUserInfo,
  queryBalance,
  queryAccountId,
  queryAllowance
}; 