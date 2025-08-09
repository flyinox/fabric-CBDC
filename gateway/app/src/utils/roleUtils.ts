/**
 * 用户角色判断工具函数
 */

export interface WalletData {
  orgType: 'central_bank' | 'commercial_bank';
  userName: string;
  orgName: string;
  fullName: string;
}

/**
 * 判断用户是否可以访问管理功能
 * 规则：
 * 1. 如果 orgType 是 central_bank，不管是否为 Admin，都可以访问管理功能
 * 2. 如果 orgType 不是 central_bank，只有 Admin 用户才可以访问管理功能
 * 3. 普通用户（非 Admin 且非央行）不能访问管理功能
 */
export function canAccessManagement(walletData: WalletData): boolean {
  // 央行用户无论是否为 Admin 都可以访问管理功能
  if (walletData.orgType === 'central_bank') {
    return true;
  }
  
  // 非央行用户，只有 Admin 可以访问管理功能
  return walletData.userName === 'Admin';
}

/**
 * 判断用户是否为央行用户
 */
export function isCentralBankUser(walletData: WalletData): boolean {
  return walletData.orgType === 'central_bank';
}

/**
 * 判断用户是否为管理员
 */
export function isAdminUser(walletData: WalletData): boolean {
  return walletData.userName === 'Admin';
}

/**
 * 判断用户是否为银行管理员（非央行的管理员）
 */
export function isBankAdmin(walletData: WalletData): boolean {
  return walletData.orgType === 'commercial_bank' && walletData.userName === 'Admin';
}

/**
 * 判断用户是否为终端用户（非管理员的普通用户）
 */
export function isEndUser(walletData: WalletData): boolean {
  return walletData.userName !== 'Admin';
}

/**
 * 获取用户角色类型
 */
export function getUserRoleType(walletData: WalletData): 'central_bank' | 'bank_admin' | 'end_user' {
  if (walletData.orgType === 'central_bank') {
    return 'central_bank';
  }
  
  if (walletData.userName === 'Admin') {
    return 'bank_admin';
  }
  
  return 'end_user';
}

/**
 * 获取用户权限列表
 */
export function getUserPermissions(walletData: WalletData) {
  const canManage = canAccessManagement(walletData);
  const isCentralBank = isCentralBankUser(walletData);
  const isAdmin = isAdminUser(walletData);
  
  return {
    canManage,
    canMint: canManage, // 只有能管理的用户才能铸币
    canBurn: canManage, // 只有能管理的用户才能销毁
    canViewAllTransactions: canManage, // 只有能管理的用户才能查看所有交易
    canTransfer: true, // 所有用户都可以转账
    canApprove: true, // 所有用户都可以授权
  };
}
