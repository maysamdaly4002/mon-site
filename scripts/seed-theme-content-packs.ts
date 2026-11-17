/**
 * Installe / rafraîchit les packs contenu par thème et aligne le site sur le thème actif.
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, runMigrations } from '../server/db/client';
import { siteSettings } from '../server/db/schema';
import { loadSnapshot } from '../server/cms/store';
import {
  applyThemePack,
  buildDoggaPack,
  buildMahdiaPack,
  ensureDefaultThemePacks,
  readThemePack,
  writeThemePack,
} from '../server/cms/themeContent';
import { initModules, listThemes } from '../server/modules/manager';

await runMigrations();
await loadSnapshot();
await initModules();

// Packs officiels : toujours réécrits pour garantir un état propre après pollution cross-thème
await writeThemePack(buildMahdiaPack());
await writeThemePack(buildDoggaPack());
await db.delete(siteSettings).where(eq(siteSettings.key, 'theme.content.novalabs.sidibou'));
await ensureDefaultThemePacks();

const themes = await listThemes();
const active = themes.find((t) => t.enabled)?.id || 'novalabs.sidibou';
const pack = await readThemePack(active);
if (!pack) throw new Error(`Pack manquant pour ${active}`);
await applyThemePack(pack);
console.log(`[seed-packs] contenu appliqué : ${active} (${pack.home.blocks.length} blocs)`);

for (const id of ['novalabs.sidibou', 'novalabs.dogga', 'novalabs.mahdia']) {
  const p = await readThemePack(id);
  const hero = p?.home.blocks.find((b) => b.type === 'hero');
  const title = hero ? String((hero.data as { title?: string }).title || '').slice(0, 50) : '-';
  console.log(`  ${id}: ${p?.home.blocks.length ?? 0} blocs · « ${title} »`);
}
process.exit(0);
