'use client';

import useSWR from 'swr';
import { api, ApiError } from '../lib/api';

export interface AuthUser {
  userId: string;
  organizationId: string;
  email: string;
  roleKey: string;
  isOwner: boolean;
  permissions: string[];
  sessionId: string;
}

export function useAuth() {
  const { data, error, isLoading, mutate } = useSWR<AuthUser>(
    '/auth/me',
    (path: string) => api.get<AuthUser>(path),
    { shouldRetryOnError: false, revalidateOnFocus: false },
  );

  const isUnauthenticated = error instanceof ApiError && error.status === 401;

  const hasPermission = (permission: string) => Boolean(data?.isOwner || data?.permissions.includes(permission));

  const logout = async () => {
    await api.post('/auth/logout');
    await mutate(undefined, { revalidate: false });
    window.location.href = '/login';
  };

  return { user: data, isLoading, isUnauthenticated, hasPermission, refresh: mutate, logout };
}
