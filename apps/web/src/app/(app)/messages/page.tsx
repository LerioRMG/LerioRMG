'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { api } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import { EmptyState, formatCurrency } from '../../../components/ui';

interface Creator {
  id: string;
  stageName: string;
  avatarUrl?: string;
}

interface ConversationSummary {
  id: string;
  unreadCount: number;
  isVip: boolean;
  lastMessageAt?: string;
  fan: { id: string; username: string; displayName?: string; vipLevel: string; lifetimeValue: number };
}

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body?: string;
  mediaUrl?: string;
  price?: number;
  isPpv: boolean;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  fan: { id: string; username: string; displayName?: string; totalSpent?: number; lifetimeValue: number };
  account: { id: string; username: string; provider: string };
  messages: Message[];
}

export default function MessagesProPage() {
  const { data: creators } = useSWR<Creator[]>('/creators', api.get);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!creatorId && creators && creators.length > 0) setCreatorId(creators[0].id);
  }, [creators, creatorId]);

  const { data: conversations, mutate: mutateList } = useSWR<ConversationSummary[]>(
    creatorId ? `/creators/${creatorId}/conversations` : null,
    api.get,
  );

  const { data: conversation, mutate: mutateConversation } = useSWR<ConversationDetail>(
    conversationId ? `/conversations/${conversationId}` : null,
    api.get,
  );

  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    socket.emit('conversation:join', conversationId);
    const handler = () => {
      mutateConversation();
      mutateList();
    };
    socket.on('message:new', handler);
    return () => {
      socket.emit('conversation:leave', conversationId);
      socket.off('message:new', handler);
    };
  }, [conversationId]);

  async function sendMessage() {
    if (!conversationId || !draft.trim()) return;
    const body = draft;
    setDraft('');
    await api.post(`/conversations/${conversationId}/messages`, { body });
    mutateConversation();
    mutateList();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3 border-b border-surface-border">
        {creators?.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCreatorId(c.id);
              setConversationId(null);
            }}
            className={clsx(
              'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs shrink-0',
              creatorId === c.id ? 'bg-brand-violet/15 border border-brand-violet/40 text-white' : 'text-gray-400 hover:bg-surface-card',
            )}
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-violet to-brand-blue flex items-center justify-center text-white text-xs font-semibold">
              {c.stageName.slice(0, 2).toUpperCase()}
            </div>
            {c.stageName}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        <div className="w-72 shrink-0 card overflow-y-auto">
          {(!conversations || conversations.length === 0) && <div className="p-4"><EmptyState message="Nessuna conversazione." /></div>}
          {conversations?.map((c) => (
            <button
              key={c.id}
              onClick={() => setConversationId(c.id)}
              className={clsx(
                'w-full text-left px-4 py-3 border-b border-surface-border hover:bg-surface-raised transition-colors',
                conversationId === c.id && 'bg-surface-raised',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-100 font-medium">{c.fan.displayName || c.fan.username}</span>
                {c.unreadCount > 0 && (
                  <span className="text-xs bg-brand-violet text-white rounded-full px-1.5">{c.unreadCount}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {c.fan.vipLevel !== 'none' ? `VIP ${c.fan.vipLevel} · ` : ''}
                {formatCurrency(c.fan.lifetimeValue)}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 card flex flex-col min-w-0">
          {!conversation ? (
            <EmptyState message="Seleziona una conversazione." />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {conversation.messages.map((m) => (
                  <div key={m.id} className={clsx('max-w-[70%] rounded-xl px-3 py-2 text-sm', m.direction === 'OUTBOUND' ? 'ml-auto bg-brand-violet/20 text-white' : 'bg-surface-raised text-gray-200')}>
                    {m.body}
                    {m.isPpv && m.price && <div className="text-xs text-amber-400 mt-1">PPV · {formatCurrency(m.price)}</div>}
                    <div className="text-[10px] text-gray-500 mt-1">{new Date(m.createdAt).toLocaleTimeString('it-IT')}</div>
                  </div>
                ))}
                {conversation.messages.length === 0 && <EmptyState message="Nessun messaggio in questa conversazione." />}
              </div>
              <div className="border-t border-surface-border p-3 flex gap-2">
                <input
                  className="input-field"
                  placeholder="Scrivi un messaggio…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button className="btn-primary" onClick={sendMessage}>Invia</button>
              </div>
            </>
          )}
        </div>

        <div className="w-72 shrink-0 card p-4">
          {conversation ? (
            <div className="space-y-3 text-sm">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-blue to-brand-violet mx-auto" />
              <div className="text-center text-gray-100 font-medium">{conversation.fan.displayName || conversation.fan.username}</div>
              <div className="text-center text-xs text-gray-500">@{conversation.fan.username}</div>
              <div className="border-t border-surface-border pt-3 space-y-2">
                <Row label="Speso totale" value={formatCurrency(conversation.fan.lifetimeValue)} />
                <Row label="Account" value={`@${conversation.account.username}`} />
                <Row label="Provider" value={conversation.account.provider} />
              </div>
            </div>
          ) : (
            <EmptyState message="Profilo fan" />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}
