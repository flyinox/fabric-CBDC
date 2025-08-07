const fs = require('fs');
const path = require('path');

// 读取根目录 network-config.json
const configPath = path.resolve(__dirname, '../network-config.json');
const configRaw = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(configRaw);

console.log('🏛️ 开始为所有组织的所有用户创建身份文件...\n');

// 获取所有组织
const orgs = config.network.organizations;
const walletPath = path.join(__dirname, 'wallet');

// 删除现有钱包内容并重新创建
if (fs.existsSync(walletPath)) {
  console.log('🗑️  删除现有钱包内容...');
  const walletContents = fs.readdirSync(walletPath);
  for (const item of walletContents) {
    const itemPath = path.join(walletPath, item);
    if (fs.statSync(itemPath).isDirectory()) {
      fs.rmSync(itemPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(itemPath);
    }
  }
  console.log('✅ 钱包内容已清理');
} else {
  fs.mkdirSync(walletPath, { recursive: true });
  console.log('📁 创建钱包目录');
}

let totalCreated = 0;
let totalSkipped = 0;

// 遍历所有组织
for (const org of orgs) {
  console.log(`📋 处理组织: ${org.name} (${org.msp_id})`);
  
  const orgDomain = org.domain;
  const orgUsersPath = path.resolve(__dirname, `../organizations/peerOrganizations/${orgDomain}/users`);
  
  if (!fs.existsSync(orgUsersPath)) {
    console.log(`  ⚠️  组织 ${org.name} 的用户目录不存在，跳过`);
    continue;
  }
  
  // 获取该组织的所有用户
  const userDirs = fs.readdirSync(orgUsersPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`  👥 发现用户: ${userDirs.join(', ')}`);
  
  // 为每个用户创建身份文件
  for (const userDir of userDirs) {
    const userName = userDir.split('@')[0]; // 提取用户名（去掉域名部分）
    
    // 使用组织前缀避免用户名冲突
    const identityFileName = `${org.name}_${userName}.id`;
    const identityPath = path.join(walletPath, identityFileName);
    
    // 检查是否已存在
    if (fs.existsSync(identityPath)) {
      console.log(`    ⏭️  ${identityFileName} 已存在，跳过`);
      totalSkipped++;
      continue;
    }
    
    try {
      // 查找证书文件
      const signcertsDir = path.join(orgUsersPath, userDir, 'msp', 'signcerts');
      let certFile = null;
      
      if (fs.existsSync(signcertsDir)) {
        const files = fs.readdirSync(signcertsDir);
        certFile = files.find(f => f.endsWith('.pem'));
      }
      
      if (!certFile) {
        // 尝试其他可能的证书位置
        const possibleCertDirs = [
          path.join(orgUsersPath, userDir, 'msp', 'cacerts'),
          path.join(orgUsersPath, userDir, 'msp', 'admincerts')
        ];
        
        for (const certDir of possibleCertDirs) {
          if (fs.existsSync(certDir)) {
            const files = fs.readdirSync(certDir);
            certFile = files.find(f => f.endsWith('.pem'));
            if (certFile) {
              console.log(`    📄 在 ${certDir} 中找到证书文件`);
              break;
            }
          }
        }
      }
      
      if (!certFile) {
        console.log(`    ❌ ${userName}: 未找到证书文件`);
        continue;
      }
      
      // 查找私钥文件
      const keystoreDir = path.join(orgUsersPath, userDir, 'msp', 'keystore');
      let keyFile = null;
      
      if (fs.existsSync(keystoreDir)) {
        const files = fs.readdirSync(keystoreDir);
        keyFile = files.find(f => f.endsWith('.pem') || f.endsWith('_sk') || f.endsWith('.key'));
      }
      
      if (!keyFile) {
        console.log(`    ❌ ${userName}: 未找到私钥文件`);
        continue;
      }
      
      // 读取证书和私钥
      const certPath = path.join(signcertsDir, certFile);
      const keyPath = path.join(keystoreDir, keyFile);
      
      const certificate = fs.readFileSync(certPath, 'utf8');
      const privateKey = fs.readFileSync(keyPath, 'utf8');
      
      // 创建身份对象
      const identity = {
        credentials: {
          certificate: certificate,
          privateKey: privateKey
        },
        mspId: org.msp_id,
        type: "X.509",
        version: 1,
        orgName: org.name,
        orgType: org.type || 'unknown',
        userName: userName,
        fullName: `${userName}@${orgDomain}`
      };
      
      // 保存身份文件
      fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2));
      
      console.log(`    ✅ ${identityFileName} 创建成功 (${org.msp_id})`);
      totalCreated++;
      
    } catch (error) {
      console.log(`    ❌ ${userName}: 创建失败 - ${error.message}`);
    }
  }
  
  console.log('');
}

console.log('📊 创建结果统计:');
console.log(`  ✅ 新创建: ${totalCreated} 个身份文件`);
console.log(`  ⏭️  已存在: ${totalSkipped} 个身份文件`);
console.log(`  📁 钱包目录: ${walletPath}`);

// 列出所有可用的身份，按组织分组
console.log('\n👥 当前可用的身份:');
const identityFiles = fs.readdirSync(walletPath)
  .filter(file => file.endsWith('.id'))
  .map(file => file.replace('.id', ''));

if (identityFiles.length > 0) {
  // 按组织分组显示
  const orgGroups = {};
  
  identityFiles.forEach(userName => {
    const identityPath = path.join(walletPath, `${userName}.id`);
    const identityData = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
    
    if (!orgGroups[identityData.orgName]) {
      orgGroups[identityData.orgName] = [];
    }
    orgGroups[identityData.orgName].push({
      fileName: userName,
      userName: identityData.userName,
      mspId: identityData.mspId,
      orgType: identityData.orgType
    });
  });
  
  // 按组织类型排序：央行在前，商业银行在后
  // 从配置文件中动态获取组织顺序
  const orgOrder = config.network.organizations.map(org => org.name);
  
  orgOrder.forEach(orgName => {
    if (orgGroups[orgName]) {
      const orgTypeIcon = orgGroups[orgName][0].orgType === 'central_bank' ? '🏛️' : '🏦';
      console.log(`\n${orgTypeIcon} ${orgName}:`);
      
      orgGroups[orgName].forEach((identity, index) => {
        console.log(`  ${index + 1}. ${identity.userName} (${identity.mspId})`);
      });
    }
  });
} else {
  console.log('  ❌ 没有找到任何身份文件');
} 