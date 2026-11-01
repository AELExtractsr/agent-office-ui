#!/bin/bash
# usage: check-inbox.sh "<Bot Name>"  - print unread office commands (approve/decline/nudge) for this bot and mark them read.
[ -n "$1" ] || { echo 'usage: check-inbox.sh "<Bot Name>"' >&2; exit 2; }
exec python3 "$(cd "$(dirname "$0")" && pwd)/inbox.py" "$1"
