'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isUnauthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isUnauthenticated) router.replace('/login');
  }, [isUnauthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
        Caricamento…
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Header />
        <main className="p-6 max-w-[1600px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
