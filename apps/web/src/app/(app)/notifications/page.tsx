'use client';

import useSWR from 'swr';
import { api } from '../../../lib/api';
import { PageHeader, EmptyState, Badge } from '../../../components/ui';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  readAt?: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const { data, mutate, isLoading } = useSWR<Notification[]>('/notifications', api.get);

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    mutate();
  }

  return (
    <div>
      <PageHeader title="Notifiche" description="Centro notifiche in-app dell'organizzazione." />

      {isLoading && <EmptyState message="Caricamento…" />}
      {data && data.length === 0 && <EmptyState message="Nessuna notifica." />}

      <div className="card divide-y divide-surface-border">
        {data?.map((n) => (
          <div key={n.id} className="flex items-start justify-between px-4 py-3">
            <div>
              <div className="text-sm text-gray-100 flex items-center gap-2">
                {n.title} {!n.readAt && <Badge tone="warning">Nuova</Badge>}
              </div>
              {n.body && <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>}
              <div className="text-xs text-gray-600 mt-1">{new Date(n.createdAt).toLocaleString('it-IT')}</div>
            </div>
            {!n.readAt && (
              <button className="btn-secondary text-xs px-2 py-1" onClick={() => markRead(n.id)}>
                Segna come letta
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
