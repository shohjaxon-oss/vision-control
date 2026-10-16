import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setToken, clearToken } from '@/lib/api';
import type { User, Role } from '@/types';

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pending2fa: boolean;
  challengeToken: string | null;
  login: (email: string, password: string) => Promise<{ requires2fa: boolean }>;
  verify2fa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  hasRole: (allowedRoles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pending2fa, setPending2fa] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
      clearToken();
    }
  }, []);

  // Initialize: attempt silent refresh & fetch /me
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        const me = await api.getMe();
        if (isMounted) setUser(me);
      } catch {
        if (isMounted) {
          setUser(null);
          clearToken();
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);

    if (res.requires_2fa && res.challenge_token) {
      setPending2fa(true);
      setChallengeToken(res.challenge_token);
      return { requires2fa: true };
    }

    if (res.access_token && res.user) {
      setToken(res.access_token);
      setUser(res.user);
      setPending2fa(false);
      setChallengeToken(null);
      return { requires2fa: false };
    }

    return { requires2fa: false };
  };

  const verify2fa = async (code: string) => {
    if (!challengeToken) {
      throw new Error("2FA tasdiqlash uchun sessiya topilmadi. Qaytadan tizimga kiring.");
    }
    const res = await api.verify2fa(challengeToken, code);
    setToken(res.access_token);
    setUser(res.user);
    setPending2fa(false);
    setChallengeToken(null);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      clearToken();
      setUser(null);
      setPending2fa(false);
      setChallengeToken(null);
    }
  };

  const hasRole = useCallback(
    (allowedRoles: Role[]): boolean => {
      if (!user) return false;
      return allowedRoles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: !!user,
        isLoading,
        pending2fa,
        challengeToken,
        login,
        verify2fa,
        logout,
        refreshMe,
        hasRole,
      }}
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
