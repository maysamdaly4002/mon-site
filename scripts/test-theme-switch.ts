import 'dotenv/config';
import { runMigrations } from '../server/db/client';
import { loadSnapshot } from '../server/cms/store';
import { initModules, activateTheme } from '../server/modules/manager';

function heroTitle(blocks: { type: string; data?: { title?: string } }[]) {
  const h = blocks.find((b) => b.type === 'hero');
  return String(h?.data?.title || '').slice(0, 55);
}

await runMigrations();
await loadSnapshot();
await initModules();

for (const id of ['novalabs.mahdia', 'novalabs.dogga', 'novalabs.sidibou', 'novalabs.mahdia']) {
  await activateTheme(id);
  const { loadSnapshot: reload } = await import('../server/cms/store');
  const s = await reload();
  const home = s.pages.find((p) => p.path === '/');
  const menu = s.menus.find((m) => m.id === 'primary')?.items.map((i) => i.label).join('>') || '';
  const hasShop = (home?.blocks || []).some((b) => b.type === 'module' && (b.data as { module?: string }).module === 'novalabs.shop');
  console.log(`→ ${id} | hero=« ${heroTitle(home?.blocks || [])} » | shopWidgets=${hasShop} | menu=${menu}`);
}
process.exit(0);
