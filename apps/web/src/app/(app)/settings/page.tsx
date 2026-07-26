'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, ApiError } from '../../../lib/api';
import { PageHeader, EmptyState, Badge } from '../../../components/ui';
import { useAuth } from '../../../hooks/useAuth';

interface Session {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
}

interface Provider {
  key: string;
  label: string;
  configured: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: sessions, mutate: mutateSessions } = useSWR<Session[]>('/auth/sessions', api.get);
  const { data: providers } = useSWR<Provider[]>('/providers', api.get);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [otpSecret, setOtpSecret] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await api.post('/auth/password/change', { currentPassword, newPassword });
      setMessage('Password aggiornata correttamente.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore.');
    }
  }

  async function setupOtp() {
    const result = await api.post<{ secret: string; otpauth: string }>('/auth/2fa/setup');
    setOtpSecret(result.secret);
  }

  async function confirmOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/auth/2fa/confirm', { otpCode });
      setMessage('Autenticazione a due fattori attivata.');
      setOtpSecret(null);
      setOtpCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Codice non valido.');
    }
  }

  async function revokeSession(id: string) {
    await api.delete(`/auth/sessions/${id}`);
    mutateSessions();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader title="Impostazioni" description="Sicurezza account, sessioni e stato dei provider." />

      <section className="card p-5">
        <h2 className="text-sm font-medium text-gray-200 mb-4">Stato provider OnlyFans</h2>
        <div className="grid grid-cols-2 gap-3">
          {providers?.map((p) => (
            <div key={p.key} className="flex items-center justify-between bg-surface-raised rounded-lg px-3 py-2">
              <span className="text-sm text-gray-300">{p.label}</span>
              <Badge tone={p.configured ? 'success' : 'warning'}>{p.configured ? 'Configurato' : 'Non configurato'}</Badge>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-medium text-gray-200 mb-4">Cambia password</h2>
        {message && <div className="text-sm text-emerald-400 mb-3">{message}</div>}
        {error && <div className="text-sm text-red-400 mb-3">{error}</div>}
        <form onSubmit={changePassword} className="space-y-3 max-w-sm">
          <div>
            <label className="label">Password attuale</label>
            <input type="password" className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">Nuova password</label>
            <input type="password" minLength={10} className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <button className="btn-primary">Aggiorna password</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-medium text-gray-200 mb-4">Autenticazione a due fattori (2FA)</h2>
        {user?.roleKey && !otpSecret && (
          <button className="btn-secondary" onClick={setupOtp}>Configura 2FA</button>
        )}
        {otpSecret && (
          <form onSubmit={confirmOtp} className="space-y-3 max-w-sm mt-3">
            <p className="text-xs text-gray-500">
              Aggiungi questa chiave segreta alla tua app di autenticazione: <code className="text-gray-300">{otpSecret}</code>
            </p>
            <input className="input-field" placeholder="Codice OTP" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} required />
            <button className="btn-primary">Conferma e attiva</button>
          </form>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-medium text-gray-200 mb-4">Sessioni attive</h2>
        {!sessions?.length && <EmptyState message="Nessuna sessione attiva." />}
        <div className="space-y-2">
          {sessions?.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-surface-raised rounded-lg px-3 py-2 text-sm">
              <div>
                <div className="text-gray-300">{s.userAgent || 'Dispositivo sconosciuto'}</div>
                <div className="text-xs text-gray-500">{s.ipAddress} · dal {new Date(s.createdAt).toLocaleString('it-IT')}</div>
              </div>
              <button className="btn-secondary text-xs px-2 py-1" onClick={() => revokeSession(s.id)}>Revoca</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
