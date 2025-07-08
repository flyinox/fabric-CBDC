#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class UserSelector {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.walletPath = path.join(__dirname, '../wallet');
    this.currentUserFile = path.join(__dirname, '../.current-user');
  }

  close() {
    this.rl.close();
  }

  question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  // 获取所有可用的身份
  getAvailableIdentities() {
    if (!fs.existsSync(this.walletPath)) {
      return [];
    }

    const identityFiles = fs.readdirSync(this.walletPath)
      .filter(file => file.endsWith('.id'))
      .map(file => file.replace('.id', ''));

    return identityFiles.map(fileName => {
      const identityPath = path.join(this.walletPath, `${fileName}.id`);
      const identityData = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
      return {
        fileName: fileName,
        userName: identityData.userName,
        mspId: identityData.mspId,
        orgName: identityData.orgName,
        orgType: identityData.orgType,
        fullName: identityData.fullName
      };
    });
  }

  // 获取当前选择的用户（返回身份文件名）
  getCurrentUser() {
    if (fs.existsSync(this.currentUserFile)) {
      return fs.readFileSync(this.currentUserFile, 'utf8').trim();
    }
    return null;
  }

  // 设置当前用户
  setCurrentUser(identityFileName) {
    fs.writeFileSync(this.currentUserFile, identityFileName);
  }

  // 显示帮助信息
  showHelp() {
    console.log(`
👤 CBDC 用户选择工具

用法: node selectUser.js [选项]

选项:
  -list, --list              列出所有可用用户
  -current, --current        显示当前选择的用户
  -select, --select <用户>    选择指定用户
  -clear, --clear            清除当前用户选择
  -h, --help                 显示此帮助信息

示例:
  node selectUser.js -list
  node selectUser.js -current
  node selectUser.js -select admin
  node selectUser.js -clear
  node selectUser.js  # 交互式选择
`);
  }

  // 列出所有用户
  listUsers() {
    const identities = this.getAvailableIdentities();
    const currentUser = this.getCurrentUser();

    console.log('👥 可用的用户身份:');
    console.log('');

    if (identities.length === 0) {
      console.log('❌ 没有找到任何身份文件');
      console.log('请先运行: node createAllIdentities.js');
      return;
    }

    // 按组织分组
    const orgGroups = {};
    identities.forEach(identity => {
      if (!orgGroups[identity.orgName]) {
        orgGroups[identity.orgName] = [];
      }
      orgGroups[identity.orgName].push(identity);
    });

    // 按组织类型排序：央行在前，商业银行在后
    const orgOrder = ['CentralBank', 'Bank1', 'Bank2'];
    let globalIndex = 1;

    orgOrder.forEach(orgName => {
      if (orgGroups[orgName]) {
        const orgTypeIcon = orgGroups[orgName][0].orgType === 'central_bank' ? '🏛️' : '🏦';
        console.log(`${orgTypeIcon} ${orgName}:`);
        
        orgGroups[orgName].forEach(identity => {
          const currentIndicator = identity.fileName === currentUser ? ' 👤' : '';
          console.log(`  ${globalIndex}. ${identity.userName} (${identity.mspId})${currentIndicator}`);
          globalIndex++;
        });
        console.log('');
      }
    });

    if (currentUser) {
      console.log(`✅ 当前选择的用户: ${currentUser}`);
    } else {
      console.log('⚠️  当前未选择任何用户');
    }
  }

  // 显示当前用户
  showCurrentUser() {
    const currentUserFileName = this.getCurrentUser();
    if (currentUserFileName) {
      const identityPath = path.join(this.walletPath, `${currentUserFileName}.id`);
      if (fs.existsSync(identityPath)) {
        const identityData = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
        const orgTypeIcon = identityData.orgType === 'central_bank' ? '🏛️' : '🏦';
        console.log(`👤 当前选择的用户:`);
        console.log(`   👤 用户名: ${identityData.userName}`);
        console.log(`   🏛️  MSP: ${identityData.mspId}`);
        console.log(`   📋 组织: ${identityData.orgName}`);
        console.log(`   🏷️  类型: ${identityData.orgType}`);
      } else {
        console.log(`❌ 当前用户 ${currentUserFileName} 的身份文件不存在`);
        this.setCurrentUser('');
      }
    } else {
      console.log('⚠️  当前未选择任何用户');
    }
  }

  // 选择用户
  async selectUser(userName) {
    const identities = this.getAvailableIdentities();
    // 首先尝试按文件名匹配
    let targetIdentities = identities.filter(id => id.fileName === userName);
    // 如果没找到，再尝试按用户名匹配
    if (targetIdentities.length === 0) {
      targetIdentities = identities.filter(id => id.userName === userName);
    }
    if (targetIdentities.length === 0) {
      console.log(`❌ 用户 "${userName}" 不存在`);
      console.log('可用用户:');
      const uniqueUsers = [...new Set(identities.map(id => id.userName))];
      uniqueUsers.forEach(user => console.log(`  - ${user}`));
      console.log('\n或者使用完整文件名:');
      identities.forEach(id => console.log(`  - ${id.fileName}`));
      return false;
    }
    if (targetIdentities.length === 1) {
      // 只有一个匹配的用户
      const targetIdentity = targetIdentities[0];
      this.setCurrentUser(targetIdentity.fileName);
      console.log(`✅ 已选择用户: ${targetIdentity.userName} (${targetIdentity.mspId})`);
      return true;
    } else {
      // 多个匹配的用户，需要用户选择
      console.log(`🔍 发现多个匹配的用户:`);
      targetIdentities.forEach((identity, index) => {
        const orgTypeIcon = identity.orgType === 'central_bank' ? '🏛️' : '🏦';
        console.log(`  ${index + 1}. ${orgTypeIcon} ${identity.orgName} - ${identity.userName} (${identity.mspId})`);
      });
      while (true) {
        const selection = await this.question(`请选择用户 [1-${targetIdentities.length}]: `);
        const index = parseInt(selection) - 1;
        if (index >= 0 && index < targetIdentities.length) {
          const selectedIdentity = targetIdentities[index];
          this.setCurrentUser(selectedIdentity.fileName);
          console.log(`✅ 已选择用户: ${selectedIdentity.userName} (${selectedIdentity.mspId})`);
          return true;
        } else {
          console.log(`❌ 无效选择，请输入 1-${targetIdentities.length} 之间的数字`);
        }
      }
    }
  }

  // 清除当前用户
  clearCurrentUser() {
    if (fs.existsSync(this.currentUserFile)) {
      fs.unlinkSync(this.currentUserFile);
    }
    console.log('✅ 已清除当前用户选择');
  }

  // 交互式选择用户
  async interactiveSelect() {
    const identities = this.getAvailableIdentities();
    const currentUserFileName = this.getCurrentUser();
    if (identities.length === 0) {
      console.log('❌ 没有找到任何身份文件');
      console.log('请先运行: node createAllIdentities.js');
      return;
    }
    console.log('👤 请选择要使用的用户身份:');
    console.log('');
    // 按组织分组
    const orgGroups = {};
    identities.forEach(identity => {
      if (!orgGroups[identity.orgName]) {
        orgGroups[identity.orgName] = [];
      }
      orgGroups[identity.orgName].push(identity);
    });
    // 按组织类型排序：央行在前，商业银行在后
    const orgOrder = ['CentralBank', 'Bank1', 'Bank2'];
    let globalIndex = 1;
    const indexedIdentities = [];
    orgOrder.forEach(orgName => {
      if (orgGroups[orgName]) {
        const orgTypeIcon = orgGroups[orgName][0].orgType === 'central_bank' ? '🏛️' : '🏦';
        console.log(`${orgTypeIcon} ${orgName}:`);
        orgGroups[orgName].forEach(identity => {
          const currentIndicator = identity.fileName === currentUserFileName ? ' 👤' : '';
          console.log(`  ${globalIndex}. ${identity.userName} (${identity.mspId})${currentIndicator}`);
          indexedIdentities.push(identity);
          globalIndex++;
        });
        console.log('');
      }
    });
    while (true) {
      const selection = await this.question(`请选择用户 [1-${indexedIdentities.length}]: `);
      const index = parseInt(selection) - 1;
      if (index >= 0 && index < indexedIdentities.length) {
        const selectedIdentity = indexedIdentities[index];
        this.setCurrentUser(selectedIdentity.fileName);
        console.log(`✅ 已选择用户: ${selectedIdentity.userName} (${selectedIdentity.mspId})`);
        break;
      } else {
        console.log(`❌ 无效选择，请输入 1-${indexedIdentities.length} 之间的数字`);
      }
    }
  }

  // 解析命令行参数
  parseArgs() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '-list':
        case '--list':
          this.listUsers();
          return true;
          
        case '-current':
        case '--current':
          this.showCurrentUser();
          return true;
          
        case '-select':
        case '--select':
          if (i + 1 < args.length) {
            const userName = args[i + 1];
            this.selectUser(userName);
            return true;
          } else {
            console.log('❌ 请指定要选择的用户名');
            return true;
          }
          
        case '-clear':
        case '--clear':
          this.clearCurrentUser();
          return true;
          
        case '-h':
        case '--help':
          this.showHelp();
          return true;
      }
    }
    
    return false;
  }

  // 执行
  async execute() {
    try {
      const handled = this.parseArgs();
      
      if (!handled) {
        await this.interactiveSelect();
      }
    } catch (error) {
      console.log('❌ 执行失败:', error.message);
    } finally {
      this.close();
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const selector = new UserSelector();
  selector.execute();
}

module.exports = UserSelector; 