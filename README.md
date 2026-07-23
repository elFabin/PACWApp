# PACWApp

Palworld API Client WebApp (PACWApp for short) is an open source API Client for Palworld's REST API.

A minimal, self-hosted web dashboard for managing a running Palworld dedicated server: view server info, live metrics, and connected players; kick/ban/unban players; send announcements; save the world; and shut down or force-stop the server. Built with Express and HTMX — no build step, no framework churn.

## Requirements

- Node.js >= 20
- A Palworld dedicated server with the [REST API](https://docs.palworldgame.com/category/rest-api/) enabled (`RESTAPIEnabled=True` in `PalWorldSettings.ini`)

## Usage

```bash
npm install
npm start
```

Open `http://localhost:3000`, enter the Palworld server's host, port, and admin password, and click Connect. The username is always `admin` (Palworld's REST API only supports a single admin account).

## Security notes

- **The admin password is never written to disk.** It lives only in server process memory for the duration of your session and is discarded on disconnect or process restart.
- Only the host and port are remembered, and only in your browser's `localStorage` (so the Connect form pre-fills next time) — nothing is persisted server-side.
- The session cookie is `HttpOnly` and `SameSite=Strict`.
- Palworld's REST API is not designed for exposure to the public internet. Run PACWApp on the same host or LAN as your game server, and don't put it behind a public reverse proxy without your own auth layer in front.

## Environment variables

- `PORT` — port PACWApp listens on (default `3000`)
