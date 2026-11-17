/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Prépare le paquet npm `create-snapify-app` — CMS client (sans plateforme SaaS) :
 *
 *   npm run app:pack [-- --force]
 *
 * Copie les sources filtrées dans create-snapify-app/template/, puis produit
 * releases/npm/create-snapify-app-<version>.tgz
 */
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG_DIR = path.join(ROOT, 'create-snapify-app');
const TEMPLATE = path.join(PKG_DIR, 'template');
const NPM_OUT = path.join(ROOT, 'releases', 'npm');
const force = process.argv.includes('--force');

/** Dossiers exclus à n’importe quelle profondeur */
const EXCLUDE_DIRS_ANY = new Set([
  'node_modules',
  '.git',
  '.cursor',
  'dist',
  'build',
  'coverage',
  '.snapify-build',
  '.snapify',
]);

/** Dossiers exclus seulement à la racine du repo */
const EXCLUDE_DIRS_ROOT = new Set([
  'backups',
  'releases',
  'data',
  'database',
  'create-snapify-app',
  'apps', // landing / marketplace / community / superadmin — plateforme Snapify
  'community', // forum packages
  'marketplace', // catalogue local + screenshots
]);

const EXCLUDE_FILES = new Set([
  '.env',
  '.pm2.env',
  'landing-analytics.jsonl',
  'ecosystem.config.json',
  'landing.html',
  'marketplace.html',
  'community.html',
  'developers.html',
  'superadmin.html',
  'client.html',
  'for.html',
]);

const EXCLUDE_PREFIXES = [
  'public/uploads/',
  'public/releases/',
  'public/landing/',
  'create-snapify-app/template/',
  'marketplace/packages/',
  'server/community/',
  'server/marketplace/',
  'server/superadmin/',
  'server/client/',
  'server/developers/',
  'server/demo/', // reset démo snapify.tn — pas pour clients
  'docs/screenshots/',
];

const EXCLUDE_SUFFIXES = ['.dump', '.pem', '.log', '.sql.gz'];

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const r = rel(full);
    const atRoot = !r.includes('/');
    if (EXCLUDE_DIRS_ANY.has(e.name)) continue;
    if (atRoot && EXCLUDE_DIRS_ROOT.has(e.name)) continue;
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function rel(p: string) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function shouldInclude(file: string): boolean {
  const r = rel(file);
  if (EXCLUDE_FILES.has(path.basename(file))) return false;
  if (EXCLUDE_PREFIXES.some((p) => r === p.slice(0, -1) || r.startsWith(p))) return false;
  if (EXCLUDE_SUFFIXES.some((s) => r.endsWith(s))) return false;
  if (r.startsWith('docs/screenshots/')) return false;
  return true;
}

async function rmrf(p: string) {
  await fs.rm(p, { recursive: true, force: true });
}

async function slimCmsTemplate() {
  // Vite : site + admin uniquement
  const vite = `/**
 * create-snapify-app — build CMS (site + administrator)
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        administrator: path.resolve(__dirname, 'administrator.html'),
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
`;
  await fs.writeFile(path.join(TEMPLATE, 'vite.config.ts'), vite);

  // .env.example CMS
  const examplePath = path.join(TEMPLATE, '.env.example');
  let example = await fs.readFile(examplePath, 'utf8').catch(() => '');
  if (!example.includes('DATABASE_URL=')) {
    example = `DATABASE_URL=postgres://snapify:changez-moi@127.0.0.1:5432/snapify\nPUBLIC_URL=https://exemple.tn\n`;
  }
  if (!example.includes('SNAPIFY_DISTRIBUTION=')) {
    example = `SNAPIFY_DISTRIBUTION=cms\nSEED_DEMO=false\n\n${example}`;
  }
  // Retirer les secrets plateforme du modèle client
  example = example
    .split('\n')
    .filter((l) => !/^(SUPERADMIN_|PLATFORM_COOKIE|FLOUCI_)/.test(l))
    .join('\n');
  await fs.writeFile(examplePath, example.endsWith('\n') ? example : `${example}\n`);

  // README template court
  await fs.writeFile(
    path.join(TEMPLATE, 'README.md'),
    `# Site Snapify (CMS)

Installation via \`create-snapify-app\`.

\`\`\`bash
NODE_ENV=production npm start
\`\`\`

- Site : \`/\`
- Admin : \`/administrator\`

Mode : \`SNAPIFY_DISTRIBUTION=cms\` (sans marketplace / forum / landing Snapify).
Données démo : \`SEED_DEMO=true\` au premier démarrage.
`,
  );
}

async function main() {
  const pkg = JSON.parse(await fs.readFile(path.join(PKG_DIR, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
  };
  const outTgz = path.join(NPM_OUT, `${pkg.name}-${pkg.version}.tgz`);
  await fs.mkdir(NPM_OUT, { recursive: true });

  try {
    await fs.access(outTgz);
    if (!force) throw new Error(`${path.relative(ROOT, outTgz)} existe déjà — utilisez --force pour régénérer`);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      /* ok */
    } else if (e instanceof Error && e.message.includes('existe déjà')) {
      throw e;
    }
  }

  console.log('• Nettoyage template/');
  await rmrf(TEMPLATE);
  await fs.mkdir(TEMPLATE, { recursive: true });

  const files = (await walk(ROOT)).filter(shouldInclude);
  console.log(`• Copie de ${files.length} fichiers (CMS basique) → create-snapify-app/template/`);
  for (const file of files) {
    const target = path.join(TEMPLATE, rel(file));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(file, target);
  }

  await slimCmsTemplate();

  const sitePkgPath = path.join(TEMPLATE, 'package.json');
  const sitePkg = JSON.parse(await fs.readFile(sitePkgPath, 'utf8')) as Record<string, unknown>;
  sitePkg.version = pkg.version;
  sitePkg.private = true;
  sitePkg.description = 'Snapify CMS (site client) — installé via create-snapify-app';
  await fs.writeFile(sitePkgPath, `${JSON.stringify(sitePkg, null, 2)}\n`);

  await fs.writeFile(
    path.join(TEMPLATE, '.snapify-install.json'),
    `${JSON.stringify(
      {
        package: pkg.name,
        version: pkg.version,
        distribution: 'cms',
        packedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  console.log(`• npm pack → ${path.relative(ROOT, outTgz)}`);
  const packed = execFileSync('npm', ['pack', '--pack-destination', NPM_OUT], {
    cwd: PKG_DIR,
    encoding: 'utf8',
  }).trim();
  const produced = path.join(NPM_OUT, packed.split('\n').pop()!.trim());
  if (path.resolve(produced) !== path.resolve(outTgz)) {
    await fs.rename(produced, outTgz);
  }

  const stat = await fs.stat(outTgz);
  console.log(`✔ ${path.relative(ROOT, outTgz)} (${(stat.size / 1024 / 1024).toFixed(1)} Mo)`);
  console.log('  Publication : npm run app:publish -- --otp …');
}

main().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
