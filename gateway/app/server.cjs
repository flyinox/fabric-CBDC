const Koa = require('koa');
const Router = require('@koa/router');
const fs = require('fs');
const path = require('path');
const cors = require('@koa/cors');

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

app.use(cors());
app.use(router.routes()).use(router.allowedMethods());

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Koa wallet API server running at http://localhost:${PORT}`);
}); 