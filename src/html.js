'use strict';

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

function bodyContent({ body = '', connected = false }) {
  const disconnectForm = connected
    ? `
      <form hx-post="/disconnect" hx-target="body" hx-swap="innerHTML">
        <button type="submit" class="btn-secondary">Disconnect</button>
      </form>`
    : '';

  return `
    <header class="topbar">
      <h1>PACWApp</h1>
      ${disconnectForm}
    </header>
    <main id="content">
      ${body}
    </main>
  `;
}

function layout({ title = 'PACWApp', body = '', connected = false }) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
      <link rel="stylesheet" href="/style.css">
      <script src="/htmx.min.js"></script>
    </head>
    <body>
      ${bodyContent({ body, connected })}
    </body>
    </html>
  `;
}

function errorFragment(message, status) {
  const statusLabel = status ? ` (${escapeHtml(String(status))})` : '';
  return `
    <div class="error">Error${statusLabel}: ${escapeHtml(message)}</div>
  `;
}

function connectPage({ error = '', fragment = false } = {}) {
  const body = `
    <section class="connect-card">
      <h2>Connect to Palworld Server</h2>
      ${error ? errorFragment(error) : ''}
      <form id="connect-form" hx-post="/connect" hx-target="body" hx-swap="innerHTML">
        <label>
          Host
          <input type="text" name="host" id="host" placeholder="127.0.0.1" required>
        </label>
        <label>
          Port
          <input type="number" name="port" id="port" placeholder="8212" required>
        </label>
        <label>
          Admin Password
          <input type="password" name="password" id="password" autocomplete="off" required>
        </label>
        <button type="submit">Connect</button>
      </form>
    </section>
    <script>
      (function () {
        var host = document.getElementById('host');
        var port = document.getElementById('port');
        try {
          var savedHost = localStorage.getItem('pacwapp.host');
          var savedPort = localStorage.getItem('pacwapp.port');
          if (savedHost) host.value = savedHost;
          if (savedPort) port.value = savedPort;
        } catch (e) {}
        var form = document.getElementById('connect-form');
        form.addEventListener('submit', function () {
          try {
            localStorage.setItem('pacwapp.host', host.value);
            localStorage.setItem('pacwapp.port', port.value);
          } catch (e) {}
        });
      })();
    </script>
  `;

  return fragment
    ? bodyContent({ body, connected: false })
    : layout({ title: 'PACWApp — Connect', body, connected: false });
}

function dashboardPage({ fragment = false } = {}) {
  const body = `
    <section class="grid">
      <!-- Server Info Panel -->
      <div class="panel" id="info-panel" hx-get="/ui/info" hx-trigger="load" hx-swap="innerHTML">
        <h3>Server Info</h3>
        <p class="loading">Loading…</p>
      </div>

      <!-- Metrics Panel -->
      <div class="panel" id="metrics-panel" hx-get="/ui/metrics" hx-trigger="load, every 5s" hx-swap="innerHTML">
        <h3>Metrics</h3>
        <p class="loading">Loading…</p>
      </div>

      <!-- Players Panel -->
      <div class="panel panel-wide" id="players-panel" hx-get="/ui/players" hx-trigger="load, every 10s" hx-swap="innerHTML">
        <h3>Players</h3>
        <p class="loading">Loading…</p>
      </div>

      <!-- Settings Panel -->
      <div class="panel panel-wide" id="settings-panel" hx-get="/ui/settings" hx-trigger="load" hx-swap="innerHTML">
        <h3>Settings</h3>
        <p class="loading">Loading…</p>
      </div>

      <!-- Actions Panel -->
      <div class="panel panel-wide" id="actions-panel">
        <h3>Actions</h3>
        <div class="actions-grid">
          <form hx-post="/ui/announce" hx-target="#action-result" hx-swap="innerHTML">
            <label>
              Announce
              <input type="text" name="message" placeholder="Message" required>
            </label>
            <button type="submit">Send</button>
          </form>

          <form hx-post="/ui/unban" hx-target="#action-result" hx-swap="innerHTML">
            <label>
              Unban
              <input type="text" name="userid" placeholder="Steam/user id" required>
            </label>
            <button type="submit">Unban</button>
          </form>

          <form hx-post="/ui/save" hx-target="#action-result" hx-swap="innerHTML" hx-confirm="Save the world now?">
            <button type="submit">Save World</button>
          </form>

          <form hx-post="/ui/shutdown" hx-target="#action-result" hx-swap="innerHTML" hx-confirm="Shut down the server?">
            <label>
              Wait time (s)
              <input type="number" name="waittime" value="60" required>
            </label>
            <label>
              Message
              <input type="text" name="message" placeholder="Server shutting down">
            </label>
            <button type="submit" class="btn-danger">Shutdown</button>
          </form>

          <form hx-post="/ui/stop" hx-target="#action-result" hx-swap="innerHTML" hx-confirm="Force stop the server immediately? This does not save.">
            <button type="submit" class="btn-danger">Force Stop</button>
          </form>
        </div>
        <div id="action-result"></div>
      </div>

      <!-- Game Data Panel (Collapsible) -->
      <div class="panel panel-wide">
        <h3>
          <button type="button" class="disclosure" onclick="var p=document.getElementById('game-data-panel'); if (!p.dataset.loaded) { p.dataset.loaded='1'; htmx.trigger(p, 'reveal'); } p.classList.toggle('hidden');">
            Game Data ▾
          </button>
        </h3>
        <div class="panel hidden" id="game-data-panel" hx-get="/ui/game-data" hx-trigger="reveal" hx-swap="innerHTML">
          <p class="loading">Click to load…</p>
        </div>
      </div>
    </section>
  `;

  return fragment
    ? bodyContent({ body, connected: true })
    : layout({ title: 'PACWApp — Dashboard', body, connected: true });
}

function infoPanel(info) {
  return `
    <h3>Server Info</h3>
    <dl class="kv">
      <dt>Name</dt>
      <dd>${escapeHtml(info.servername)}</dd>
      <dt>Version</dt>
      <dd>${escapeHtml(info.version)}</dd>
      <dt>World GUID</dt>
      <dd>${escapeHtml(info.worldguid)}</dd>
    </dl>
  `;
}

function metricsPanel(metrics) {
  return `
    <h3>Metrics</h3>
    <dl class="kv">
      <dt>FPS</dt>
      <dd>${escapeHtml(metrics.serverfps)}</dd>
      <dt>Players</dt>
      <dd>${escapeHtml(metrics.currentplayernum)}/${escapeHtml(metrics.maxplayernum)}</dd>
      <dt>Frame time</dt>
      <dd>${escapeHtml(metrics.serverframetime)} ms</dd>
      <dt>Uptime</dt>
      <dd>${escapeHtml(metrics.uptime)}s</dd>
    </dl>
  `;
}

function playersPanel(players) {
  const list = Array.isArray(players) ? players : [];

  const rows = list.length
    ? list
      .map((p) => {
        const playerId = escapeHtml(p.playerId);
        const userId = escapeHtml(p.userId);
        const playerName = escapeHtml(p.name);
        const level = escapeHtml(p.level);

        return `
        <tr>
          <td>${playerName}</td>
          <td>${playerId}</td>
          <td>${userId}</td>
          <td>${level}</td>
          <td class="row-actions">
            <form hx-post="/ui/kick" hx-target="#players-panel" hx-swap="innerHTML" hx-prompt="Kicking ${playerName}.\n\n Enter a reason (optional):">
              <input type="hidden" name="userid" value="${userId}">
              <button type="submit" class="btn-warn">Kick</button>
            </form>
            <form hx-post="/ui/ban" hx-target="#players-panel" hx-swap="innerHTML" hx-prompt="Banning ${playerName}.\n\n Enter a reason (optional):">
              <input type="hidden" name="userid" value="${userId}">
              <button type="submit" class="btn-danger">Ban</button>
            </form>
          </td>
        </tr>`;
      })
      .join('\n')
    : `
        <tr>
          <td colspan="4">No players connected.</td>
        </tr>`;

  return `
    <h3>Players (${list.length})</h3>
    <table class="players-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Player ID</th>
          <th>User ID</th>
          <th>Level</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function settingsPanel(settings) {
  const entries = Object.entries(settings || {});
  const rows = entries
    .map(([k, v]) => `
      <dt>${escapeHtml(k)}</dt>
      <dd>${escapeHtml(v)}</dd>`)
    .join('\n');

  return `
    <h3>Settings</h3>
    <dl class="kv">${rows}
    </dl>
  `;
}

function gameDataPanel(data) {
  return `
    <pre class="raw-json">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
  `;
}

function actionResult(message) {
  return `
    <div class="success">${escapeHtml(message)}</div>
  `;
}

module.exports = {
  escapeHtml,
  layout,
  errorFragment,
  connectPage,
  dashboardPage,
  infoPanel,
  metricsPanel,
  playersPanel,
  settingsPanel,
  gameDataPanel,
  actionResult,
};
