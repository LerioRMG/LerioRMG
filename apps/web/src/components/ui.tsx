export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      {hint && <div className="text-xs text-gray-600 mt-1">{hint}</div>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="text-sm text-gray-500 py-10 text-center">{message}</div>;
}

export function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const tones: Record<string, string> = {
    default: 'bg-surface-border text-gray-300',
    success: 'bg-emerald-950 text-emerald-400 border border-emerald-900',
    warning: 'bg-amber-950 text-amber-400 border border-amber-900',
    danger: 'bg-red-950 text-red-400 border border-red-900',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>;
}

export function formatCurrency(value: number | string, currency = 'EUR') {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(n || 0);
}
