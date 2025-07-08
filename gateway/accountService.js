const fs = require('fs');
const path = require('path');
const { Wallets, Gateway } = require('fabric-network');

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
console.log('  Peer端口:', centralBankOrg.peer.port);
console.log('  Peer操作端口:', centralBankOrg.peer.operations_port);
console.log('  CouchDB端口:', centralBankOrg.peer.couchdb_port);

// 构建连接配置
function buildConnectionProfile() {
  const peerName = `peer0.${centralBankOrg.domain}`;
  const ordererName = `orderer.${config.network.orderer.domain}`;
  
  return {
    name: "cbdc-network",
    version: "1.0.0",
    client: {
      organization: centralBankOrg.msp_id,
      connection: {
        timeout: {
          peer: {
            endorser: "300"
          },
          orderer: "300"
        }
      }
    },
    channels: {
      "cbdc-channel": {
        orderers: [ordererName],
        peers: {
          [peerName]: {
            endorsingPeer: true,
            chaincodeQuery: true,
            ledgerQuery: true,
            eventSource: true
          }
        }
      }
    },
    organizations: {
      [centralBankOrg.msp_id]: {
        mspid: centralBankOrg.msp_id,
        peers: [peerName],
        certificateAuthorities: [`ca.${centralBankOrg.domain}`]
      }
    },
    orderers: {
      [ordererName]: {
        url: `grpcs://localhost:${config.network.orderer.port}`,
        tlsCACerts: {
          path: path.resolve(__dirname, `../organizations/ordererOrganizations/${config.network.orderer.domain}/orderers/${ordererName}/msp/tlscacerts/tlsca.${config.network.orderer.domain}-cert.pem`)
        },
        grpcOptions: {
          "ssl-target-name-override": ordererName,
          "hostnameOverride": ordererName
        }
      }
    },
    peers: {
      [peerName]: {
        url: `grpcs://localhost:${centralBankOrg.peer.port}`,
        tlsCACerts: {
          path: path.resolve(__dirname, `../organizations/peerOrganizations/${centralBankOrg.domain}/tlsca/tlsca.${centralBankOrg.domain}-cert.pem`)
        },
        grpcOptions: {
          "ssl-target-name-override": peerName,
          "hostnameOverride": peerName
        }
      }
    },
    certificateAuthorities: {
      [`ca.${centralBankOrg.domain}`]: {
        url: `https://localhost:${centralBankOrg.peer.operations_port}`,
        caName: `ca-${centralBankOrg.name.toLowerCase()}`,
        tlsCACerts: {
          path: path.resolve(__dirname, `../organizations/peerOrganizations/${centralBankOrg.domain}/ca/ca.${centralBankOrg.domain}-cert.pem`)
        },
        httpOptions: {
          verify: false
        }
      }
    }
  };
}

// 连接网络并查询余额
async function queryBalance() {
  try {
    console.log('\n=== 连接网络并查询余额 ===');
    
    // 构建连接配置
    const connectionProfile = buildConnectionProfile();
    console.log('连接配置构建完成');
    
    // 加载钱包
    const walletPath = path.join(__dirname, 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    console.log('钱包加载完成');
    
    // 检查身份是否存在
    const identity = await wallet.get('admin');
    if (!identity) {
      throw new Error('钱包中未找到身份 "admin"');
    }
    console.log('身份加载完成: admin');
    console.log('身份MSP:', identity.mspId);
    console.log('身份MSP:', identity.mspId);
    
    // 创建网关连接
    const gateway = new Gateway();
    await gateway.connect(connectionProfile, {
      wallet,
      identity: 'admin',
      discovery: { enabled: false }
    });
    console.log('网关连接成功');
    
    // 获取网络和合约
    const network = await gateway.getNetwork('cbdc-channel');
    const contract = network.getContract('cbdc');
    console.log('合约获取成功: cbdc');
    
    // 查询当前客户端余额
    console.log('\n查询当前客户端余额...');
    const result = await contract.evaluateTransaction('ClientAccountBalance');
    const balance = parseInt(result.toString());
    console.log('当前客户端余额:', balance);
    
    // 查询客户端账户ID
    console.log('\n查询客户端账户ID...');
    const accountIdResult = await contract.evaluateTransaction('ClientAccountID');
    const accountId = accountIdResult.toString();
    console.log('客户端账户ID:', accountId);
    
    // 查询总供应量
    console.log('\n查询总供应量...');
    const supplyResult = await contract.evaluateTransaction('TotalSupply');
    const totalSupply = parseInt(supplyResult.toString());
    console.log('总供应量:', totalSupply);
    
    // 断开连接
    gateway.disconnect();
    console.log('\n连接已断开');
    
  } catch (error) {
    console.error('查询余额时发生错误:', error);
  }
}

// 如果直接运行此脚本，则执行查询
if (require.main === module) {
  queryBalance();
}

module.exports = {
  buildConnectionProfile,
  queryBalance
};
