import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('feed',Path(__file__).resolve().parents[1]/'feed_order.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class FeedTests(unittest.TestCase):
 def test_suppresses_inactive_and_interleaves(self):
  creators=[{'id':1,'active':1,'clips_enabled':1,'boost':5},{'id':2,'active':1,'clips_enabled':1},{'id':3,'active':0,'clips_enabled':1}]
  clips=[{'id':i,'creator_id':1 if i<4 else 2,'active':1,'approved':1} for i in range(1,7)]+[{'id':7,'creator_id':3,'active':1,'approved':1}]
  feed=m.build_feed(creators,clips,[{'id':'ad','active':1,'approved':1}],seed=8,ad_interval=3)
  items=[x['item']['creator_id'] for x in feed if x['type']=='clip']
  self.assertEqual(items.count(1),3);self.assertEqual(items.count(2),3);self.assertNotIn(3,items)
  self.assertTrue(all(not(a==b==c) for a,b,c in zip(items,items[1:],items[2:])))
  self.assertEqual([x['type'] for x in feed].count('ad'),1)
 def test_boost_changes_exposure_with_cap(self):
  creators=[{'id':1,'active':1,'clips_enabled':1,'boost':5},{'id':2,'active':1,'clips_enabled':1,'boost':1}]
  clips=[{'id':i,'creator_id':1 if i<30 else 2,'active':1,'approved':1} for i in range(1,60)]
  values=[v['item']['creator_id'] for v in m.build_feed(creators,clips,[],seed=0,limit=9)]
  self.assertGreater(values.count(1),values.count(2))
  self.assertTrue(all(not(a==b==c) for a,b,c in zip(values,values[1:],values[2:])))
 def test_disabled_and_unapproved(self):
  self.assertEqual(m.build_feed([{'id':1,'active':1,'clips_enabled':1}],[{'creator_id':1,'active':1,'approved':0}],[]),[])
if __name__=='__main__':unittest.main()
