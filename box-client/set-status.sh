#!/bin/bash
# usage: set-status.sh "<Bot Name>" <working|needs_you|idle|error> "<what it's doing>" [step] [total]
# Writes $OFFICE_DIR/<slug>.json (default /workspace/office-status). sync.py pushes it to the office. Then prints unread office commands.
D="${OFFICE_DIR:-/workspace/office-status}"; H="$(cd "$(dirname "$0")" && pwd)"
[ $# -ge 3 ] || { echo 'usage: set-status.sh "<Bot Name>" <working|needs_you|idle|error> "<task>" [step] [total]' >&2; exit 2; }
case "$2" in working|needs_you|idle|error) ;; *) echo "state must be working|needs_you|idle|error" >&2; exit 2;; esac
mkdir -p "$D"
python3 - "$D" "$1" "$2" "$3" "${4:-}" "${5:-}" <<'PY'
import json,sys,time,re,os
d,name,state,task,step,total=sys.argv[1:7]
slug=re.sub(r'-+$','',re.sub(r'[^a-z0-9\n]','-',name.lower()))[:80]
o={"name":name,"state":state,"task":task[:400],"updated":int(time.time())}
if step: o["step"]=int(step)
if total: o["total"]=int(total)
tmp=os.path.join(d,f".{slug}.tmp"); json.dump(o,open(tmp,"w")); os.replace(tmp,os.path.join(d,f"{slug}.json"))
PY
# keep the sync running (idempotent; silent when already up)
[ -s "$D/.office_url" ] && [ -s "$D/.push_token" ] && OFFICE_DIR="$D" "$H/sync-ctl.sh" start >/dev/null 2>&1
exec python3 "$H/inbox.py" "$1"
