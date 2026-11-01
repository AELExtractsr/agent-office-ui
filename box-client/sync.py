#!/usr/bin/env python3
"""Push $OFFICE_DIR/*.json to the office Worker (/push) when changed, plus a 4-minute heartbeat. Stdlib only.
Also pulls page commands (GET /pull) into inbox/<slug>.jsonl, acks them as delivered, and reports read ones as seen.
Reads the Worker URL from $OFFICE_DIR/.office_url and the token from $OFFICE_DIR/.push_token. Never prints either."""
import os, sys, json, glob, time, urllib.request
D = os.environ.get('OFFICE_DIR', '/workspace/office-status')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import inbox as IB
BASE = open(os.path.join(D, '.office_url')).read().strip().rstrip('/')
TOKEN = open(os.path.join(D, '.push_token')).read().strip()
IBX = IB.D; SEEN_F = os.path.join(IBX, '.seen_acked'); GOT_F = os.path.join(IBX, '.received')
EVERY, HEARTBEAT = 7, 240
def snapshot():
    out = {}
    for fp in sorted(glob.glob(os.path.join(D, '*.json'))):
        try:
            d = json.load(open(fp))
            if isinstance(d, dict) and d.get('name') and d.get('state'): out[os.path.basename(fp)[:-5]] = d
        except Exception: pass
    return out
def api(method, path, body=None):
    req = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(), method=method,
        headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'office-sync/1'})
    with urllib.request.urlopen(req, timeout=20) as r: return json.loads(r.read() or b'null')
def idset(fp): return set(open(fp).read().split()) if os.path.exists(fp) else set()
def pull_commands():
    os.makedirs(IBX, exist_ok=True); got = idset(GOT_F); delivered = []
    for c in api('GET', '/pull') or []:
        cid = str(c.get('id', ''))
        if not cid: continue
        if cid not in got:
            slug = IB.slugify(str(c.get('bot', '')))
            if not slug: continue
            rec = {k: c.get(k) for k in ('id', 'bot', 'action', 'text', 'created')}
            with IB.Lock(slug), open(os.path.join(IBX, slug + '.jsonl'), 'a') as f: f.write(json.dumps(rec) + '\n')
            with open(GOT_F, 'a') as f: f.write(cid + '\n')
        delivered.append(cid)
    if delivered: api('POST', '/ack', {'delivered': delivered})
def sync_seen():
    acked = idset(SEEN_F); new = []
    for fp in glob.glob(os.path.join(IBX, '*.read.jsonl')):
        for l in open(fp):
            try: cid = json.loads(l).get('id')
            except Exception: continue
            if cid and cid not in acked: new.append(cid)
    if new:
        api('POST', '/ack', {'seen': new})
        with open(SEEN_F, 'a') as f: f.write(''.join(i + '\n' for i in new))
last, last_t = None, 0
print(time.strftime('%F %T'), 'office sync started', flush=True)
while True:
    try:
        s = snapshot(); now = time.time()
        if s != last or now - last_t > HEARTBEAT:
            api('PUT', '/push', s); last, last_t = s, now
        pull_commands(); sync_seen()
    except Exception as e:
        print(time.strftime('%F %T'), 'sync error:', type(e).__name__, getattr(e, 'code', ''), flush=True)
        time.sleep(15)
    time.sleep(EVERY)
