'use client';

import { useAuth } from '../hooks/useAuth';
import { ROLE_LABELS_IT, SystemRole } from '@honey-garden/shared';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 border-b border-surface-border flex items-center justify-between px-6 bg-surface/60 backdrop-blur sticky top-0 z-10">
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <div className="text-right">
            <div className="text-sm text-gray-200">
              {user.email}
            </div>
            <div className="text-xs text-gray-500">
              {ROLE_LABELS_IT[user.roleKey as SystemRole] || user.roleKey}
            </div>
          </div>
        )}
        <button onClick={logout} className="btn-secondary">
          Logout
        </button>
      </div>
    </header>
  );
}
