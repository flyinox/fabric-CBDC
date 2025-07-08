const fs = require('fs');
const path = require('path');
const { Wallets, Gateway } = require('fabric-network');

class BaseService {
  constructor() {
    this.config = null;
    this.centralBankOrg = null;
    this.connectionProfile = null;
    this.gateway = null;
    this.network = null;
    this.contract = null;
  }

  // 加载网络配置
  loadNetworkConfig() {
    const configPath = path.resolve(__dirname, '../../network-config.json');
    const configRaw = fs.readFileSync(configPath, 'utf8');
    this.config = JSON.parse(configRaw);

    // 查找央行组织
    const orgs = this.config.network.organizations;
    this.centralBankOrg = orgs.find(org => org.type === 'central_bank');

    if (!this.centralBankOrg) {
      throw new Error('未找到央行组织 (type=central_bank)');
    }

    return this.centralBankOrg;
  }

  // 构建连接配置
  buildConnectionProfile() {
    if (!this.centralBankOrg) {
      this.loadNetworkConfig();
    }

    const peerName = `peer0.${this.centralBankOrg.domain}`;
    const ordererName = `orderer.${this.config.network.orderer.domain}`;
    
    this.connectionProfile = {
      name: "cbdc-network",
      version: "1.0.0",
      client: {
        organization: this.centralBankOrg.msp_id,
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
        [this.centralBankOrg.msp_id]: {
          mspid: this.centralBankOrg.msp_id,
          peers: [peerName],
          certificateAuthorities: [`ca.${this.centralBankOrg.domain}`]
        }
      },
      orderers: {
        [ordererName]: {
          url: `grpcs://localhost:${this.config.network.orderer.port}`,
          tlsCACerts: {
            path: path.resolve(__dirname, `../../organizations/ordererOrganizations/${this.config.network.orderer.domain}/orderers/${ordererName}/msp/tlscacerts/tlsca.${this.config.network.orderer.domain}-cert.pem`)
          },
          grpcOptions: {
            "ssl-target-name-override": ordererName,
            "hostnameOverride": ordererName
          }
        }
      },
      peers: {
        [peerName]: {
          url: `grpcs://localhost:${this.centralBankOrg.peer.port}`,
          tlsCACerts: {
            path: path.resolve(__dirname, `../../organizations/peerOrganizations/${this.centralBankOrg.domain}/tlsca/tlsca.${this.centralBankOrg.domain}-cert.pem`)
          },
          grpcOptions: {
            "ssl-target-name-override": peerName,
            "hostnameOverride": peerName
          }
        }
      },
      certificateAuthorities: {
        [`ca.${this.centralBankOrg.domain}`]: {
          url: `https://localhost:${this.centralBankOrg.peer.operations_port}`,
          caName: `ca-${this.centralBankOrg.name.toLowerCase()}`,
          tlsCACerts: {
            path: path.resolve(__dirname, `../../organizations/peerOrganizations/${this.centralBankOrg.domain}/ca/ca.${this.centralBankOrg.domain}-cert.pem`)
          },
          httpOptions: {
            verify: false
          }
        }
      }
    };

    return this.connectionProfile;
  }

  // 连接网络
  async connect(identityName = 'admin') {
    if (!this.connectionProfile) {
      this.buildConnectionProfile();
    }

    // 加载钱包
    const walletPath = path.join(__dirname, '../wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // 检查身份是否存在
    const identity = await wallet.get(identityName);
    if (!identity) {
      throw new Error(`钱包中未找到身份 "${identityName}"`);
    }

    // 创建网关连接
    this.gateway = new Gateway();
    await this.gateway.connect(this.connectionProfile, {
      wallet,
      identity: identityName,
      discovery: { enabled: false }
    });

    // 获取网络和合约
    this.network = await this.gateway.getNetwork('cbdc-channel');
    this.contract = this.network.getContract('cbdc');

    return {
      gateway: this.gateway,
      network: this.network,
      contract: this.contract
    };
  }

  // 断开连接
  disconnect() {
    if (this.gateway) {
      this.gateway.disconnect();
      this.gateway = null;
      this.network = null;
      this.contract = null;
    }
  }

  // 执行链码调用
  async invokeTransaction(functionName, ...args) {
    if (!this.contract) {
      throw new Error('合约未连接，请先调用 connect() 方法');
    }

    // 创建交易
    const transaction = this.contract.createTransaction(functionName);
    
    // 提交交易并获取交易ID
    const result = await transaction.submit(...args);
    
    // 返回交易ID
    return transaction.getTransactionId();
  }

  // 执行链码查询
  async evaluateTransaction(functionName, ...args) {
    if (!this.contract) {
      throw new Error('合约未连接，请先调用 connect() 方法');
    }

    return await this.contract.evaluateTransaction(functionName, ...args);
  }

  // 获取央行组织信息
  getCentralBankInfo() {
    if (!this.centralBankOrg) {
      this.loadNetworkConfig();
    }
    return this.centralBankOrg;
  }
}

module.exports = BaseService; 