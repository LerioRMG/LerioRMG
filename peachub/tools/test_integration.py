import json, sqlite3, tempfile, unittest, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import catalogue, feed_order
from import_staged import import_staged
class Integration(unittest.TestCase):
 def test_import_and_activation(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);stage=root/'stage';(stage/'foto/1').mkdir(parents=True);(stage/'foto/1/1.jpg').write_bytes(b'image')
   (stage/'creator.json').write_text(json.dumps({'version':1,'creators':[{'source_id':1,'name':'Evie','slug':'evie','images':['foto/1/1.jpg']}]}))
   import_staged(stage,root/'database',root/'media');db=catalogue.open_catalogue(root/'database')
   cid=db.execute('select id from creators').fetchone()['id'];catalogue.set_creator_state(db,cid,active=True,clips_enabled=True,boost=3)
   mid=catalogue.add_media(db,cid,'clips/evie.mp4','video/mp4','video');catalogue.set_media_state(db,mid,active=True,approved=True,clip_enabled=True)
   creators,clips,ads=catalogue.active_feed_inputs(db);feed=feed_order.build_feed(creators,clips,ads)
   self.assertEqual(len(feed),1);self.assertEqual(feed[0]['item']['creator_id'],cid);db.close()
if __name__=='__main__':unittest.main()
