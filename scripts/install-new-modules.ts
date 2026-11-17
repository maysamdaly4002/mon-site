/**
 * Installe Calendrier + Articles IA, licence Articles IA, sync marketplace, seed événements démo.
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../server/db/client';
import { loadSnapshot } from '../server/cms/store';
import { initModules, installStaged, setModuleEnabled, setModuleLicense, stagePackage } from '../server/modules/manager';
import { createCollection } from '../server/modules/records';
import { syncOfficialMarketplace } from '../server/marketplace/syncOfficial';
import type { CalEvent } from '../modules/calendar/src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PKG = path.join(ROOT, 'marketplace/packages');

await runMigrations();
await loadSnapshot();
await initModules();

async function install(file: string, enabled: boolean, license?: string) {
  const buf = await fs.readFile(path.join(PKG, file));
  const staged = stagePackage(buf, 'marketplace', { enabled });
  const info = await installStaged(staged.token);
  console.log(`[install] ${info.id} ${info.version} enabled=${info.enabled}`);
  if (license) {
    const lic = await setModuleLicense(info.id, license.trim());
    console.log(`[install] licence ${info.id} : ${lic.license.state}`);
    if (!enabled) await setModuleEnabled(info.id, true);
  } else if (!enabled) {
    await setModuleEnabled(info.id, true);
  }
}

const license = (await fs.readFile('/tmp/ai-articles.license', 'utf8')).trim();

await install('novalabs.calendar-1.0.0.snapmod', true);
await install('novalabs.ai-articles-1.0.0.snapmod', false, license);

const events = createCollection<CalEvent>('novalabs.calendar', 'events');
if ((await events.count()) === 0) {
  const today = new Date();
  const d = (offset: number) => {
    const x = new Date(today);
    x.setDate(x.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };
  const demo: CalEvent[] = [
    {
      title: 'Atelier découverte Snapify',
      slug: 'atelier-snapify',
      description: 'Démonstration du CMS et de la marketplace.',
      location: 'Tunis',
      date: d(3),
      startTime: '10:00',
      endTime: '12:00',
      allDay: false,
      color: '#00C6BA',
      status: 'published',
    },
    {
      title: 'Webinaire e-commerce Mahdia',
      slug: 'webinaire-mahdia',
      description: 'Configurer boutique, panier et paiement à la livraison.',
      location: 'En ligne',
      date: d(7),
      startTime: '18:00',
      endTime: '19:00',
      allDay: false,
      color: '#0066EE',
      status: 'published',
    },
    {
      title: 'Journée portes ouvertes',
      slug: 'portes-ouvertes',
      description: 'Rencontrez l’équipe NOVALABS.',
      location: 'Sfax',
      date: d(14),
      startTime: '',
      endTime: '',
      allDay: true,
      color: '#FF7300',
      status: 'published',
    },
  ];
  for (const e of demo) {
    await events.insert(e, { id: `evt-${e.slug}` });
    console.log(`[seed] événement ${e.title}`);
  }
}

const synced = await syncOfficialMarketplace();
console.log('[marketplace] sync', synced);
process.exit(0);
