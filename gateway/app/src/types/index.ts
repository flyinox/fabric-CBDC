export interface User {
  id: string;
  name: string;
  organization: string;
  address: string;
  balance: string;
  orgType?: 'central_bank' | 'commercial_bank';
  userName?: string;
  canManage?: boolean; // 是否可以访问管理功能
}

export interface Transaction {
  id: string;
  type: 'transfer' | 'approve' | 'transferFrom' | 'mint' | 'burn';
  amount: string;
  from: string;
  to: string;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
  hash?: string;
  spender?: string; // 新增：授权转账中的spender
}

export interface WalletState {
  currentUser: User | null;
  users: User[];
  transactions: Transaction[];
  loading: boolean;
}

export interface UserContextType {
  users: User[];
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  loading: boolean;
  switchingUser: boolean;
  refreshUserBalances: () => Promise<void>;
} 