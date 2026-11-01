#!/bin/bash
# Run from anywhere after the first deploy. Generates the Worker secrets, stores the ones the box needs in
# $OFFICE_DIR (chmod 600), and uploads them with wrangler. Prints nothing secret.
# Needs CLOUDFLARE_API_TOKEN in the environment. Re-running ROTATES everything (everyone must log in again).
set -euo pipefail
D="${OFFICE_DIR:-/workspace/office-status}"; W="$(cd "$(dirname "$0")/../remote/worker" && pwd)"
mkdir -p "$D"; chmod 700 "$D"; umask 077
gen() { python3 -c 'import secrets,sys;sys.stdout.write(secrets.token_hex(32))'; }
gen > "$D/.push_token"; gen > "$D/.report_token"
python3 -c 'import secrets,sys;sys.stdout.write("-".join(secrets.token_urlsafe(4) for _ in range(4)))' > "$D/.passcode"
cd "$W"
gen | npx wrangler secret put COOKIE_SECRET >/dev/null
npx wrangler secret put PUSH_TOKEN   < "$D/.push_token"   >/dev/null
npx wrangler secret put REPORT_TOKEN < "$D/.report_token" >/dev/null
npx wrangler secret put OFFICE_PASSCODE < "$D/.passcode"  >/dev/null
echo "secrets set; stored in $D/.push_token .report_token .passcode (mode 600)"
