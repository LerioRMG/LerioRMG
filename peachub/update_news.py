#!/usr/bin/env python3
"""Install curated news without overwriting unrelated site edits."""
import os, shutil, subprocess, tempfile
from pathlib import Path
from datetime import datetime
src=Path(__file__).resolve().parent
web=Path('/var/www/peachub')
if os.geteuid()!=0: raise SystemExit('Esegui come root.')
def digest(p):return subprocess.check_output(['git','hash-object',str(p)],text=True).strip()
expected='9cd4ca87db140f92c4924f0777066350167c3710'
files=[Path('index.html')]+sorted(p.relative_to(src) for p in (src/'articoli').glob('*/index.html'))+sorted(p.relative_to(src) for p in (src/'media/news').glob('*.svg'))
if len(files)!=11: raise SystemExit('Pacchetto incompleto: nessuna modifica effettuata.')
changes=[]
for rel in files:
 source=src/rel;target=web/rel
 if not source.is_file():raise SystemExit('File sorgente mancante: '+str(rel))
 if target.exists():
  if not target.is_file():raise SystemExit('Percorso non valido: '+str(target))
  actual=digest(target);new=digest(source)
  if actual==new:continue
  if str(rel)!='index.html' or actual!=expected:raise SystemExit('File online diverso dalla versione prevista: '+str(target)+'. Nessuna modifica effettuata.')
 changes.append((source,target,rel))
if not changes:raise SystemExit('Notizie già aggiornate.')
backup=Path('/root/backup-peachub-news')/datetime.now().strftime('%Y%m%d-%H%M%S-%f');backup.mkdir(parents=True,mode=0o700)
written=[]
try:
 for source,target,rel in changes:
  if target.exists():
   saved=backup/rel;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,saved)
 for source,target,rel in changes:
  target.parent.mkdir(parents=True,exist_ok=True)
  with tempfile.NamedTemporaryFile(dir=target.parent,delete=False) as f:f.write(source.read_bytes());tmp=Path(f.name)
  try:
   if target.exists():shutil.copystat(target,tmp)
   else:os.chmod(tmp,0o644)
   os.replace(tmp,target)
  finally:tmp.unlink(missing_ok=True)
  written.append((target,rel));print('Aggiornato:',rel)
except BaseException:
 for target,rel in reversed(written):
  saved=backup/rel
  if saved.exists():shutil.copy2(saved,target)
  else:target.unlink(missing_ok=True)
 raise
print('Notizie pubblicate. Backup:',backup)
