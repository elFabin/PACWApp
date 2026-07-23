'use strict';

const crypto = require('crypto');

const IDLE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const sessions = new Map();

function create({ host, port, password }) {
  const id = crypto.randomUUID();
  sessions.set(id, { host, port, password, lastSeen: Date.now() });
  return id;
}

function get(id) {
  const session = sessions.get(id);
  if (!session) return undefined;
  session.lastSeen = Date.now();
  return session;
}

function destroy(id) {
  sessions.delete(id);
}

function sweep() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastSeen > IDLE_TTL_MS) {
      sessions.delete(id);
    }
  }
}

setInterval(sweep, SWEEP_INTERVAL_MS).unref();

module.exports = { create, get, destroy };
