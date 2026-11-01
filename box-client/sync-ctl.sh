#!/bin/bash
# usage: sync-ctl.sh start|stop|status|restart  - keeps exactly one sync.py running (log: $OFFICE_DIR/sync.log)
D="${OFFICE_DIR:-/workspace/office-status}"; H="$(cd "$(dirname "$0")" && pwd)"; P="$D/.sync.pid"
running() { [ -f "$P" ] && kill -0 "$(cat "$P")" 2>/dev/null; }
case "$1" in
  start)   running && { echo "sync already running (pid $(cat "$P"))"; exit 0; }
           OFFICE_DIR="$D" nohup python3 "$H/sync.py" >>"$D/sync.log" 2>&1 & echo $! > "$P"; echo "sync started (pid $!)";;
  stop)    running && kill "$(cat "$P")" && echo "sync stopped" || echo "sync not running"; rm -f "$P";;
  status)  running && echo "sync running (pid $(cat "$P"))" || { echo "sync not running"; exit 1; };;
  restart) "$0" stop; sleep 1; "$0" start;;
  *) echo "usage: $0 start|stop|status|restart" >&2; exit 2;;
esac
