import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runConnectors } from '../src/connectors/index.ts';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

function file(name: string) {
  return {
    name,
    mimeType: 'text/plain',
    content: fs.readFileSync(path.join(dir, name), 'utf8'),
    encoding: 'utf8' as const,
  };
}

{
  const r = runConnectors([file('aioseo-sample.csv')]);
  assert.ok(r.detects.some((d) => d.id === 'aioseo-csv' && d.found));
  assert.equal(r.records.length, 2);
  assert.ok(r.records[0].seoTitle);
  console.log('ok aioseo', r.records.length);
}

{
  const r = runConnectors([file('sample.htaccess')]);
  assert.ok(r.redirects.length >= 2);
  console.log('ok htaccess', r.redirects.length);
}

{
  const r = runConnectors([file('sample-page.html')]);
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].path, '/');
  assert.ok(r.records[0].metaDescription);
  assert.ok(r.records[0].schemaJsonLd);
  console.log('ok html crawler', r.records[0].seoTitle);
}
