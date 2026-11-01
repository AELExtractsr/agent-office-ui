# Grok Bot quick start: your main Grok Bot hosts the office

**For the member:** tell your main Grok Bot:
> Set up the Agent Office from github.com/AELExtractsr/agent-office-ui. Follow GROKBOT_QUICKSTART.md.

**For the Grok Bot:** the rest of this file is for you. Follow it top to bottom. **Never print, echo, log, or paste** any token, passcode, or ntfy topic. Read them from the files below and pass them by redirect (`< file`), not on the command line.

This is how the office was first built. Your Grok Bot hosts the office on a Cloudflare Worker that it deploys from its own box. Your other Grok Bots run on the same shared box, so they report by writing a small status file. One sync process relays those files to the Worker and brings approve, decline and nudge commands back to an inbox. You then embed the office URL in your Agentic OS.

```
teammate bots ─ set-status.sh ─▶ /workspace/office-status/*.json ─ sync.py ─▶ Worker (/push) ─▶ office page
teammate bots ◀─ check-inbox.sh ◀─ inbox/ ◀────────────── sync.py ◀─ Worker (/pull) ◀─ approve/nudge clicks
```

## What the member provides
1. **A Cloudflare account.** The free plan is fine. Open *Workers & Pages* once in the dashboard so the account has a `workers.dev` subdomain.
2. **A Cloudflare API token:** *My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"* template. Send it to the bot through the bot's secure secret or credential form, never in plain chat.
3. **The Cloudflare Account ID (required, even if the token covers only one account).** It's shown on the dashboard's right sidebar. Without it, wrangler fails on `/memberships` with error 9106.
4. **Optional:** the **ntfy** app on their phone, for alerts.

## Steps for the Grok Bot
`D=/workspace/office-status` holds runtime state and secrets, all mode 600. `R=/workspace/agent-office-ui` is the repo.

1. **Get the code**
   ```bash
   git clone https://github.com/AELExtractsr/agent-office-ui /workspace/agent-office-ui
   mkdir -p /workspace/office-status && chmod 700 /workspace/office-status
   ```
2. **Store the Cloudflare token.** Write it from the secret form straight to `$D/.cf_token` with `umask 077`, without echoing it. In every later wrangler command, load it inline:
   ```bash
   export CLOUDFLARE_API_TOKEN="$(cat /workspace/office-status/.cf_token)" CLOUDFLARE_ACCOUNT_ID="<ACCOUNT_ID>"   # both required
   ```
3. **Configure the Worker**
   ```bash
   cd /workspace/agent-office-ui/remote/worker
   cp wrangler.toml.example wrangler.toml
   npm install --no-save wrangler      # package.json ({"private":true}) is included so this works
   ```
   In `wrangler.toml`:
   - Set a unique `name`, for example `agent-office-<4 random chars>`.
   - Set `OFFICE_TITLE`.
   - Set `OFFICE_ROSTER_JSON` with one entry per teammate: `{"id","name","color","shape"}`. Use each bot's exact display name, and its color (`#rrggbb`) and shape as shown in the Grok app. Valid shapes are `circle | square | rounded | hexagon | triangle | diamond | star | pill`. Mark yourself `"primary":true`.
4. **Deploy, then set the secrets**
   ```bash
   ./deploy.sh | tee /workspace/office-status/deploy.log
   grep -o 'https://[a-z0-9.-]*workers\.dev' /workspace/office-status/deploy.log | head -1 > /workspace/office-status/.office_url
   ../../box-client/setup-secrets.sh
   ```
   - `setup-secrets.sh` generates `COOKIE_SECRET`, `PUSH_TOKEN`, `REPORT_TOKEN` and `OFFICE_PASSCODE`. It stores the push token, report token and passcode in `$D` (mode 600) and uploads all four to Cloudflare. It prints nothing secret.
   - Until the secrets are set, the Worker answers "Not configured". That is expected.
   - **Optional:** to make tapped phone alerts open the office, set `OFFICE_URL` in `[vars]` to that URL, then run `./deploy.sh` again.
5. **Start the sync** (one instance, idempotent): `OFFICE_DIR=/workspace/office-status /workspace/agent-office-ui/box-client/sync-ctl.sh start`.
   > **Shared box warning:** other agents may run their own office syncs on this box. Always pass `OFFICE_DIR` explicitly. `stop` and `restart` refuse to run without it, and they only kill the sync started for that exact directory. Never use `pkill` or kill sync processes by name. The log is `$D/sync.log`. `set-status.sh` also starts the sync if it isn't running, so it survives box restarts once any bot reports.
6. **Report yourself:** `/workspace/agent-office-ui/box-client/set-status.sh "<YOUR NAME>" idle "Office set up"`.
7. **Message each teammate** with the instruction block below. Send it through your normal teammate channel, filled in with that bot's exact name.
8. **Hand over to the member:**
   - Give them the office URL from `$D/.office_url`.
   - Give them the passcode through a private route only. For example, save it as a login in the member's vault, or tell them it's in `$D/.passcode` on the box. Never put it in chat history, logs, or the repo.
   - Point them to "Embed in the Agentic OS" below.
9. **Optional phone alerts:** run `/workspace/agent-office-ui/box-client/setup-ntfy.sh`. Then the member installs ntfy and subscribes to the topic stored in `$D/.ntfy_topic`. Deliver that topic the same private way as the passcode.

## Instruction block for each teammate bot
````
You're on the Agent Office. Your office name is "<BOT NAME>" (use exactly this).
Report your status by running:
  /workspace/agent-office-ui/box-client/set-status.sh "<BOT NAME>" <state> "<short task>" [step] [total]
- When you start a run: working "<what you're doing>"
- After each major step: working "<step summary>" <n> <total>
- When you need my input: needs_you "<your question>"
- When you finish: idle "done: <one-line result>"   (or: error "<what failed>")
At the start of every run, check your inbox first:
  /workspace/agent-office-ui/box-client/check-inbox.sh "<BOT NAME>"
set-status.sh also prints new commands. APPROVE means go ahead. DECLINE means stop or skip it. NUDGE means follow the text.
Don't edit or print anything in /workspace/office-status except through these scripts.
````

## Embed in the Agentic OS
- The Worker already allows framing from `http://127.0.0.1:8081` and `http://localhost:8081` through `frame-ancestors` in `remote/worker/src/worker.js` (`SEC`). If the OS runs on another origin, add it there and redeploy.
- The login cookie is `SameSite=None; Secure; Partitioned`, so logging in inside the iframe works in Chromium-based browsers.
- In the OS, add the office URL as an embed, or use `<iframe src="https://<your-worker>.workers.dev/" style="width:100%;height:100%;border:0">`. Log in once with the passcode; the session lasts 30 days.
- If your browser blocks third-party cookies, open the URL in its own tab instead.

## Verification checklist
- [ ] `curl -s -o /dev/null -w '%{http_code}' "$(cat $D/.office_url)/"` returns `200`. This is the login page.
- [ ] Logging in with the passcode shows the room with every teammate's desk and its shape and color.
- [ ] `OFFICE_DIR=$D sync-ctl.sh status` shows exactly one sync running, and `$D/sync.log` has no repeating errors.
- [ ] `set-status.sh "<YOUR NAME>" working "test" 1 2`: your desk shows "working 1/2" within about 15 seconds.
- [ ] `set-status.sh "<YOUR NAME>" needs_you "test alert"`: a red badge and banner appear within about 15 seconds, plus a phone push if ntfy is set. Then set yourself back to `idle`.
- [ ] Click Nudge on your desk: `check-inbox.sh "<YOUR NAME>"` prints it within about 15 seconds, and the page later shows it as seen.
- [ ] Each teammate's desk updates after its next run.
- [ ] The office loads inside the Agentic OS embed.

## Troubleshooting
- **Alerts missing after a redeploy, or `/api/alerts` says `pending`:** the Durable Object is still running the old code because sync traffic keeps it warm. Run `OFFICE_DIR=$D sync-ctl.sh stop`, wait 2–3 minutes, then `OFFICE_DIR=$D sync-ctl.sh start`.
- **A nudge or approve stays "queued":** the sync isn't running (`OFFICE_DIR=$D sync-ctl.sh status`). **"Delivered" but never "seen":** the bot hasn't checked its inbox. Each bot must run `check-inbox.sh`, or `set-status.sh`, at the start of every run.
- **A desk never updates:** the reported name doesn't match the roster. Names match by name, `short`, `id` or `aliases`, ignoring case and punctuation. Fix `OFFICE_ROSTER_JSON` and redeploy.
- **A bot shows asleep:** no update for 15 minutes is normal between runs.
- **"Stuck?" alert:** the bot was `working` with no update for `ALERT_STUCK_MIN` minutes (default 30). Remind it to report `idle` when it finishes.
- **One `sync error: HTTPError 500` right after `setup-secrets.sh`:** expected while the new secrets roll out. Ignore it if the next lines are clean.
- **`sync error: HTTPError 401` in the log:** `$D/.push_token` doesn't match the Worker. Re-run `setup-secrets.sh`; this rotates all secrets and logs everyone out.
- **Deploy fails with auth or account errors:** check the token template ("Edit Cloudflare Workers"). Make sure `CLOUDFLARE_ACCOUNT_ID` is set (error 9106 on `/memberships` means it's missing), and make sure the `workers.dev` subdomain exists.
- **Login locked:** after 5 wrong passcodes, wait 10 minutes. Or run `curl -X POST "$(cat $D/.office_url)/reset-lockout" -H "Authorization: Bearer $(cat $D/.push_token)"`; this doesn't print the token.
