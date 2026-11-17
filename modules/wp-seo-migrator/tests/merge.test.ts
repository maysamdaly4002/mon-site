/**
 * Tests unitaires connecteurs — exécutés via tsx si besoin.
 * Usage : npx tsx --test modules/wp-seo-migrator/tests/merge.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runConnectors } from '../src/connectors/index';
import { computeStats } from '../src/pipeline/analyze';

const dir = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(dir, '../fixtures/sample-exporter.json'), 'utf8');

{
  const { detects, records, redirects } = runConnectors([
    { name: 'export.json', mimeType: 'application/json', content: fixture, encoding: 'utf8' },
  ]);
  assert.ok(detects.find((d) => d.id === 'snapify-exporter')?.found, 'exporter détecté');
  assert.equal(records.length, 2);
  assert.equal(redirects.length, 1);
  const stats = computeStats(records, redirects);
  assert.ok(stats.coveragePct >= 50, `coverage ${stats.coveragePct}`);
  console.log('ok merge exporter', stats);
}
