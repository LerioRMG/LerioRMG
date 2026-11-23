import importlib.util, sqlite3, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('catalogue',Path(__file__).resolve().parents[1]/'catalogue.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class CatalogueTests(unittest.TestCase):
 def test_states_and_clips(self):
  with tempfile.TemporaryDirectory() as t:
   db=m.open_catalogue(Path(t)/'db.sqlite');db.execute("INSERT INTO creators(name,slug) VALUES('Ash','ash')");db.commit()
   mid=m.add_media(db,1,'clips/example.mp4','video/mp4','video')
   m.set_creator_state(db,1,active=True,clips_enabled=True,boost=2)
   self.assertEqual(len(m.active_feed_inputs(db)[1]),0)
   m.set_media_state(db,mid,active=True,approved=True,clip_enabled=True)
   self.assertEqual(len(m.active_feed_inputs(db)[1]),1)
   m.set_creator_state(db,1,active=False,clips_enabled=True,boost=2)
   self.assertEqual(len(m.active_feed_inputs(db)[1]),0)
   with self.assertRaises(ValueError): m.add_media(db,1,'../a','video/mp4','video')
   with self.assertRaises(ValueError): m.add_ad(db,'test','javascript:alert(1)')
   db.close()
class MigrationTests(unittest.TestCase):
 def test_additive_and_idempotent(self):
  with tempfile.TemporaryDirectory() as t:
   path=Path(t)/'db.sqlite';db=sqlite3.connect(path)
   db.executescript("CREATE TABLE creators(id INTEGER PRIMARY KEY,source_key TEXT,name TEXT,slug TEXT,username TEXT,bio TEXT,onlyfans_url TEXT,instagram_url TEXT,telegram_url TEXT,active INTEGER,clips_enabled INTEGER,boost INTEGER,created_at TEXT);CREATE TABLE media(id INTEGER PRIMARY KEY,creator_id INTEGER,path TEXT,mime TEXT,kind TEXT,active INTEGER,approved INTEGER,clip_enabled INTEGER,caption TEXT,position INTEGER,created_at TEXT);CREATE TABLE ads(id INTEGER PRIMARY KEY,title TEXT,url TEXT,image_path TEXT,active INTEGER,approved INTEGER,starts_at TEXT,ends_at TEXT,created_at TEXT);INSERT INTO creators(id,name,slug,bio) VALUES(1,'Ash','ash','contenuto esistente');INSERT INTO media(id,creator_id,path,mime,kind,caption) VALUES(1,1,'1.mp4','video/mp4','video','caption già presente');");db.commit();db.close()
   for _ in range(2):
    db=m.open_catalogue(path);self.assertEqual(db.execute('SELECT bio,excerpt,about,tags FROM creators').fetchone()[:],('contenuto esistente','','',''));self.assertEqual(db.execute('SELECT caption,tags FROM media').fetchone()[:],('caption già presente',''));db.close()
if __name__=='__main__':unittest.main()
