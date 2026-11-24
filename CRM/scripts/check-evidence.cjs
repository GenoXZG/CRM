// Run via stdin inside the app container. Outputs counts without exposing filenames.
const fs = require('node:fs/promises');
const path = require('node:path');
const { QueryTypes } = require('sequelize');
const { database } = require('./dist/infrastructure/database/connection');
const { configuration } = require('./dist/config');
const { evidenceRoute, openEvidence, safeEvidenceName } = require('./dist/services/ticket-evidence');

(async () => {
  const rows = await database.query(
    'SELECT f.Ruta_archivo AS url, t.ID_ticket AS ticket FROM Ticket_fotos f LEFT JOIN Tickets t ON t.ID_ticket=f.ID_ticket',
    { type: QueryTypes.SELECT },
  );
  const counts = { references: rows.length, detached: 0, invalid: 0, missing: 0, unreferenced: 0, duplicates: 0, nonRegular: 0 };
  const references = new Set();
  for (const { url, ticket } of rows) {
    if (ticket === null) counts.detached++;
    const name = url.startsWith(evidenceRoute) ? url.slice(evidenceRoute.length) : '';
    if (!safeEvidenceName(name)) { counts.invalid++; continue; }
    references.add(name);
  }
  for (const name of references) {
    const file = await openEvidence(name);
    if (file) await file.handle.close();
    else counts.missing++;
  }
  const files = new Set();
  for (const directory of ['tickets', 'validated']) {
    const entries = await fs.readdir(path.join(configuration.evidenceRoot, directory), { withFileTypes: true }).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const entry of entries) {
      if (!entry.isFile()) { counts.nonRegular++; continue; }
      if (files.has(entry.name)) counts.duplicates++;
      files.add(entry.name);
    }
  }
  for (const file of files) if (!references.has(file)) counts.unreferenced++;
  console.log(JSON.stringify(counts));
  if (counts.invalid || counts.missing || counts.detached || counts.unreferenced || counts.duplicates || counts.nonRegular) process.exitCode = 1;
})().catch(error => { console.error('Evidence reconciliation failed:', error.name); process.exitCode = 1; })
  .finally(() => database.close());
