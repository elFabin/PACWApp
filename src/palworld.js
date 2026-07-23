'use strict';

const TIMEOUT_MS = 10000;

class PalworldError extends Error {
  constructor(message, { status, kind } = {}) {
    super(message);
    this.name = 'PalworldError';
    this.status = status;
    this.kind = kind; // 'network' | 'auth' | 'http'
  }
}

async function apiFetch(session, path, { method = 'GET', body } = {}) {
  const { host, port, password } = session;
  const url = `http://${host}:${port}/v1/api${path}`;
  const auth = Buffer.from(`admin:${password}`).toString('base64');

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new PalworldError('Could not reach Palworld server', { kind: 'network' });
  }

  if (res.status === 401) {
    throw new PalworldError('Unauthorized — check the admin password', {
      status: 401,
      kind: 'auth',
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new PalworldError(text || `Palworld API request failed`, {
      status: res.status,
      kind: 'http',
    });
  }

  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

module.exports = { apiFetch, PalworldError };
