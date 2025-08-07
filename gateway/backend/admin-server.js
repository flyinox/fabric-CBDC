const Koa = require('koa');
const Router = require('@koa/router');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = new Koa();
const router = new Router();

app.use(cors());
app.use(bodyParser());

// 认证中间件
const authMiddleware = async (ctx, next) => {
  const authHeader = ctx.headers.authorization;
  if (!authHeader) {
    ctx.status = 401;
    ctx.body = { error: '需要认证' };
    return;
  }
  
  const auth = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString();
  const [username, password] = auth.split(':');
  
  if (username !== 'admin' || password !== 'admin123') {
    ctx.status = 401;
    ctx.body = { error: '用户名或密码错误' };
    return;
  }
  
  await next();
};

// 应用认证中间件到管理API
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/api/admin')) {
    return authMiddleware(ctx, next);
  }
  await next();
});

// 执行命令
function executeCommand(command, args = [], cwd = process.cwd()) {
  console.log(`[执行命令] ${command} ${args.join(' ')} (cwd: ${cwd})`);
  return new Promise((resolve) => {
    const child = spawn(command, args, { 
      cwd, 
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }
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
      console.log(`[命令完成] 退出码: ${code}, 输出长度: ${stdout.length}, 错误长度: ${stderr.length}`);
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        resolve({ success: false, error: stderr || '命令执行失败' });
      }
    });
    
    child.on('error', (error) => {
      console.log(`[命令错误] ${error.message}`);
      resolve({ success: false, error: error.message });
    });
  });
}

// 重定向到前端应用
router.get('/', async (ctx) => {
  ctx.redirect('/app');
});

// 健康检查API端点（无需认证）
router.get('/health', async (ctx) => {
  ctx.body = { 
    message: 'CBDC 管理后台服务运行正常',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  };
});

// 获取网络状态
router.get('/api/admin/network/status', async (ctx) => {
  try {
    const result = await executeCommand('docker', ['ps', '--format', '{{.Names}}\t{{.Status}}']);
    
    const containers = [];
    if (result.success) {
      const lines = result.output.trim().split('\n');
      for (const line of lines) {
        if (line.includes('peer') || line.includes('orderer') || line.includes('ca')) {
          const [name, status] = line.split('\t');
          containers.push({ name, status });
        }
      }
    }
    
    const runningCount = containers.filter(c => c.status.includes('Up')).length;
    const status = runningCount === 0 ? 'stopped' : runningCount === containers.length ? 'running' : 'partial';
    
    ctx.body = {
      status,
      nodes: containers.map(c => ({
        name: c.name,
        status: c.status.includes('Up') ? 'running' : 'stopped',
        type: c.name.includes('orderer') ? 'orderer' : c.name.includes('ca') ? 'ca' : 'peer'
      })),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取网络状态失败' };
  }
});

// 启动网络
router.post('/api/admin/network/start', async (ctx) => {
  console.log('[启动网络] 开始执行');
  try {
    const networkRoot = path.resolve(__dirname, '../../');
    const fs = require('fs');
    const scriptPath = path.join(networkRoot, 'network.sh');
    console.log(`[启动网络] 脚本路径: ${scriptPath}`);
    
    if (!fs.existsSync(scriptPath)) {
      console.log(`[启动网络] 脚本不存在: ${scriptPath}`);
      ctx.status = 500;
      ctx.body = { error: '网络脚本不存在', path: scriptPath };
      return;
    }
    
    console.log(`[启动网络] 脚本存在，开始执行`);
    const result = await executeCommand('./network.sh', ['up'], networkRoot);
    console.log(`[启动网络] 执行结果: ${result.success ? '成功' : '失败'}`);
    
    if (result.success) {
      ctx.body = { success: true, message: '网络启动成功' };
    } else {
      ctx.status = 500;
      ctx.body = { error: '网络启动失败', details: result.error };
    }
  } catch (error) {
    console.log(`[启动网络] 异常: ${error.message}`);
    ctx.status = 500;
    ctx.body = { error: '启动网络失败', details: error.message };
  }
});

// 停止网络
router.post('/api/admin/network/stop', async (ctx) => {
  console.log('[停止网络] 开始执行');
  try {
    const networkRoot = path.resolve(__dirname, '../../');
    const result = await executeCommand('./network.sh', ['down'], networkRoot);
    console.log(`[停止网络] 执行结果: ${result.success ? '成功' : '失败'}`);
    
    if (result.success) {
      ctx.body = { success: true, message: '网络停止成功' };
    } else {
      ctx.status = 500;
      ctx.body = { error: '网络停止失败', details: result.error };
    }
  } catch (error) {
    console.log(`[停止网络] 异常: ${error.message}`);
    ctx.status = 500;
    ctx.body = { error: '停止网络失败', details: error.message };
  }
});

// 清除网络配置
router.post('/api/admin/network/clean', async (ctx) => {
  console.log('[清除网络] 开始执行');
  try {
    const networkRoot = path.resolve(__dirname, '../../');
    const result = await executeCommand('./network.sh', ['clean'], networkRoot);
    console.log(`[清除网络] 执行结果: ${result.success ? '成功' : '失败'}`);
    
    if (result.success) {
      ctx.body = { success: true, message: '网络配置清除成功' };
    } else {
      ctx.status = 500;
      ctx.body = { error: '网络配置清除失败', details: result.error };
    }
  } catch (error) {
    console.log(`[清除网络] 异常: ${error.message}`);
    ctx.status = 500;
    ctx.body = { error: '网络配置清除失败', details: error.message };
  }
});

// 设置网络配置
router.post('/api/admin/network/setup', async (ctx) => {
  console.log('[设置网络] 开始执行');
  try {
    const { centralBank, banks } = ctx.request.body;
    console.log(`[设置网络] 配置: 央行=${centralBank}, 银行=${banks.map(b => b.name).join(', ')}`);
    
    const networkRoot = path.resolve(__dirname, '../../');
    const bankArgs = banks.map(bank => bank.name);
    const args = ['setup', '-central', centralBank, '-banks', ...bankArgs];
    
    const result = await executeCommand('./network.sh', args, networkRoot);
    console.log(`[设置网络] 执行结果: ${result.success ? '成功' : '失败'}`);
    
    if (result.success) {
      ctx.body = { success: true, message: '网络配置成功' };
    } else {
      ctx.status = 500;
      ctx.body = { error: '网络配置失败', details: result.error };
    }
  } catch (error) {
    console.log(`[设置网络] 异常: ${error.message}`);
    ctx.status = 500;
    ctx.body = { error: '网络配置失败', details: error.message };
  }
});

// 获取可用银行列表
router.get('/api/admin/banks', async (ctx) => {
  try {
    const networkRoot = path.resolve(__dirname, '../../');
    const result = await executeCommand('ls', ['-1'], path.join(networkRoot, 'organizations/peerOrganizations'));
    
    const banks = [];
    if (result.success) {
      const lines = result.output.trim().split('\n');
      for (const line of lines) {
        if (line && !line.includes('example.com')) {
          const bankName = line.replace('.example.com', '');
          banks.push(bankName);
        }
      }
    }
    
    ctx.body = { banks };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取银行列表失败', details: error.message };
  }
});

// 添加用户
router.post('/api/admin/users/add', async (ctx) => {
  console.log('[添加用户] 开始执行');
  try {
    const { bank, count } = ctx.request.body;
    console.log(`[添加用户] 银行=${bank}, 数量=${count}`);
    
    const networkRoot = path.resolve(__dirname, '../../');
    const result = await executeCommand('./network.sh', ['adduser', '-bank', bank, '-count', count.toString()], networkRoot);
    console.log(`[添加用户] 执行结果: ${result.success ? '成功' : '失败'}`);
    
    if (result.success) {
      ctx.body = { success: true, message: `成功为${bank}添加${count}个用户` };
    } else {
      ctx.status = 500;
      ctx.body = { error: '添加用户失败', details: result.error };
    }
  } catch (error) {
    console.log(`[添加用户] 异常: ${error.message}`);
    ctx.status = 500;
    ctx.body = { error: '添加用户失败', details: error.message };
  }
});

// 获取节点日志
router.get('/api/admin/logs/:nodeName', async (ctx) => {
  try {
    const { nodeName } = ctx.params;
    const command = `docker logs --tail 50 ${nodeName} 2>&1`;
    
    const result = await new Promise((resolve) => {
      exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          const output = stdout || stderr;
          resolve({ success: true, output: output, error: stderr });
        }
      });
    });
    
    if (result.success) {
      const rawLines = result.output.trim().split('\n');
      const logs = rawLines
        .filter(line => line.trim())
        .map(line => {
          const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+ UTC)/);
          const levelMatch = line.match(/(INFO|WARN|ERRO|DEBUG|FATA)/);
          
          let level = 'INFO';
          if (levelMatch) {
            level = levelMatch[1];
          } else if (line.includes('ERROR') || line.includes('ERRO')) {
            level = 'ERROR';
          } else if (line.includes('WARN')) {
            level = 'WARN';
          } else if (line.includes('DEBUG')) {
            level = 'DEBUG';
          }
          
          return {
            timestamp: timestampMatch ? new Date(timestampMatch[1]).toISOString() : new Date().toISOString(),
            level: level,
            message: line.trim(),
            node: nodeName
          };
        });
      
      ctx.body = { logs };
    } else {
      ctx.status = 500;
      ctx.body = { error: '获取日志失败', details: result.error };
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取日志失败', details: error.message };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = process.env.ADMIN_PORT || 3001;
app.listen(PORT, () => {
  console.log(`管理后台服务器运行在端口 ${PORT}`);
  console.log('默认管理员账户: admin/admin123');
});

module.exports = app;
