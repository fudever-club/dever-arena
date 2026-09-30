import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken as saveToken } from '../lib/apiClient';

const AuthContext = createContext(null);

const LOCAL_AVATAR = '/brand/icon-192.png';

export const PRESET_USERS = {
  GUEST: {
    id: 'guest_anon',
    username: 'Khách',
    name: 'Khách Vãng Lai',
    rating: 0,
    role: 'GUEST',
    rank: 'Newbie',
    avatar: LOCAL_AVATAR
  },
  PARTICIPANT: {
    id: 'u_participant',
    username: 'thi_sinh',
    name: 'Thí Sinh',
    rating: 1200,
    role: 'PARTICIPANT',
    rank: 'Newbie',
    clan: '',
    avatar: LOCAL_AVATAR
  },
  ADMIN: {
    id: 'u_dever_admin',
    username: 'dever_admin',
    name: 'Ban Chuyên Môn FU-DEVER',
    rating: 2450,
    role: 'ADMIN',
    rank: 'Grandmaster',
    clan: 'Council Board',
    avatar: LOCAL_AVATAR
  }
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('dever_auth_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading saved auth user:', e);
    }
    return PRESET_USERS.GUEST; // chưa đăng nhập = khách (Vòng 37.5: hết mặc định demo user)
  });

  // Setup BroadcastChannel for cross-tab realtime sync
  useEffect(() => {
    let channel = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('dever_arena_bus');
        channel.onmessage = (event) => {
          if (event.data?.type === 'AUTH_STATE_CHANGED') {
            setCurrentUser(event.data.payload);
          }
        };
      }
    } catch (err) {
      console.warn('[BroadcastChannel] Initialization skipped:', err);
    }

    // Token hết hạn/bị thu hồi (apiClient báo 401): về trạng thái khách
    const onUnauthorized = () => {
      setCurrentUser(PRESET_USERS.GUEST);
      try {
        localStorage.setItem('dever_auth_user', JSON.stringify(PRESET_USERS.GUEST));
        localStorage.setItem('dever_active_role', 'GUEST');
      } catch {}
    };
    window.addEventListener('dever:unauthorized', onUnauthorized);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('dever:unauthorized', onUnauthorized);
    };
  }, []);

  const broadcastAuthChange = (newUser) => {
    try {
      localStorage.setItem('dever_auth_user', JSON.stringify(newUser));
      localStorage.setItem('dever_active_role', newUser.role);
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('dever_arena_bus');
        channel.postMessage({ type: 'AUTH_STATE_CHANGED', payload: newUser });
        channel.close();
      }
    } catch (e) {
      console.error('Failed to broadcast auth change:', e);
    }
  };

  // Fast-switch: nút GUEST/PARTICIPANT/ADMIN thử đăng nhập BACKEND THẬT bằng tài khoản
  // test chung (dever_ts/dever_ts123 — chỉ tồn tại trên môi trường dev/test có seed demo).
  // Sai/hết tài khoản → báo lỗi trung thực, không fallback user ảo (Vòng 37.5).
  const PRESET_PASSWORDS = { PARTICIPANT: 'dever_ts123', ADMIN: 'dever_ts123' };
  const PRESET_USERNAME_OF = { PARTICIPANT: 'dever_ts', ADMIN: 'dever_admin' };
  const loginWithPreset = async (roleKey) => {
    if (roleKey === 'GUEST') {
      const guest = PRESET_USERS.GUEST;
      setCurrentUser(guest);
      broadcastAuthChange(guest);
      return guest;
    }
    const user = PRESET_USERS[roleKey] || PRESET_USERS.PARTICIPANT;
    const pw = PRESET_PASSWORDS[roleKey];
    const username = PRESET_USERNAME_OF[roleKey] || user.username;
    if (pw) {
      try {
        const data = await api.login(username, pw);
        saveToken(data.accessToken || data.token);
        const u = data.user;
        const backendUser = {
          id: u.id,
          username: u.username,
          name: u.full_name || u.username,
          rating: u.rating,
          role: u.role,
          rank: u.rank_tier || u.rank || 'Newbie',
          clan: u.clan_id || '',
          avatar: LOCAL_AVATAR,
        };
        setCurrentUser(backendUser);
        broadcastAuthChange(backendUser);
        return backendUser;
      } catch (e) {
        // Không fallback user ảo — ném lỗi trung thực để UI hiển thị (Vòng 37.5).
        throw new Error(e?.message || 'Đăng nhập nhanh thất bại — tài khoản test chưa có trên máy chủ này.');
      }
    }
    setCurrentUser(user);
    broadcastAuthChange(user);
    return user;
  };

  const loginWithCredentials = async (username, password) => {
    // Ưu tiên backend thật (JWT); rớt mạng → fallback mock local để vẫn demo được
    try {
      const data = await api.login(username, password);
      saveToken(data.accessToken || data.token);
      const u = data.user;
      const backendUser = {
        id: u.id,
        username: u.username,
        name: u.full_name || u.username,
        rating: u.rating,
        role: u.role,
        rank: u.rank_tier || u.rank || 'Newbie',
        clan: u.clan_id || '',
        avatar: LOCAL_AVATAR,
      };
      setCurrentUser(backendUser);
      broadcastAuthChange(backendUser);
      return backendUser;
    } catch (e) {
      if (e?.code !== 'NO_TOKEN') saveToken(null);
      // Fallback mock local (giữ hành vi cũ khi chưa có backend)
      const role = username.toLowerCase().includes('admin') ? 'ADMIN' : 'PARTICIPANT';
      const newUser = {
        id: `u_${Date.now()}`,
        username: username || 'fpt_coder',
        name: username || 'FPT Coder',
        rating: 1500,
        role: role,
        rank: role === 'ADMIN' ? 'Grandmaster' : 'Specialist',
        clan: 'FU-DEVER Member',
        avatar: LOCAL_AVATAR
      };
      setCurrentUser(newUser);
      broadcastAuthChange(newUser);
      return newUser;
    }
  };

  const logout = () => {
    saveToken(null);
    const guestUser = PRESET_USERS.GUEST;
    setCurrentUser(guestUser);
    broadcastAuthChange(guestUser);
  };

  return (
    <AuthContext.Provider value={{
      user: currentUser,
      isAuthenticated: currentUser.role !== 'GUEST',
      isAdmin: currentUser.role === 'ADMIN',
      loginWithPreset,
      loginWithCredentials,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
