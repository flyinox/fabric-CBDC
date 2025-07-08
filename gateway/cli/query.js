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
      case '--minamount':
        options.minAmount = args[++i];
        break;
      case '--maxamount':
        options.maxAmount = args[++i];
        break;
      case '--transactiontype':
        options.transactionType = args[++i];
        break;
      case '--counterparty':
        options.counterparty = args[++i];
        break;
      case '--pagesize':
        options.pageSize = args[++i];
        break;
      case '--offset':
        options.offset = args[++i];
        break;
      case '--bookmark':
        options.bookmark = args[++i];
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
🔍 CBDC 富查询工具

用法: node query.js [选项]

查询类型 (--type):
  transactions     - 查询用户交易记录（富查询，支持多条件筛选）
  transactionspage - 查询用户交易记录（分页查询，使用偏移量）
  transactionsbookmark - 查询用户交易记录（分页查询，使用书签）
  history          - 获取用户交易历史（分页查询）

选项:
  -t, --type <类型>           - 查询类型 (必需)
  -u, --userid <用户ID>       - 用户ID (必需)
  --minamount <金额>          - 最小金额 (可选)
  --maxamount <金额>          - 最大金额 (可选)
  --transactiontype <类型>    - 交易类型 (可选)
  --counterparty <对手方>     - 交易对手方 (可选)
  --pagesize <数量>           - 页面大小 (分页查询，可选)
  --offset <数量>             - 偏移量 (分页查询，可选)
  --bookmark <书签>           - 书签 (书签分页查询，可选)
  -i, --identity <身份>       - 指定身份名称
  -h, --help                 - 显示此帮助信息

示例:
  # 基础富查询
  node query.js -t transactions -u <用户ID> --minamount 100 --maxamount 1000 --transactiontype transfer

  # 分页查询
  node query.js -t transactionspage -u <用户ID> --pagesize 20 --offset 0

  # 书签分页查询
  node query.js -t transactionsbookmark -u <用户ID> --pagesize 15 --bookmark <书签>

  # 交易历史查询
  node query.js -t history -u <用户ID> --pagesize 50 --offset 0

  # 交互模式
  node query.js
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

// 执行基础富查询
async function executeTransactionsQuery(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.queryUserTransactions({
      userId: options.userId,
      minAmount: options.minAmount,
      maxAmount: options.maxAmount,
      transactionType: options.transactionType,
      counterparty: options.counterparty,
      identityName: options.identityName
    });

    if (result.success) {
      console.log('\n✅ 查询成功:');
      console.log('用户ID:', result.data.userID);
      console.log('查询条件:', JSON.stringify(result.data.queryConditions, null, 2));
      console.log('总记录数:', result.data.totalCount);
      console.log('交易记录:', JSON.stringify(result.data.transactions, null, 2));
    } else {
      console.error('\n❌ 查询失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 查询过程中发生错误:', error.message);
  }
}

// 执行分页查询
async function executeTransactionsPageQuery(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.queryUserTransactionsWithOffset({
      userId: options.userId,
      minAmount: options.minAmount,
      maxAmount: options.maxAmount,
      transactionType: options.transactionType,
      counterparty: options.counterparty,
      pageSize: options.pageSize,
      offset: options.offset,
      identityName: options.identityName
    });

    if (result.success) {
      console.log('\n✅ 分页查询成功:');
      console.log('用户ID:', result.data.userID);
      console.log('查询条件:', JSON.stringify(result.data.queryConditions, null, 2));
      console.log('分页信息:', JSON.stringify(result.data.pagination, null, 2));
      console.log('总记录数:', result.data.totalCount);
      console.log('当前页记录数:', result.data.transactions.length);
      console.log('交易记录:', JSON.stringify(result.data.transactions, null, 2));
    } else {
      console.error('\n❌ 分页查询失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 分页查询过程中发生错误:', error.message);
  }
}

// 执行书签分页查询
async function executeTransactionsBookmarkQuery(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.queryUserTransactionsWithBookmark({
      userId: options.userId,
      minAmount: options.minAmount,
      maxAmount: options.maxAmount,
      transactionType: options.transactionType,
      counterparty: options.counterparty,
      pageSize: options.pageSize,
      bookmark: options.bookmark,
      identityName: options.identityName
    });

    if (result.success) {
      console.log('\n✅ 书签分页查询成功:');
      console.log('用户ID:', result.data.userID);
      console.log('查询条件:', JSON.stringify(result.data.queryConditions, null, 2));
      console.log('分页信息:', JSON.stringify(result.data.pagination, null, 2));
      console.log('总记录数:', result.data.totalCount);
      console.log('当前页记录数:', result.data.transactions.length);
      console.log('下一页书签:', result.data.pagination?.nextBookmark || '无');
      console.log('交易记录:', JSON.stringify(result.data.transactions, null, 2));
    } else {
      console.error('\n❌ 书签分页查询失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 书签分页查询过程中发生错误:', error.message);
  }
}

// 执行交易历史查询
async function executeHistoryQuery(options) {
  const tokenService = new TokenService();
  
  try {
    const result = await tokenService.getUserTransactionHistory({
      userId: options.userId,
      pageSize: options.pageSize,
      offset: options.offset,
      identityName: options.identityName
    });

    if (result.success) {
      console.log('\n✅ 交易历史查询成功:');
      console.log('用户ID:', result.data.userID);
      console.log('分页信息:', JSON.stringify(result.data.pagination, null, 2));
      console.log('总记录数:', result.data.totalCount);
      console.log('当前页记录数:', result.data.transactions.length);
      console.log('交易记录:', JSON.stringify(result.data.transactions, null, 2));
    } else {
      console.error('\n❌ 交易历史查询失败:', result.message);
      if (result.error) {
        console.error('错误详情:', result.error);
      }
    }
  } catch (error) {
    console.error('\n❌ 交易历史查询过程中发生错误:', error.message);
  }
}

// 交互式查询
async function interactiveQuery() {
  console.log('\n🔍 CBDC 富查询工具 (交互模式)');
  console.log('请选择查询类型:');
  console.log('1. 基础富查询 (支持多条件筛选)');
  console.log('2. 分页查询 (使用偏移量)');
  console.log('3. 书签分页查询 (使用书签)');
  console.log('4. 交易历史查询 (简化分页)');
  console.log('0. 退出');

  const choice = await askQuestion('\n请输入选择 (0-4): ');

  switch (choice) {
    case '1':
      await interactiveTransactionsQuery();
      break;
    case '2':
      await interactiveTransactionsPageQuery();
      break;
    case '3':
      await interactiveTransactionsBookmarkQuery();
      break;
    case '4':
      await interactiveHistoryQuery();
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

// 交互式基础富查询
async function interactiveTransactionsQuery() {
  console.log('\n🔍 基础富查询');
  
  const userId = await askQuestion('请输入用户ID: ');
  if (!userId) {
    console.log('❌ 用户ID不能为空');
    return;
  }
  
  const minAmount = await askQuestion('请输入最小金额 (可选，直接回车跳过): ');
  const maxAmount = await askQuestion('请输入最大金额 (可选，直接回车跳过): ');
  const transactionType = await askQuestion('请输入交易类型 (可选，直接回车跳过): ');
  const counterparty = await askQuestion('请输入交易对手方 (可选，直接回车跳过): ');
  
  await executeTransactionsQuery({
    userId,
    minAmount: minAmount || undefined,
    maxAmount: maxAmount || undefined,
    transactionType: transactionType || undefined,
    counterparty: counterparty || undefined
  });
}

// 交互式分页查询
async function interactiveTransactionsPageQuery() {
  console.log('\n📄 分页查询');
  
  const userId = await askQuestion('请输入用户ID: ');
  if (!userId) {
    console.log('❌ 用户ID不能为空');
    return;
  }
  
  const minAmount = await askQuestion('请输入最小金额 (可选，直接回车跳过): ');
  const maxAmount = await askQuestion('请输入最大金额 (可选，直接回车跳过): ');
  const transactionType = await askQuestion('请输入交易类型 (可选，直接回车跳过): ');
  const counterparty = await askQuestion('请输入交易对手方 (可选，直接回车跳过): ');
  
  const pageSize = await askQuestion('请输入页面大小 (默认20，最大100): ');
  const offset = await askQuestion('请输入偏移量 (默认0): ');
  
  await executeTransactionsPageQuery({
    userId,
    minAmount: minAmount || undefined,
    maxAmount: maxAmount || undefined,
    transactionType: transactionType || undefined,
    counterparty: counterparty || undefined,
    pageSize: pageSize || '20',
    offset: offset || '0'
  });
}

// 交互式书签分页查询
async function interactiveTransactionsBookmarkQuery() {
  console.log('\n🔖 书签分页查询');
  
  const userId = await askQuestion('请输入用户ID: ');
  if (!userId) {
    console.log('❌ 用户ID不能为空');
    return;
  }
  
  const minAmount = await askQuestion('请输入最小金额 (可选，直接回车跳过): ');
  const maxAmount = await askQuestion('请输入最大金额 (可选，直接回车跳过): ');
  const transactionType = await askQuestion('请输入交易类型 (可选，直接回车跳过): ');
  const counterparty = await askQuestion('请输入交易对手方 (可选，直接回车跳过): ');
  
  const pageSize = await askQuestion('请输入页面大小 (默认20，最大100): ');
  const bookmark = await askQuestion('请输入书签 (可选，直接回车跳过): ');
  
  await executeTransactionsBookmarkQuery({
    userId,
    minAmount: minAmount || undefined,
    maxAmount: maxAmount || undefined,
    transactionType: transactionType || undefined,
    counterparty: counterparty || undefined,
    pageSize: pageSize || '20',
    bookmark: bookmark || undefined
  });
}

// 交互式交易历史查询
async function interactiveHistoryQuery() {
  console.log('\n📜 交易历史查询');
  
  const userId = await askQuestion('请输入用户ID: ');
  if (!userId) {
    console.log('❌ 用户ID不能为空');
    return;
  }
  
  const pageSize = await askQuestion('请输入页面大小 (默认50，最大1000): ');
  const offset = await askQuestion('请输入偏移量 (默认0): ');
  
  await executeHistoryQuery({
    userId,
    pageSize: pageSize || '50',
    offset: offset || '0'
  });
}

// 主函数
async function main() {
  const options = parseArgs();
  
  if (!options.type) {
    // 如果没有指定类型，进入交互模式
    await interactiveQuery();
    return;
  }

  // 验证必需参数
  if (!options.userId) {
    console.error('❌ 用户ID是必需参数');
    process.exit(1);
  }

  // 根据类型执行相应的查询
  switch (options.type.toLowerCase()) {
    case 'transactions':
      await executeTransactionsQuery(options);
      break;
    case 'transactionspage':
      await executeTransactionsPageQuery(options);
      break;
    case 'transactionsbookmark':
      await executeTransactionsBookmarkQuery(options);
      break;
    case 'history':
      await executeHistoryQuery(options);
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
  executeTransactionsQuery,
  executeTransactionsPageQuery,
  executeTransactionsBookmarkQuery,
  executeHistoryQuery
}; 