# Connecting your Grok Bots to the Agent Office

The office runs on your machine (`http://127.0.0.1:8081/office`). Your Grok Bots run on their own cloud box, so **they can't reach your localhost**. They report to a small **relay** on the internet, and a pull job on your machine mirrors that relay into the local office. The pull job also sends your Approve, Decline and Nudge clicks back to the relay.

```
Grok Bot ──POST status──▶ relay ◀──poll── relay-pull.mjs (your machine) ──▶ local office
Grok Bot ◀──read inbox─── relay ◀──forward commands──┘
```

This is a one-time setup per member. Choose one option.

## Option 1: Cloudflare Worker relay (recommended)

This option needs a free Cloudflare account. Your tokens stay private, and you also get the remote web view.

1. Deploy `remote/worker/`. Follow REMOTE_ACCESS.md. You will set `REPORT_TOKEN` (for bots) and `PUSH_TOKEN` (for your machine) as wrangler secrets.
2. Start the pull job on your machine and leave it running:
   ```bash
   RELAY=worker RELAY_URL=https://<your-worker>.workers.dev RELAY_PUSH_TOKEN=<PUSH_TOKEN> \
   OFFICE_URL=http://127.0.0.1:8081/api/office node office/server/relay-pull.mjs
   ```
3. Send each bot the instruction block below. Use `<RELAY_URL>` = your Worker URL and `<REPORT_TOKEN>` = the bot token.

Relay endpoints:
- Bots use `POST /report` and `GET /inbox?bot=<name>` with `Bearer REPORT_TOKEN`.
- Your machine uses `GET /export` and `POST /enqueue` with `Bearer PUSH_TOKEN`.

## Option 2: ntfy topics (no account)

This option needs no account. Bots publish to a private [ntfy](https://ntfy.sh) topic, and your machine polls it. **The topic name is the only secret.** Anyone who knows it can read or post, so use long random names. Messages also pass through the public ntfy.sh server; you can self-host ntfy and set `NTFY_BASE`.

1. Pick two random topic names, one for status and one for commands. For example, run `openssl rand -hex 16` twice.
2. Start the pull job:
   ```bash
   RELAY=ntfy NTFY_STATUS_TOPIC=<STATUS_TOPIC> NTFY_CMD_TOPIC=<CMD_TOPIC> \
   OFFICE_URL=http://127.0.0.1:8081/api/office node office/server/relay-pull.mjs
   ```
3. Send each bot the Option 2 block below.

## Instruction block to send each Grok Bot

Replace the `<…>` placeholders and send one copy per bot. Each bot gets its own `<BOT NAME>`. The name must match roster.json.

**Option 1 (Worker):**
````
Agent Office reporting. You are "<BOT NAME>".
Report your status with:
  curl -s -X POST <RELAY_URL>/report -H "Authorization: Bearer <REPORT_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"name":"<BOT NAME>","state":"<STATE>","task":"<short task>","step":<n>,"total":<m>}'
- On start: state "working" with a short task.
- After each major step: state "working", update step and total.
- When you need my input: state "needs_you", with the task as your question.
- When finished: state "idle", task "done: <one-line result>". Use "error" if something failed.
Every run, before you start, check your inbox:
  curl -s "<RELAY_URL>/inbox?bot=<BOT NAME>" -H "Authorization: Bearer <REPORT_TOKEN>"
It returns a JSON list of {action, text}. "approve" means go ahead. "decline" means stop or skip it. "nudge" means follow the text.
Keep the token private and never print it in chat or logs.
````

**Option 2 (ntfy):**
````
Agent Office reporting. You are "<BOT NAME>".
Report your status with:
  curl -s -d '{"name":"<BOT NAME>","state":"<STATE>","task":"<short task>","step":<n>,"total":<m>}' https://ntfy.sh/<STATUS_TOPIC>
- On start: state "working" with a short task.
- After each major step: state "working", update step and total.
- When you need my input: state "needs_you", with the task as your question.
- When finished: state "idle", task "done: <one-line result>". Use "error" if something failed.
Every run, before you start, check your inbox:
  curl -s "https://ntfy.sh/<CMD_TOPIC>/json?poll=1&since=24h"
Use only lines whose message has "bot":"<BOT NAME>". Skip ids listed in ~/office-seen.txt, and add the ids you act on to that file.
"approve" means go ahead. "decline" means stop or skip it. "nudge" means follow the text.
Keep the topic names private and never print them in chat or logs.
````

## Notes
- **States:** `working`, `needs_you`, `idle`, `error`. A `working` bot with no update for `ALERT_STUCK_MIN` minutes (default 20) raises a "stuck" alert.
- **Spaces in names:** in the inbox URL, write spaces as `%20`.
- **Timestamps:** the office keeps each bot's own report time, so staleness reflects when the bot reported, not when your machine polled.
- **Pull job stopped:** bots keep reporting to the relay, and the office catches up when the job restarts. With ntfy, it catches up on the last hour.
- **Security:** never commit tokens or topic names. Keep them in your shell environment or a git-ignored `.env`.
