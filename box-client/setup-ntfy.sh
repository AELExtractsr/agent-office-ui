#!/bin/bash
# Optional phone alerts. Generates a private ntfy topic, stores it in $OFFICE_DIR/.ntfy_topic (600), uploads NTFY_TOPIC. Prints nothing secret.
set -euo pipefail
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] || { echo "set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID first (both required)" >&2; exit 1; }
D="${OFFICE_DIR:-/workspace/office-status}"; W="$(cd "$(dirname "$0")/../remote/worker" && pwd)"; umask 077
[ -s "$D/.ntfy_topic" ] || python3 -c 'import secrets,sys;sys.stdout.write("office-"+secrets.token_urlsafe(18))' > "$D/.ntfy_topic"
cd "$W" && npx wrangler secret put NTFY_TOPIC < "$D/.ntfy_topic" >/dev/null && echo "NTFY_TOPIC set (topic stored in $D/.ntfy_topic)"
