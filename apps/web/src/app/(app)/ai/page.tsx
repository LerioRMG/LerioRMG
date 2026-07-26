'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { PageHeader, EmptyState, Badge } from '../../../components/ui';

interface Creator {
  id: string;
  stageName: string;
  aiProfile?: { mode: string } | null;
}

export default function AiOverviewPage() {
  const { data, isLoading } = useSWR<Creator[]>('/creators', api.get);

  return (
    <div>
      <PageHeader
        title="AI"
        description="Configurazione dei profili AI per creator. I suggerimenti richiedono un provider AI configurato lato server (AI_API_KEY)."
      />

      {isLoading && <EmptyState message="Caricamento…" />}

      <div className="card divide-y divide-surface-border">
        {data?.map((c) => (
          <Link key={c.id} href={`/creators/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-raised block">
            <span className="text-gray-200">{c.stageName}</span>
            <Badge tone={c.aiProfile?.mode && c.aiProfile.mode !== 'DISABLED' ? 'success' : 'default'}>
              {c.aiProfile?.mode || 'DISABLED'}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
