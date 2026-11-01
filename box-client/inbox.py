#!/usr/bin/env python3
"""Office command inbox. $OFFICE_DIR/inbox/<slug>.jsonl = unread; <slug>.read.jsonl = read (sync.py reports these as 'seen')."""
import os, sys, json, fcntl, re
D = os.path.join(os.environ.get('OFFICE_DIR', '/workspace/office-status'), 'inbox')
def slugify(name): return re.sub(r'-+$', '', re.sub(r'[^a-z0-9\n]', '-', name.lower()))[:80]
class Lock:
    def __init__(self, slug): self.p = os.path.join(D, slug + '.lock')
    def __enter__(self): os.makedirs(D, exist_ok=True); self.f = open(self.p, 'a'); fcntl.flock(self.f, fcntl.LOCK_EX); return self
    def __exit__(self, *a): fcntl.flock(self.f, fcntl.LOCK_UN); self.f.close()
def read_unread(name):
    slug = slugify(name); u = os.path.join(D, slug + '.jsonl'); r = os.path.join(D, slug + '.read.jsonl')
    with Lock(slug):
        if not os.path.exists(u) or os.path.getsize(u) == 0: return []
        lines = [l for l in open(u).read().splitlines() if l.strip()]
        with open(r, 'a') as f: f.write(''.join(l + '\n' for l in lines))
        open(u, 'w').close()
    out = []
    for l in lines:
        try: out.append(json.loads(l))
        except Exception: pass
    return out
def show(name):
    cmds = read_unread(name)
    if not cmds: return
    print('Commands from the office:')
    for c in cmds:
        a = c.get('action', '?').upper(); t = (c.get('text') or '').strip()
        print(f"  - [{a}]" + (f" {t}" if t else '') + f"  (id {str(c.get('id',''))[:8]})")
    sys.stdout.flush()
if __name__ == '__main__': show(sys.argv[1])
