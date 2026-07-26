'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { PageHeader, EmptyState, Badge, formatCurrency } from '../../../../components/ui';

interface FanDetail {
  id: string;
  username: string;
  displayName?: string;
  notes?: string;
  tags: string[];
  vipLevel: string;
  lifetimeValue: number;
  creatorLinks: Array<{
    creator: { id: string; stageName: string };
    account: { username: string };
    subscriptionStatus: string;
    totalSpent: number;
  }>;
  transactions: Array<{ id: string; type: string; amountGross: number; occurredAt: string }>;
  aiMemories: Array<{ id: string; key: string; value: string }>;
}

export default function FanDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, mutate, isLoading } = useSWR<FanDetail>(`/fans/${params.id}`, api.get);
  const [memKey, setMemKey] = useState('');
  const [memValue, setMemValue] = useState('');

  if (isLoading) return <EmptyState message="Caricamento…" />;
  if (!data) return <EmptyState message="Fan non trovato." />;

  async function addMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!memKey.trim() || !memValue.trim()) return;
    await api.post(`/fans/${data!.id}/ai-memory`, { key: memKey, value: memValue });
    setMemKey('');
    setMemValue('');
    mutate();
  }

  async function deleteMemory(id: string) {
    await api.delete(`/fans/${data!.id}/ai-memory/${id}`);
    mutate();
  }

  return (
    <div>
      <PageHeader title={data.displayName || data.username} description={`@${data.username}`} />

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Lifetime value</div>
          <div className="text-xl text-white font-semibold">{formatCurrency(data.lifetimeValue)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Livello VIP</div>
          <div className="text-xl text-white font-semibold">{data.vipLevel}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Creator collegate</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.creatorLinks.map((l, i) => (
              <Badge key={i}>{l.creator.stageName}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-3">Transazioni recenti</h2>
          {data.transactions.length === 0 && <EmptyState message="Nessuna transazione." />}
          <div className="space-y-2">
            {data.transactions.map((t) => (
              <div key={t.id} className="flex justify-between text-sm">
                <span className="text-gray-400">{t.type} · {new Date(t.occurredAt).toLocaleDateString('it-IT')}</span>
                <span className="text-gray-200">{formatCurrency(t.amountGross)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-3">Memoria AI</h2>
          <form onSubmit={addMemory} className="flex gap-2 mb-3">
            <input className="input-field" placeholder="Chiave (es. interesse)" value={memKey} onChange={(e) => setMemKey(e.target.value)} />
            <input className="input-field" placeholder="Valore" value={memValue} onChange={(e) => setMemValue(e.target.value)} />
            <button className="btn-primary shrink-0">+</button>
          </form>
          {data.aiMemories.length === 0 && <EmptyState message="Nessuna memoria registrata." />}
          <div className="space-y-1">
            {data.aiMemories.map((m) => (
              <div key={m.id} className="flex justify-between text-sm bg-surface-raised rounded-lg px-3 py-1.5">
                <span className="text-gray-400">{m.key}: <span className="text-gray-200">{m.value}</span></span>
                <button onClick={() => deleteMemory(m.id)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
