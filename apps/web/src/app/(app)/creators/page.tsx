'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { api, ApiError } from '../../../lib/api';
import { PageHeader, EmptyState, Badge } from '../../../components/ui';

interface Creator {
  id: string;
  stageName: string;
  status: string;
  tags: string[];
  accounts: { id: string; connectionStatus: string }[];
  assignments: { user: { firstName: string; lastName: string } }[];
  aiProfile?: { mode: string } | null;
}

const STATUS_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  ONBOARDING: 'warning',
  INACTIVE: 'default',
  SUSPENDED: 'danger',
};

export default function CreatorsPage() {
  const { data, mutate, isLoading } = useSWR<Creator[]>('/creators', api.get);
  const [showCreate, setShowCreate] = useState(false);
  const [stageName, setStageName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function createCreator(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/creators', { stageName });
      setStageName('');
      setShowCreate(false);
      mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore durante la creazione.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Creator"
        description="Gestisci le creator dell'organizzazione e i relativi account collegati."
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + Nuova creator
          </button>
        }
      />

      {showCreate && (
        <form onSubmit={createCreator} className="card p-4 mb-6 flex items-end gap-3">
          <div className="flex-1">
            <label className="label">Nome d&apos;arte</label>
            <input className="input-field" value={stageName} onChange={(e) => setStageName(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary">Crea</button>
          <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Annulla</button>
        </form>
      )}
      {error && <div className="text-sm text-red-400 mb-4">{error}</div>}

      {isLoading && <EmptyState message="Caricamento creator…" />}
      {data && data.length === 0 && <EmptyState message="Nessuna creator ancora. Creane una per iniziare." />}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.map((creator) => (
          <Link href={`/creators/${creator.id}`} key={creator.id} className="card p-4 hover:border-brand-violet/50 transition-colors block">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-white">{creator.stageName}</span>
              <Badge tone={STATUS_TONE[creator.status] || 'default'}>{creator.status}</Badge>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              {creator.accounts.length} account collegati · AI: {creator.aiProfile?.mode || 'DISABLED'}
            </div>
            <div className="flex flex-wrap gap-1">
              {creator.tags.map((t) => (
                <span key={t} className="text-xs bg-surface-border rounded-full px-2 py-0.5 text-gray-400">{t}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
