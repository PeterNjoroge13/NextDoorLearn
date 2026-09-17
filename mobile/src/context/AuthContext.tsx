import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, configureApiSession } from '@/lib/api';
import type { AuthResponse, User } from '@/types';

const SESSION_KEY = 'nextdoorlearn.session.v1';
type StoredSession = Pick<AuthResponse, 'token' | 'refreshToken' | 'user'>;

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(data: { name: string; email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  updateUser(changes: Partial<User>): Promise<void>;
  clearSession(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loading, setLoading] = useState(true);

  const persist = useCallback(async (next: StoredSession | null) => {
    setSession(next);
    if (next) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  }, []);

  useEffect(() => {
    SecureStore.getItemAsync(SESSION_KEY)
      .then((saved) => saved && setSession(JSON.parse(saved)))
      .catch(() => SecureStore.deleteItemAsync(SESSION_KEY))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    configureApiSession(session, async (tokens) => {
      if (session) await persist({ ...session, ...tokens });
    });
  }, [persist, session]);

  const acceptAuth = useCallback(async (response: AuthResponse) => {
    await persist({ token: response.token, refreshToken: response.refreshToken, user: response.user });
    router.replace('/(app)/(tabs)/home');
  }, [persist]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user || null,
    loading,
    signIn: async (email, password) => acceptAuth(await api.login(email, password)),
    signUp: async (data) => acceptAuth(await api.register(data)),
    signOut: async () => {
      const token = session?.refreshToken || null;
      try { await api.logout(token); } catch {}
      await persist(null);
      router.replace('/(auth)/welcome');
    },
    updateUser: async (changes) => {
      if (session) await persist({ ...session, user: { ...session.user, ...changes } });
    },
    clearSession: async () => {
      await persist(null);
      router.replace('/(auth)/welcome');
    },
  }), [acceptAuth, loading, persist, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
};
