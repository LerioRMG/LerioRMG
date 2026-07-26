'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { SIDEBAR_ITEMS_IT } from '@honey-garden/shared';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-surface-raised border-r border-surface-border h-screen sticky top-0 flex flex-col">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-surface-border">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-violet to-brand-blue flex items-center justify-center text-white text-xs font-bold">
          HG
        </div>
        <span className="text-sm font-semibold text-white">Honey Garden</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {SIDEBAR_ITEMS_IT.map((item) => {
          const active = pathname === item.path || pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.key}
              href={item.path}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-brand-violet/15 text-white border border-brand-violet/30'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-surface-card border border-transparent',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
