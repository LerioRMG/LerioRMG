"""Import a private staging directory produced by copy_from_fanslist."""
import json, shutil, sqlite3, tempfile
from pathlib import Path
from catalogue import open_catalogue

def import_staged(stage_dir, db_path, media_root):
 stage_dir=Path(stage_dir).resolve(); media_root=Path(media_root).resolve()
 data=json.loads((stage_dir/'creator.json').read_text(encoding='utf-8'))
 if data.get('version')!=1 or not isinstance(data.get('creators'),list): raise ValueError('Archivio non valido')
 db=open_catalogue(db_path); created=[]
 try:
  db.execute('BEGIN IMMEDIATE')
  for c in data['creators']:
   key='fanslist:'+str(int(c['source_id']))
   row=db.execute('SELECT id FROM creators WHERE source_key=?',(key,)).fetchone()
   if row: continue
   cursor=db.execute('INSERT INTO creators(source_key,name,slug,username,bio,excerpt,about,tags,onlyfans_url,instagram_url,telegram_url) VALUES(?,?,?,?,?,?,?,?,?,?,?)',(key,c['name'],c['slug'],c.get('username'),c.get('bio'),c.get('excerpt') or '',c.get('about') or '',c.get('tags') or '',c.get('onlyfans_url'),c.get('instagram_url'),c.get('telegram_url')))
   creator_id=cursor.lastrowid
   for image in c.get('images',[]):
    source=(stage_dir/image).resolve()
    if not source.is_relative_to(stage_dir) or not source.is_file(): raise ValueError('Foto mancante')
    ext=source.suffix.lower(); mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif'}.get(ext)
    if not mime: raise ValueError('Formato immagine non valido')
    target=media_root / ('creator-'+str(creator_id)) / source.name
    if target.exists(): raise ValueError('Foto già presente')
    target.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(source,target); created.append(target)
    db.execute('INSERT INTO media(creator_id,path,mime,kind) VALUES(?,?,?,?)',(creator_id,str(target.relative_to(media_root)),mime,'image'))
  db.commit()
 except BaseException:
  db.rollback()
  for path in created: path.unlink(missing_ok=True)
  raise
 finally: db.close()
