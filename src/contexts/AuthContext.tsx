import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { clearToken, setToken } from '@/lib/api';
import { callApi } from '@/lib/apiFacade';
import type { User, AskResponse, Employee, Camera, AttendanceRecord, TimelineEvent, UnknownFace, EnrollmentSample } from '@/types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pending2fa: boolean;
  login: (email: string, password: string) => Promise<{ requires2fa: boolean }>;
  verify2fa: (code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pending2fa, setPending2fa] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('wfv_token');
    const savedUser = localStorage.getItem('wfv_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        clearToken();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await callApi<{ access_token: string; refresh_token: string; user: User; requires_2fa: boolean }>((a) => a.login(email, password));
    if (res.requires_2fa) {
      setPending2fa(true);
      return { requires2fa: true };
    }
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem('wfv_user', JSON.stringify(res.user));
    return { requires2fa: false };
  };

  const verify2fa = async (code: string) => {
    const res = await callApi<{ access_token: string; refresh_token: string; user: User }>((a) => a.verify2fa(code));
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem('wfv_user', JSON.stringify(res.user));
    setPending2fa(false);
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem('wfv_user');
    setUser(null);
    setPending2fa(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, pending2fa, login, verify2fa, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
