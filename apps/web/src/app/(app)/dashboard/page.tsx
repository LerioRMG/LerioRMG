'use client';

import useSWR from 'swr';
import { api } from '../../../lib/api';
import { PageHeader, StatCard, formatCurrency, EmptyState } from '../../../components/ui';

interface DashboardData {
  revenue: {
    today: number;
    last7Days: number;
    month: number;
    byType: { type: string; total: number; count: number }[];
    byCreator: { creatorId?: string; creatorName?: string; revenue: number }[];
  };
  fans: { active: number; total: number };
  messages: { sent: number; received: number; conversations: number };
  accounts: { disconnectedOrError: number; total: number };
}

export default function DashboardPage() {
  const { data, isLoading } = useSWR<DashboardData>('/analytics/dashboard', api.get);

  return (
    <div>
      <PageHeader title="Dashboard" description="Panoramica in tempo reale dell'organizzazione." />

      {isLoading && <EmptyState message="Caricamento statistiche…" />}

      {data && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Ricavi oggi" value={formatCurrency(data.revenue.today)} />
            <StatCard label="Ricavi ultimi 7 giorni" value={formatCurrency(data.revenue.last7Days)} />
            <StatCard label="Ricavi del mese" value={formatCurrency(data.revenue.month)} />
            <StatCard label="Fan attivi" value={String(data.fans.active)} hint={`${data.fans.total} totali`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Messaggi inviati" value={String(data.messages.sent)} />
            <StatCard label="Messaggi ricevuti" value={String(data.messages.received)} />
            <StatCard label="Conversazioni" value={String(data.messages.conversations)} />
            <StatCard
              label="Account con problemi"
              value={String(data.accounts.disconnectedOrError)}
              hint={`${data.accounts.total} account totali`}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-4">
              <h2 className="text-sm font-medium text-gray-300 mb-3">Ricavi per tipo</h2>
              {data.revenue.byType.length === 0 && <EmptyState message="Nessuna transazione nel periodo." />}
              <div className="space-y-2">
                {data.revenue.byType.map((t) => (
                  <div key={t.type} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{t.type}</span>
                    <span className="text-gray-200">{formatCurrency(t.total)} ({t.count})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <h2 className="text-sm font-medium text-gray-300 mb-3">Ricavi per creator</h2>
              {data.revenue.byCreator.length === 0 && <EmptyState message="Nessuna creator con ricavi nel periodo." />}
              <div className="space-y-2">
                {data.revenue.byCreator.map((c) => (
                  <div key={c.creatorId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{c.creatorName}</span>
                    <span className="text-gray-200">{formatCurrency(c.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
