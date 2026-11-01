#!/bin/bash
# Build the page and deploy the Worker. Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in your env. See REMOTE_ACCESS.md.
set -e
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || { echo "CLOUDFLARE_API_TOKEN is not set (token from the 'Edit Cloudflare Workers' template)" >&2; exit 1; }
[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] || { echo "CLOUDFLARE_ACCOUNT_ID is not set. It is required, even for single-account tokens (otherwise wrangler fails on /memberships, error 9106). Find it on the Cloudflare dashboard sidebar." >&2; exit 1; }
cd "$(dirname "$0")"
node ../../office/build.mjs
cp ../../office/dist/office.html src/app.html
[ -f wrangler.toml ] || { echo "copy wrangler.toml.example to wrangler.toml first"; exit 1; }
npx wrangler deploy
