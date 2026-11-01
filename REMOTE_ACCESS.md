# Remote access (optional): Cloudflare Worker

Use this only if you want to open the office away from your computer, for example on your phone. Local mode needs none of this.
The Worker serves the same page behind a passcode. It keeps state in a Durable Object, and an alarm handles stuck detection.

## 1. Prerequisites
- A free Cloudflare account, and Node 18+.
- An API token: Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template.
- Export `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in your shell. **Both are required:** even with a single-account token, wrangler fails on `/memberships` (error 9106) without the account ID, and `deploy.sh` stops with a clear message if either is missing. Never commit them.

## 2. Configure
```bash
cd remote/worker
cp wrangler.toml.example wrangler.toml      # set a unique `name`; optionally OFFICE_TITLE / OFFICE_ROSTER_JSON / OFFICE_URL
npm install --no-save wrangler             # uses the included package.json
```

## 3. Secrets (each one is stored only in Cloudflare)
Shortcut: deploy first (step 4), then run `box-client/setup-secrets.sh`. It generates all four secrets, keeps the push token, report token and passcode in `$OFFICE_DIR` (default `/workspace/office-status`, mode 600), and prints nothing secret.

Or set them by hand:
Generate random values. Never paste them into chat, code, or logs.
```bash
gen() { node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))'; }
gen | npx wrangler secret put COOKIE_SECRET
gen | npx wrangler secret put PUSH_TOKEN      # for a sync job (/push, /pull, /ack)
gen | npx wrangler secret put REPORT_TOKEN    # for agents calling /report. Save a copy in your own password manager
npx wrangler secret put OFFICE_PASSCODE       # you type it. It's what you enter on the login page
```

## 4. Deploy
```bash
./deploy.sh        # builds office/dist/office.html → src/app.html, then runs wrangler deploy
```
Open `https://<name>.<your-subdomain>.workers.dev/` and enter the passcode. Until the secrets are set, the Worker answers "Not configured".

**Embedding:** `frame-ancestors` (the `SEC` headers in `src/worker.js`) allows `http://127.0.0.1:8081` and `http://localhost:8081`; edit it for other origins. The session cookie is `SameSite=None; Secure; Partitioned`, so login works inside an iframe in Chromium browsers. Where third-party cookies are blocked, open the office in its own tab.

## 5. Point agents at it
Remote endpoints have no `/api/office` prefix:
- `POST /report` with `Authorization: Bearer <REPORT_TOKEN>`. The body is the same as in local mode (see CLAUDE.md "Data contract").
- `POST` or `PUT /push` with `Authorization: Bearer <PUSH_TOKEN>`. The body is `{slug: status}` for the whole box (this is what `box-client/sync.py` sends). This counts as each bot's "own" status.
- `GET /pull` and `POST /ack` with `Bearer <PUSH_TOKEN>`. These read the command inbox (approve, decline, nudge).
- The page uses `/api/status`, `/api/alerts`, `/api/command` and `/api/commands`, which need the login cookie.

## 6. Phone alerts with ntfy (optional)
1. Generate a long random topic name and treat it like a password:
   `node -e 'process.stdout.write("office-"+require("crypto").randomBytes(16).toString("hex"))' > .ntfy_topic && chmod 600 .ntfy_topic`
2. `npx wrangler secret put NTFY_TOPIC < .ntfy_topic`. Add `.ntfy_topic` to `.gitignore`. Or run `box-client/setup-ntfy.sh`, which does steps 1–2 and stores the topic in `$OFFICE_DIR`.
3. Install the **ntfy** app (iOS App Store or Google Play) and subscribe to that same topic on the default server (ntfy.sh).
4. Optional: set `OFFICE_URL` in `[vars]` so tapping a push opens the office. Use `NTFY_SERVER` for a self-hosted ntfy.
5. Tune with `ALERT_STUCK_MIN` (default 30) and `ALERT_COOLDOWN_MIN` (default 15). The hard cap is 20 pushes per hour.

## Notes
- After a deploy, the Durable Object can keep running the old code while traffic keeps it warm. The Worker then answers `/api/alerts` with `"pending"`. Pause any sync job for 2–3 minutes (`OFFICE_DIR=<dir> box-client/sync-ctl.sh stop`, then `start`; on a shared box, never kill syncs by name) and the object will restart on the new code.
- One sync `HTTP 500` right after setting the secrets is expected while they roll out.
- Rotating `OFFICE_PASSCODE` or `COOKIE_SECRET` logs everyone out.
- After 5 wrong passcodes from one IP (40 across all IPs), login locks for 10 minutes. `POST /reset-lockout` with `Bearer PUSH_TOKEN` clears it.

## Relay endpoints for Grok Bots
The Worker also acts as the relay in GROKBOT_SETUP.md, Option 1:
- `GET /inbox?bot=<name>` uses `Bearer REPORT_TOKEN`. Bots read their queued commands, which are then marked delivered.
- `GET /export` and `POST /enqueue` use `Bearer PUSH_TOKEN`. `office/server/relay-pull.mjs` mirrors statuses into your local office and forwards page commands.
