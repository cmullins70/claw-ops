/**
 * Health check handler.
 * Returns service status, uptime, and db connectivity.
 */
export function createHealthHandler(deps = {}) {
  const startedAt = Date.now();

  return async function handleHealth(req, res) {
    const payload = {
      ok: true,
      service: 'claw-ops',
      uptime_ms: Date.now() - startedAt,
      ts: new Date().toISOString(),
    };

    // If a db handle was provided, do a quick connectivity check
    if (deps.db) {
      try {
        deps.db.prepare('SELECT 1').get();
        payload.db = 'ok';
      } catch {
        payload.ok = false;
        payload.db = 'error';
      }
    }

    const status = payload.ok ? 200 : 503;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
  };
}
