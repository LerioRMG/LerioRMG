'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, ApiError } from '../../../lib/api';
import { PageHeader, EmptyState, Badge } from '../../../components/ui';

interface TeamUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  isOwner: boolean;
  role: { key: string; name: string };
}

export default function TeamPage() {
  const { data, mutate, isLoading } = useSWR<TeamUser[]>('/users', api.get);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', roleKey: 'CHATTER' });
  const [error, setError] = useState<string | null>(null);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/users', form);
      setShowCreate(false);
      setForm({ email: '', password: '', firstName: '', lastName: '', roleKey: 'CHATTER' });
      mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore durante la creazione.');
    }
  }

  async function suspend(id: string) {
    await api.patch(`/users/${id}/suspend`);
    mutate();
  }

  async function activate(id: string) {
    await api.patch(`/users/${id}/activate`);
    mutate();
  }

  return (
    <div>
      <PageHeader
        title="Team"
        description="Gestione dei membri del team, ruoli e stato degli account."
        actions={<button className="btn-primary" onClick={() => setShowCreate(true)}>+ Nuovo utente</button>}
      />

      {showCreate && (
        <form onSubmit={createUser} className="card p-4 mb-6 grid md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="label">Nome</label>
            <input className="input-field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </div>
          <div>
            <label className="label">Cognome</label>
            <input className="input-field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="label">Password iniziale</label>
            <input type="password" minLength={10} className="input-field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div>
            <label className="label">Ruolo</label>
            <select className="input-field" value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value })}>
              <option value="CHATTER">Chatter</option>
              <option value="CHATTER_MANAGER">Chatter Manager</option>
              <option value="ADMIN">Amministratore</option>
            </select>
          </div>
          <div className="md:col-span-5 flex gap-2">
            <button className="btn-primary">Crea utente</button>
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Annulla</button>
          </div>
        </form>
      )}
      {error && <div className="text-sm text-red-400 mb-4">{error}</div>}

      {isLoading && <EmptyState message="Caricamento team…" />}

      <div className="card divide-y divide-surface-border">
        {data?.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm text-gray-100">{u.firstName} {u.lastName} {u.isOwner && <Badge tone="warning">Owner</Badge>}</div>
              <div className="text-xs text-gray-500">{u.email} · {u.role.name}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={u.status === 'ACTIVE' ? 'success' : 'danger'}>{u.status}</Badge>
              {!u.isOwner && (
                u.status === 'ACTIVE' ? (
                  <button className="btn-secondary text-xs px-2 py-1" onClick={() => suspend(u.id)}>Sospendi</button>
                ) : (
                  <button className="btn-secondary text-xs px-2 py-1" onClick={() => activate(u.id)}>Riattiva</button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
