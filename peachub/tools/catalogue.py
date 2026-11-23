"""Persistence layer for Peachub. The database is not web accessible."""
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

SCHEMA = Path(__file__).with_name('schema.sql')

def open_catalogue(path):
    db = sqlite3.connect(str(path), timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA busy_timeout=5000')
    db.executescript(SCHEMA.read_text(encoding='utf-8'))
    # Additive upgrades preserve profiles, captions, selections and existing media.
    for table, column in [('creators','excerpt'),('creators','about'),('creators','tags'),('media','tags')]:
        if column not in {row['name'] for row in db.execute('PRAGMA table_info('+table+')')}:
            try: db.execute("ALTER TABLE "+table+" ADD COLUMN "+column+" TEXT NOT NULL DEFAULT ''")
            except sqlite3.OperationalError:
                if column not in {row['name'] for row in db.execute('PRAGMA table_info('+table+')')}: raise
    return db

def set_creator_state(db, creator_id, *, active, clips_enabled, boost):
    if type(active) is not bool or type(clips_enabled) is not bool or type(boost) is not int or not 1 <= boost <= 5:
        raise ValueError('Impostazioni creator non valide')
    with db:
        result=db.execute('UPDATE creators SET active=?, clips_enabled=?, boost=? WHERE id=?', (active, clips_enabled, boost, creator_id))
        if result.rowcount != 1: raise ValueError('Creator non trovata')

def add_media(db, creator_id, path, mime, kind, caption='', publish_clip=False):
    if kind not in ('image','video') or not path or path.startswith('/') or '..' in Path(path).parts:
        raise ValueError('File non valido')
    if not mime.startswith(kind+'/'): raise ValueError('Tipo di file non corrispondente')
    with db:
        return db.execute('INSERT INTO media(creator_id,path,mime,kind,caption,active,approved,clip_enabled) VALUES(?,?,?,?,?,?,?,?)',(creator_id,path,mime,kind,caption,1,1,int(kind=='video' and publish_clip))).lastrowid

def set_media_state(db, media_id, *, active, approved, clip_enabled):
    if any(type(x) is not bool for x in (active,approved,clip_enabled)): raise ValueError('Stato non valido')
    with db:
        result=db.execute('UPDATE media SET active=?, approved=?, clip_enabled=? WHERE id=? AND (kind = ? OR ? = 0)',(active,approved,clip_enabled,media_id,'video',clip_enabled))
        if result.rowcount != 1: raise ValueError('Media non trovato o non è un video')

def add_ad(db,title,url):
    u=urlparse(url)
    if not title.strip() or u.scheme != 'https' or not u.hostname or u.username or u.password:
        raise ValueError('Annuncio o URL non valido')
    with db: return db.execute('INSERT INTO ads(title,url) VALUES(?,?)',(title.strip(),url)).lastrowid

def active_feed_inputs(db):
    creators=[dict(r) for r in db.execute('SELECT * FROM creators WHERE active=1 AND clips_enabled=1')]
    clips=[dict(r) for r in db.execute("SELECT m.*,m.clip_enabled AS active FROM media m JOIN creators c ON c.id=m.creator_id WHERE c.active=1 AND c.clips_enabled=1 AND m.kind='video' AND m.active=1 AND m.approved=1 AND m.clip_enabled=1")]
    ads=[dict(r) for r in db.execute("SELECT * FROM ads WHERE active=1 AND approved=1 AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP) AND (ends_at IS NULL OR ends_at>CURRENT_TIMESTAMP)")]
    return creators,clips,ads
