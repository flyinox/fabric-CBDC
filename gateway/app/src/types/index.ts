export interface User {
  id: string;
  name: string;
  organization: string;
  address: string;
  balance: string;
}

export interface Transaction {
  id: string;
  type: 'transfer' | 'approve' | 'mint' | 'burn';
  amount: string;
  from: string;
  to: string;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
  hash?: string;
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
} 