import Constants from 'expo-constants';
import type { AuthResponse } from '@/types';

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://nextdoorlearn-backend.onrender.com/api'
).replace(/\/$/, '');

export const assetUrl = (path?: string | null) => {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL.replace(/\/api$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onSessionRefresh: ((tokens: { token: string; refreshToken: string }) => Promise<void>) | null = null;
let refreshing: Promise<string | null> | null = null;

export const configureApiSession = (
  session: { token: string; refreshToken: string } | null,
  handler?: (tokens: { token: string; refreshToken: string }) => Promise<void>
) => {
  accessToken = session?.token || null;
  refreshToken = session?.refreshToken || null;
  onSessionRefresh = handler || null;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { error: text }; }
  if (!response.ok) {
    throw new ApiError(
      String(payload.error || payload.message || 'Something went wrong. Please try again.'),
      response.status,
      typeof payload.code === 'string' ? payload.code : undefined
    );
  }
  return payload as T;
};

const renewSession = async () => {
  if (!refreshToken) return null;
  if (!refreshing) {
    refreshing = (async () => {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, deviceName: Constants.deviceName || undefined })
      });
      if (!response.ok) return null;
      const tokens = await parseResponse<{ token: string; refreshToken: string }>(response);
      accessToken = tokens.token;
      refreshToken = tokens.refreshToken;
      await onSessionRefresh?.(tokens);
      return tokens.token;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
};

type RequestOptions = RequestInit & { authenticated?: boolean; retry?: boolean };

export const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { authenticated = true, retry = true, headers, ...init } = options;
  const isForm = init.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(authenticated && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if ((response.status === 401 || response.status === 403) && authenticated && retry && refreshToken) {
    const renewed = await renewSession();
    if (renewed) return request<T>(path, { ...options, retry: false });
  }
  return parseResponse<T>(response);
};

export const api = {
  login: (email: string, password: string) => request<AuthResponse>('/auth/login', {
    method: 'POST', authenticated: false,
    body: JSON.stringify({ email, password, deviceName: Constants.deviceName || 'Mobile app' })
  }),
  register: (data: { name: string; email: string; password: string }) => request<AuthResponse>('/auth/register', {
    method: 'POST', authenticated: false,
    body: JSON.stringify({ ...data, role: 'student', deviceName: Constants.deviceName || 'Mobile app' })
  }),
  forgotPassword: (email: string) => request<{ message: string }>('/auth/forgot-password', {
    method: 'POST', authenticated: false, body: JSON.stringify({ email })
  }),
  logout: (token: string | null) => request('/auth/logout', {
    method: 'POST', authenticated: false, body: JSON.stringify({ refreshToken: token })
  }),
  profile: () => request<Record<string, any>>('/users/profile'),
  updateProfile: (body: Record<string, unknown>) => request('/users/profile', { method: 'PUT', body: JSON.stringify(body) }),
  deleteAccount: (currentPassword: string) => request('/users/account', {
    method: 'DELETE', body: JSON.stringify({ currentPassword, confirmation: 'DELETE' })
  }),
  uploadAvatar: (uri: string) => {
    const form = new FormData();
    form.append('avatar', { uri, name: 'profile.jpg', type: 'image/jpeg' } as unknown as Blob);
    return request<{ avatarUrl: string }>('/upload/avatar', { method: 'POST', body: form });
  },
  registerPushToken: (body: Record<string, string>) => request('/devices/push-token', { method: 'POST', body: JSON.stringify(body) }),
  unregisterPushToken: (token: string) => request('/devices/push-token', { method: 'DELETE', body: JSON.stringify({ token }) }),
};
