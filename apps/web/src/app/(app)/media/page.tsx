'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '../../../lib/api';
import { PageHeader, EmptyState, Badge } from '../../../components/ui';

interface MediaAsset {
  id: string;
  fileName: string;
  type: string;
  visibility: string;
  sizeBytes: number;
  createdAt: string;
}

interface Creator {
  id: string;
  stageName: string;
}

export default function MediaVaultPage() {
  const { data, mutate, isLoading } = useSWR<MediaAsset[]>('/media', api.get);
  const { data: creators } = useSWR<Creator[]>('/creators', api.get);
  const [creatorId, setCreatorId] = useState('');
  const [type, setType] = useState('PHOTO');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !creatorId) return;
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', type);
      await api.postForm(`/media/creators/${creatorId}`, form);
      setFile(null);
      mutate();
    } catch (err) {
      setError('Caricamento fallito.');
    }
  }

  return (
    <div>
      <PageHeader title="Media Vault" description="Archivio centralizzato dei media delle creator." />

      <form onSubmit={upload} className="card p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Creator</label>
          <select className="input-field" value={creatorId} onChange={(e) => setCreatorId(e.target.value)} required>
            <option value="">Seleziona…</option>
            {creators?.map((c) => <option key={c.id} value={c.id}>{c.stageName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="PHOTO">Foto</option>
            <option value="VIDEO">Video</option>
            <option value="AUDIO">Audio</option>
            <option value="VOICE">Voice</option>
          </select>
        </div>
        <div>
          <label className="label">File</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
        </div>
        <button className="btn-primary">Carica</button>
      </form>
      {error && <div className="text-sm text-red-400 mb-4">{error}</div>}

      {isLoading && <EmptyState message="Caricamento…" />}
      {data && data.length === 0 && <EmptyState message="Nessun media caricato." />}

      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
        {data?.map((m) => (
          <a key={m.id} href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/media/${m.id}/download`} className="card p-4 block hover:border-brand-violet/50">
            <div className="text-sm text-gray-200 truncate mb-1">{m.fileName}</div>
            <div className="flex gap-1">
              <Badge>{m.type}</Badge>
              <Badge>{m.visibility}</Badge>
            </div>
            <div className="text-xs text-gray-500 mt-2">{(m.sizeBytes / 1024).toFixed(0)} KB</div>
          </a>
        ))}
      </div>
    </div>
  );
}
