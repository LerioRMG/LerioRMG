#!/usr/bin/env python3
"""Add reversible styling to the existing site without replacing its pages."""
import os, shutil, tempfile, subprocess
from pathlib import Path
from datetime import datetime
SRC=Path(__file__).resolve().parent
WEB=Path('/var/www/peachub')
if os.geteuid()!=0:raise SystemExit('Esegui come root.')
if not (WEB/'index.html').is_file():raise SystemExit('Sito Peachub non trovato. Nessuna modifica effettuata.')
css='<link rel="stylesheet" href="/miami/miami.css">'
js='<script src="/miami/miami.js" defer></script>'
pages=[WEB/'index.html',WEB/'clips.html']+sorted((WEB/'articoli').glob('*/index.html'))+sorted((WEB/'creator').glob('*/index.html'))
changes=[]
for target in pages:
 if not target.exists():continue
 if not target.is_file() or target.is_symlink():raise SystemExit('Pagina non valida: '+str(target)+'. Nessuna modifica effettuata.')
 original=target.read_bytes();text=original.decode('utf-8')
 if '</head>' not in text.lower():raise SystemExit('Struttura non riconosciuta: '+str(target)+'. Nessuna modifica effettuata.')
 add=('' if css in text else css)+('' if js in text else js)
 if add:
  idx=text.lower().index('</head>');changes.append((target,original,(text[:idx]+add+text[idx:]).encode('utf-8')))
old_theme={'miami.css':'945ebb3ae45d941060a389f7dd18427f9e58a6bf','miami.js':'5284c746c3e8d4fe6a6144e3ec24a27640a13575','palm.svg':'d42941ae064b0ce6792959c09e3db6d671068b34'}
for name in ('miami.css','miami.js','palm.svg'):
 source=SRC/'miami'/name;target=WEB/'miami'/name
 if not source.is_file():raise SystemExit('File mancante: '+str(source)+'. Nessuna modifica effettuata.')
 data=source.read_bytes();original=target.read_bytes() if target.is_file() else None
 if target.exists() and (target.is_symlink() or not target.is_file()):raise SystemExit('Percorso non valido: '+str(target))
 if original is not None and original!=data and subprocess.check_output(['git','hash-object',str(target)],text=True).strip()!=old_theme[name]:raise SystemExit('File tema già modificato: '+str(target)+'. Nessuna modifica effettuata.')
 if original!=data:changes.append((target,original,data))
if not changes:raise SystemExit('Tema già installato.')
backup=Path('/root/backup-peachub-miami')/datetime.now().strftime('%Y%m%d-%H%M%S-%f');backup.mkdir(parents=True,mode=0o700)
for target,original,data in changes:
 if original is not None:
  dest=backup/target.relative_to(WEB);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,dest)
written=[]
try:
 for target,original,data in changes:
  target.parent.mkdir(parents=True,exist_ok=True)
  with tempfile.NamedTemporaryFile(dir=target.parent,delete=False) as f:f.write(data);tmp=Path(f.name)
  try:
   if original is not None:shutil.copystat(target,tmp)
   else:os.chmod(tmp,0o644)
   os.replace(tmp,target)
  finally:tmp.unlink(missing_ok=True)
  written.append((target,original));print('Aggiornato:',target.relative_to(WEB))
except BaseException:
 for target,original in reversed(written):
  if original is None:target.unlink(missing_ok=True)
  else:shutil.copy2(backup/target.relative_to(WEB),target)
 raise
print('Tema installato. Backup:',backup)
