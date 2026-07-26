'use client';

import useSWR from 'swr';
import { api } from '../../../lib/api';
import { PageHeader, EmptyState, Badge } from '../../../components/ui';

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  result: string;
  ipAddress?: string;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string } | null;
}

interface AuditResponse {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AuditLogPage() {
  const { data, isLoading } = useSWR<AuditResponse>('/audit-log', api.get);

  return (
    <div>
      <PageHeader title="Audit Log" description="Registro immutabile delle azioni sensibili. Sola lettura." />

      {isLoading && <EmptyState message="Caricamento…" />}
      {data && data.items.length === 0 && <EmptyState message="Nessuna voce nell'audit log." />}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-surface-border">
              <th className="px-4 py-2 font-medium">Data</th>
              <th className="px-4 py-2 font-medium">Utente</th>
              <th className="px-4 py-2 font-medium">Azione</th>
              <th className="px-4 py-2 font-medium">Risorsa</th>
              <th className="px-4 py-2 font-medium">IP</th>
              <th className="px-4 py-2 font-medium">Esito</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((entry) => (
              <tr key={entry.id} className="border-b border-surface-border last:border-0">
                <td className="px-4 py-2 text-gray-400">{new Date(entry.createdAt).toLocaleString('it-IT')}</td>
                <td className="px-4 py-2 text-gray-300">{entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : '—'}</td>
                <td className="px-4 py-2 text-gray-300">{entry.action}</td>
                <td className="px-4 py-2 text-gray-400">{entry.resource}</td>
                <td className="px-4 py-2 text-gray-500">{entry.ipAddress || '—'}</td>
                <td className="px-4 py-2">
                  <Badge tone={entry.result === 'success' ? 'success' : 'danger'}>{entry.result}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
