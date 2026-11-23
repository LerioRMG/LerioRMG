#!/usr/bin/env python3
"""Copy selected creator data and images to a private, reviewable staging folder."""
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

REQUESTED = {
    'Evie': (['eviecutie'], ['evie']),
    'Eleonora Villa': (['eleonovilla'], ['eleonora villa']),
    'Ash': (['chiamamiash'], ['ash']),
    'Sara Peach': (['peachsara'], ['sara peach']),
    'Greta De Santis': (['gretadesantis'], ['greta de santis']),
    'Cheshire': (['misscheshirecat'], ['cheshire']),
    'Vanilla': (['vanilla08'], ['sara (vanilla)', 'vanilla']),
    'Nayla': (['itsnayla'], ['nayla']),
    'Jaquelina': (['jaquelina08'], ['jaquelina']),
}
FIELDS = ('name','slug','username','excerpt','bio','about','image','image_position','onlyfans_url','instagram_url','tiktok_url','telegram_url','location','birth_year','nationality','tags','is_verified','is_free','price','has_free_trial','trial_days')
EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}

def run(source_path, uploads_path, dest_path):
    source_path, uploads_path, dest_path = Path(source_path).resolve(), Path(uploads_path).resolve(), Path(dest_path).resolve()
    if not source_path.is_file() or not uploads_path.is_dir():
        raise ValueError('Database o cartella upload FansList non trovati.')
    if dest_path.exists():
        raise ValueError('La cartella di destinazione esiste già: non viene sovrascritta.')
    source = sqlite3.connect(source_path.as_uri() + '?mode=ro', uri=True)
    source.row_factory = sqlite3.Row
    try:
        available = {r['name'] for r in source.execute('PRAGMA table_info(creators)')}
        if not {'id','name','slug','username','image'}.issubset(available):
            raise ValueError('Struttura database FansList diversa dal previsto.')
        fields = [field for field in FIELDS if field in available]
        select = 'SELECT id,' + ','.join(fields) + ' FROM creators' + (' WHERE deleted_at IS NULL' if 'deleted_at' in available else '')
        all_rows = source.execute(select).fetchall()
        selected = []
        for label, (handles, names) in REQUESTED.items():
            matches = [r for r in all_rows if str(r['username'] or '').strip().lstrip('@').lower() in handles or str(r['slug'] or '').strip().lower() in handles]
            if not matches:
                matches = [r for r in all_rows if str(r['name'] or '').strip().lower() in names]
            if len(matches) != 1:
                raise ValueError(f'{label}: trovate {len(matches)} corrispondenze. Nessuna copia effettuata.')
            selected.append(dict(matches[0]))
        ids = [int(row['id']) for row in selected]
        if len(set(ids)) != len(ids):
            raise ValueError('Due nomi indicano lo stesso profilo. Nessuna copia effettuata.')
        galleries = {i: [] for i in ids}
        has_photos = source.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='creator_photos'").fetchone()
        if has_photos:
            query = 'SELECT creator_id,image FROM creator_photos WHERE creator_id IN (' + ','.join('?' for _ in ids) + ') ORDER BY sort_order,id'
            for row in source.execute(query, ids): galleries[int(row['creator_id'])].append(row['image'])
    finally:
        source.close()
    parent = dest_path.parent
    parent.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix='.peachub-stage-', dir=parent))
    os.chmod(temp, 0o700)
    missing = []
    try:
        for creator in selected:
            creator_dir = temp / 'foto' / str(creator['id'])
            paths = [creator.get('image')] + galleries[int(creator['id'])]
            images = []
            for original in paths:
                if not original: continue
                path = (uploads_path / str(original)).resolve()
                if not path.is_relative_to(uploads_path) or not path.is_file() or path.suffix.lower() not in EXTS:
                    missing.append(f"{creator['name']}: immagine non disponibile")
                    continue
                creator_dir.mkdir(parents=True, exist_ok=True)
                name = str(len(images)+1) + path.suffix.lower()
                shutil.copy2(path, creator_dir / name)
                images.append('foto/' + str(creator['id']) + '/' + name)
            creator['source_id'] = creator.pop('id')
            creator['source'] = 'fanslist'
            creator['source_image'] = creator.pop('image', None)
            creator['images'] = images
            creator['active'] = False
            creator['clips_enabled'] = False
        (temp / 'creator.json').write_text(json.dumps({'version': 1, 'creators': selected, 'warnings': missing}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        os.rename(temp, dest_path)
    except BaseException:
        shutil.rmtree(temp, ignore_errors=True)
        raise
    print('Copiate:', len(selected), 'creator')
    print('Foto copiate:', sum(len(r['images']) for r in selected))
    print('Cartella privata:', dest_path)
    for message in missing: print('Attenzione:', message)

if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit('Uso: copy_from_fanslist.py DATABASE UPLOADS DESTINAZIONE')
    try: run(*sys.argv[1:])
    except (ValueError, sqlite3.Error, OSError) as exc: raise SystemExit(str(exc))
