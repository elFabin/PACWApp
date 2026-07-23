# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PACWApp (Palworld API Client WebApp) is a self-hosted web dashboard for Palworld's REST API. It's a thin authenticated proxy: an HTMX frontend talks to an Express backend, which calls the Palworld dedicated server's REST API with Basic Auth and returns HTML fragments.

## Commands

```bash
npm install   # install deps (express, cookie-parser)
npm start     # run the server on http://localhost:3000 (PORT env var to override)
```

There is no build step, linter, or test suite configured.

## Architecture

Browser (HTMX) → Express app (session + proxy) → Palworld REST API (`http://<host>:<port>/v1/api`, Basic Auth `admin:<password>`).

- `server.js` — entry point; mounts cookie-parser, static `public/`, and `src/routes.js`.
- `src/routes.js` — every HTTP route: page load, connect/disconnect, and one `GET/POST /ui/*` route per Palworld endpoint. `requireSession` middleware guards all `/ui/*` routes and responds with `HX-Redirect: /` when the session is missing/expired.
- `src/sessions.js` — in-memory `Map<sessionId, {host, port, password}>` with idle-TTL sweep. This is the *only* place the admin password lives; it is never written to disk.
- `src/palworld.js` — `apiFetch(session, path, {method, body})`: builds the Basic Auth header, applies a 10s timeout, and throws a `PalworldError` (kind: `network` | `auth` | `http`) that routes turn into an inline error fragment.
- `src/html.js` — all HTML is template literals, no template engine. `escapeHtml()` must wrap any Palworld-sourced data (player names, messages) before interpolation — that data is attacker-controlled.
- `public/htmx.min.js` — vendored, not loaded from a CDN.

### Session / auth model

- IP/port are remembered client-side only, in browser `localStorage` (pre-fills the Connect form). Nothing server-side persists them.
- The admin password is submitted once via `POST /connect`, validated against `/v1/api/info`, then held only in the in-memory session Map keyed by an `HttpOnly; SameSite=Strict` cookie. It's gone on disconnect or process restart.
- When adding a new Palworld endpoint: add a route in `src/routes.js` using `apiFetch`, a fragment renderer in `src/html.js`, and wire it into the dashboard markup in `dashboardPage()`. Keep the "password never touches disk" invariant — don't add logging of request bodies or auth headers.
