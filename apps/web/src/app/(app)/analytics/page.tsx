'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '../../../lib/api';
import { PageHeader, StatCard, EmptyState, formatCurrency } from '../../../components/ui';

interface DashboardData {
  revenue: {
    range: number;
    byType: { type: string; total: number; count: number }[];
    byCreator: { creatorId?: string; creatorName?: string; revenue: number }[];
  };
  fans: { active: number; total: number };
  messages: { sent: number; received: number; conversations: number };
}

export default function AnalyticsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const { data, isLoading } = useSWR<DashboardData>(`/analytics/dashboard${query ? `?${query}` : ''}`, api.get);

  return (
    <div>
      <PageHeader title="Analytics" description="Statistiche dettagliate filtrabili per periodo." />

      <div className="flex gap-3 mb-6">
        <div>
          <label className="label">Da</label>
          <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">A</label>
          <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading && <EmptyState message="Caricamento…" />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Ricavi nel periodo" value={formatCurrency(data.revenue.range)} />
            <StatCard label="Fan attivi" value={String(data.fans.active)} />
            <StatCard label="Conversazioni" value={String(data.messages.conversations)} />
            <StatCard label="Messaggi inviati" value={String(data.messages.sent)} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-4">
              <h2 className="text-sm font-medium text-gray-300 mb-3">Ricavi per tipo di vendita</h2>
              {data.revenue.byType.map((t) => (
                <div key={t.type} className="flex justify-between text-sm py-1">
                  <span className="text-gray-400">{t.type}</span>
                  <span className="text-gray-200">{formatCurrency(t.total)}</span>
                </div>
              ))}
            </div>
            <div className="card p-4">
              <h2 className="text-sm font-medium text-gray-300 mb-3">Ricavi per creator</h2>
              {data.revenue.byCreator.map((c) => (
                <div key={c.creatorId} className="flex justify-between text-sm py-1">
                  <span className="text-gray-400">{c.creatorName}</span>
                  <span className="text-gray-200">{formatCurrency(c.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
