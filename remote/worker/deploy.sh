#!/bin/bash
# Build the page and deploy the Worker. Needs CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID) in your env. See REMOTE_ACCESS.md.
set -e
cd "$(dirname "$0")"
node ../../office/build.mjs
cp ../../office/dist/office.html src/app.html
[ -f wrangler.toml ] || { echo "copy wrangler.toml.example to wrangler.toml first"; exit 1; }
npx wrangler deploy
