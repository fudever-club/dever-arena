import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const PRESET_USERS = {
  GUEST: {
    id: 'guest_anon',
    username: 'Khách',
    name: 'Khách Vãng Lai',
    rating: 0,
    role: 'GUEST',
    rank: 'Newbie',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=guest'
  },
  PARTICIPANT: {
    id: 'u_dever_hero',
    username: 'dever_hero',
    name: 'Nguyễn Anh Tuấn (K19)',
    rating: 1742,
    role: 'PARTICIPANT',
    rank: 'Expert',
    clan: 'House of Buggy (K19)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=dever_hero'
  },
  ADMIN: {
    id: 'u_dever_admin',
    username: 'dever_admin',
    name: 'Ban Chuyên Môn FU-DEVER',
    rating: 2450,
    role: 'ADMIN',
    rank: 'Grandmaster',
    clan: 'Council Board',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=dever_admin'
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
    return PRESET_USERS.PARTICIPANT; // Default to dever_hero for seamless demo
  });

  // Setup BroadcastChannel for cross-tab realtime sync
  useEffect(() => {
    let channel = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('dever_arena_bus');
        channel.onmessage = (event) => {
          if (event.data?.type === 'AUTH_STATE_CHANGED') {
            console.log('[BroadcastChannel] Auth state updated from another tab:', event.data.payload);
            setCurrentUser(event.data.payload);
          }
        };
      }
    } catch (err) {
      console.warn('[BroadcastChannel] Initialization skipped:', err);
    }

    return () => {
      if (channel) channel.close();
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

  const loginWithPreset = (roleKey) => {
    const user = PRESET_USERS[roleKey] || PRESET_USERS.PARTICIPANT;
    setCurrentUser(user);
    broadcastAuthChange(user);
    return user;
  };

  const loginWithCredentials = (username, password) => {
    // Standard mock credential logic
    const role = username.toLowerCase().includes('admin') ? 'ADMIN' : 'PARTICIPANT';
    const newUser = {
      id: `u_${Date.now()}`,
      username: username || 'fpt_coder',
      name: username || 'FPT Coder',
      rating: 1500,
      role: role,
      rank: role === 'ADMIN' ? 'Grandmaster' : 'Specialist',
      clan: 'FU-DEVER Member',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`
    };
    setCurrentUser(newUser);
    broadcastAuthChange(newUser);
    return newUser;
  };

  const logout = () => {
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
