'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '../../../lib/api';
import { PageHeader, StatCard, EmptyState, formatCurrency } from '../../../components/ui';

interface Summary {
  grossRevenue: number;
  netRevenue: number;
  totalFees: number;
  chargebacks: number;
  refunds: number;
}

interface CommissionRule {
  id: string;
  scope: string;
  scopeRefId?: string;
  percent: number;
}

export default function FinancePage() {
  const { data: summary, isLoading } = useSWR<Summary>('/finance/summary', api.get);
  const { data: rules, mutate } = useSWR<CommissionRule[]>('/finance/commission-rules', api.get);
  const [scope, setScope] = useState('role');
  const [percent, setPercent] = useState('10');

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/finance/commission-rules', { scope, percent: Number(percent) });
    mutate();
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  return (
    <div>
      <PageHeader
        title="Finanze"
        description="Riepilogo finanziario e configurazione delle commissioni."
        actions={
          <a className="btn-secondary" href={`${apiBase}/api/finance/export.csv`}>
            Esporta CSV
          </a>
        }
      />

      {isLoading && <EmptyState message="Caricamento…" />}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Ricavo lordo" value={formatCurrency(summary.grossRevenue)} />
          <StatCard label="Ricavo netto" value={formatCurrency(summary.netRevenue)} />
          <StatCard label="Fee provider" value={formatCurrency(summary.totalFees)} />
          <StatCard label="Chargeback" value={formatCurrency(summary.chargebacks)} />
          <StatCard label="Rimborsi" value={formatCurrency(summary.refunds)} />
        </div>
      )}

      <h2 className="text-sm font-medium text-gray-300 mb-3">Regole di commissione</h2>
      <form onSubmit={addRule} className="card p-4 mb-4 flex items-end gap-3">
        <div>
          <label className="label">Ambito</label>
          <select className="input-field" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="role">Per ruolo</option>
            <option value="creator">Per creator</option>
            <option value="account">Per account</option>
            <option value="sale_type">Per tipo vendita</option>
          </select>
        </div>
        <div>
          <label className="label">Percentuale</label>
          <input type="number" step="0.1" className="input-field" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </div>
        <button className="btn-primary">Aggiungi regola</button>
      </form>

      <div className="card divide-y divide-surface-border">
        {rules?.length === 0 && <div className="p-4"><EmptyState message="Nessuna regola di commissione configurata." /></div>}
        {rules?.map((r) => (
          <div key={r.id} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-gray-300">{r.scope}</span>
            <span className="text-gray-100">{r.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
