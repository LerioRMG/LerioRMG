'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { api, ApiError } from '../../../../lib/api';
import { PageHeader, EmptyState, Badge, formatCurrency } from '../../../../components/ui';

const TABS = ['Profilo', 'Account OnlyFans', 'Team', 'Prezzi', 'Personalità', 'AI', 'Note'] as const;
type Tab = (typeof TABS)[number];

interface CreatorDetail {
  id: string;
  stageName: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  status: string;
  language: string;
  country?: string;
  timezone: string;
  tags: string[];
  accounts: Array<{
    id: string;
    username: string;
    displayName: string;
    provider: string;
    connectionStatus: string;
    syncStatus: string;
    lastSyncedAt?: string;
    lastError?: string;
  }>;
  assignments: Array<{ role: string; user: { id: string; firstName: string; lastName: string; email: string } }>;
  pricing: Record<string, unknown> | null;
  personality: Record<string, unknown> | null;
  aiProfile: Record<string, unknown> | null;
  notes: Array<{ id: string; body: string; createdAt: string; author: { firstName: string; lastName: string } }>;
}

export default function CreatorDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, mutate, isLoading } = useSWR<CreatorDetail>(`/creators/${params.id}`, api.get);
  const [tab, setTab] = useState<Tab>('Profilo');

  if (isLoading) return <EmptyState message="Caricamento…" />;
  if (!data) return <EmptyState message="Creator non trovata." />;

  return (
    <div>
      <PageHeader title={data.stageName} description={`Stato: ${data.status}`} />

      <div className="flex gap-1 border-b border-surface-border mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? 'border-brand-violet text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Profilo' && <ProfiloTab data={data} onSaved={() => mutate()} />}
      {tab === 'Account OnlyFans' && <AccountsTab creatorId={data.id} accounts={data.accounts} onSaved={() => mutate()} />}
      {tab === 'Team' && <TeamTab creatorId={data.id} assignments={data.assignments} onSaved={() => mutate()} />}
      {tab === 'Prezzi' && <PrezziTab creatorId={data.id} pricing={data.pricing} onSaved={() => mutate()} />}
      {tab === 'Personalità' && <PersonalitaTab creatorId={data.id} personality={data.personality} onSaved={() => mutate()} />}
      {tab === 'AI' && <AiTab creatorId={data.id} />}
      {tab === 'Note' && <NoteTab creatorId={data.id} notes={data.notes} onSaved={() => mutate()} />}
    </div>
  );
}

function ProfiloTab({ data, onSaved }: { data: CreatorDetail; onSaved: () => void }) {
  const [form, setForm] = useState({
    stageName: data.stageName,
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    bio: data.bio || '',
    country: data.country || '',
    timezone: data.timezone,
    language: data.language,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/creators/${data.id}`, form);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5 max-w-2xl space-y-4">
      <Field label="Nome d'arte" value={form.stageName} onChange={(v) => setForm({ ...form, stageName: v })} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
        <Field label="Cognome" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Lingua" value={form.language} onChange={(v) => setForm({ ...form, language: v })} />
        <Field label="Paese" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
        <Field label="Fuso orario" value={form.timezone} onChange={(v) => setForm({ ...form, timezone: v })} />
      </div>
      <div>
        <label className="label">Bio</label>
        <textarea className="input-field" rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
      </div>
      <button className="btn-primary" onClick={save} disabled={saving}>
        {saving ? 'Salvataggio…' : 'Salva modifiche'}
      </button>
    </div>
  );
}

function AccountsTab({
  creatorId,
  accounts,
  onSaved,
}: {
  creatorId: string;
  accounts: CreatorDetail['accounts'];
  onSaved: () => void;
}) {
  const { data: providers } = useSWR<{ key: string; label: string; configured: boolean }[]>(
    '/providers',
    api.get,
  );
  const [form, setForm] = useState({ username: '', displayName: '', provider: 'MANUAL' });
  const [error, setError] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/creators/${creatorId}/accounts`, form);
      setForm({ username: '', displayName: '', provider: 'MANUAL' });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore di connessione.');
    }
  }

  async function runSync(accountId: string, operation: string) {
    await api.post(`/accounts/${accountId}/sync/${operation}`);
    onSaved();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={connect} className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Username</label>
          <input className="input-field" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        </div>
        <div>
          <label className="label">Nome visualizzato</label>
          <input className="input-field" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
        </div>
        <div>
          <label className="label">Provider</label>
          <select className="input-field" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
            {providers?.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label} {!p.configured && p.key.startsWith('PROVIDER_API') ? '(non configurato)' : ''}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary">Collega account</button>
      </form>
      {error && <div className="text-sm text-red-400">{error}</div>}

      {providers?.some((p) => p.key.startsWith('PROVIDER_API') && !p.configured) && (
        <div className="text-xs text-amber-400 bg-amber-950/30 border border-amber-900 rounded-lg px-3 py-2">
          Alcuni provider esterni non sono configurati. Imposta le relative variabili d&apos;ambiente per attivarli.
        </div>
      )}

      {accounts.length === 0 && <EmptyState message="Nessun account collegato." />}

      <div className="space-y-3">
        {accounts.map((acc) => (
          <div key={acc.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-white font-medium">{acc.displayName}</span>
                <span className="text-gray-500 text-sm ml-2">@{acc.username}</span>
              </div>
              <div className="flex gap-2">
                <Badge tone={acc.connectionStatus === 'CONNECTED' ? 'success' : acc.connectionStatus === 'NOT_CONFIGURED' ? 'warning' : 'danger'}>
                  {acc.connectionStatus === 'NOT_CONFIGURED' ? 'Provider non configurato' : acc.connectionStatus}
                </Badge>
                <Badge>{acc.provider}</Badge>
              </div>
            </div>
            {acc.lastError && <div className="text-xs text-red-400 mb-2">{acc.lastError}</div>}
            <div className="text-xs text-gray-500 mb-3">
              Ultima sincronizzazione: {acc.lastSyncedAt ? new Date(acc.lastSyncedAt).toLocaleString('it-IT') : 'mai'} · Stato: {acc.syncStatus}
            </div>
            <div className="flex flex-wrap gap-2">
              {['syncProfile', 'syncFans', 'syncMessages', 'syncTransactions', 'syncSubscriptions'].map((op) => (
                <button key={op} onClick={() => runSync(acc.id, op)} className="btn-secondary text-xs px-2 py-1">
                  {op}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamTab({
  creatorId,
  assignments,
  onSaved,
}: {
  creatorId: string;
  assignments: CreatorDetail['assignments'];
  onSaved: () => void;
}) {
  const { data: users } = useSWR<Array<{ id: string; firstName: string; lastName: string; role: { key: string } }>>(
    '/users',
    api.get,
  );
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('CHATTER');

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/creators/${creatorId}/assignments`, { userId, role });
    onSaved();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={assign} className="card p-4 flex items-end gap-3">
        <div>
          <label className="label">Utente</label>
          <select className="input-field" value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="">Seleziona…</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ruolo assegnazione</label>
          <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="CHATTER">Chatter</option>
            <option value="CHATTER_MANAGER">Chatter Manager</option>
            <option value="PUBLISHER">Publisher</option>
            <option value="EDITOR">Editor</option>
          </select>
        </div>
        <button className="btn-primary">Assegna</button>
      </form>

      <div className="card divide-y divide-surface-border">
        {assignments.length === 0 && <div className="p-4"><EmptyState message="Nessun membro del team assegnato." /></div>}
        {assignments.map((a, i) => (
          <div key={i} className="p-3 flex items-center justify-between text-sm">
            <span className="text-gray-200">{a.user.firstName} {a.user.lastName} <span className="text-gray-500">({a.user.email})</span></span>
            <Badge>{a.role}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrezziTab({ creatorId, pricing, onSaved }: { creatorId: string; pricing: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    subscriptionPrice: pricing?.subscriptionPrice || '',
    ppvMinPrice: pricing?.ppvMinPrice || '',
    ppvMaxPrice: pricing?.ppvMaxPrice || '',
    customPrice: pricing?.customPrice || '',
    videoPrice: pricing?.videoPrice || '',
    photoPrice: pricing?.photoPrice || '',
    voicePrice: pricing?.voicePrice || '',
    currency: pricing?.currency || 'EUR',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : k === 'currency' ? v : Number(v)]),
      );
      await api.patch(`/creators/${creatorId}/pricing`, payload);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5 max-w-2xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Prezzo abbonamento" value={form.subscriptionPrice} onChange={(v) => setForm({ ...form, subscriptionPrice: v })} />
        <Field label="Valuta" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
        <Field label="PPV minimo" value={form.ppvMinPrice} onChange={(v) => setForm({ ...form, ppvMinPrice: v })} />
        <Field label="PPV massimo" value={form.ppvMaxPrice} onChange={(v) => setForm({ ...form, ppvMaxPrice: v })} />
        <Field label="Custom" value={form.customPrice} onChange={(v) => setForm({ ...form, customPrice: v })} />
        <Field label="Video" value={form.videoPrice} onChange={(v) => setForm({ ...form, videoPrice: v })} />
        <Field label="Foto" value={form.photoPrice} onChange={(v) => setForm({ ...form, photoPrice: v })} />
        <Field label="Voice" value={form.voicePrice} onChange={(v) => setForm({ ...form, voicePrice: v })} />
      </div>
      <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvataggio…' : 'Salva prezzi'}</button>
    </div>
  );
}

function PersonalitaTab({ creatorId, personality, onSaved }: { creatorId: string; personality: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    tone: personality?.tone || '',
    lexicon: personality?.lexicon || '',
    emojis: (personality?.emojis || []).join(' '),
    forbiddenWords: (personality?.forbiddenWords || []).join(', '),
    forbiddenTopics: (personality?.forbiddenTopics || []).join(', '),
    backstory: personality?.backstory || '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/creators/${creatorId}/personality`, {
        tone: form.tone,
        lexicon: form.lexicon,
        emojis: form.emojis.split(' ').filter(Boolean),
        forbiddenWords: form.forbiddenWords.split(',').map((s: string) => s.trim()).filter(Boolean),
        forbiddenTopics: form.forbiddenTopics.split(',').map((s: string) => s.trim()).filter(Boolean),
        backstory: form.backstory,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5 max-w-2xl space-y-4">
      <Field label="Tono" value={form.tone} onChange={(v) => setForm({ ...form, tone: v })} placeholder="dolce, timido, spontaneo" />
      <Field label="Lessico" value={form.lexicon} onChange={(v) => setForm({ ...form, lexicon: v })} />
      <Field label="Emoji preferite" value={form.emojis} onChange={(v) => setForm({ ...form, emojis: v })} placeholder="🤍 🥹 ✨" />
      <Field label="Parole vietate (separate da virgola)" value={form.forbiddenWords} onChange={(v) => setForm({ ...form, forbiddenWords: v })} />
      <Field label="Argomenti vietati (separati da virgola)" value={form.forbiddenTopics} onChange={(v) => setForm({ ...form, forbiddenTopics: v })} />
      <div>
        <label className="label">Storia personale</label>
        <textarea className="input-field" rows={3} value={form.backstory} onChange={(e) => setForm({ ...form, backstory: e.target.value })} />
      </div>
      <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvataggio…' : 'Salva personalità'}</button>
    </div>
  );
}

function AiTab({ creatorId }: { creatorId: string }) {
  const { data, mutate, isLoading } = useSWR<any>(`/creators/${creatorId}/ai-profile`, api.get);
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <EmptyState message="Caricamento…" />;
  const current = form || data || { mode: 'DISABLED', temperature: 0.7, maxTokens: 400 };

  async function save() {
    setError(null);
    try {
      await api.patch(`/creators/${creatorId}/ai-profile`, current);
      mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore di salvataggio.');
    }
  }

  return (
    <div className="card p-5 max-w-2xl space-y-4">
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div>
        <label className="label">Modalità AI</label>
        <select
          className="input-field"
          value={current.mode}
          onChange={(e) => setForm({ ...current, mode: e.target.value })}
        >
          <option value="DISABLED">Disattivata</option>
          <option value="SUGGESTION">Suggerimento</option>
          <option value="COPILOT">Copilot</option>
          <option value="SEMI_AUTO">Automazione controllata</option>
        </select>
      </div>
      <div>
        <label className="label">Prompt di sistema</label>
        <textarea
          className="input-field"
          rows={4}
          value={current.systemPrompt || ''}
          onChange={(e) => setForm({ ...current, systemPrompt: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Temperature" value={String(current.temperature ?? 0.7)} onChange={(v) => setForm({ ...current, temperature: Number(v) })} />
        <Field label="Budget mensile (€)" value={String(current.monthlyBudget ?? '')} onChange={(v) => setForm({ ...current, monthlyBudget: v ? Number(v) : null })} />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={Boolean(current.autoSendEnabled)}
          onChange={(e) => setForm({ ...current, autoSendEnabled: e.target.checked })}
        />
        Invio automatico (richiede provider AI configurato)
      </label>
      <button className="btn-primary" onClick={save}>Salva configurazione AI</button>
    </div>
  );
}

function NoteTab({ creatorId, notes, onSaved }: { creatorId: string; notes: CreatorDetail['notes']; onSaved: () => void }) {
  const [body, setBody] = useState('');

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await api.post(`/creators/${creatorId}/notes`, { body });
    setBody('');
    onSaved();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addNote} className="card p-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="label">Nuova nota</label>
          <input className="input-field" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <button className="btn-primary">Aggiungi</button>
      </form>
      <div className="space-y-2">
        {notes.length === 0 && <EmptyState message="Nessuna nota." />}
        {notes.map((n) => (
          <div key={n.id} className="card p-3 text-sm">
            <div className="text-gray-200">{n.body}</div>
            <div className="text-xs text-gray-500 mt-1">
              {n.author.firstName} {n.author.lastName} · {new Date(n.createdAt).toLocaleString('it-IT')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input-field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
