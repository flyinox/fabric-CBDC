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
  async connect(identityFileName = 'CentralBank_Admin') {
    if (!this.connectionProfile) {
      this.buildConnectionProfile();
    }
    // 加载钱包
    const walletPath = path.join(__dirname, '../wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    // 检查身份是否存在
    const identity = await wallet.get(identityFileName);
    if (!identity) {
      throw new Error(`钱包中未找到身份 "${identityFileName}"`);
    }
    // 创建网关连接
    this.gateway = new Gateway();
    await this.gateway.connect(this.connectionProfile, {
      wallet,
      identity: identityFileName,
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

  // 获取当前选择的用户（返回身份文件名）
  getCurrentUser() {
    const currentUserFile = path.join(__dirname, '../.current-user');
    if (fs.existsSync(currentUserFile)) {
      return fs.readFileSync(currentUserFile, 'utf8').trim();
    }
    return null;
  }

  // 获取用户身份信息（通过身份文件名）
  getUserIdentityInfo(identityFileName) {
    const walletPath = path.join(__dirname, '../wallet');
    const identityPath = path.join(walletPath, `${identityFileName}.id`);
    if (fs.existsSync(identityPath)) {
      return JSON.parse(fs.readFileSync(identityPath, 'utf8'));
    }
    return null;
  }

  // 显示当前用户信息
  showCurrentUserInfo() {
    const currentUserFileName = this.getCurrentUser();
    if (currentUserFileName) {
      const identityInfo = this.getUserIdentityInfo(currentUserFileName);
      if (identityInfo) {
        const orgTypeIcon = identityInfo.orgType === 'central_bank' ? '🏛️' : '🏦';
        console.log(`👤 当前用户: ${orgTypeIcon} ${identityInfo.userName} (${identityInfo.mspId}) - ${identityInfo.orgName}`);
        return currentUserFileName;
      } else {
        console.log(`⚠️  当前用户 ${currentUserFileName} 的身份文件不存在`);
        const currentUserFile = path.join(__dirname, '../.current-user');
        try {
          if (fs.existsSync(currentUserFile)) {
            fs.unlinkSync(currentUserFile);
          }
        } catch (error) {
          console.log(`⚠️  清除当前用户设置失败: ${error.message}`);
        }
        return null;
      }
    } else {
      console.log('⚠️  当前未选择任何用户，将使用默认身份');
      return null;
    }
  }
}

module.exports = BaseService; 