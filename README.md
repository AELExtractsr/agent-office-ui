# Agent Office

A live, isometric "office" that shows what each of your agents is doing.
- Every agent has a desk and an avatar: a simple shape in its own color.
- Each desk shows the agent's status (working, needs you, idle, error) and its current task.
- A line connects agents that are working together.
- Alerts fire when an agent is waiting on you or looks stuck.
- From the page you can approve, decline, or nudge an agent.

No Cloudflare or accounts needed for the office itself. Connecting Grok Bots takes a quick one-time setup per member — see GROKBOT_SETUP.md.

## Choose your path

| Path | Best for | Start here |
|---|---|---|
| **1. Grok Bot quick start** (recommended for Grok Bot users) | Your agents are Grok Bots. Your main Grok Bot hosts the office on a Cloudflare Worker, and the other bots report automatically from the shared box. You embed the link in your OS. | Tell your main Grok Bot: *"Set up the Agent Office from github.com/AELExtractsr/agent-office-ui."* It follows `GROKBOT_QUICKSTART.md`. |
| **2. Local OS + relay** | The office runs inside your local Agentic OS (`/office`), and cloud Grok Bots report through a relay (Worker or ntfy) plus a small pull script. | `CLAUDE.md` to integrate, then `GROKBOT_SETUP.md` |
| **3. Local-only** | All your agents run inside the OS on your machine. No relay and no accounts. | `CLAUDE.md` |

`REMOTE_ACCESS.md` covers the Cloudflare Worker itself: passcode login, phone viewing, ntfy phone alerts, and endpoints. Path 1 uses it; it's optional for paths 2 and 3.

## Quick try (Node 18+, no install)
```bash
node office/build.mjs
cp office/roster.example.json roster.json
node office/server/server.mjs        # http://127.0.0.1:8790/office  (OFFICE_PORT to change)
```
Agents report like this:
```bash
curl -s -X POST http://127.0.0.1:8790/api/office/report \
  -H 'Content-Type: application/json' \
  -d '{"name":"Writer","state":"working","task":"Drafting post"}'
```
Inside the Next app, the same API is at `http://127.0.0.1:8081/api/office/...`.

Neon wall sign: the default is **AGENTIC OS × GROK BOT** (a green tube on the left, ice-blue `#8fd8ff` with a bot-head mark on the right). Change it with `OFFICE_SIGN_LEFT` / `OFFICE_SIGN_RIGHT`, or set `OFFICE_SIGN=off` for a plain title panel. The same settings work in the Worker `[vars]` and the Next app env. A `"sign"` object in roster.json also works.

## What's in the box
- `office/`: page source, build script, standalone server and core (`office/server/`), and the relay pull script (`office/server/relay-pull.mjs`).
- `next-integration/`: drop-in Next.js route files.
- `remote/worker/`: the optional Cloudflare Worker.
- `box-client/`: scripts for Grok Bots on a shared box: `set-status.sh`, `check-inbox.sh`, `sync.py` and `sync-ctl.sh`, plus `setup-secrets.sh` and `setup-ntfy.sh`.

Credit: original Agent Office design by Antidote Extract Labs.
