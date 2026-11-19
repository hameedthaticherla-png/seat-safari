import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Role } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User;
  role: Role;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  quickSwitchPersona: (roleKey: 'guest' | 'student' | 'staff') => Promise<void>;
}

const GUEST_USER: User = {
  role: 'guest',
  display_name: 'Guest User',
};

const AuthContext = createContext<AuthContextType>({
  user: GUEST_USER,
  role: 'guest',
  token: null,
  isLoading: true,
  login: async () => GUEST_USER,
  logout: () => {},
  quickSwitchPersona: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('safari_token'));
  const [user, setUser] = useState<User>(() => {
    const saved = localStorage.getItem('safari_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return GUEST_USER;
      }
    }
    return GUEST_USER;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const currentToken = localStorage.getItem('safari_token');
    if (!currentToken) {
      setUser(GUEST_USER);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.auth.me();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem('safari_user', JSON.stringify(data.user));
      } else {
        setUser(GUEST_USER);
      }
    } catch {
      setUser(GUEST_USER);
      localStorage.removeItem('safari_token');
      localStorage.removeItem('safari_user');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    const handleAuthChange = () => {
      setToken(localStorage.getItem('safari_token'));
      refreshUser();
    };

    window.addEventListener('safari_auth_change', handleAuthChange);
    return () => window.removeEventListener('safari_auth_change', handleAuthChange);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.auth.login({ email, password });
    localStorage.setItem('safari_token', res.token);
    localStorage.setItem('safari_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('safari_token');
    localStorage.removeItem('safari_user');
    setToken(null);
    setUser(GUEST_USER);
  };

  const quickSwitchPersona = async (roleKey: 'guest' | 'student' | 'staff') => {
    if (roleKey === 'guest') {
      logout();
      return;
    }

    const credentialsMap: Record<string, { email: string; pass: string }> = {
      student: { email: 'student@demo.test', pass: 'Student123!' },
      staff: { email: 'library@demo.test', pass: 'Library123!' },
    };

    const target = credentialsMap[roleKey];
    if (target) {
      await login(target.email, target.pass);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user.role,
        token,
        isLoading,
        login,
        logout,
        quickSwitchPersona,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
