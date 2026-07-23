# PACWApp — Palworld REST API Client WebApp

## Context

PACWApp is an empty repo (README + LICENSE only). The goal is a minimalistic, self-hosted web client for the Palworld REST API (https://docs.palworldgame.com/category/rest-api/), built with **HTMX + Node.js**. It covers every documented endpoint. Security constraint: the app may persist only the Palworld server's **IP and port** — the admin password is **never stored** anywhere durable. The API username is always `admin` (HTTP Basic Auth).

Confirmed decisions:
- **Password**: entered on a Connect screen, held only in Node process memory in an in-memory session, gone on disconnect or process restart. Never written to disk, never echoed back to the browser.
- **IP/port**: remembered in **browser localStorage** (pre-fills the Connect form client-side). Nothing persisted on the Node side.
- **Stack**: **Express, no template engine** — HTML fragments via JS template literals. HTMX vendored as a static file (no CDN).

## Palworld REST API surface (base path `http://<host>:<port>/v1/api`, Basic Auth `admin:<password>`)

| Endpoint | Method | Body |
|---|---|---|
| `/info` | GET | — server name, version, world GUID |
| `/players` | GET | — connected player list |
| `/settings` | GET | — current server settings |
| `/metrics` | GET | — FPS, uptime, player count, frame time |
| `/announce` | POST | `{ message }` |
| `/kick` | POST | `{ userid, message }` |
| `/ban` | POST | `{ userid, message }` |
| `/unban` | POST | `{ userid }` |
| `/save` | POST | empty |
| `/shutdown` | POST | `{ waittime, message }` |
| `/stop` | POST | empty (force stop) |

(A newer `/game-data` world-actor-snapshot endpoint exists in current docs; include it as a raw JSON viewer panel — low effort, keeps "every endpoint" true.)

## Architecture

Browser (HTMX) → Express app (session + proxy) → Palworld REST API.

The Node app is a thin authenticated proxy: HTMX posts forms to Express routes; Express calls the Palworld API with Basic Auth built from the in-memory session and returns small HTML fragments.

### File layout

```
package.json            # deps: express, cookie-parser; node >=20 so global fetch
server.js               # entry point: express app, middleware, mounts routes
src/sessions.js         # in-memory Map<sessionId, {host, port, password}>, crypto.randomUUID ids, idle TTL sweep
src/palworld.js         # apiFetch(session, path, {method, body}) → fetch with Basic Auth header, timeout, JSON parse
src/routes.js           # all HTTP routes (connect/disconnect + one route per endpoint)
src/html.js             # layout(), fragment helpers, escapeHtml() — template literals only
public/htmx.min.js      # vendored HTMX
public/style.css        # minimal stylesheet
.gitignore              # node_modules
```

### Session / auth flow

1. `GET /` — if no valid session cookie: render Connect page (host, port, password fields). A tiny inline script pre-fills host/port from `localStorage` and saves them back on submit. The password field is never touched by localStorage.
2. `POST /connect` — validate by calling Palworld `/v1/api/info` with the supplied credentials. On success: create session id (`crypto.randomUUID()`), store `{host, port, password}` in the in-memory Map, set `HttpOnly; SameSite=Strict` cookie, return the dashboard. On 401/unreachable: re-render form with error message (password not echoed back).
3. `POST /disconnect` — delete session entry, clear cookie, back to Connect page.
4. Sessions expire after idle TTL (e.g. 60 min sweep); expired/missing session on any HTMX request returns the Connect fragment with a full-page swap so the user is cleanly bounced.

### UI (single dashboard page, HTMX everywhere)

- **Info panel** — `hx-get="/ui/info"` on load.
- **Metrics panel** — `hx-get="/ui/metrics" hx-trigger="load, every 5s"` (live FPS/uptime/player count).
- **Players panel** — `hx-get="/ui/players" hx-trigger="load, every 10s"`; each player row gets Kick / Ban buttons (`hx-post` with `hx-confirm`, userid in hidden field, optional message via `hx-prompt`).
- **Settings panel** — `hx-get="/ui/settings"`, collapsible key/value table (read-only; the API has no settings-write endpoint).
- **Actions panel** — Announce form (`message`), Unban form (`userid`), Save button, Shutdown form (`waittime`, `message`, `hx-confirm`), Force Stop button (`hx-confirm` with strong warning).
- **Game-data panel** — collapsed by default, fetches `/ui/game-data` on demand and shows raw JSON in a `<pre>`.
- Every proxy route returns an HTML fragment; errors return an inline `<div class="error">` fragment (Palworld status code + short text), so a failing action never blanks the page.

### Express routes (all in `src/routes.js`)

- `GET /` (page), `POST /connect`, `POST /disconnect`
- `GET /ui/info | /ui/players | /ui/settings | /ui/metrics | /ui/game-data`
- `POST /ui/announce | /ui/kick | /ui/ban | /ui/unban | /ui/save | /ui/shutdown | /ui/stop`
- Each POST route: read urlencoded form body → minimal validation → `apiFetch` → success/error fragment. Kick/ban re-return the refreshed players panel.

### Security notes

- Password only ever in: the connect POST body (transient) and the in-memory session Map. No logging of request bodies or auth headers; no password field pre-fill; `autocomplete="off"` on the password input.
- Session cookie is `HttpOnly` + `SameSite=Strict` (CSRF-resistant for this same-origin HTMX app).
- All rendered API data (player names, messages) passes through `escapeHtml()` — player names are attacker-controlled input.
- README warns: run PACWApp on the same LAN/host as the game server; Palworld's REST API is not meant for internet exposure.

## Implementation steps

1. `npm init -y`, add `express` + `cookie-parser`, `.gitignore`, download `htmx.min.js` into `public/`.
2. `src/html.js` — `escapeHtml`, `layout`, Connect-page and panel fragment renderers.
3. `src/sessions.js` — Map, create/get/destroy, TTL sweep via `setInterval(...).unref()`.
4. `src/palworld.js` — `apiFetch` with `AbortSignal.timeout(10s)`, Basic Auth header, distinguishes network-error vs 401 vs other statuses.
5. `src/routes.js` + `server.js` — wire everything; `requireSession` middleware for `/ui/*`.
6. `public/style.css` — compact grid dashboard.
7. Update README (usage, security notes) and CLAUDE.md (run commands: `npm start`, architecture summary).

## Verification

- `node server.js`, open `http://localhost:3000`: Connect form appears; wrong password shows inline error and never sticks.
- Without a real Palworld server: use a throwaway mock script (not committed) that serves `/v1/api/*` with canned JSON + Basic Auth check; connect to it and click through every panel/action, confirming each of the 12 endpoints round-trips and error fragments render when the mock returns 400/401.
- Confirm the password never lands on disk (`grep -ri password` shows only code/labels, no config); restart Node and confirm the session is gone while localStorage still pre-fills host/port.
- `curl -v http://localhost:3000/ui/info` without a cookie → bounced to Connect (session enforcement).
