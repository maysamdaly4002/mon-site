/**
 * Réinstalle thèmes / modules marketplace manquants sans activer (SidiBou reste actif).
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, runMigrations } from '../server/db/client';
import { modules } from '../server/db/schema';
import { initModules, installStaged, stagePackage } from '../server/modules/manager';
import { loadSnapshot } from '../server/cms/store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(__dirname, '../marketplace/packages');

/** Thèmes / modules à réinstaller (désactivés) après restore d’une ancienne sauvegarde. */
const PACKS: { file: string; enabled: boolean }[] = [
  { file: 'novalabs.dogga-1.0.0.snaptheme', enabled: false },
  { file: 'novalabs.mahdia-1.0.0.snaptheme', enabled: false },
  { file: 'novalabs.shop-1.0.0.snapmod', enabled: false },
  { file: 'novalabs.cart-1.0.0.snapmod', enabled: false },
  { file: 'novalabs.checkout-1.0.0.snapmod', enabled: false },
  { file: 'novalabs.customers-1.1.0.snapmod', enabled: false },
];

await runMigrations();
await loadSnapshot();
await initModules();

const installed = new Set((await db.select({ id: modules.id }).from(modules)).map((r) => r.id));
console.log('[reinstall] déjà présents :', [...installed].sort().join(', ') || '(aucun)');

for (const p of PACKS) {
  const full = path.join(PKG_DIR, p.file);
  const buf = await fs.readFile(full);
  const staged = stagePackage(buf, 'marketplace', { enabled: p.enabled });
  const id = staged.manifest.id;
  if (installed.has(id)) {
    console.log(`[reinstall] skip ${id} (déjà installé)`);
    continue;
  }
  const info = await installStaged(staged.token);
  console.log(`[reinstall] ${info.kind} ${info.id} ${info.version} enabled=${info.enabled}`);
}

const rows = await db.select({ id: modules.id, kind: modules.kind, enabled: modules.enabled, version: modules.version }).from(modules);
console.log('[reinstall] final :');
for (const r of rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))) {
  console.log(`  ${r.kind.padEnd(6)} ${r.enabled ? 'ON ' : 'off'} ${r.id} ${r.version}`);
}
process.exit(0);
