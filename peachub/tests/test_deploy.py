import importlib.util,json,sqlite3,tempfile,unittest,sys
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('deploy',ROOT/'deploy.py');d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
spec2=importlib.util.spec_from_file_location('copy_staging',ROOT/'copy_from_fanslist.py');source=importlib.util.module_from_spec(spec2);spec2.loader.exec_module(source)
class FakeResponse:
 status=200
 def __enter__(self):return self
 def __exit__(self,*a):pass
class DeployTest(unittest.TestCase):
 def fixture(self,base):
  d.SRC=base/'src';(d.SRC/'tools').mkdir(parents=True);(d.SRC/'admin').mkdir()
  import shutil
  for n in ('catalogue.py','schema.sql','feed_order.py','import_staged.py','copy_from_fanslist.py'):shutil.copy2(ROOT/n,d.SRC/'tools'/n)
  for n in ('app.py','index.html'):shutil.copy2(ROOT/'admin'/n,d.SRC/'admin'/n)
  for n in ('index.html','clips.html'):(d.SRC/n).write_text('new '+n)
  d.WEB=base/'web';d.WEB.mkdir()
  for n in d.BASE:(d.WEB/n).write_text('old '+n)
  d.APP=base/'app';d.STATE=base/'state';d.SERVICE=base/'service';d.BACKUP=base/'backup'
  conf=base/'nginx';orig='server { server_name thepeachub.com; listen 443 ssl; }';conf.write_text(orig)
  up=base/'uploads';up.mkdir();(up/'m.jpg').write_bytes(b'image')
  src=base/'fans.db';db=sqlite3.connect(src);db.execute('CREATE TABLE creators(id INTEGER,name TEXT,slug TEXT,username TEXT,image TEXT,deleted_at TEXT)')
  for i,(name,(handles,_)) in enumerate(source.REQUESTED.items(),1):db.execute('INSERT INTO creators VALUES(?,?,?,?,?,NULL)',(i,name,handles[0],handles[0],'m.jpg'))
  db.commit();db.close()
  return conf,orig,src,up
 def test_success_and_rollback(self):
  for fail in (False,True):
   with self.subTest(fail=fail),tempfile.TemporaryDirectory() as td:
    p=Path(td);conf,orig,src,up=self.fixture(p)
    def run(*args,**kw):
     if len(args)>1 and str(args[1]).endswith('copy_from_fanslist.py'):source.run(args[2],args[3],args[4])
     if fail and args[:2]==('nginx','-t'):raise RuntimeError('nginx test failed')
    with patch.object(d.os,'geteuid',return_value=0),patch.object(d,'git_hash',side_effect=lambda f:d.BASE[f.name]),patch.object(d,'nginx_target',return_value=(conf,orig,orig.rfind('}'))),patch.object(d.getpass,'getpass',return_value='correct-horse-battery'),patch.object(d,'run',side_effect=run),patch.object(d.subprocess,'check_output',return_value=str(src)+'\n'+str(up)+'\n'),patch.object(d.subprocess,'run'),patch.object(d.urllib.request,'urlopen',return_value=FakeResponse()):
     if fail:
      with self.assertRaises(RuntimeError):d.main()
      self.assertEqual(conf.read_text(),orig);self.assertEqual((d.WEB/'index.html').read_text(),'old index.html');self.assertFalse(d.APP.exists());self.assertFalse(d.STATE.exists())
     else:
      d.main();self.assertIn('location ^~ /api/',conf.read_text());self.assertEqual((d.WEB/'index.html').read_text(),'new index.html')
      db=sqlite3.connect(d.STATE/'peachub.sqlite');self.assertEqual(db.execute('SELECT count(*),sum(active) FROM creators').fetchone(),(9,0));db.close()
if __name__=='__main__':unittest.main()
