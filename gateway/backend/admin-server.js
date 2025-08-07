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

// 管理界面端点（无需认证）
router.get('/', async (ctx) => {
  ctx.type = 'text/html';
  ctx.body = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CBDC 管理后台</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: #fafafa;
        }
        .section h3 {
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            margin: 5px;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        button:hover {
            background: #5a6fd8;
            transform: translateY(-2px);
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        .btn-danger {
            background: #dc3545;
        }
        .btn-danger:hover {
            background: #c82333;
        }
        .btn-success {
            background: #28a745;
        }
        .btn-success:hover {
            background: #218838;
        }
        .result {
            margin-top: 15px;
            padding: 15px;
            border-radius: 6px;
            font-family: 'Monaco', 'Menlo', monospace;
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
            font-size: 12px;
        }
        .success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .info {
            background: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
        }
        .status {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin: 5px;
        }
        .status.running { background: #28a745; color: white; }
        .status.stopped { background: #dc3545; color: white; }
        .status.partial { background: #ffc107; color: black; }
        .node-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .node-card {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #ddd;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .node-name {
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
        }
        .node-details {
            font-size: 12px;
            color: #666;
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏦 CBDC 管理后台</h1>
            <p>央行数字货币网络管理系统</p>
        </div>

        <div class="section">
            <h3>📊 网络状态概览</h3>
            <div class="stats" id="stats">
                <div class="stat-card">
                    <div class="stat-number" id="total-nodes">-</div>
                    <div class="stat-label">总节点数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="running-nodes">-</div>
                    <div class="stat-label">运行中节点</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="network-status">-</div>
                    <div class="stat-label">网络状态</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h3>🔧 网络控制</h3>
            <button onclick="getNetworkStatus()" class="btn-success">🔄 刷新状态</button>
            <button onclick="startNetwork()" class="btn-success">▶️ 启动网络</button>
            <button onclick="stopNetwork()" class="btn-danger">⏹️ 停止网络</button>
            <div id="network-result" class="result"></div>
        </div>

        <div class="section">
            <h3>🖥️ 节点状态</h3>
            <div id="nodes-container">
                <div class="loading">
                    <div class="spinner"></div>
                    加载中...
                </div>
            </div>
        </div>

        <div class="section">
            <h3>📋 节点日志</h3>
            <input type="text" id="nodeName" placeholder="输入节点名称" value="orderer.example.com" style="padding: 10px; margin-right: 10px; border: 1px solid #ddd; border-radius: 4px; width: 200px;">
            <button onclick="getNodeLogs()">📄 获取日志</button>
            <div id="logs-result" class="result"></div>
        </div>
    </div>

    <script>
        const BASE_URL = 'http://127.0.0.1:3001';
        const AUTH_HEADER = 'Basic ' + btoa('admin:admin123');

        function showResult(elementId, data, type = 'info') {
            const element = document.getElementById(elementId);
            element.textContent = JSON.stringify(data, null, 2);
            element.className = \`result \${type}\`;
        }

        async function makeRequest(url, options = {}) {
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: options.body ? JSON.stringify(options.body) : undefined
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || \`HTTP \${response.status}\`);
            }
            
            return data;
        }

        function updateStats(data) {
            const totalNodes = data.nodes ? data.nodes.length : 0;
            const runningNodes = data.nodes ? data.nodes.filter(n => n.status === 'running').length : 0;
            const networkStatus = data.status === 'running' ? '运行中' : 
                                data.status === 'stopped' ? '已停止' : '部分运行';

            document.getElementById('total-nodes').textContent = totalNodes;
            document.getElementById('running-nodes').textContent = runningNodes;
            document.getElementById('network-status').textContent = networkStatus;
        }

        function renderNodes(nodes) {
            const container = document.getElementById('nodes-container');
            if (!nodes || nodes.length === 0) {
                container.innerHTML = '<div class="loading">暂无节点信息</div>';
                return;
            }

            const nodesHtml = nodes.map(node => \`
                <div class="node-card">
                    <div class="node-name">\${node.name}</div>
                    <div class="node-details">
                        <span class="status \${node.status}">\${node.status === 'running' ? '运行中' : '已停止'}</span>
                        <span style="margin-left: 10px;">类型: \${node.type}</span>
                    </div>
                </div>
            \`).join('');

            container.innerHTML = \`<div class="node-list">\${nodesHtml}</div>\`;
        }

        async function getNetworkStatus() {
            try {
                const result = await makeRequest(\`\${BASE_URL}/api/admin/network/status\`, {
                    headers: { 'Authorization': AUTH_HEADER }
                });
                
                updateStats(result);
                renderNodes(result.nodes);
                showResult('network-result', result, 'success');
            } catch (error) {
                showResult('network-result', { error: error.message }, 'error');
            }
        }

        async function startNetwork() {
            if (!confirm('确定要启动网络吗？')) {
                return;
            }
            
            try {
                const result = await makeRequest(\`\${BASE_URL}/api/admin/network/start\`, {
                    method: 'POST',
                    headers: { 'Authorization': AUTH_HEADER }
                });
                showResult('network-result', result, 'success');
                
                // 延迟获取状态
                setTimeout(getNetworkStatus, 3000);
            } catch (error) {
                showResult('network-result', { error: error.message }, 'error');
            }
        }

        async function stopNetwork() {
            if (!confirm('确定要停止网络吗？这将停止所有节点。')) {
                return;
            }
            
            try {
                const result = await makeRequest(\`\${BASE_URL}/api/admin/network/stop\`, {
                    method: 'POST',
                    headers: { 'Authorization': AUTH_HEADER }
                });
                showResult('network-result', result, 'success');
                
                // 延迟获取状态
                setTimeout(getNetworkStatus, 2000);
            } catch (error) {
                showResult('network-result', { error: error.message }, 'error');
            }
        }

        async function getNodeLogs() {
            const nodeName = document.getElementById('nodeName').value;
            if (!nodeName) {
                alert('请输入节点名称');
                return;
            }
            
            try {
                const result = await makeRequest(\`\${BASE_URL}/api/admin/logs/\${encodeURIComponent(nodeName)}\`, {
                    headers: { 'Authorization': AUTH_HEADER }
                });
                showResult('logs-result', result, 'success');
            } catch (error) {
                showResult('logs-result', { error: error.message }, 'error');
            }
        }

        // 页面加载时自动获取网络状态
        window.onload = function() {
            getNetworkStatus();
        };
    </script>
</body>
</html>
  `;
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