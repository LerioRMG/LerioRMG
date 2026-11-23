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
slugs=['anissa-kate-nuovo-film-reality-junkies','jessi-rae-debutto-tushy-julia-grandi','xhamster-awards-2026-vincitori','xma-2027-nomination-film-porno','femdom-awards-2026-rachel-rampage','video-blacked-lucy-mochi-octavia-red']
files=[Path('index.html')]+[Path('articoli')/slug/'index.html' for slug in slugs]+[Path('media/news')/(slug+'.svg') for slug in slugs]
if len(files)!=13: raise SystemExit('Pacchetto incompleto: nessuna modifica effettuata.')
changes=[]
for rel in files:
 source=src/rel;target=web/rel
 if not source.is_file():raise SystemExit('File sorgente mancante: '+str(rel))
 if target.exists():
  if not target.is_file():raise SystemExit('Percorso non valido: '+str(target))
  actual=digest(target);new=digest(source)
  if actual==new:continue
  if actual not in {expected if str(rel)=='index.html' else '', '1b4fc17c79e29da3abda4eb3d409238bf30f1604' if str(rel)=='index.html' else '', {'index.html':'d45be9b0d75e5519f29dbad09a56597ee3a4ab53','articoli/anissa-kate-nuovo-film-reality-junkies/index.html':'44c4a380336e51f24f09efcb19784c5273578850','articoli/xhamster-awards-2026-vincitori/index.html':'cd0aa3a2230c150f93bbf2e4e06bf75077e18c85'}.get(str(rel),'')}: raise SystemExit('File online diverso dalla versione prevista: '+str(target)+'. Nessuna modifica effettuata.')
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
