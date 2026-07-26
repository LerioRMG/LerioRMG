const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function rawFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
}

/**
 * Client HTTP centralizzato. Se una richiesta risponde 401, tenta un refresh
 * del token una sola volta prima di rilanciare l'errore (evita loop infiniti).
 */
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const res = await rawFetch(path, options);

  if (res.status === 401 && retry) {
    const refreshRes = await rawFetch('/auth/refresh', { method: 'POST' });
    if (refreshRes.ok) {
      return apiFetch<T>(path, options, false);
    }
  }

  if (!res.ok) {
    let message = `Richiesta fallita (HTTP ${res.status})`;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      // risposta non JSON, mantieni messaggio generico
    }
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path),
  post: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  postForm: <T = unknown>(path: string, form: FormData) => apiFetch<T>(path, { method: 'POST', body: form }),
};
