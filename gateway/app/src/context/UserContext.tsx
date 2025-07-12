import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserContextType } from '../types';
import { getUsersWithBalances } from '../services/walletApi';

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingUser, setSwitchingUser] = useState(false);

  // 刷新用户余额的函数
  const refreshUserBalances = async () => {
    try {
      const userList = await getUsersWithBalances();
      setUsers(userList);
      
      // 如果当前用户存在，更新当前用户的余额信息
      if (currentUser) {
        const updatedCurrentUser = userList.find(user => user.id === currentUser.id);
        if (updatedCurrentUser) {
          setCurrentUser(updatedCurrentUser);
        }
        // 如果找不到当前用户，保持当前用户不变，不重置为默认用户
      }
    } catch (error) {
      console.error('刷新用户余额失败:', error);
    }
  };

  // 设置当前用户并刷新余额
  const setCurrentUserAndRefresh = async (user: User) => {
    // 先保存要切换的用户ID
    const targetUserId = user.id;
    
    // 设置切换状态
    setSwitchingUser(true);
    
    // 刷新用户余额
    try {
      const userList = await getUsersWithBalances();
      setUsers(userList);
      
      // 在刷新后的用户列表中找到目标用户
      const updatedTargetUser = userList.find(u => u.id === targetUserId);
      if (updatedTargetUser) {
        setCurrentUser(updatedTargetUser);
      } else {
        // 如果找不到目标用户，使用原始用户对象
        setCurrentUser(user);
      }
    } catch (error) {
      console.error('刷新用户余额失败:', error);
      // 即使刷新失败，也要设置目标用户
      setCurrentUser(user);
    } finally {
      // 延迟一点时间让用户感知到切换过程
      setTimeout(() => {
        setSwitchingUser(false);
      }, 500);
    }
  };

  useEffect(() => {
    getUsersWithBalances().then(userList => {
      setUsers(userList);
      if (userList.length > 0) setCurrentUser(userList[0]);
      setLoading(false);
    });
  }, []);

  return (
    <UserContext.Provider value={{ 
      users, 
      currentUser, 
      setCurrentUser: setCurrentUserAndRefresh, 
      loading,
      switchingUser,
      refreshUserBalances 
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserContext must be used within UserProvider');
  return ctx;
}; 