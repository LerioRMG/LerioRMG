import hashlib, importlib.util, os, sys, tempfile, unittest
from pathlib import Path
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
spec=importlib.util.spec_from_file_location('peach_app',Path(__file__).resolve().parents[1]/'admin/app.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class AdminTest(unittest.TestCase):
 def test_flow(self):
  with tempfile.TemporaryDirectory() as t:
   m.STATE=Path(t);m.DB=m.STATE/'peachub.sqlite';m.MEDIA=m.STATE/'media';m.AUTH=m.STATE/'admin.hash'
   salt=os.urandom(16);m.AUTH.write_text(salt.hex()+':'+hashlib.scrypt(b'test-password',salt=salt,n=16384,r=8,p=1).hex())
   with TestClient(m.app,base_url='https://testserver') as c:
    self.assertEqual(c.get('/admin/data').status_code,401)
    self.assertEqual(c.post('/admin/login',data={'password':'bad'}).status_code,401)
    self.assertEqual(c.post('/admin/login',data={'password':'test-password'}).status_code,204)
    csrf=c.get('/admin/session').json()['csrf'];headers={'x-csrf-token':csrf}
    self.assertEqual(c.post('/admin/creator',json={'name':'Ash','slug':'ash','boost':1}).status_code,403)
    r=c.post('/admin/creator',headers=headers,json={'name':'Ash','slug':'ash','active':True,'clips_enabled':True,'boost':2});self.assertEqual(r.status_code,200);cid=r.json()['id']
    r=c.post('/admin/upload',headers=headers,data={'creator_id':cid},files={'files':('x.mp4',b'\x00\x00\x00\x18ftypisom'+b'0'*40,'video/mp4')});self.assertEqual(r.status_code,200);mid=r.json()['uploaded'][0]
    self.assertEqual(c.get('/api/media/'+str(mid)).status_code,404)
    self.assertEqual(c.post('/admin/media/'+str(mid),headers=headers,json={'active':True,'approved':True,'clip_enabled':True,'caption':'Ciao!', 'tags':'OnlyFanser, Creator'}).status_code,200)
    self.assertEqual(len(c.get('/api/clips').json()),1);self.assertEqual(c.get('/api/clips').json()[0]['tags'],['OnlyFanser','Creator']);self.assertEqual(c.post('/admin/media/'+str(mid),headers=headers,json={'active':True,'approved':True,'clip_enabled':True,'caption':'Aggiornata'}).status_code,200);self.assertEqual(c.get('/api/clips').json()[0]['tags'],['OnlyFanser','Creator']);self.assertEqual(c.get('/api/media/'+str(mid)).status_code,200)
    self.assertEqual(c.get('/api/media/'+str(mid),headers={'Range':'bytes=0-3'}).status_code,206)
    self.assertEqual(c.post('/admin/creator',headers=headers,json={'id':cid,'name':'Ash','slug':'ash','active':True,'clips_enabled':True,'boost':2,'excerpt':'Testo conservato','about':'Approfondimento','tags':'Creator'}).status_code,200)
    self.assertEqual(c.post('/admin/creator',headers=headers,json={'id':cid,'name':'Ash','slug':'ash','active':True,'clips_enabled':True,'boost':2,'bio':'Cambiata'}).status_code,200)
    self.assertEqual(c.get('/api/creators').json()[0]['excerpt'],'Testo conservato')
    self.assertEqual(c.post('/admin/ads',headers=headers,json={'title':'Sponsor','url':'https://example.com','active':True,'approved':True}).status_code,200)
    batch=c.post('/admin/upload',headers=headers,data={'creator_id':cid},files=[('files',('photo.jpg',b'\xff\xd8\xff'+b'0'*50,'image/jpeg')),('files',('photo2.jpg',b'\xff\xd8\xff'+b'1'*50,'image/jpeg'))]);self.assertEqual(batch.status_code,200);self.assertEqual(len(batch.json()['uploaded']),2);img,img2=batch.json()['uploaded'];self.assertEqual(c.get('/api/image/'+str(img2)).status_code,200)
    self.assertEqual(c.get('/api/image/'+str(img)).status_code,200)
    self.assertEqual(c.post('/admin/media/'+str(img),headers=headers,json={'active':False,'approved':False,'clip_enabled':False}).status_code,200)
    self.assertEqual(c.get('/api/image/'+str(img)).status_code,404)
    self.assertEqual(c.post('/admin/creator/'+str(cid)+'/photos/publish',headers=headers).json()['updated'],1)
    self.assertEqual(c.get('/api/image/'+str(img)).status_code,200)
    self.assertEqual(len(c.get('/api/creators').json()[0]['images']),2)
    self.assertEqual(c.post('/admin/creator',headers=headers,json={'id':cid,'name':'Ash','slug':'ash','active':False,'clips_enabled':True,'boost':2}).status_code,200)
    self.assertEqual(c.get('/api/image/'+str(img)).status_code,404)
    self.assertEqual(c.get('/api/clips').json(),[])
    self.assertEqual(c.post('/admin/logout',headers=headers).status_code,204);self.assertEqual(c.get('/admin/data').status_code,401)
if __name__=='__main__':unittest.main()
