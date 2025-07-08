const fs = require('fs');
const path = require('path');

// 读取根目录 network-config.json
const configPath = path.resolve(__dirname, '../network-config.json');
const configRaw = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(configRaw);

// 查找央行组织
const orgs = config.network.organizations;
const centralBankOrg = orgs.find(org => org.type === 'central_bank');

if (!centralBankOrg) {
  console.error('未找到央行组织 (type=central_bank)');
  process.exit(1);
}

console.log('央行组织信息:');
console.log('  名称:', centralBankOrg.name);
console.log('  MSP:', centralBankOrg.msp_id);
console.log('  域名:', centralBankOrg.domain);

// 查找 User1 的证书文件
const user1SigncertsDir = path.resolve(__dirname, `../organizations/peerOrganizations/${centralBankOrg.domain}/users/User1@${centralBankOrg.domain}/msp/signcerts`);
let certFile = null;
if (fs.existsSync(user1SigncertsDir)) {
  const files = fs.readdirSync(user1SigncertsDir);
  certFile = files.find(f => f.endsWith('.pem'));
}

if (!certFile) {
  console.error('User1 signcerts目录下未找到证书文件');
  console.log('尝试查找其他可能的证书文件...');
  
  // 尝试查找其他可能的证书文件
  const possiblePaths = [
    path.resolve(__dirname, `../organizations/peerOrganizations/${centralBankOrg.domain}/users/User1@${centralBankOrg.domain}/msp/cacerts`),
    path.resolve(__dirname, `../organizations/peerOrganizations/${centralBankOrg.domain}/users/User1@${centralBankOrg.domain}/msp/admincerts`)
  ];
  
  for (const certDir of possiblePaths) {
    if (fs.existsSync(certDir)) {
      const files = fs.readdirSync(certDir);
      certFile = files.find(f => f.endsWith('.pem'));
      if (certFile) {
        console.log(`在 ${certDir} 中找到证书文件: ${certFile}`);
        break;
      }
    }
  }
  
  if (!certFile) {
    console.error('未找到 User1 的证书文件，请确保 User1 身份已正确生成');
    process.exit(1);
  }
}

const certPath = path.join(user1SigncertsDir, certFile);

// 查找 User1 的私钥文件
const user1KeystoreDir = path.resolve(__dirname, `../organizations/peerOrganizations/${centralBankOrg.domain}/users/User1@${centralBankOrg.domain}/msp/keystore`);
let keyFile = null;
if (fs.existsSync(user1KeystoreDir)) {
  const files = fs.readdirSync(user1KeystoreDir);
  keyFile = files.find(f => f.endsWith('.pem') || f.endsWith('_sk') || f.endsWith('.key'));
}

if (!keyFile) {
  console.error('User1 keystore目录下未找到私钥文件');
  process.exit(1);
}

const keyPath = path.join(user1KeystoreDir, keyFile);

console.log('User1 证书路径:', certPath);
console.log('User1 私钥路径:', keyPath);

// 读取证书和私钥
const certificate = fs.readFileSync(certPath, 'utf8');
const privateKey = fs.readFileSync(keyPath, 'utf8');

// 创建身份对象
const identity = {
  credentials: {
    certificate: certificate,
    privateKey: privateKey
  },
  mspId: centralBankOrg.msp_id,
  type: "X.509",
  version: 1
};

// 保存到钱包
const walletPath = path.join(__dirname, 'wallet');
if (!fs.existsSync(walletPath)) {
  fs.mkdirSync(walletPath, { recursive: true });
}

const identityPath = path.join(walletPath, 'User1.id');
fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2));

console.log('User1 身份文件创建成功:', identityPath);
console.log('MSP ID:', identity.mspId); 