#!/usr/bin/env python3
import os, shutil, subprocess, tempfile
from pathlib import Path
from datetime import datetime
source=Path(__file__).resolve().parent/'favicon.svg'
target=Path('/var/www/peachub/favicon.svg')
expected='40145899ad32f31e9f0f698687859bf77df4d06a'
def digest(path): return subprocess.check_output(['git','hash-object',str(path)],text=True).strip()
if os.geteuid()!=0: raise SystemExit('Esegui come root.')
if not source.is_file() or not target.is_file(): raise SystemExit('Favicon mancante: nessuna modifica effettuata.')
current=digest(target)
if current==digest(source): raise SystemExit('La favicon è già aggiornata.')
if current!=expected: raise SystemExit('La favicon online è diversa dalla versione prevista: nessuna modifica effettuata.')
backup=Path('/root/backup-peachub-favicon')/datetime.now().strftime('%Y%m%d-%H%M%S-%f')
backup.mkdir(parents=True,mode=0o700)
shutil.copy2(target,backup/'favicon.svg')
with tempfile.NamedTemporaryFile(dir=target.parent,delete=False) as f:
 f.write(source.read_bytes());tmp=Path(f.name)
try:
 shutil.copystat(target,tmp);os.replace(tmp,target)
finally: tmp.unlink(missing_ok=True)
print('Favicon aggiornata. Backup:',backup)
