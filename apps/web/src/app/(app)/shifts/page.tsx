'use client';

import useSWR from 'swr';
import { api } from '../../../lib/api';
import { PageHeader, EmptyState, Badge } from '../../../components/ui';

interface Shift {
  id: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
  assignments: Array<{ id: string; clockInAt?: string; clockOutAt?: string; user: { firstName: string; lastName: string } }>;
}

interface ActiveAssignment {
  id: string;
  shiftId: string;
  clockInAt?: string;
  shift: { startsAt: string; endsAt: string };
}

export default function ShiftsPage() {
  const { data, mutate, isLoading } = useSWR<Shift[]>('/shifts', api.get);
  const { data: active, mutate: mutateActive } = useSWR<ActiveAssignment | null>('/shifts/me/active', api.get);

  async function clockIn(shiftId: string) {
    await api.post(`/shifts/${shiftId}/clock-in`);
    mutate();
    mutateActive();
  }

  async function clockOut(shiftId: string) {
    await api.post(`/shifts/${shiftId}/clock-out`, {});
    mutate();
    mutateActive();
  }

  return (
    <div>
      <PageHeader title="Turni" description="Gestione dei turni e clock-in/clock-out del team." />

      {active && (
        <div className="card p-4 mb-6 flex items-center justify-between">
          <span className="text-sm text-gray-200">
            Turno attivo dalle {new Date(active.shift.startsAt).toLocaleTimeString('it-IT')}
          </span>
          <button className="btn-primary" onClick={() => clockOut(active.shiftId)}>Termina turno</button>
        </div>
      )}

      {isLoading && <EmptyState message="Caricamento turni…" />}
      {data && data.length === 0 && <EmptyState message="Nessun turno pianificato." />}

      <div className="space-y-3">
        {data?.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-200 text-sm">
                {new Date(s.startsAt).toLocaleString('it-IT')} → {new Date(s.endsAt).toLocaleString('it-IT')}
              </span>
              {!active && (
                <button className="btn-secondary text-xs px-2 py-1" onClick={() => clockIn(s.id)}>Inizia turno</button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {s.assignments.map((a) => (
                <Badge key={a.id} tone={a.clockInAt && !a.clockOutAt ? 'success' : 'default'}>
                  {a.user.firstName} {a.user.lastName}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
