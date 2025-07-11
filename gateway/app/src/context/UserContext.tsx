import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserContextType } from '../types';
import { getUsersWithBalances } from '../services/walletApi';

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsersWithBalances().then(userList => {
      setUsers(userList);
      if (userList.length > 0) setCurrentUser(userList[0]);
      setLoading(false);
    });
  }, []);

  return (
    <UserContext.Provider value={{ users, currentUser, setCurrentUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserContext must be used within UserProvider');
  return ctx;
}; 