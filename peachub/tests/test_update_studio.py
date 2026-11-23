import importlib.util, sqlite3, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('update',Path(__file__).resolve().parents[1]/'update_studio.py');u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
class UpdateTests(unittest.TestCase):
 def test_backfill_only_empty_values(self):
  with tempfile.TemporaryDirectory() as td:
   src=Path(td)/'fans.db';dst=Path(td)/'peach.db';db=sqlite3.connect(src)
   db.execute('CREATE TABLE creators(id INTEGER,excerpt TEXT,about TEXT)');db.executemany('INSERT INTO creators VALUES(?,?,?)',[(1,'fonte breve','fonte lunga'),(2,'fonte 2','fonte 2 lunga')]);db.commit();db.close()
   db=sqlite3.connect(dst);db.execute('CREATE TABLE creators(id INTEGER,source_key TEXT,excerpt TEXT,about TEXT)');db.executemany('INSERT INTO creators VALUES(?,?,?,?)',[(1,'fanslist:1','mio testo',''),(2,'fanslist:2','','testo personale'),(3,'altro:3','','')]);db.commit();db.close()
   self.assertEqual(u.backfill(src,dst),2);self.assertEqual(u.backfill(src,dst),0)
   db=sqlite3.connect(dst);self.assertEqual(db.execute('SELECT excerpt,about FROM creators WHERE id=1').fetchone(),('mio testo','fonte lunga'));self.assertEqual(db.execute('SELECT excerpt,about FROM creators WHERE id=2').fetchone(),('fonte 2','testo personale'));self.assertEqual(db.execute('SELECT excerpt,about FROM creators WHERE id=3').fetchone(),('',''));db.close()
if __name__=='__main__':unittest.main()

class UpdateFlowTests(unittest.TestCase):
 def test_install_and_rollback_preserve_database(self):
  from unittest.mock import patch
  for fail in (False,True):
   with self.subTest(fail=fail),tempfile.TemporaryDirectory() as t:
    root=Path(t);u.SRC=root/'src';u.SRC.mkdir();u.APP=root/'app';u.APP.mkdir();u.WEB=root/'web';u.WEB.mkdir();u.BACKUP_ROOT=root/'backups';u.BACKUP_ROOT.mkdir()
    (u.APP/'venv/bin').mkdir(parents=True);(u.APP/'venv/bin/python').write_text('fake')
    target=u.APP/'file';target.write_text('old');incoming=u.SRC/'file';incoming.write_text('new');u.FILES={'file':(target,'oldhash')}
    u.DB=root/'peach.db';db=sqlite3.connect(u.DB);db.execute('CREATE TABLE creators(id INTEGER,source_key TEXT,excerpt TEXT,about TEXT)');db.execute("INSERT INTO creators VALUES(1,'fanslist:1','personal','')");db.commit();db.close()
    source=root/'fans.db';db=sqlite3.connect(source);db.execute('CREATE TABLE creators(id INTEGER,excerpt TEXT,about TEXT)');db.execute("INSERT INTO creators VALUES(1,'source','about source')");db.commit();db.close()
    def cmd(*a,**k):
     if fail and a[:2]==('systemctl','start'):raise RuntimeError('service failed')
    class FakeResponse:
     status=200
     def __enter__(self):return self
     def __exit__(self,*a):pass
    class Done: returncode=0
    with patch.object(u.os,'geteuid',return_value=0),patch.object(u,'sha',side_effect=lambda p:'oldhash' if p.read_text()=='old' else 'newhash'),patch.object(u.subprocess,'check_output',return_value=str(source)),patch.object(u,'command',side_effect=cmd),patch.object(u.subprocess,'run',return_value=Done()),patch.object(u.urllib.request,'urlopen',return_value=FakeResponse()):
     if fail:
      with self.assertRaises(RuntimeError):u.main()
      self.assertEqual(target.read_text(),'old')
     else:
      u.main();self.assertEqual(target.read_text(),'new')
     db=sqlite3.connect(u.DB);self.assertEqual(db.execute('select excerpt,about from creators').fetchone(),('personal','about source'));db.close()
