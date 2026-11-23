"""Private admin API for Peachub. Run only behind HTTPS and a local reverse proxy."""
import hashlib, hmac, os, secrets, sqlite3, sys, time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlparse
from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from catalogue import open_catalogue, set_creator_state, add_media, set_media_state, add_ad, active_feed_inputs
from feed_order import build_feed

STATE=Path(os.environ.get('PEACHUB_STATE','/var/lib/peachub'))
DB=STATE/'peachub.sqlite'; MEDIA=STATE/'media'; AUTH=STATE/'admin.hash'
app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
sessions={}; attempts={}
MAX_UPLOAD=200*1024*1024

@contextmanager
def db():
 conn=open_catalogue(DB)
 try:
  with conn: yield conn
 finally: conn.close()
def check_password(raw):
 try:
  salt, expected = AUTH.read_text().strip().split(':',1)
  calculated=hashlib.scrypt(raw.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
  return hmac.compare_digest(calculated,expected)
 except (OSError,ValueError): return False

def require(request,write=False):
 token=request.cookies.get('peach_admin',''); s=sessions.get(token)
 if not s or s['expires'] < time.time():
  sessions.pop(token,None); raise HTTPException(401,'Accesso richiesto')
 if write and not hmac.compare_digest(request.headers.get('x-csrf-token',''),s['csrf']): raise HTTPException(403,'Richiesta non valida')
 return s

def valid_image(head):
 return (head.startswith(b'\xff\xd8\xff') or head.startswith(b'\x89PNG\r\n\x1a\n') or head[:6] in (b'GIF87a',b'GIF89a') or (head[:4]==b'RIFF' and head[8:12]==b'WEBP'))

def detect(head):
 if head.startswith(b'\xff\xd8\xff'): return 'image/jpeg','.jpg','image'
 if head.startswith(b'\x89PNG\r\n\x1a\n'): return 'image/png','.png','image'
 if head[:6] in (b'GIF87a',b'GIF89a'): return 'image/gif','.gif','image'
 if head[:4]==b'RIFF' and head[8:12]==b'WEBP': return 'image/webp','.webp','image'
 if len(head)>=12 and head[4:8]==b'ftyp':
  brand=head[8:12]
  if brand in (b'avif',b'avis'): return 'image/avif','.avif','image'
  if brand in (b'heic',b'heix',b'hevc',b'hevx',b'mif1',b'msf1'): return 'image/heic','.heic','image'
  if brand==b'qt  ': return 'video/quicktime','.mov','video'
  return 'video/mp4','.mp4','video'
 if head[:4]==b'\x1a\x45\xdf\xa3': return 'video/webm','.webm','video'
 raise HTTPException(400,'Formato non supportato')

@app.post('/admin/login')
async def login(request:Request, password:str=Form(...)):
 host=request.client.host if request.client else 'unknown'; now=time.time()
 attempts[host]=[x for x in attempts.get(host,[]) if x>now-600]
 if len(attempts[host])>=8: raise HTTPException(429,'Riprova più tardi')
 if not check_password(password): attempts[host].append(now);raise HTTPException(401,'Password non corretta')
 attempts.pop(host,None);token=secrets.token_urlsafe(32);csrf=secrets.token_urlsafe(32)
 sessions[token]={'csrf':csrf,'expires':now+8*3600}
 response=Response(status_code=204);response.set_cookie('peach_admin',token,httponly=True,secure=True,samesite='strict',path='/admin',max_age=8*3600);return response

@app.post('/admin/logout')
def logout(request:Request):
 require(request,True);sessions.pop(request.cookies.get('peach_admin',''),None)
 r=Response(status_code=204);r.delete_cookie('peach_admin',path='/admin');return r

@app.get('/admin/session')
def session(request:Request): return {'csrf':require(request)['csrf']}

@app.get('/admin/data')
def data(request:Request):
 require(request)
 with db() as conn:
  return {'creators':[dict(r) for r in conn.execute('SELECT * FROM creators ORDER BY name')], 'media':[dict(r) for r in conn.execute('SELECT * FROM media ORDER BY id DESC')], 'ads':[dict(r) for r in conn.execute('SELECT * FROM ads ORDER BY id DESC')]}

@app.post('/admin/creator')
async def save_creator(request:Request):
 require(request,True);obj=await request.json();name=str(obj.get('name','')).strip();slug=str(obj.get('slug','')).strip()
 if not name or not slug or len(name)>120 or len(slug)>120 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in slug): raise HTTPException(400,'Nome o slug non valido')
 with db() as conn:
  cid=int(obj.get('id') or 0)
  if cid:
   cur=conn.execute('UPDATE creators SET name=?,slug=?,bio=?,username=?,onlyfans_url=?,instagram_url=?,telegram_url=? WHERE id=?',(name,slug,str(obj.get('bio',''))[:10000],str(obj.get('username',''))[:120],str(obj.get('onlyfans_url',''))[:2048],str(obj.get('instagram_url',''))[:2048],str(obj.get('telegram_url',''))[:2048],cid))
   if not cur.rowcount: raise HTTPException(404,'Creator non trovata')
  else: cid=conn.execute('INSERT INTO creators(name,slug,bio) VALUES(?,?,?)',(name,slug,str(obj.get('bio',''))[:10000])).lastrowid
  try: set_creator_state(conn,cid,active=bool(obj.get('active')),clips_enabled=bool(obj.get('clips_enabled')),boost=int(obj.get('boost',1)))
  except ValueError as exc: raise HTTPException(400,str(exc))
 return {'id':cid}

@app.post('/admin/upload')
async def upload(request:Request,creator_id:int=Form(...),files:list[UploadFile]=File(...)):
 require(request,True)
 if len(files)>20: raise HTTPException(400,'Massimo 20 file per volta')
 MEDIA.mkdir(parents=True,exist_ok=True); uploaded=[]
 with db() as conn:
  if not conn.execute('SELECT 1 FROM creators WHERE id=?',(creator_id,)).fetchone(): raise HTTPException(404,'Creator non trovata')
  for f in files:
   head=await f.read(32);mime,ext,kind=detect(head);name=secrets.token_hex(20)+ext;target=MEDIA/name;size=len(head)
   try:
    with target.open('xb') as out:
     out.write(head)
     while chunk:=await f.read(1024*1024):
      size+=len(chunk)
      if size>MAX_UPLOAD: raise HTTPException(413,'File troppo grande')
      out.write(chunk)
    media_id=add_media(conn,creator_id,name,mime,kind);uploaded.append(media_id)
   except BaseException: target.unlink(missing_ok=True);raise
   finally: await f.close()
 return {'uploaded':uploaded}

@app.post('/admin/media/{media_id}')
async def media_state(request:Request,media_id:int):
 require(request,True);o=await request.json()
 try:
  with db() as conn:
   set_media_state(conn,media_id,active=bool(o.get('active')),approved=bool(o.get('approved')),clip_enabled=bool(o.get('clip_enabled')))
   conn.execute('UPDATE media SET caption=? WHERE id=?',(str(o.get('caption',''))[:2000],media_id))
 except ValueError as exc: raise HTTPException(400,str(exc))
 return {'ok':True}

@app.post('/admin/ads')
async def save_ad(request:Request):
 require(request,True);o=await request.json()
 try:
  with db() as conn:
   aid=add_ad(conn,str(o.get('title','')),str(o.get('url','')))
   conn.execute('UPDATE ads SET active=?,approved=? WHERE id=?',(bool(o.get('active')),bool(o.get('approved')),aid))
 except ValueError as exc: raise HTTPException(400,str(exc))
 return {'id':aid}

@app.post('/admin/ads/{ad_id}')
async def change_ad(request:Request,ad_id:int):
 require(request,True);o=await request.json()
 with db() as conn:
  result=conn.execute('UPDATE ads SET active=?,approved=? WHERE id=?',(bool(o.get('active')),bool(o.get('approved')),ad_id))
  if not result.rowcount: raise HTTPException(404,'Annuncio non trovato')
 return {'ok':True}

@app.get('/admin/media/{media_id}/preview')
def preview(request:Request,media_id:int):
 require(request)
 with db() as conn:
  row=conn.execute('SELECT * FROM media WHERE id=?',(media_id,)).fetchone()
  if not row: raise HTTPException(404)
  target=(MEDIA/row['path']).resolve()
  if not target.is_relative_to(MEDIA.resolve()) or not target.is_file(): raise HTTPException(404)
  return FileResponse(target,media_type=row['mime'],headers={'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'})

@app.get('/api/creators')
def public_creators():
 with db() as conn:
  rows=[dict(r) for r in conn.execute("SELECT id,name,slug,bio,onlyfans_url,instagram_url,telegram_url FROM creators WHERE active=1 ORDER BY name")]
  for creator in rows:
   creator['images']=['/api/image/'+str(m['id']) for m in conn.execute("SELECT id FROM media WHERE creator_id=? AND kind='image' AND active=1 AND approved=1 ORDER BY position,id",(creator['id'],))]
   creator['image']=creator['images'][0] if creator['images'] else None
  return rows

@app.get('/api/image/{media_id}')
def public_image(media_id:int):
 with db() as conn:
  row=conn.execute("SELECT m.* FROM media m JOIN creators c ON c.id=m.creator_id WHERE m.id=? AND m.kind='image' AND m.active=1 AND m.approved=1 AND c.active=1",(media_id,)).fetchone()
  if not row: raise HTTPException(404)
  target=(MEDIA/row['path']).resolve()
  if not target.is_relative_to(MEDIA.resolve()) or not target.is_file(): raise HTTPException(404)
  return FileResponse(target,media_type=row['mime'],headers={'X-Content-Type-Options':'nosniff'})

@app.get('/api/clips')
def clips():
 with db() as conn: creators,items,ads=active_feed_inputs(conn)
 result=[]
 for item in build_feed(creators,items,ads,seed=int(time.time()//3600),limit=30):
  if item['type']=='clip':
   clip=item['item'];creator=next(c for c in creators if c['id']==clip['creator_id'])
   result.append({'id':clip['id'],'src':'/api/media/'+str(clip['id']),'creator':creator['name'],'caption':clip['caption'],'profile':'/#/creator/'+creator['slug'],'instagram':creator.get('instagram_url'),'telegram':creator.get('telegram_url'),'onlyfans':creator.get('onlyfans_url'),'approved':True,'explicit':False})
  else: result.append({'type':'ad','title':item['item']['title'],'url':item['item']['url']})
 return result

@app.get('/api/media/{media_id}')
def public_media(media_id:int):
 with db() as conn:
  row=conn.execute("SELECT m.* FROM media m JOIN creators c ON c.id=m.creator_id WHERE m.id=? AND m.active=1 AND m.approved=1 AND m.clip_enabled=1 AND c.active=1 AND c.clips_enabled=1 AND m.kind='video'",(media_id,)).fetchone()
  if not row: raise HTTPException(404)
  target=(MEDIA/row['path']).resolve()
  if not target.is_relative_to(MEDIA.resolve()) or not target.is_file(): raise HTTPException(404)
  return FileResponse(target,media_type=row['mime'],headers={'X-Content-Type-Options':'nosniff'})

@app.get('/admin',response_class=HTMLResponse)
@app.get('/admin/',response_class=HTMLResponse)
def admin(): return (Path(__file__).parent/'index.html').read_text(encoding='utf-8')
