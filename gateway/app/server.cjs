const Koa = require('koa');
const Router = require('@koa/router');
const fs = require('fs');
const path = require('path');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
const { spawn } = require('child_process');
const TokenService = require('../services/TokenService');

const app = new Koa();
const router = new Router();

const WALLET_DIR = path.resolve(__dirname, '../wallet');
const CONFIG_PATH = path.resolve(__dirname, '../../network-config.json');

// 获取网络配置信息
router.get('/api/network-config', async (ctx) => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const config = JSON.parse(configContent);
      ctx.body = config;
    } else {
      ctx.status = 404;
      ctx.body = { error: '网络配置文件不存在' };
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '读取网络配置失败', details: error.message };
  }
});

// 获取所有钱包账户基本信息
router.get('/api/wallets', async (ctx) => {
  const files = fs.readdirSync(WALLET_DIR).filter(f => f.endsWith('.id'));
  const wallets = files.map(f => {
    const content = fs.readFileSync(path.join(WALLET_DIR, f), 'utf-8');
    try {
      const json = JSON.parse(content);
      return {
        file: f,
        orgName: json.orgName,
        orgType: json.orgType,
        userName: json.userName,
        fullName: json.fullName,
        mspId: json.mspId,
        type: json.type,
        version: json.version
      };
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
  ctx.body = { wallets };
});

// 获取用户余额
router.get('/api/balance/:identityName', async (ctx) => {
  const { identityName } = ctx.params;
  
  try {
    // 使用CLI工具查询余额
    const result = await new Promise((resolve, reject) => {
      const child = spawn('node', ['../cli/query.js', '--type', 'balance', '--identity', identityName], {
        cwd: path.resolve(__dirname, '../cli'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          try {
            // 尝试解析JSON输出
            const lines = stdout.trim().split('\n');
            const jsonLine = lines.find(line => line.startsWith('{'));
            if (jsonLine) {
              resolve(JSON.parse(jsonLine));
            } else {
              resolve({ success: true, data: { balance: 0 } });
            }
          } catch (e) {
            resolve({ success: true, data: { balance: 0 } });
          }
        } else {
          reject(new Error(stderr || '查询余额失败'));
        }
      });
    });
    
    ctx.body = result;
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '查询余额失败',
      error: error.message
    };
  }
});

// 批量获取用户余额
router.post('/api/balances', async (ctx) => {
  const { identityNames } = ctx.request.body;
  
  if (!Array.isArray(identityNames)) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'identityNames必须是数组' };
    return;
  }
  
  try {
    const balances = {};
    
    for (const identityName of identityNames) {
      try {
        const result = await new Promise((resolve, reject) => {
          const child = spawn('node', ['../cli/query.js', '--type', 'balance', '--identity', identityName], {
            cwd: path.resolve(__dirname, '../cli'),
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let stdout = '';
          let stderr = '';
          
          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          child.on('close', (code) => {
            if (code === 0) {
              try {
                const lines = stdout.trim().split('\n');
                const jsonLine = lines.find(line => line.startsWith('{'));
                if (jsonLine) {
                  resolve(JSON.parse(jsonLine));
                } else {
                  resolve({ success: true, data: { balance: 0 } });
                }
              } catch (e) {
                resolve({ success: true, data: { balance: 0 } });
              }
            } else {
              reject(new Error(stderr || '查询余额失败'));
            }
          });
        });
        
        balances[identityName] = result.success ? result.data.balance : 0;
      } catch (error) {
        balances[identityName] = 0;
      }
    }
    
    ctx.body = {
      success: true,
      data: { balances }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '批量查询余额失败',
      error: error.message
    };
  }
});

// 获取用户账户ID
router.get('/api/account/:identityName', async (ctx) => {
  const { identityName } = ctx.params;
  
  try {
    const tokenService = new TokenService();
    const result = await tokenService.getClientAccountId(identityName);
    
    ctx.body = result;
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '查询账户ID失败',
      error: error.message
    };
  }
});

// 查询所有交易记录（根据用户角色权限控制）
router.post('/api/all-transactions', async (ctx) => {
  const { 
    identityName, 
    minAmount = '0', 
    maxAmount = '0', 
    transactionType = '', 
    counterparty = '',
    pageSize = '20',
    offset = '0'
  } = ctx.request.body;
  
  if (!identityName) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'identityName是必需的' };
    return;
  }
  
  try {
    const tokenService = new TokenService();
    const result = await tokenService.queryAllTransactions({
      minAmount,
      maxAmount,
      transactionType,
      counterparty,
      pageSize,
      offset,
      identityName
    });
    
    ctx.body = result;
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '查询所有交易记录失败',
      error: error.message
    };
  }
});

// 查询用户交易记录
router.post('/api/transactions', async (ctx) => {
  const { 
    userId, 
    identityName, 
    minAmount = '0', 
    maxAmount = '0', 
    transactionType = '', 
    counterparty = '',
    pageSize = '20',
    offset = '0',
    queryType = 'transactions'
  } = ctx.request.body;
  
  if (!userId) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'userId是必需的' };
    return;
  }
  
  try {
    const tokenService = new TokenService();
    let result;
    
    switch (queryType) {
      case 'transactions':
        result = await tokenService.queryUserTransactions({
          userId,
          minAmount,
          maxAmount,
          transactionType,
          counterparty,
          identityName
        });
        break;
      case 'transactionspage':
        result = await tokenService.queryUserTransactionsWithOffset({
          userId,
          minAmount,
          maxAmount,
          transactionType,
          counterparty,
          pageSize,
          offset,
          identityName
        });
        break;
      case 'transactionsbookmark':
        result = await tokenService.queryUserTransactionsWithBookmark({
          userId,
          minAmount,
          maxAmount,
          transactionType,
          counterparty,
          pageSize,
          identityName
        });
        break;
      case 'history':
        result = await tokenService.getUserTransactionHistory({
          userId,
          pageSize,
          offset,
          identityName
        });
        break;
      default:
        ctx.status = 400;
        ctx.body = { success: false, message: '不支持的查询类型' };
        return;
    }
    
    ctx.body = result;
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '查询交易记录失败',
      error: error.message
    };
  }
});

// 转账API
router.post('/api/transfer', async (ctx) => {
  const { 
    recipient, 
    amount, 
    identityName 
  } = ctx.request.body;
  
  // 🔍 添加后端API地址跟踪日志
  console.log('🔍 BACKEND API TRANSFER 地址跟踪开始:');
  console.log('  📥 后端接收到的 recipient:', recipient);
  console.log('  📥 recipient 类型:', typeof recipient);
  console.log('  📥 recipient 长度:', recipient ? recipient.length : 0);
  console.log('  📥 recipient 是否为空:', !recipient);
  console.log('  📥 recipient 是否为空字符串:', recipient === '');
  console.log('  📥 recipient 是否只包含空格:', recipient && recipient.trim() === '');
  console.log('  📥 完整的请求体:', ctx.request.body);
  
  if (!recipient || !amount || !identityName) {
    console.log('❌ 参数验证失败:', { recipient, amount, identityName });
    ctx.status = 400;
    ctx.body = { success: false, message: 'recipient、amount、identityName都是必需的' };
    return;
  }
  
  try {
    console.log('🔍 准备调用 TokenService.transfer:');
    console.log('  📤 传递给 TokenService 的 recipient:', recipient);
    console.log('  📤 传递给 TokenService 的 amount:', amount);
    console.log('  📤 传递给 TokenService 的 identityName:', identityName);

    const tokenService = new TokenService();
    const result = await tokenService.transfer({
      recipient,
      amount,
      identityName
    });
    
    console.log('🔍 TokenService 返回结果:', result);
    ctx.body = result;
  } catch (error) {
    console.error('❌ 转账失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '转账失败',
      error: error.message
    };
  }
});

// 批量转账API：按顺序执行，任意一条失败会继续执行并返回每条结果
router.post('/api/batch-transfer', async (ctx) => {
  const { transfers, identityName } = ctx.request.body || {};
  if (!identityName || !Array.isArray(transfers)) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'identityName 必填且 transfers 必须为数组' };
    return;
  }
  try {
    const tokenService = new TokenService();
    const results = [];
    for (const item of transfers) {
      const recipient = item?.recipient;
      const amount = item?.amount;
      if (!recipient || !amount) {
        results.push({ success: false, message: '参数无效', recipient, amount });
        continue;
      }
      try {
        const res = await tokenService.transfer({ recipient, amount, identityName });
        results.push({ success: !!res?.success, ...res, recipient, amount });
      } catch (e) {
        results.push({ success: false, message: '转账失败', error: e.message, recipient, amount });
      }
    }
    const ok = results.every(r => r.success);
    ctx.body = { success: ok, data: { results } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: '批量转账失败', error: error.message };
  }
});

// 铸币API
router.post('/api/mint', async (ctx) => {
  const { 
    amount, 
    identityName 
  } = ctx.request.body;
  
  // 🔍 添加后端API铸币跟踪日志
  console.log('🔍 BACKEND API MINT 开始:');
  console.log('  📥 后端接收到的 amount:', amount);
  console.log('  📥 后端接收到的 identityName:', identityName);
  console.log('  📥 完整的请求体:', ctx.request.body);
  
  if (!amount || !identityName) {
    console.log('❌ 参数验证失败:', { amount, identityName });
    ctx.status = 400;
    ctx.body = { success: false, message: 'amount、identityName都是必需的' };
    return;
  }
  
  try {
    console.log('🔍 准备调用 TokenService.mint:');
    console.log('  📤 传递给 TokenService 的 amount:', amount);
    console.log('  📤 传递给 TokenService 的 identityName:', identityName);

    const tokenService = new TokenService();
    const result = await tokenService.mint({
      amount,
      identityName
    });
    
    console.log('🔍 TokenService 返回结果:', result);
    ctx.body = result;
  } catch (error) {
    console.error('❌ 铸币失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '铸币失败',
      error: error.message
    };
  }
});

// 销毁API
router.post('/api/burn', async (ctx) => {
  const { 
    amount, 
    identityName 
  } = ctx.request.body;
  
  // 🔍 添加后端API销毁跟踪日志
  console.log('🔍 BACKEND API BURN 开始:');
  console.log('  📥 后端接收到的 amount:', amount);
  console.log('  📥 后端接收到的 identityName:', identityName);
  console.log('  📥 完整的请求体:', ctx.request.body);
  
  if (!amount || !identityName) {
    console.log('❌ 参数验证失败:', { amount, identityName });
    ctx.status = 400;
    ctx.body = { success: false, message: 'amount、identityName都是必需的' };
    return;
  }
  
  try {
    console.log('🔍 准备调用 TokenService.burn:');
    console.log('  📤 传递给 TokenService 的 amount:', amount);
    console.log('  📤 传递给 TokenService 的 identityName:', identityName);

    const tokenService = new TokenService();
    const result = await tokenService.burn({
      amount,
      identityName
    });
    
    console.log('🔍 TokenService 返回结果:', result);
    ctx.body = result;
  } catch (error) {
    console.error('❌ 销毁失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '销毁失败',
      error: error.message
    };
  }
});

// 授权转账API
router.post('/api/transferFrom', async (ctx) => {
  const { 
    from, 
    to, 
    amount, 
    identityName 
  } = ctx.request.body;
  
  console.log('🔧 授权转账 API 调用参数:', { from, to, amount, identityName });
  
  if (!from || !to || !amount || !identityName) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'from、to、amount、identityName都是必需的' };
    return;
  }
  
  try {
    const tokenService = new TokenService();
    const result = await tokenService.transferFrom({
      from,
      to,
      amount,
      identityName
    });
    
    ctx.body = result;
  } catch (error) {
    console.error('❌ 授权转账失败:', error.message);
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '授权转账失败',
      error: error.message
    };
  }
});

// 授权批准API
router.post('/api/approve', async (ctx) => {
  const { 
    spender, 
    amount, 
    identityName 
  } = ctx.request.body;
  
  if (!spender || !amount || !identityName) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'spender、amount、identityName都是必需的' };
    return;
  }
  
  try {
    const tokenService = new TokenService();
    const result = await tokenService.approve({
      spender,
      amount,
      identityName
    });
    
    ctx.body = result;
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '授权批准失败',
      error: error.message
    };
  }
});

// 查询授权额度API
router.post('/api/allowance', async (ctx) => {
  const { 
    owner, 
    spender, 
    identityName 
  } = ctx.request.body;
  
  if (!owner || !spender || !identityName) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'owner、spender、identityName都是必需的' };
    return;
  }
  
  try {
    const tokenService = new TokenService();
    const result = await tokenService.getAllowance({
      owner,
      spender,
      identityName
    });
    
    ctx.body = result;
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '查询授权额度失败',
      error: error.message
    };
  }
});

// 获取当前选择的用户
router.get('/api/current-user', async (ctx) => {
  try {
    const currentUserFile = path.resolve(__dirname, '../.current-user');
    if (!fs.existsSync(currentUserFile)) {
      ctx.body = { success: true, data: { identityName: null } };
      return;
    }
    const identityName = fs.readFileSync(currentUserFile, 'utf8').trim();
    const walletPath = path.resolve(__dirname, '../wallet');
    const identityPath = path.join(walletPath, `${identityName}.id`);
    let identityInfo = null;
    if (fs.existsSync(identityPath)) {
      try {
        identityInfo = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
      } catch (_) {}
    }
    ctx.body = { success: true, data: { identityName, identityInfo } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: '读取当前用户失败', error: error.message };
  }
});

// 选择当前用户（仅限传入钱包中存在的身份文件名，不带 .id）
router.post('/api/select-user', async (ctx) => {
  const { identityName } = ctx.request.body || {};
  if (!identityName || typeof identityName !== 'string') {
    ctx.status = 400;
    ctx.body = { success: false, message: 'identityName 是必需的' };
    return;
  }

  try {
    const cliDir = path.resolve(__dirname, '../cli');
    const scriptPath = path.join(cliDir, 'selectUser.js');
    if (!fs.existsSync(scriptPath)) {
      ctx.status = 500;
      ctx.body = { success: false, message: 'selectUser 脚本不存在' };
      return;
    }

    const result = await new Promise((resolve) => {
      const child = spawn('node', ['selectUser.js', '-select', identityName], {
        cwd: cliDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('close', code => {
        resolve({ code, stdout, stderr });
      });
      child.on('error', error => resolve({ code: 1, stdout: '', stderr: error.message }));
    });

    if (result.code === 0) {
      ctx.body = { success: true, message: '选择用户成功', output: result.stdout };
    } else {
      ctx.status = 500;
      ctx.body = { success: false, message: '选择用户失败', error: result.stderr || 'unknown error' };
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: '选择用户失败', error: error.message };
  }
});

app.use(cors());
app.use(bodyParser());
app.use(router.routes()).use(router.allowedMethods());

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Koa wallet API server running at http://localhost:${PORT}`);
}); 