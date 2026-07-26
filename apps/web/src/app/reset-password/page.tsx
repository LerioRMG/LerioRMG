'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '../../lib/api';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/auth/password/reset-request', { email });
      setMessage('Se l\'indirizzo esiste, riceverai un\'email con le istruzioni per reimpostare la password.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore imprevisto.');
    }
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/auth/password/reset-confirm', { token, newPassword });
      setMessage('Password aggiornata. Ora puoi accedere con la nuova password.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore imprevisto.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm card p-6 space-y-4">
        <h1 className="text-lg font-semibold text-white">
          {token ? 'Imposta una nuova password' : 'Recupero password'}
        </h1>

        {message && <div className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-900 rounded-lg px-3 py-2">{message}</div>}
        {error && <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>}

        {token ? (
          <form onSubmit={confirmReset} className="space-y-4">
            <div>
              <label className="label">Nuova password</label>
              <input
                type="password"
                required
                minLength={10}
                className="input-field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center flex">
              Aggiorna password
            </button>
          </form>
        ) : (
          <form onSubmit={requestReset} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center flex">
              Invia istruzioni
            </button>
          </form>
        )}

        <div className="text-center">
          <a href="/login" className="text-xs text-gray-500 hover:text-gray-300">
            Torna al login
          </a>
        </div>
      </div>
    </div>
  );
}
