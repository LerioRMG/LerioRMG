'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<{ requiresOtp?: boolean; success?: boolean }>('/auth/login', {
        email,
        password,
        otpCode: otpCode || undefined,
      });
      if (result.requiresOtp) {
        setNeedsOtp(true);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Errore imprevisto durante il login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-violet to-brand-blue text-white font-bold text-xl mb-3">
            HG
          </div>
          <h1 className="text-xl font-semibold text-white">Honey Garden CRM</h1>
          <p className="text-sm text-gray-500 mt-1">Accedi al gestionale</p>
        </div>

        <form onSubmit={onSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {needsOtp && (
            <div>
              <label className="label">Codice OTP (autenticazione a due fattori)</label>
              <input
                type="text"
                required
                className="input-field"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                autoComplete="one-time-code"
              />
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex">
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>

          <div className="text-center">
            <a href="/reset-password" className="text-xs text-gray-500 hover:text-gray-300">
              Password dimenticata?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
