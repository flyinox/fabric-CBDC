import React from 'react';
import { Popup, List } from 'antd-mobile';
import type { User } from '../types';

interface UserSelectorDrawerProps {
  visible: boolean;
  onClose: () => void;
  users: User[];
  currentUser: User | null;
  onSelect: (user: User) => void;
}

const UserSelectorDrawer: React.FC<UserSelectorDrawerProps> = ({ visible, onClose, users, currentUser, onSelect }) => {
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
              onClick={() => onSelect(user)}
              style={{ fontWeight: currentUser?.id === user.id ? 600 : 400, color: currentUser?.id === user.id ? '#1677ff' : '#333' }}
              extra={currentUser?.id === user.id ? '当前' : ''}
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