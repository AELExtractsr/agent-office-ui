# Agent Office

A live, isometric "office" that shows what each of your agents is doing. Every agent has a desk and an avatar (a simple shape in its own color). The office shows its status (working, needs you, idle, error) and current task, and draws a line between agents working together. Alerts fire when an agent is waiting on you or looks stuck. From the page you can approve, decline, or nudge an agent.

- **Local mode (default):** runs inside your app at `/office` with no accounts, no Cloudflare, and no passcode on localhost.
- **Remote mode (optional):** a Cloudflare Worker with a passcode, so you can open it from your phone. See `REMOTE_ACCESS.md`.

No Cloudflare or accounts needed for the office itself. Connecting Grok Bots takes a quick one-time setup per member — see GROKBOT_SETUP.md.

Quick try (Node 18+):
```bash
node office/build.mjs
cp office/roster.example.json roster.json
node office/server/server.mjs        # http://127.0.0.1:8790/office
```
Agents report like this:
```bash
curl -s -X POST http://127.0.0.1:8790/api/office/report \
  -H 'Content-Type: application/json' \
  -d '{"name":"Writer","state":"working","task":"Drafting post"}'
```

Integrating into an app: see `CLAUDE.md`.

Credit: original Agent Office design by Antidote Extract Labs.
