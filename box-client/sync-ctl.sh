#!/bin/bash
# usage: OFFICE_DIR=/path sync-ctl.sh start|stop|status|restart   (or: sync-ctl.sh --dir /path <cmd>)
# Keeps exactly one sync.py running for that OFFICE_DIR (log: $OFFICE_DIR/sync.log).
# Shared box: stop/restart require an explicit OFFICE_DIR and only touch the sync started for that same dir.
if [ "$1" = "--dir" ]; then OFFICE_DIR="$2"; shift 2; fi
H="$(cd "$(dirname "$0")" && pwd)"
cmd="$1"
if [ -z "${OFFICE_DIR:-}" ]; then
  case "$cmd" in stop|restart) echo "refusing to $cmd: set OFFICE_DIR (or use --dir) so only your sync is touched" >&2; exit 2;; esac
fi
D="$(cd "${OFFICE_DIR:-/workspace/office-status}" 2>/dev/null && pwd)" || { echo "no such dir: ${OFFICE_DIR}" >&2; exit 2; }
P="$D/.sync.pid"
ours() { # pid is a sync.py whose OFFICE_DIR is exactly $D
  local p="$1"; [ -n "$p" ] && kill -0 "$p" 2>/dev/null || return 1
  tr '\0' '\n' < "/proc/$p/cmdline" 2>/dev/null | grep -q 'sync\.py$' || return 1
  tr '\0' '\n' < "/proc/$p/environ" 2>/dev/null | grep -qx "OFFICE_DIR=$D"
}
running() { [ -f "$P" ] && ours "$(cat "$P")"; }
case "$cmd" in
  start)   running && { echo "sync already running (pid $(cat "$P"))"; exit 0; }
           OFFICE_DIR="$D" nohup python3 "$H/sync.py" >>"$D/sync.log" 2>&1 & echo $! > "$P"; echo "sync started (pid $!)";;
  stop)    if running; then kill "$(cat "$P")" && echo "sync stopped"; else echo "no sync for $D running (nothing killed)"; fi; rm -f "$P";;
  status)  running && echo "sync running (pid $(cat "$P"))" || { echo "sync not running for $D"; exit 1; };;
  restart) OFFICE_DIR="$D" "$0" stop; sleep 1; OFFICE_DIR="$D" "$0" start;;
  *) echo "usage: OFFICE_DIR=/path $0 start|stop|status|restart" >&2; exit 2;;
esac
