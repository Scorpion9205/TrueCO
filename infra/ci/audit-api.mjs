#!/usr/bin/env node
// Fails CI when a high or critical advisory affects the API's production dependency tree.
// The web and mobile apps are audited separately: their toolchains (Next.js, Expo) carry
// advisories the API image never ships, and blocking API changes on them would stall CI.
//
//   pnpm audit --prod --json | node infra/ci/audit-api.mjs
import { readFileSync } from 'node:fs';

const BLOCKING = new Set(['high', 'critical']);
const report = JSON.parse(readFileSync(0, 'utf8') || '{}');

const findings = [];
for (const advisory of Object.values(report.advisories ?? {})) {
  const apiPaths = (advisory.findings ?? []).flatMap((f) => f.paths ?? []).filter((p) => p.startsWith('apps__api'));
  if (apiPaths.length === 0) continue;
  findings.push({
    severity: advisory.severity,
    module: advisory.module_name,
    title: advisory.title,
    url: advisory.url,
    path: apiPaths[0],
  });
}

for (const f of findings) {
  console.log(`${f.severity.toUpperCase().padEnd(9)} ${f.module}: ${f.title}\n          via ${f.path}\n          ${f.url}`);
}
const blocking = findings.filter((f) => BLOCKING.has(f.severity));
console.log(`\nAPI advisories: ${findings.length} (${blocking.length} high/critical)`);
process.exit(blocking.length > 0 ? 1 : 0);
