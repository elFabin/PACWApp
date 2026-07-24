'use strict';

const express = require('express');
const sessions = require('./sessions');
const { apiFetch, PalworldError } = require('./palworld');
const html = require('./html');

const router = express.Router();

const COOKIE_NAME = 'sid';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 60 * 60 * 1000,
};

function requireSession(req, res, next) {
  const sid = req.cookies[COOKIE_NAME];
  const session = sid ? sessions.get(sid) : undefined;
  if (!session) {
    res.clearCookie(COOKIE_NAME);
    res.set('HX-Redirect', '/');
    return res.status(200).end();
  }
  req.session = session;
  next();
}

function handlePalworldError(err, res) {
  if (err instanceof PalworldError) {
    return res.status(200).send(html.errorFragment(err.message, err.status));
  }
  return res.status(200).send(html.errorFragment('Unexpected error'));
}

// --- Page ---

router.get('/', (req, res) => {
  const sid = req.cookies[COOKIE_NAME];
  const session = sid ? sessions.get(sid) : undefined;
  if (session) {
    return res.send(html.dashboardPage());
  }
  res.send(html.connectPage());
});

// --- Session lifecycle ---

router.post('/connect', express.urlencoded({ extended: false }), async (req, res) => {
  const { host, port, password } = req.body;
  if (!host || !port || !password) {
    return res.send(html.connectPage({ error: 'Host, port, and password are required', fragment: true }));
  }

  const candidate = { host: String(host).trim(), port: String(port).trim(), password };

  try {
    await apiFetch(candidate, '/info');
  } catch (err) {
    const message =
      err instanceof PalworldError
        ? err.kind === 'auth'
          ? 'Incorrect admin password'
          : err.message
        : 'Unexpected error';
    return res.send(html.connectPage({ error: message, fragment: true }));
  }

  const sid = sessions.create(candidate);
  res.cookie(COOKIE_NAME, sid, COOKIE_OPTS);
  res.send(html.dashboardPage({ fragment: true }));
});

router.post('/disconnect', (req, res) => {
  const sid = req.cookies[COOKIE_NAME];
  if (sid) sessions.destroy(sid);
  res.clearCookie(COOKIE_NAME);
  res.send(html.connectPage({ fragment: true }));
});

// --- Read-only panels ---

router.get('/ui/info', requireSession, async (req, res) => {
  try {
    const info = await apiFetch(req.session, '/info');
    res.send(html.infoPanel(info));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

router.get('/ui/metrics', requireSession, async (req, res) => {
  try {
    const metrics = await apiFetch(req.session, '/metrics');
    res.send(html.metricsPanel(metrics));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

router.get('/ui/players', requireSession, async (req, res) => {
  try {
    const players = await apiFetch(req.session, '/players');
    res.send(html.playersPanel(players?.players ?? players));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

router.get('/ui/settings', requireSession, async (req, res) => {
  try {
    const settings = await apiFetch(req.session, '/settings');
    res.send(html.settingsPanel(settings));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

router.get('/ui/game-data', requireSession, async (req, res) => {
  try {
    const data = await apiFetch(req.session, '/game-data');
    res.send(html.gameDataPanel(data));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

// --- Actions ---

router.post('/ui/announce', requireSession, express.urlencoded({ extended: false }), async (req, res) => {
  const { message } = req.body;
  if (!message) return res.send(html.errorFragment('Message is required'));
  try {
    await apiFetch(req.session, '/announce', { method: 'POST', body: { message } });
    res.send(html.actionResult('Announcement sent.'));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

router.post('/ui/kick', requireSession, express.urlencoded({ extended: false }), async (req, res) => {
  const { userid } = req.body;
  const message = req.headers['hx-prompt'] || "Kicked by admin.";
  if (!userid) return res.send(html.errorFragment('User id is required'));
  try {
    const kickResponse = await apiFetch(req.session, '/kick', { method: 'POST', body: { userid, message: message || 'Kicked by admin' } });
    const players = await apiFetch(req.session, '/players');
    res.send(html.playersPanel(players?.players ?? players));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

router.post('/ui/ban', requireSession, express.urlencoded({ extended: false }), async (req, res) => {
  const { userid } = req.body;
  const message = req.headers['hx-prompt'] || "Banned by admin.";
  if (!userid) return res.send(html.errorFragment('User id is required'));
  try {
    await apiFetch(req.session, '/ban', { method: 'POST', body: { userid, message: message || 'Banned by admin' } });
    const players = await apiFetch(req.session, '/players');
    res.send(html.playersPanel(players?.players ?? players));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

router.post('/ui/unban', requireSession, express.urlencoded({ extended: false }), async (req, res) => {
  const { userid } = req.body;
  if (!userid) return res.send(html.errorFragment('User id is required'));
  try {
    await apiFetch(req.session, '/unban', { method: 'POST', body: { userid } });
    res.send(html.actionResult(`Unbanned ${userid}.`));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

router.post('/ui/save', requireSession, async (req, res) => {
  try {
    await apiFetch(req.session, '/save', { method: 'POST' });
    res.send(html.actionResult('World saved.'));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

router.post('/ui/shutdown', requireSession, express.urlencoded({ extended: false }), async (req, res) => {
  const { waittime, message } = req.body;
  try {
    await apiFetch(req.session, '/shutdown', {
      method: 'POST',
      body: { waittime: Number(waittime) || 0, message: message || 'Server shutting down' },
    });
    res.send(html.actionResult('Shutdown scheduled.'));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

router.post('/ui/stop', requireSession, async (req, res) => {
  try {
    await apiFetch(req.session, '/stop', { method: 'POST' });
    res.send(html.actionResult('Server force stopped.'));
  } catch (err) {
    handlePalworldError(err, res);
  }
});

module.exports = router;
