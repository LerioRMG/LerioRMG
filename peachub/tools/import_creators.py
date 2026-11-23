#!/usr/bin/env python3
"""One-time, read-only copy of selected FansList profiles into Peachub SQLite."""
import argparse
import sqlite3
from pathlib import Path

REQUESTED = {
    'evie': ('eviecutie',),
    'eleonora': ('eleonovilla',),
    'ash': ('chiamamiash',),
    'sara peach': ('peachsara',),
    'greta de santis': ('gretadesantis',),
    'cheshire': ('misscheshirecat',),
    'vanilla': ('vanilla08',),
    'nayla': ('itsnayla',),
    'jaquelina': ('jaquelina08',),
}
SCHEMA = '''CREATE TABLE IF NOT EXISTS creators (
    id INTEGER PRIMARY KEY, source_key TEXT NOT NULL UNIQUE, source_id INTEGER NOT NULL,
    name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, username TEXT, excerpt TEXT, bio TEXT,
    image TEXT, onlyfans_url TEXT, instagram_url TEXT, telegram_url TEXT,
    active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
    clips_enabled INTEGER NOT NULL DEFAULT 0 CHECK(clips_enabled IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'''
FIELDS = ('name', 'slug', 'username', 'excerpt', 'bio', 'image', 'onlyfans_url', 'instagram_url', 'telegram_url')

def copy_profiles(source_path, target_path):
    source_path, target_path = Path(source_path).resolve(), Path(target_path).resolve()
    if source_path == target_path:
        raise ValueError('Il database di destinazione deve essere diverso da FansList.')
    if not source_path.is_file():
        raise ValueError('Database FansList non trovato.')
    source = sqlite3.connect(source_path.as_uri() + '?mode=ro', uri=True)
    source.row_factory = sqlite3.Row
    try:
        rows = []
        for name, handles in REQUESTED.items():
            matches = source.execute('SELECT id,' + ','.join(FIELDS) + ' FROM creators WHERE deleted_at IS NULL AND (lower(ltrim(trim(coalesce(username,\'\')),\'@\')) IN (' + ','.join('?' for _ in handles) + ') OR lower(slug) IN (' + ','.join('?' for _ in handles) + '))', handles + handles).fetchall()
            if len(matches) != 1:
                raise ValueError(f'{name}: trovati {len(matches)} profili; nessuna importazione effettuata.')
            rows.append(matches[0])
    finally:
        source.close()
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target = sqlite3.connect(str(target_path))
    try:
        target.execute('BEGIN IMMEDIATE')
        target.execute(SCHEMA)
        for row in rows:
            cols = ('source_key', 'source_id') + FIELDS
            values = ('fanslist:' + str(row['id']), row['id']) + tuple(row[field] for field in FIELDS)
            target.execute('INSERT INTO creators (' + ','.join(cols) + ') VALUES (' + ','.join('?' for _ in cols) + ') ON CONFLICT(source_key) DO NOTHING', values)
        target.commit()
    except BaseException:
        target.rollback()
        raise
    finally:
        target.close()
    return len(rows)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('fanslist_database')
    parser.add_argument('peachub_database')
    args = parser.parse_args()
    print('Profili copiati o già presenti:', copy_profiles(args.fanslist_database, args.peachub_database))
