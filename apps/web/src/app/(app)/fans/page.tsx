'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { PageHeader, EmptyState, Badge, formatCurrency } from '../../../components/ui';

interface Fan {
  id: string;
  username: string;
  displayName?: string;
  segment?: string;
  vipLevel: string;
  lifetimeValue: number;
  isBlacklisted: boolean;
  creatorLinks: Array<{ creator: { id: string; stageName: string } }>;
}

const SEGMENTS = ['', 'new', 'subscriber', 'expiring', 'expired', 'whale', 'vip', 'inactive'];

export default function FansPage() {
  const [segment, setSegment] = useState('');
  const [search, setSearch] = useState('');
  const query = new URLSearchParams({ ...(segment ? { segment } : {}), ...(search ? { search } : {}) }).toString();
  const { data, isLoading } = useSWR<Fan[]>(`/fans${query ? `?${query}` : ''}`, api.get);

  return (
    <div>
      <PageHeader title="Fan" description="Elenco dei fan collegati alle creator dell'organizzazione." />

      <div className="flex gap-3 mb-4">
        <input className="input-field max-w-xs" placeholder="Cerca username…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input-field max-w-xs" value={segment} onChange={(e) => setSegment(e.target.value)}>
          {SEGMENTS.map((s) => (
            <option key={s} value={s}>{s || 'Tutti i segmenti'}</option>
          ))}
        </select>
      </div>

      {isLoading && <EmptyState message="Caricamento fan…" />}
      {data && data.length === 0 && <EmptyState message="Nessun fan trovato." />}

      <div className="card divide-y divide-surface-border">
        {data?.map((fan) => (
          <Link key={fan.id} href={`/fans/${fan.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-raised block">
            <div>
              <div className="text-sm text-gray-100">{fan.displayName || fan.username}</div>
              <div className="text-xs text-gray-500">
                @{fan.username} · {fan.creatorLinks.map((l) => l.creator.stageName).join(', ')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {fan.isBlacklisted && <Badge tone="danger">Blacklist</Badge>}
              {fan.vipLevel !== 'none' && <Badge tone="warning">VIP {fan.vipLevel}</Badge>}
              <span className="text-sm text-gray-300">{formatCurrency(fan.lifetimeValue)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
