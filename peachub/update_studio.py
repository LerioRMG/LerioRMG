#!/usr/bin/env python3
"""Guarded update for an existing Peachub installation; never resets its database."""
import os, shutil, sqlite3, subprocess, tempfile, time, urllib.request
from datetime import datetime
from pathlib import Path

SRC=Path(__file__).resolve().parent
APP=Path('/opt/peachub-app')
WEB=Path('/var/www/peachub')
DB=Path('/var/lib/peachub/peachub.sqlite')
SERVICE='peachub-admin.service'
BACKUP_ROOT=Path('/root')
FILES={
 'admin/app.py':(APP/'admin/app.py','cbbe4364cedd154d27d910a3edc4482a1ec1e114'),
 'admin/index.html':(APP/'admin/index.html','0136b789c4662184f05f6a075ecf2bd6507a2a99'),
 'tools/catalogue.py':(APP/'catalogue.py','8841990040315e27ac6e03de002bc6135de520d5'),
 'tools/schema.sql':(APP/'schema.sql','e36d35834e0fe7a753604c2f0d59772a63023203'),
 'tools/import_staged.py':(APP/'import_staged.py','d34313c75a43066ba7ea476f1c2e2b729545c391'),
 'index.html':(WEB/'index.html','f4bf7af63e83fb0f0da55778f941f33a81acb975'),
 'clips.html':(WEB/'clips.html','e1aebbf4c22e4e7e198ea694f8b1309812a06293'),
}
ADDITIONAL_BASE={'admin/app.py':'3f712b9b0eb9bd4b76e162c37f5e17280634b8dc','admin/index.html':'1b395b881a96d69803379f137d685cc69e738336','tools/catalogue.py':'91a3879eeb8153f4c9871b7117933fd0bc1adf02','tools/schema.sql':'e014172db9791ebd4aff69b327802c553ebb65eb','tools/import_staged.py':'d07df30e651fd8e0afb8b0e7c13bbffea18c8863','index.html':'8b5a547ca0144d8712e045393b587bd7ce6533a5','clips.html':'d25fa6c284453e09491ccf71cabcfcf6c0d3c54a'}
def sha(path): return subprocess.check_output(['git','hash-object',str(path)],text=True).strip()
def command(*args, **kwargs): return subprocess.run(args,check=True,**kwargs)

def backfill(source_db, target_db):
 source=sqlite3.connect(Path(source_db).resolve().as_uri()+'?mode=ro',uri=True);source.row_factory=sqlite3.Row
 target=sqlite3.connect(Path(target_db).resolve().as_uri()+'?mode=rw',uri=True,timeout=10)
 try:
  source_columns={r['name'] for r in source.execute('PRAGMA table_info(creators)')}
  if not {'id','excerpt','about'}.issubset(source_columns):raise ValueError('I campi di origine FansList non sono disponibili.')
  records={int(r['id']):(r['excerpt'] or '',r['about'] or '') for r in source.execute('SELECT id,excerpt,about FROM creators')}
  target.execute('BEGIN IMMEDIATE');updated=0
  for cid,key in target.execute("SELECT id,source_key FROM creators WHERE source_key LIKE 'fanslist:%'").fetchall():
   try: origin=records.get(int(key.split(':',1)[1]))
   except (ValueError,AttributeError,IndexError): continue
   if not origin:continue
   updated+=target.execute("UPDATE creators SET excerpt=CASE WHEN trim(coalesce(excerpt,''))='' THEN ? ELSE excerpt END, about=CASE WHEN trim(coalesce(about,''))='' THEN ? ELSE about END WHERE id=? AND ((trim(coalesce(excerpt,''))='' AND ?<>'') OR (trim(coalesce(about,''))='' AND ?<>''))",(origin[0],origin[1],cid,origin[0],origin[1])).rowcount
  target.commit();return updated
 except BaseException: target.rollback();raise
 finally: source.close();target.close()

def main():
 if os.geteuid()!=0: raise SystemExit('Esegui come root.')
 if not DB.is_file() or not (APP/'venv/bin/python').is_file(): raise SystemExit('Installazione Peachub esistente non trovata. Nessuna modifica effettuata.')
 changes=[]
 for src,(target,expected) in FILES.items():
  incoming=SRC/src
  if not incoming.is_file() or not target.is_file():raise SystemExit('File mancante: '+str(target)+'. Nessuna modifica effettuata.')
  current=sha(target);new=sha(incoming)
  if current not in (expected,ADDITIONAL_BASE.get(src),new):raise SystemExit('File online modificato rispetto alla versione prevista: '+str(target)+'. Nessuna modifica effettuata.')
  if current!=new:changes.append((src,target,incoming))
 try:
  source_db=subprocess.check_output(['php','-r','require "/var/www/fanslist/config.php"; echo DB_PATH;'],text=True).strip()
  if not Path(source_db).is_file():raise ValueError('Database FansList non trovato')
 except (OSError,subprocess.CalledProcessError,ValueError) as e:raise SystemExit(str(e)+'. Nessuna modifica effettuata.')
 with tempfile.TemporaryDirectory() as td:
  for src,target,incoming in changes:
   if src.endswith('.py'):
    check=Path(td)/Path(src).name;shutil.copy2(incoming,check)
    command(str(APP/'venv/bin/python'),'-m','py_compile',str(check))
 backup=BACKUP_ROOT/('backup-peachub-studio-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
 backup.mkdir(mode=0o700);stopped=False;written=[]
 try:
  command('systemctl','stop',SERVICE);stopped=True
  with sqlite3.connect(DB.resolve().as_uri()+'?mode=ro',uri=True) as source:
   with sqlite3.connect(str(backup/'peachub.sqlite')) as snapshot:source.backup(snapshot)
  for src,target,incoming in changes:
   saved=backup/'files'/src;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,saved)
  for src,target,incoming in changes:
   with tempfile.NamedTemporaryFile(dir=target.parent,delete=False) as stream: stream.write(incoming.read_bytes());tmp=Path(stream.name)
   shutil.copystat(target,tmp);os.replace(tmp,target);written.append((src,target));print('Aggiornato:',src)
  command(str(APP/'venv/bin/python'),'-c','from catalogue import open_catalogue; import sys; db=open_catalogue(sys.argv[1]); db.close()',str(DB),cwd=str(APP))
  count=backfill(source_db,DB)
  command('systemctl','start',SERVICE);stopped=False
  healthy=False
  for _ in range(30):
   try:
    with urllib.request.urlopen('http://127.0.0.1:18881/api/creators',timeout=1) as response: healthy=response.status==200
    if healthy: break
   except OSError:time.sleep(.3)
  if not healthy:raise RuntimeError('Il servizio non risponde dopo l’aggiornamento.')
  print('Fatto. Schede completate con dati esistenti:',count)
  print('Backup:',backup)
 except BaseException:
  if not stopped:subprocess.run(['systemctl','stop',SERVICE],check=False)
  for src,target in reversed(written):shutil.copy2(backup/'files'/src,target)
  result=subprocess.run(['systemctl','start',SERVICE],check=False)
  print('Aggiornamento interrotto; file precedenti ripristinati. Backup:',backup)
  if result.returncode: print('Il servizio non si è riavviato: controlla systemctl status '+SERVICE)
  raise

if __name__=='__main__':main()
