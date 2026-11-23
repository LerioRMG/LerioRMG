"""Lightweight, deterministic feed selection; never modifies stored records."""
from collections import defaultdict
from random import Random

def build_feed(creators, clips, ads, seed=0, limit=30, ad_interval=6):
    """Only enabled creators and approved clips enter the feed. Boost is capped 1..5."""
    if limit <= 0:
        return []
    rng = Random(seed)
    eligible = {c['id']: c for c in creators if c.get('active') and c.get('clips_enabled')}
    pool = defaultdict(list)
    for clip in clips:
        cid = clip.get('creator_id')
        if cid in eligible and clip.get('active') and clip.get('approved'):
            pool[cid].append(clip)
    for values in pool.values():
        rng.shuffle(values)
    counts = defaultdict(int)
    last = None
    streak = 0
    output = []
    ad_pool = [a for a in ads if a.get('active') and a.get('approved')]
    rng.shuffle(ad_pool)
    ad_index = 0
    while pool and len(output) < limit:
        choices = ([cid for cid in pool if cid != last] or list(pool)) if streak >= 2 else list(pool)
        def score(cid):
            try: weight = max(1, min(5, int(eligible[cid].get('boost', 1))))
            except (ValueError, TypeError): weight = 1
            return counts[cid] / weight + rng.random() * .01
        cid = min(choices, key=score)
        clip = pool[cid].pop()
        if not pool[cid]: del pool[cid]
        counts[cid] += 1
        output.append({'type': 'clip', 'item': clip})
        streak = streak + 1 if cid == last else 1
        last = cid
        if ad_interval > 0 and sum(1 for i in output if i['type']=='clip') % ad_interval == 0 and ad_index < len(ad_pool) and len(output) < limit:
            output.append({'type': 'ad', 'item': ad_pool[ad_index]})
            ad_index += 1
    return output
