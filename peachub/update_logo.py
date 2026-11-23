#!/usr/bin/env python3
"""Update the public logo, preserving any independently modified version."""
import os, shutil, subprocess, tempfile
from pathlib import Path
from datetime import datetime

source=Path(__file__).resolve().parent/'logo.svg'
target=Path('/var/www/peachub/logo.svg')
expected='72ffb5c9064f43e96b137461892c1b55f273541a'
def git_hash(path):
 return subprocess.check_output(['git','hash-object',str(path)],text=True).strip()
if os.geteuid()!=0: raise SystemExit('Esegui come root.')
if not source.is_file() or not target.is_file(): raise SystemExit('Logo mancante: nessuna modifica effettuata.')
current=git_hash(target)
if current==git_hash(source): raise SystemExit('Il logo è già aggiornato.')
if current!=expected: raise SystemExit('Il logo online è diverso dalla versione prevista: nessuna modifica effettuata.')
backup=Path('/root/backup-peachub-logo')/datetime.now().strftime('%Y%m%d-%H%M%S-%f')
backup.mkdir(parents=True,mode=0o700)
shutil.copy2(target,backup/'logo.svg')
with tempfile.NamedTemporaryFile(dir=target.parent,delete=False) as f:
 f.write(source.read_bytes());tmp=Path(f.name)
try:
 shutil.copystat(target,tmp);os.replace(tmp,target)
finally: tmp.unlink(missing_ok=True)
print('Logo aggiornato. Backup:',backup)
