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
  
  if (!recipient || !amount || !identityName) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'recipient、amount、identityName都是必需的' };
    return;
  }
  
  try {
    const tokenService = new TokenService();
    const result = await tokenService.transfer({
      recipient,
      amount,
      identityName
    });
    
    ctx.body = result;
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '转账失败',
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

app.use(cors());
app.use(bodyParser());
app.use(router.routes()).use(router.allowedMethods());

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Koa wallet API server running at http://localhost:${PORT}`);
}); 