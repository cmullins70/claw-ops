import http from 'node:http';
import { resolve } from 'node:path';
import { loadConfig } from './config/index.js';
import { openDatabase } from './db/index.js';
import { createHealthHandler } from './health/index.js';
import { IncidentRepository } from './incidents/index.js';
import { loadPolicies } from './policies/index.js';
import { loadRunbooks } from './runbooks/index.js';
import { createAlertmanagerHandler } from './webhooks/alertmanager.js';

// --- Bootstrap ---
const config = loadConfig();
const db = openDatabase(resolve(config.dbPath));
const incidentRepo = new IncidentRepository(db);

// Load policies and runbooks (fail-fast if invalid)
const policyStore = loadPolicies(config.policiesDir);
const runbookStore = loadRunbooks(config.runbooksDir);

console.log(`[claw-ops] policies loaded: global-policy + ${policyStore.actions.length} action policies`);
console.log(`[claw-ops] runbooks loaded: ${runbookStore.listIds().join(', ')}`);

// --- Route handlers ---
const handleHealth = createHealthHandler({ db });
const handleAlertmanager = createAlertmanagerHandler({ incidentRepo, db, config, policyStore, runbookStore });

// --- HTTP server ---
const server = http.createServer((req, res) => {
  // GET /health
  if (req.method === 'GET' && req.url === '/health') {
    return handleHealth(req, res);
  }

  // POST /webhooks/alertmanager
  if (req.method === 'POST' && req.url === '/webhooks/alertmanager') {
    return handleAlertmanager(req, res);
  }

  // GET /incidents (simple list for debugging/Phase 1)
  if (req.method === 'GET' && req.url?.startsWith('/incidents')) {
    const incidents = incidentRepo.listOpen();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ count: incidents.length, incidents }));
    return;
  }

  // 404
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`[claw-ops] listening on 0.0.0.0:${config.port} (${config.nodeEnv})`);
  console.log(`[claw-ops] db: ${config.dbPath}`);
});

// Graceful shutdown
function shutdown() {
  console.log('[claw-ops] shutting down...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
