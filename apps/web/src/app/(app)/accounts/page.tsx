'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { PageHeader, EmptyState, Badge } from '../../../components/ui';

interface Provider {
  key: string;
  label: string;
  configured: boolean;
}

interface Creator {
  id: string;
  stageName: string;
  accounts: Array<{ id: string; connectionStatus: string; syncStatus: string }>;
}

export default function AccountsPage() {
  const { data: providers } = useSWR<Provider[]>('/providers', api.get);
  const { data: creators, isLoading } = useSWR<Creator[]>('/creators', api.get);

  return (
    <div className="space-y-8">
      <PageHeader title="Account" description="Architettura a provider per il collegamento degli account OnlyFans." />

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {providers?.map((p) => (
          <div key={p.key} className="card p-4">
            <div className="text-sm text-gray-200 font-medium mb-2">{p.label}</div>
            <Badge tone={p.configured ? 'success' : 'warning'}>{p.configured ? 'Configurato' : 'Provider non configurato'}</Badge>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-medium text-gray-300 mb-3">Account per creator</h2>
        {isLoading && <EmptyState message="Caricamento…" />}
        <div className="space-y-2">
          {creators?.map((c) => (
            <Link key={c.id} href={`/creators/${c.id}`} className="card p-4 flex items-center justify-between block hover:border-brand-violet/50">
              <span className="text-gray-200">{c.stageName}</span>
              <div className="flex gap-2">
                {c.accounts.length === 0 && <Badge tone="warning">Nessun account</Badge>}
                {c.accounts.map((a) => (
                  <Badge key={a.id} tone={a.connectionStatus === 'CONNECTED' ? 'success' : 'warning'}>
                    {a.connectionStatus}
                  </Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
