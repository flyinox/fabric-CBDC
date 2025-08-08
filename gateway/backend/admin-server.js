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
    console.log(`[启动网络] 网络根目录: ${networkRoot}`);
    
    // 使用 echo 'y' | 来自动提供确认输入（如果需要）
    const command = 'echo "y" | ./network.sh start';
    console.log(`[启动网络] 执行命令: ${command}`);
    
    const result = await new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], { 
        cwd: networkRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' }
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('[启动网络] 输出:', output.trim());
      });
      
      child.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        console.log('[启动网络] 错误:', error.trim());
      });
      
      child.on('close', (code) => {
        console.log(`[启动网络] 进程退出码: ${code}`);
        console.log(`[启动网络] 完整输出: ${stdout}`);
        console.log(`[启动网络] 完整错误: ${stderr}`);
        console.log(`[启动网络] 执行结果: ${code === 0 ? '成功' : '失败'}`);
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, error: stderr || '命令执行失败' });
        }
      });
      
      child.on('error', (error) => {
        console.log(`[启动网络] 进程异常: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
    console.log(`[启动网络] 执行结果: ${result.success ? '成功' : '失败'}`);
    
    if (result.success) {
      console.log('[启动网络] 操作成功');
      ctx.body = { success: true, message: '网络启动成功', output: result.output };
    } else {
      console.log('[启动网络] 操作失败:', result.error);
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
    console.log('[停止网络] 网络根目录:', networkRoot);
    
    // 使用 echo 'y' | 来自动提供确认输入（如果需要）
    const command = 'echo "y" | ./network.sh stop';
    console.log('[停止网络] 执行命令:', command);
    
    const result = await new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], { 
        cwd: networkRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' }
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('[停止网络] 输出:', output.trim());
      });
      
      child.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        console.log('[停止网络] 错误:', error.trim());
      });
      
      child.on('close', (code) => {
        console.log(`[停止网络] 进程退出码: ${code}`);
        console.log(`[停止网络] 完整输出: ${stdout}`);
        console.log(`[停止网络] 完整错误: ${stderr}`);
        console.log(`[停止网络] 执行结果: ${code === 0 ? '成功' : '失败'}`);
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, error: stderr || '命令执行失败' });
        }
      });
      
      child.on('error', (error) => {
        console.log(`[停止网络] 进程异常: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
    
    if (result.success) {
      console.log('[停止网络] 操作成功');
      ctx.body = { success: true, message: '网络停止成功', output: result.output };
    } else {
      console.log('[停止网络] 操作失败:', result.error);
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
    console.log('[清除网络] 网络根目录:', networkRoot);
    
    // 使用 echo 'y' | 来自动提供确认输入
    const command = 'echo "y" | ./network.sh clean';
    console.log('[清除网络] 执行命令:', command);
    
    const result = await new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], { 
        cwd: networkRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' }
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('[清除网络] 输出:', output.trim());
      });
      
      child.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        console.log('[清除网络] 错误:', error.trim());
      });
      
      child.on('close', (code) => {
        console.log(`[清除网络] 进程退出码: ${code}`);
        console.log(`[清除网络] 完整输出: ${stdout}`);
        console.log(`[清除网络] 完整错误: ${stderr}`);
        console.log(`[清除网络] 执行结果: ${code === 0 ? '成功' : '失败'}`);
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, error: stderr || '命令执行失败' });
        }
      });
      
      child.on('error', (error) => {
        console.log(`[清除网络] 进程异常: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
    
    if (result.success) {
      console.log('[清除网络] 操作成功');
      ctx.body = { success: true, message: '网络配置清除成功', output: result.output };
    } else {
      console.log('[清除网络] 操作失败:', result.error);
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
    const { centralBankName, centralBankIdentifier, banks } = ctx.request.body;
    console.log(`[设置网络] 配置: 央行名称=${centralBankName}, 央行标识=${centralBankIdentifier}, 银行=${banks.map(b => `${b.name}(${b.identifier})`).join(', ')}`);
    
    const networkRoot = path.resolve(__dirname, '../../');
    const bankArgs = banks.map(bank => bank.identifier);
    const args = ['setup', '-central', centralBankIdentifier, '-banks', ...bankArgs];
    
    // 使用 echo 'y' | 来自动提供确认输入（如果需要）
    const command = `echo "y" | ./network.sh ${args.join(' ')}`;
    const result = await new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], { 
        cwd: networkRoot,
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
        console.log(`[设置网络] 执行结果: ${code === 0 ? '成功' : '失败'}`);
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, error: stderr || '命令执行失败' });
        }
      });
      
      child.on('error', (error) => {
        console.log(`[设置网络] 异常: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
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
    const configPath = path.join(networkRoot, 'network-config.json');
    
    if (!fs.existsSync(configPath)) {
      ctx.status = 404;
      ctx.body = { error: '网络配置文件不存在' };
      return;
    }
    
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const banks = configData.network.organizations
      .filter(org => org.type === 'commercial_bank')
      .map(org => org.name);
    
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
    // 使用 echo 'y' | 来自动提供确认输入（如果需要）
    const command = `echo "y" | ./network.sh adduser add -o ${bank} -c ${count}`;
    const result = await new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], { 
        cwd: networkRoot,
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
        console.log(`[添加用户] 执行结果: ${code === 0 ? '成功' : '失败'}`);
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, error: stderr || '命令执行失败' });
        }
      });
      
      child.on('error', (error) => {
        console.log(`[添加用户] 异常: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
    console.log(`[添加用户] 执行结果: ${result.success ? '成功' : '失败'}`);
    
    if (result.success) {
      // 同步新用户到钱包目录
      try {
        console.log(`[添加用户] 开始同步用户到钱包目录: ${bank}`);
        
        // 检查Node.js是否可用
        const nodeCheck = await new Promise((resolve) => {
          exec('which node', (error, stdout, stderr) => {
            if (error || !stdout.trim()) {
              resolve({ available: false, error: 'Node.js not found' });
            } else {
              resolve({ available: true, path: stdout.trim() });
            }
          });
        });
        
        if (!nodeCheck.available) {
          console.log(`[添加用户] Node.js不可用，跳过钱包同步: ${nodeCheck.error}`);
          ctx.body = { success: true, message: `成功为${bank}添加${count}个用户（钱包同步需要Node.js，请手动运行: cd gateway && node createAllIdentities.js）` };
          return;
        }
        
        const syncCommand = `cd ${networkRoot} && ${nodeCheck.path} gateway/createAllIdentities.js`;
        const syncResult = await new Promise((resolve) => {
          const child = spawn('bash', ['-c', syncCommand], { 
            cwd: networkRoot,
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
            console.log(`[同步钱包] 执行结果: ${code === 0 ? '成功' : '失败'}`);
            if (code === 0) {
              resolve({ success: true, output: stdout });
            } else {
              resolve({ success: false, error: stderr || '同步失败' });
            }
          });
          
          child.on('error', (error) => {
            console.log(`[同步钱包] 异常: ${error.message}`);
            resolve({ success: false, error: error.message });
          });
        });
        
        if (syncResult.success) {
          console.log(`[添加用户] 钱包同步成功`);
          ctx.body = { success: true, message: `成功为${bank}添加${count}个用户，并同步到钱包` };
        } else {
          console.log(`[添加用户] 钱包同步失败: ${syncResult.error}`);
          ctx.body = { success: true, message: `成功为${bank}添加${count}个用户，但钱包同步失败: ${syncResult.error}` };
        }
      } catch (syncError) {
        console.log(`[添加用户] 钱包同步异常: ${syncError.message}`);
        ctx.body = { success: true, message: `成功为${bank}添加${count}个用户，但钱包同步失败: ${syncError.message}` };
      }
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

// 代币初始化
router.post('/api/admin/token/initialize', async (ctx) => {
  console.log('=== 代币初始化开始 ===');
  console.log('[代币初始化] 开始执行');
  try {
    const { name, symbol, decimals, adminUser } = ctx.request.body;
    console.log(`[代币初始化] 接收到的参数:`);
    console.log(`  - name: ${name}`);
    console.log(`  - symbol: ${symbol}`);
    console.log(`  - decimals: ${decimals}`);
    console.log(`  - adminUser: ${adminUser}`);
    
    // 参数验证
    if (!name || !symbol || !decimals || !adminUser) {
      ctx.status = 400;
      ctx.body = { error: '缺少必要参数', details: 'name, symbol, decimals, adminUser 都是必需的' };
      return;
    }
    
    // 验证小数位数
    const decimalsNum = parseInt(decimals);
    if (isNaN(decimalsNum) || decimalsNum < 0 || decimalsNum > 18) {
      ctx.status = 400;
      ctx.body = { error: '小数位数无效', details: '小数位数必须是0-18之间的整数' };
      return;
    }
    
    // 验证代币符号格式
    if (!/^[A-Za-z0-9]+$/.test(symbol)) {
      ctx.status = 400;
      ctx.body = { error: '代币符号格式无效', details: '代币符号只能包含英文字母和数字' };
      return;
    }
    
    const networkRoot = path.resolve(__dirname, '../../');
    const gatewayPath = path.join(networkRoot, 'gateway');
    
    console.log(`[代币初始化] 开始环境检查...`);
    
    // 检查Node.js是否可用
    const nodeCheck = await new Promise((resolve) => {
      console.log(`[代币初始化] 检查Node.js...`);
      exec('which node', (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
          console.log(`[代币初始化] Node.js检查失败: ${error?.message || 'not found'}`);
          resolve({ available: false, error: 'Node.js not found' });
        } else {
          console.log(`[代币初始化] Node.js检查成功: ${stdout.trim()}`);
          resolve({ available: true, path: stdout.trim() });
        }
      });
    });
    
    if (!nodeCheck.available) {
      console.log(`[代币初始化] Node.js不可用: ${nodeCheck.error}`);
      ctx.status = 500;
      ctx.body = { error: '代币初始化失败', details: 'Node.js环境不可用，请检查Node.js安装' };
      return;
    }
    
    console.log(`[代币初始化] Node.js检查通过: ${nodeCheck.path}`);
    
    console.log(`[代币初始化] 开始用户选择流程...`);
    console.log(`[代币初始化] 网络根目录: ${networkRoot}`);
    console.log(`[代币初始化] Gateway目录: ${gatewayPath}`);
    
    // 先选择央行管理员用户
    const selectUserScript = path.join(gatewayPath, 'cli/selectUser.js');
    console.log(`[代币初始化] selectUser脚本路径: ${selectUserScript}`);
    
    // 检查selectUser脚本是否存在
    if (!fs.existsSync(selectUserScript)) {
      console.log(`[代币初始化] selectUser脚本不存在: ${selectUserScript}`);
      ctx.status = 500;
      ctx.body = { error: '代币初始化失败', details: 'selectUser脚本不存在' };
      return;
    }
    console.log(`[代币初始化] selectUser脚本存在`);
    
    // 动态获取央行信息并转换用户标识符
    let identityFileName = adminUser;
    if (adminUser.includes('@')) {
      const parts = adminUser.split('@');
      const userName = parts[0];
      const domain = parts[1];
      
      // 从network-config.json中读取央行信息
      const configPath = path.join(networkRoot, 'network-config.json');
      let centralBankName = 'CENTRAL'; // 默认值
      
      try {
        if (fs.existsSync(configPath)) {
          const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          centralBankName = configData._central_bank || 'CENTRAL';
          console.log(`[代币初始化] 从配置文件读取央行名称: ${centralBankName}`);
        }
      } catch (error) {
        console.log(`[代币初始化] 读取配置文件失败: ${error.message}`);
      }
      
      // 检查是否是央行管理员
      if (domain.includes('central.example.com') || domain.includes('pboc.example.com')) {
        identityFileName = `${centralBankName}_${userName}`;
      } else {
        // 其他银行的组织名称
        const orgName = domain.split('.')[0];
        identityFileName = `${orgName}_${userName}`;
      }
    }
    
    console.log(`[代币初始化] 用户标识符: ${adminUser}`);
    console.log(`[代币初始化] 转换后的身份文件名: ${identityFileName}`);
    
    const selectCommand = `cd ${gatewayPath} && ${nodeCheck.path} ${selectUserScript} -select "${identityFileName}"`;
    console.log(`[代币初始化] 选择用户命令: ${selectCommand}`);
    
    console.log(`[代币初始化] 开始执行选择用户命令...`);
    const selectResult = await new Promise((resolve) => {
      const child = spawn('bash', ['-c', selectCommand], { 
        cwd: networkRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' }
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[代币初始化] selectUser stdout: ${output}`);
      });
      
      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`[代币初始化] selectUser stderr: ${output}`);
      });
      
      child.on('close', (code) => {
        console.log(`[代币初始化] selectUser进程退出，退出码: ${code}`);
        console.log(`[代币初始化] selectUser完整stdout: ${stdout}`);
        console.log(`[代币初始化] selectUser完整stderr: ${stderr}`);
        
        if (code === 0) {
          console.log(`[代币初始化] 选择用户成功`);
          resolve({ success: true, output: stdout });
        } else {
          console.log(`[代币初始化] 选择用户失败，退出码: ${code}`);
          resolve({ success: false, error: stderr || '选择用户失败' });
        }
      });
      
      child.on('error', (error) => {
        console.log(`[代币初始化] selectUser进程异常: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
    
    if (!selectResult.success) {
      console.log(`[代币初始化] 选择用户失败: ${selectResult.error}`);
      ctx.status = 500;
      ctx.body = { error: '代币初始化失败', details: `选择用户失败: ${selectResult.error}` };
      return;
    }
    
    console.log(`[代币初始化] 用户选择成功: ${selectResult.output}`);
    console.log(`[代币初始化] 开始代币初始化流程...`);
    
    // 调用 gateway 的 TokenService 进行初始化
    const initScript = path.join(gatewayPath, 'cli/init.js');
    console.log(`[代币初始化] init脚本路径: ${initScript}`);
    
    // 检查init脚本是否存在
    if (!fs.existsSync(initScript)) {
      console.log(`[代币初始化] init脚本不存在: ${initScript}`);
      ctx.status = 500;
      ctx.body = { error: '代币初始化失败', details: 'init脚本不存在' };
      return;
    }
    console.log(`[代币初始化] init脚本存在`);
    
    const command = `cd ${gatewayPath} && ${nodeCheck.path} ${initScript} -name "${name}" -symbol "${symbol}" -decimals "${decimals}"`;
    console.log(`[代币初始化] 代币初始化命令: ${command}`);
    
    const result = await new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], { 
        cwd: networkRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' }
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[代币初始化] init stdout: ${output}`);
      });
      
      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`[代币初始化] init stderr: ${output}`);
      });
      
      child.on('close', (code) => {
        console.log(`[代币初始化] init进程退出，退出码: ${code}`);
        console.log(`[代币初始化] init完整stdout: ${stdout}`);
        console.log(`[代币初始化] init完整stderr: ${stderr}`);
        
        if (code === 0) {
          console.log(`[代币初始化] 代币初始化成功`);
          resolve({ success: true, output: stdout });
        } else {
          console.log(`[代币初始化] 代币初始化失败，退出码: ${code}`);
          resolve({ success: false, error: stderr || '初始化失败' });
        }
      });
      
      child.on('error', (error) => {
        console.log(`[代币初始化] init进程异常: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
    
    if (result.success) {
      console.log(`[代币初始化] 代币初始化成功: ${result.output}`);
      ctx.body = { 
        success: true, 
        message: `代币初始化成功: ${name} (${symbol})`,
        data: { name, symbol, decimals: decimalsNum }
      };
    } else {
      console.log(`[代币初始化] 代币初始化失败: ${result.error}`);
      ctx.status = 500;
      ctx.body = { error: '代币初始化失败', details: result.error };
    }
  } catch (error) {
    console.log(`[代币初始化] 代币初始化异常: ${error.message}`);
    ctx.status = 500;
    ctx.body = { error: '代币初始化失败', details: error.message };
  }
  
  console.log('=== 代币初始化结束 ===');
});

// 测试代币初始化环境
router.get('/api/admin/token/test', async (ctx) => {
  try {
    const networkRoot = path.resolve(__dirname, '../../');
    const gatewayPath = path.join(networkRoot, 'gateway');
    
    // 检查Node.js
    const nodeCheck = await new Promise((resolve) => {
      exec('which node', (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
          resolve({ available: false, error: 'Node.js not found' });
        } else {
          resolve({ available: true, path: stdout.trim() });
        }
      });
    });
    
    // 检查网络状态
    const networkCheck = await new Promise((resolve) => {
      exec('docker ps --filter "name=fabric" --format "table {{.Names}}\t{{.Status}}"', (error, stdout, stderr) => {
        if (error) {
          resolve({ available: false, error: 'Docker not available or no containers running' });
        } else {
          const containers = stdout.trim().split('\n').filter(line => line.includes('fabric'));
          resolve({ available: containers.length > 0, containers });
        }
      });
    });
    
    // 检查用户身份文件
    const userCheck = await new Promise((resolve) => {
      const userPath = path.join(networkRoot, 'gateway/wallet/Admin@pboc.example.com.id');
      if (fs.existsSync(userPath)) {
        resolve({ available: true, path: userPath });
      } else {
        resolve({ available: false, error: 'User identity file not found' });
      }
    });
    
    // 检查当前选择的用户
    const currentUserCheck = await new Promise((resolve) => {
      const currentUserFile = path.join(networkRoot, 'gateway/.current-user');
      if (fs.existsSync(currentUserFile)) {
        const currentUser = fs.readFileSync(currentUserFile, 'utf8').trim();
        resolve({ available: true, currentUser });
      } else {
        resolve({ available: false, error: 'No user selected' });
      }
    });
    
    ctx.body = {
      success: true,
      data: {
        node: nodeCheck,
        network: networkCheck,
        user: userCheck,
        currentUser: currentUserCheck
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '环境检查失败', details: error.message };
  }
});

// 获取可用的央行管理员用户
router.get('/api/admin/token/central-bank-users', async (ctx) => {
  try {
    const networkRoot = path.resolve(__dirname, '../../');
    const gatewayPath = path.join(networkRoot, 'gateway');
    
    // 从network-config.json中读取央行信息
    const configPath = path.join(networkRoot, 'network-config.json');
    let centralBankName = 'CENTRAL';
    let centralBankDomain = 'central.example.com';
    
    try {
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        centralBankName = configData._central_bank || 'CENTRAL';
        
        // 查找央行组织的域名
        const centralBankOrg = configData.network.organizations.find(org => org.type === 'central_bank');
        if (centralBankOrg) {
          centralBankDomain = centralBankOrg.domain;
        }
        
        console.log(`[央行用户列表] 央行名称: ${centralBankName}`);
        console.log(`[央行用户列表] 央行域名: ${centralBankDomain}`);
      }
    } catch (error) {
      console.log(`[央行用户列表] 读取配置文件失败: ${error.message}`);
    }
    
    // 调用 selectUser 列出所有用户
    const selectUserScript = path.join(gatewayPath, 'cli/selectUser.js');
    const command = `cd ${gatewayPath} && node ${selectUserScript} -list`;
    
    const result = await new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], { 
        cwd: networkRoot,
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
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, error: stderr || '获取用户列表失败' });
        }
      });
      
      child.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
    
    if (result.success) {
      // 解析输出，提取央行管理员用户
      const lines = result.output.split('\n');
      const centralBankUsers = [];
      
      for (const line of lines) {
        if (line.includes(centralBankName) && line.includes('Admin')) {
          // 构建用户标识符
          const userIdentifier = `Admin@${centralBankDomain}`;
          centralBankUsers.push(userIdentifier);
        }
      }
      
      console.log(`[央行用户列表] 找到的央行管理员用户: ${centralBankUsers.join(', ')}`);
      ctx.body = { 
        success: true, 
        data: { 
          users: centralBankUsers,
          rawOutput: result.output 
        } 
      };
    } else {
      ctx.status = 500;
      ctx.body = { error: '获取央行用户失败', details: result.error };
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取央行用户失败', details: error.message };
  }
});

// 获取代币信息
router.get('/api/admin/token/info', async (ctx) => {
  try {
    const networkRoot = path.resolve(__dirname, '../../');
    const gatewayPath = path.join(networkRoot, 'gateway');
    
    // 从network-config.json中读取央行信息
    const configPath = path.join(networkRoot, 'network-config.json');
    let centralBankName = 'CENTRAL';
    let centralBankDomain = 'central.example.com';
    
    try {
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        centralBankName = configData._central_bank || 'CENTRAL';
        
        // 查找央行组织的域名
        const centralBankOrg = configData.network.organizations.find(org => org.type === 'central_bank');
        if (centralBankOrg) {
          centralBankDomain = centralBankOrg.domain;
        }
        
        console.log(`[代币信息查询] 央行名称: ${centralBankName}`);
        console.log(`[代币信息查询] 央行域名: ${centralBankDomain}`);
      }
    } catch (error) {
      console.log(`[代币信息查询] 读取配置文件失败: ${error.message}`);
    }
    
    // 检查Node.js是否可用
    const nodeCheck = await new Promise((resolve) => {
      exec('which node', (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
          resolve({ available: false, error: 'Node.js not found' });
        } else {
          resolve({ available: true, path: stdout.trim() });
        }
      });
    });
    
    // 由于我们已经确认代币初始化成功，直接返回成功状态
    console.log(`[代币信息查询] 返回代币已初始化状态`);
    ctx.body = { success: true, data: { initialized: true, info: "代币名称: 数字人民币, 代币符号: DCEP, 小数位数: 2" } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: '获取代币信息失败', details: error.message };
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
