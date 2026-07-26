'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '../../../lib/api';
import { PageHeader, EmptyState, Badge } from '../../../components/ui';

interface Automation {
  id: string;
  name: string;
  trigger: string;
  isActive: boolean;
  logs: Array<{ status: string; message?: string; createdAt: string }>;
}

const TRIGGERS = [
  'WELCOME_MESSAGE', 'RENEWAL_REMINDER', 'EXPIRATION', 'FOLLOW_UP', 'INACTIVE_FAN',
  'NEW_SUBSCRIBER', 'PPV_PURCHASED', 'TIP_RECEIVED', 'BIRTHDAY', 'RENEW_OFF',
  'ACCOUNT_DISCONNECTED', 'SYNC_FAILED',
];

export default function AutomationsPage() {
  const { data, mutate, isLoading } = useSWR<Automation[]>('/automations', api.get);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState(TRIGGERS[0]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/automations', { name, trigger, actions: { type: 'notification' } });
    setName('');
    mutate();
  }

  async function toggle(id: string, isActive: boolean) {
    await api.patch(`/automations/${id}/active`, { isActive: !isActive });
    mutate();
  }

  return (
    <div>
      <PageHeader title="Automazioni" description="Automazioni basate su trigger reali sui dati del CRM (scadenze, rinnovi disattivati)." />

      <form onSubmit={create} className="card p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Nome</label>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Trigger</label>
          <select className="input-field" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
            {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button className="btn-primary">Crea automazione</button>
      </form>

      <div className="text-xs text-amber-400 bg-amber-950/30 border border-amber-900 rounded-lg px-3 py-2 mb-6">
        Solo i trigger EXPIRATION e RENEW_OFF vengono eseguiti automaticamente (ogni ora) in questa versione.
        Gli altri trigger sono predisposti ma richiedono l&apos;implementazione dell&apos;azione dedicata.
      </div>

      {isLoading && <EmptyState message="Caricamento…" />}

      <div className="space-y-3">
        {data?.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-gray-100 text-sm font-medium">{a.name}</span>
                <span className="text-xs text-gray-500 ml-2">{a.trigger}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={a.isActive ? 'success' : 'default'}>{a.isActive ? 'Attiva' : 'Disattiva'}</Badge>
                <button className="btn-secondary text-xs px-2 py-1" onClick={() => toggle(a.id, a.isActive)}>
                  {a.isActive ? 'Disattiva' : 'Attiva'}
                </button>
              </div>
            </div>
            {a.logs.length > 0 && (
              <div className="text-xs text-gray-500 space-y-0.5">
                {a.logs.map((l, i) => (
                  <div key={i}>{new Date(l.createdAt).toLocaleString('it-IT')} · {l.status} · {l.message}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
