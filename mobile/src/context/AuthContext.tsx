import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { api, configureApiSession } from '@/lib/api';
import type { AuthResponse, User } from '@/types';

const SESSION_KEY = 'nextdoorlearn.session.v1';
type StoredSession = Pick<AuthResponse, 'token' | 'refreshToken' | 'user'>;

const sessionStorage = {
  get: () => Platform.OS === 'web'
    ? Promise.resolve(typeof window === 'undefined' ? null : window.localStorage.getItem(SESSION_KEY))
    : SecureStore.getItemAsync(SESSION_KEY),
  set: (value: string) => Platform.OS === 'web'
    ? Promise.resolve(typeof window === 'undefined' ? undefined : window.localStorage.setItem(SESSION_KEY, value))
    : SecureStore.setItemAsync(SESSION_KEY, value),
  remove: () => Platform.OS === 'web'
    ? Promise.resolve(typeof window === 'undefined' ? undefined : window.localStorage.removeItem(SESSION_KEY))
    : SecureStore.deleteItemAsync(SESSION_KEY),
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(data: {
    name: string; email: string; password: string; ageGroup: '13-17' | '18+';
    guardianConsent: boolean; termsAccepted: boolean; privacyAccepted: boolean; safetyAccepted: boolean;
  }): Promise<void>;
  signOut(): Promise<void>;
  updateUser(changes: Partial<User>): Promise<void>;
  clearSession(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loading, setLoading] = useState(true);
  const restoredSessionChecked = useRef(false);

  const persist = useCallback(async (next: StoredSession | null) => {
    setSession(next);
    if (next) await sessionStorage.set(JSON.stringify(next));
    else await sessionStorage.remove();
  }, []);

  useEffect(() => {
    sessionStorage.get()
      .then((saved) => saved && setSession(JSON.parse(saved)))
      .catch(() => sessionStorage.remove())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    configureApiSession(session, async (tokens) => {
      if (session) await persist({ ...session, ...tokens });
    }, async () => {
      await persist(null);
      router.replace('/(auth)/welcome');
    });
  }, [persist, session]);

  useEffect(() => {
    if (loading || !session || restoredSessionChecked.current) return;
    restoredSessionChecked.current = true;
    api.profile()
      .then((profile) => persist({
        ...session,
        user: {
          ...session.user,
          id: profile.id,
          email: profile.email,
          role: profile.role,
          name: profile.name,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
        },
      }))
      .catch(() => undefined);
  }, [loading, persist, session]);

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
