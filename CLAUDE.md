# CLAUDE.md: integrating Agent Office into the OS (Next.js / TypeScript)

You are integrating a self-contained "Agent Office" page into a Next.js app. The app runs at `http://127.0.0.1:8081`, and its agent code lives in `src/lib/agent-drive.ts`, `src/lib/crew.ts` and `src/components/agents/crew-workspace.tsx`.
The goal is that `/office` runs inside the app with **no extra process, no Cloudflare and no passcode on localhost**. Remote mode is optional and documented separately in `REMOTE_ACCESS.md`.

## File map
```
office/src/*.html|js         page source, concatenated in order by office/build.mjs. Edit these, never dist/.
  01_head.html               CSS + markup (header, team list, task panel, alert banner)
  02_config.js               reads window.OFFICE_CONFIG (title, apiBase, roster); desk assignment; demo tasks
  03_scene.js / 04_assemble.js   isometric room (desks, props, wall title panel)
  05a_avatars.js             simple avatars: one shape per bot in the bot's color
  05_runtime.js              bot sprites, live feed (polls {apiBase}/status every 5s), alerts (polls {apiBase}/alerts every 15s)
  06_ui.js                   panels, commands (POST {apiBase}/command), init
office/build.mjs             -> office/dist/office.html + office/dist/office-html.mjs (string export)
office/server/office-core.mjs  framework-free state + logic + router (report, status, commands, inbox, ack, alerts, ntfy)
office/server/server.mjs     standalone zero-dependency server, for testing outside Next (port 8790)
office/roster.example.json   generic roster example
next-integration/src/...     drop-in Next files (lib/office/office.ts, app/office/route.ts, app/api/office/[...path]/route.ts)
remote/worker/               optional Cloudflare Worker (remote mode). See REMOTE_ACCESS.md.
```

## Integration steps
1. **Build the page:** `node office/build.mjs`. Re-run it after any change under `office/src/`. You can add `"office:build": "node office/build.mjs"` to package.json and run it before `next build`/`dev`.
2. **Copy the files into the app:**
   - `next-integration/src/lib/office/office.ts` → `src/lib/office/office.ts`
   - `office/server/office-core.mjs` → `src/lib/office/office-core.mjs`
   - `office/dist/office-html.mjs` → `src/lib/office/office-html.mjs`. It's generated, so either re-copy it after each build or point build.mjs's output there.
   - `next-integration/src/app/office/route.ts` → `src/app/office/route.ts`
   - `next-integration/src/app/api/office/[...path]/route.ts` → `src/app/api/office/[...path]/route.ts`
   - If the app uses a `pages/` router or no `src/` directory, adjust the paths and the `@/` alias to match.
3. **Wire the roster** in `getRoster()` in `src/lib/office/office.ts` (see "Roster" below). Until that's done, it reads `roster.json` from the project root, or `OFFICE_ROSTER=/path`.
4. **Link it in the UI:** add an "Office" link or button to the crew workspace (`crew-workspace.tsx`) that opens `/office`. Keep `/office` a full page. If you embed it, use an `<iframe src="/office">` that fills its container; don't try to render its HTML inside React.
5. **Make agents report status** (see "Data contract"). The cleanest place is the code that starts and finishes agent runs (`agent-drive.ts`/`crew.ts`). Call `office.report({...})` in-process, or `fetch("/api/office/report")`. Typical calls:
   - run started: `working`
   - step changed: `working` with step/total
   - waiting for user approval or input: `needs_you`
   - run finished: `idle` with a short summary
   - failure: `error` with the message in `task`
6. **Deliver commands back to agents:** approve, decline and nudge from the page are queued. Agents, or the OS, read `GET /api/office/inbox?bot=<name>`, which marks those commands delivered, then `POST /api/office/ack {"seen":[id]}` once acted on. In-process you can call `office.inbox(name)` and `office.ack({...})` directly.
7. **Data directory:** state lives in `.office-data/office.json` under the app cwd (override with `OFFICE_DATA_DIR`). Add `.office-data/` to `.gitignore`.

## Roster: avatar shape and color come from the OS
Each bot needs `{ id, name, color, shape }`. Optional fields: `short`, `role`, `aliases[]`, `primary`, `desk` (0–8), `idleNote`.
- `color`: `#rrggbb`. `shape`: one of `circle | square | rounded | hexagon | triangle | diamond | star | pill`.
- **Prefer the OS agent data:** in `getRoster()`, load the agent list from `src/lib/crew.ts`/`agent-drive.ts`, whatever those files already export for listing agents, and map each agent to a roster entry:
  - `id` = the agent id, `name` = the display name
  - `color` = the agent's assigned color
  - `shape` = the agent's assigned shape or icon, mapped onto the shape list above (`toShape()`), with `circle` as the fallback
  - `primary` = the main or default agent
  Read the actual types in those files before writing the mapper, and don't guess field names. If the OS has no shape field, keep `circle` (or derive one deterministically from the id).
- **Fallback:** `roster.json` (`{ "title": "...", "bots": [...] }`, see `office/roster.example.json`).
- With no roster at all, the page shows a generic demo roster in "Demo" mode.
- Matching reports to desks: a report's `name` matches a bot by name, `short`, `id` or `aliases`, ignoring case and punctuation. 9 desks; bots 10–18 share desks two to a desk.

## Data contract (local base: `/api/office`)
| Method | Path | Body / query | Notes |
|---|---|---|---|
| POST | `/report` | `{ name, state, task?, step?, total?, with?, soft?, ts? }` | Main status call. `?own=1` (or `"own":true`) marks it as the bot's own status. |
| DELETE | `/report` | `{ name }` | Removes the bot's status (the desk goes to sleep). |
| GET | `/status` | | Array of `{slug,name,state,task,step?,total?,with?,updated,age,stale}`. Used by the page. |
| POST | `/command` | `{ bot, action: approve\|decline\|nudge, text? }` | Sent by the page. Requires the `X-Office: 1` header. |
| GET | `/commands` | | Last 40 commands with state queued, delivered or seen. |
| GET | `/inbox` | `?bot=Name` (`&peek=1` to not mark delivered) | Queued commands for one bot. Omit `bot` to get all. |
| POST | `/ack` | `{ delivered?:[id], seen?:[id], remove?:[id] }` | |
| GET | `/alerts` | | `{ stuck_min, phone, alerts:[{kind: needs_you\|stuck, slug, name, task, updated, since, pushed}] }` |
| GET | `/health` | | `{ok:true}` |

Field rules:
- `state` is one of `working | needs_you | idle | error`. The page shows anything else as idle.
- `task` is up to 400 characters. `step` and `total` are integers.
- `with`: one bot name or an array of up to 5 (max 60 characters each). While the reporting bot is active, the page draws a collaboration line to those bots.
- `soft: true`: a hint, not the truth, for example a scheduler saying a bot started. It is ignored if the bot posted its own status (`own`) at the same time or later. Response: `{"applied":false,"reason":"newer own status"}`.
- `ts`: unix seconds when the info was observed. Allowed **only with soft**, and never in the future.
- After 15 minutes without an update a status is `stale`, and the page shows the bot asleep.

Alerts:
- **needs_you:** fires when a bot enters `needs_you`.
- **stuck:** the bot has been `working` with no update for `ALERT_STUCK_MIN` minutes (default 30). A 60-second timer in the server process checks this, and each write re-checks it.
- **One alert per state change.** For phone pushes there is a per-bot cooldown, `ALERT_COOLDOWN_MIN` (default 15), plus a hard cap of 20 per hour.
- **Delivery:** a red badge on the desk, a banner at the top (click to open the bot, ✕ to dismiss), an optional browser Notification, and an optional ntfy phone push when `NTFY_TOPIC` is set. `NTFY_SERVER` and `OFFICE_URL` are optional.

Auth:
- Requests whose Host is `127.0.0.1`, `localhost` or `[::1]` with no `X-Forwarded-For` need no auth.
- Anything else gets 401 unless it sends `Authorization: Bearer $OFFICE_REPORT_TOKEN`, if that env var is set. `/office` itself is local-only (403).
- Writes must be `Content-Type: application/json`. This is a CSRF guard: it forces a CORS preflight, so other websites can't post to localhost.

Example from an agent (Node 18+):
```ts
await fetch("http://127.0.0.1:8081/api/office/report", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Writer", state: "working", task: "Drafting post", step: 2, total: 4, with: ["Researcher"] }) });
```

## Testing checklist
- [ ] `node office/build.mjs` succeeds. `node office/server/server.mjs` and opening `http://127.0.0.1:8790/office` shows the room in "Demo" mode with no console errors.
- [ ] Inside the app, `GET /office` returns 200 HTML and `GET /api/office/health` returns `{ok:true}`.
- [ ] Every OS agent appears in the Team list with the right name, color and shape.
- [ ] Reporting `working` with step 2/4: the pill turns "Live" within 5s, the bot moves to its desk, and the task and step show.
- [ ] `needs_you`: the bot goes to the couch, a red badge and banner appear (within 15s), and `/api/office/alerts` lists it. Reporting the same state again does not create a second alert.
- [ ] Stuck: with `ALERT_STUCK_MIN=1`, send `working` with `soft:true, ts:<now-120>` to a fresh bot. A "Stuck?" banner appears.
- [ ] `with:["Other Bot"]` draws a line between the two bots.
- [ ] Approve, decline and nudge in the page create commands. `GET /api/office/inbox?bot=Name` returns them once, then they show as delivered.
- [ ] `soft` older than an own status is ignored (`applied:false`). `ts` without `soft` returns 400.
- [ ] A POST without `Content-Type: application/json` returns 415. `/command` without `X-Office: 1` returns 403.
- [ ] State survives an app restart (`.office-data/office.json`).
- [ ] With `NTFY_TOPIC` unset, nothing is sent to the network.

## Don't do
- Don't put secrets, tokens, ntfy topics, account IDs or personal URLs in code, roster files or logs. Read them from env.
- Don't rewrite the page in React. It's a tuned, self-contained canvas/SVG app; integrate it by route or iframe.
- Don't edit `office/dist/*` by hand. Edit `office/src/*` and rebuild.
- Don't add a database or external services for local mode. The JSON file is enough.
- Don't expose `/api/office/*` publicly without `OFFICE_REPORT_TOKEN`, or remote mode with a passcode.
- Don't poll faster than the page already does (5s status, 15s alerts) or add per-report push notifications. The dedupe and cooldown are deliberate.
- Don't require users to set up Cloudflare. Remote mode is opt-in.
- Don't run the office core on the Edge runtime. The routes use `runtime = "nodejs"` because state lives in the file system and process memory.

## Connecting Grok Bots
Grok Bots run in the cloud and can't reach localhost. See [GROKBOT_SETUP.md](GROKBOT_SETUP.md) for the relay options (Worker or ntfy), `office/server/relay-pull.mjs`, and the copy-paste instruction block for each bot.
