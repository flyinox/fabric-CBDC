import React from 'react';
import { Popup, List } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import type { User } from '../types';

interface UserSelectorDrawerProps {
  visible: boolean;
  onClose: () => void;
  users: User[];
  currentUser: User | null;
  onSelect: (user: User) => void;
  switchingUser?: boolean;
}

const UserSelectorDrawer: React.FC<UserSelectorDrawerProps> = ({ visible, onClose, users, currentUser, onSelect, switchingUser = false }) => {
  const { t } = useTranslation();
  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="left"
      bodyStyle={{ width: 320, height: '100%', padding: 0 }}
    >
      <div style={{ padding: '24px 0 0 0', background: '#fff', height: '100%' }}>
        <List>
          {users.map(user => (
            <List.Item
              key={user.id}
              prefix={
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: currentUser?.id === user.id ? '#1677ff' : '#eee',
                  color: currentUser?.id === user.id ? '#fff' : '#333',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 20
                }}>{user.name[0]}</div>
              }
              onClick={() => !switchingUser && onSelect(user)}
              style={{ 
                fontWeight: currentUser?.id === user.id ? 600 : 400, 
                color: currentUser?.id === user.id ? '#1677ff' : '#333',
                opacity: switchingUser ? 0.5 : 1,
                cursor: switchingUser ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease'
              }}
              extra={
                currentUser?.id === user.id ? (
                  switchingUser ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 12,
                        height: 12,
                        border: '2px solid #1677ff',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      {t('common.switching')}
                    </div>
                  ) : t('common.current')
                ) : ''
              }
            >
              {user.name}
              <div style={{ fontSize: 12, color: '#888' }}>{user.organization}</div>
            </List.Item>
          ))}
        </List>
      </div>
    </Popup>
  );
};

export default UserSelectorDrawer; 