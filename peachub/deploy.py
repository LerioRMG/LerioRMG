#!/usr/bin/env python3
"""Install Peachub app and proxy into its existing HTTPS vhost, with rollback."""
import getpass, hashlib, os, re, secrets, shutil, subprocess, sys, time, urllib.request
from pathlib import Path

SRC=Path(__file__).resolve().parent
WEB=Path('/var/www/peachub')
APP=Path('/opt/peachub-app')
STATE=Path('/var/lib/peachub')
SERVICE=Path('/etc/systemd/system/peachub-admin.service')
BACKUP=Path('/root')/('backup-peachub-'+time.strftime('%Y%m%d-%H%M%S'))
BASE={'index.html':'e13da82b862084f5977cefe7c22c9f776dbe42b8','clips.html':'f90c91f4685805ecd656189ddc3eb51faef864d8'}

def run(*args,**kw): return subprocess.run(args,check=True,**kw)
def git_hash(path): return subprocess.check_output(['git','hash-object',str(path)],text=True).strip()

def server_end(text,start):
 depth=0; quote=None; esc=False; comment=False
 for i in range(start,len(text)):
  c=text[i]
  if comment:
   if c=='\n':comment=False
   continue
  if quote:
   if esc:esc=False
   elif c=='\\':esc=True
   elif c==quote:quote=None
   continue
  if c=='#':comment=True;continue
  if c in ('\"',"'"):quote=c;continue
  if c=='{':depth+=1
  elif c=='}':
   depth-=1
   if depth==0:return i
 raise ValueError('Blocco Nginx non chiuso')

def nginx_target():
 found=[]
 for path in Path('/etc/nginx/sites-enabled').glob('*'):
  if not path.is_file():continue
  text=path.read_text()
  for match in re.finditer(r'(?m)^\s*server\s*\{',text):
   brace=text.find('{',match.start());end=server_end(text,brace);block=text[match.start():end]
   if re.search(r'\bserver_name\s+[^;]*\bthepeachub\.com\b',block) and re.search(r'\blisten\s+(?:\[[^]]+\]:)?443\b',block):found.append((path,text,end,block))
 if len(found)!=1:raise ValueError('Configurazione HTTPS Peachub non identificata in modo univoco; nessuna modifica effettuata.')
 path,text,end,block=found[0]
 root=re.search(r'(?m)^\s*root\s+([^;]+);',block)
 if not root or root.group(1).strip()!='/var/www/peachub':raise ValueError('La root HTTPS di Peachub è diversa dal previsto; nessuna modifica effettuata.')
 if re.search(r'location\s+(?:\^~\s+|=\s+)?/(?:admin|api)(?:/|\s|\{)',block):raise ValueError('Esistono già regole admin o API: nessuna modifica effettuata.')
 return path,text,end

def main():
 if os.geteuid()!=0:raise SystemExit('Esegui come root.')
 for f,sha in BASE.items():
  target=WEB/f
  if not target.is_file() or git_hash(target)!=sha:raise SystemExit('Il file online '+str(target)+' è diverso dalla base prevista: nessuna modifica effettuata.')
 if APP.exists() or STATE.exists() or SERVICE.exists():raise SystemExit('Esiste già una installazione Peachub admin: nessuna modifica effettuata.')
 config,original,end=nginx_target()
 password=getpass.getpass('Crea una password admin (almeno 12 caratteri): ')
 confirm=getpass.getpass('Ripeti la password: ')
 if len(password)<12 or password!=confirm:raise SystemExit('Password troppo corta o non corrispondente. Nessuna modifica effettuata.')
 BACKUP.mkdir(mode=0o700)
 for f in BASE: shutil.copy2(WEB/f,BACKUP/f)
 (BACKUP/'nginx.conf').write_text(original)
 APP.mkdir(mode=0o755);STATE.mkdir(mode=0o750)
 (APP/'admin').mkdir();(STATE/'media').mkdir()
 site_touched=False
 try:
  for name in ('catalogue.py','schema.sql','feed_order.py','import_staged.py','copy_from_fanslist.py'):shutil.copy2(SRC/'tools'/name,APP/name)
  for name in ('app.py','index.html'):shutil.copy2(SRC/'admin'/name,APP/'admin'/name)
  run(sys.executable,'-m','venv',str(APP/'venv'))
  run(str(APP/'venv/bin/pip'),'install','--disable-pip-version-check','fastapi==0.141.1','uvicorn==0.52.1','python-multipart==0.0.32')
  paths=subprocess.check_output(['php','-r','require "/var/www/fanslist/config.php"; echo DB_PATH, PHP_EOL, UPLOAD_DIR, PHP_EOL;'],text=True).splitlines()
  if len(paths)!=2:raise ValueError('Percorsi FansList non disponibili.')
  staging=BACKUP/'import'
  run(sys.executable,str(APP/'copy_from_fanslist.py'),paths[0],paths[1],str(staging))
  sys.path.insert(0,str(APP));from import_staged import import_staged
  import_staged(staging,STATE/'peachub.sqlite',STATE/'media')
  salt=secrets.token_bytes(16);pw=hashlib.scrypt(password.encode(),salt=salt,n=16384,r=8,p=1)
  (STATE/'admin.hash').write_text(salt.hex()+':'+pw.hex()+'\n');del password,confirm,pw
  run('chown','-R','www-data:www-data',str(STATE));os.chmod(STATE/'admin.hash',0o600)
  SERVICE.write_text('''[Unit]\nDescription=Peachub admin\nAfter=network.target\n[Service]\nUser=www-data\nGroup=www-data\nWorkingDirectory=/opt/peachub-app\nEnvironment=PEACHUB_STATE=/var/lib/peachub\nExecStart=/opt/peachub-app/venv/bin/uvicorn admin.app:app --host 127.0.0.1 --port 18881 --workers 1\nRestart=on-failure\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=strict\nReadWritePaths=/var/lib/peachub\n[Install]\nWantedBy=multi-user.target\n''')
  run('systemctl','daemon-reload');run('systemctl','enable','--now','peachub-admin.service')
  healthy=False
  for _ in range(30):
   try:
    with urllib.request.urlopen('http://127.0.0.1:18881/api/clips',timeout=1) as res:healthy=res.status==200
    if healthy:break
   except OSError:time.sleep(.3)
  if not healthy:raise ValueError('Il servizio Peachub non risponde; non viene pubblicato.')
  rules='''\n    # PEACHUB ADMIN - dedicated localhost service\n    location = /admin { return 308 /admin/; }\n    location ^~ /admin/ { client_max_body_size 210m; proxy_pass http://127.0.0.1:18881; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 300s; }\n    location ^~ /api/ { proxy_pass http://127.0.0.1:18881; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 300s; }\n'''
  site_touched=True
  for f in BASE:shutil.copy2(SRC/f,WEB/f)
  config.write_text(original[:end]+rules+original[end:])
  run('nginx','-t');run('systemctl','reload','nginx')
  print('Installazione completata: https://thepeachub.com/admin/')
  print('I profili importati e le foto sono inizialmente disattivati; attivali dal pannello.')
  print('Backup:',BACKUP)
 except BaseException:
  if site_touched:
   config.write_text(original)
   for f in BASE: shutil.copy2(BACKUP/f,WEB/f)
   subprocess.run(['nginx','-t'],check=False)
   subprocess.run(['systemctl','reload','nginx'],check=False)
  if SERVICE.exists():
   subprocess.run(['systemctl','disable','--now','peachub-admin.service'],check=False)
   SERVICE.unlink(missing_ok=True)
   subprocess.run(['systemctl','daemon-reload'],check=False)
  if APP.exists(): shutil.move(str(APP),str(BACKUP/'failed-app'))
  if STATE.exists(): shutil.move(str(STATE),str(BACKUP/'failed-state'))
  print('Installazione interrotta; dati conservati nel backup:',BACKUP,file=sys.stderr)
  raise

if __name__=='__main__':main()
