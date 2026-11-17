/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Construit le kit développeur public (paquet npm `snapify-sdk`, importé sous le nom `@snapify/sdk`) à partir des sources du dépôt :
 *
 *   npm run sdk:pack [-- --force] [-- --base-url https://developers.snapify.tn/sdk]
 *
 * Produit dans releases/sdk/ : snapify-sdk-<v>.tgz (installable avec npm), snapify-starter-<v>.zip
 * (projets de départ module et thème), SHA256SUMS-<v>.txt et index.json (lu par le portail développeurs) ;
 * dans releases/npm/ : snapify-sdk-<v>.tgz (identique au kit téléchargeable) et create-snapify-<v>.tgz, publiés par
 * `npm run sdk:publish`.
 * Seuls le SDK, les déclarations de types qu'il référence et l'outil `snapify` sont inclus : aucune source
 * de l'administration ni du serveur, aucune clé privée.
 */
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { builtinModules } from 'module';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import { Scanner } from '@tailwindcss/oxide';
import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import { REPO_LAYOUT } from '../sdk/build';
import { SNAPIFY_MODULE_API_VERSION } from '../sdk/index';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT = path.join(ROOT, 'sdk-kit');
const OUT = path.join(ROOT, 'releases', 'sdk');
const NPM_OUT = path.join(ROOT, 'releases', 'npm');

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const baseUrlArg = argv.indexOf('--base-url');
const BASE_URL = (baseUrlArg >= 0 ? argv[baseUrlArg + 1] : process.env.SNAPIFY_SDK_BASE_URL || 'https://developers.snapify.tn/sdk').replace(/\/+$/, '');

/** Points d'entrée publics (voir `exports` de sdk-kit/package.template.json). */
const ENTRIES = ['index', 'admin', 'theme', 'content', 'commerce', 'image', 'icons', 'settings', 'ui/commerce', 'ui/orders'];
/** Fichiers du SDK utilisés seulement par l'outil `snapify` (Node), inclus dans son bundle. */
const TOOLING_ONLY = new Set(['sdk/build.ts', 'sdk/package.ts']);
/** Code de l'hôte exécuté par le SDK dans le navigateur. */
const HOST_RUNTIME = ['server/cms/blocks.ts'];

const log = (s: string) => console.log(s);
const fail = (s: string): never => {
  throw new Error(s);
};
const sha256 = (buf: Buffer) => crypto.createHash('sha256').update(buf).digest('hex');
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function write(file: string, data: string | Buffer) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

/** Remplace l'en-tête « Tous droits réservés » des sources par celui du kit (licence LICENSE.md). */
function withKitHeader(text: string, banner: string) {
  const stripped = text.replace(/^\/\*\*?\n(?: \*.*\n)*? \*.*Tous droits réservés.*\n \*\/\n/, '');
  return `${banner}\n${stripped}`;
}

async function main() {
  const pkgTemplate = JSON.parse(await fs.readFile(path.join(KIT, 'package.template.json'), 'utf8')) as {
    name: string;
    version: string;
    dependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
  };
  const version = pkgTemplate.version;
  const tarballName = `snapify-sdk-${version}.tgz`;
  const starterName = `snapify-starter-${version}.zip`;
  const sumsName = `SHA256SUMS-${version}.txt`;
  const tarballUrl = `${BASE_URL}/${tarballName}`;
  /** Dépendance écrite dans les projets créés : le paquet npm sous l'alias des imports. */
  const sdkDependency = `npm:${pkgTemplate.name}@^${version}`;
  const banner = `/*! Snapify SDK ${version} — © 2026 NOVALABS WEB DESIGN — licence : LICENSE.md */`;

  await fs.mkdir(OUT, { recursive: true });
  if (!force && (await fs.access(path.join(OUT, tarballName)).then(() => true, () => false))) {
    fail(`${tarballName} existe déjà : une version publiée ne change plus. Augmentez la version ou utilisez --force.`);
  }

  const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'snapify-sdk-'));
  const pkgDir = path.join(staging, 'package');
  log(`• Kit ${version} (API ${SNAPIFY_MODULE_API_VERSION}) dans ${staging}`);

  try {
    /* 1. Code exécuté dans le navigateur : transpilé fichier par fichier, imports relatifs conservés. */
    const sources = [...(await walk(path.join(ROOT, 'sdk'))).filter((f) => /\.tsx?$/.test(f)).map(rel).filter((f) => !TOOLING_ONLY.has(f)), ...HOST_RUNTIME];
    const outputs = new Set(sources.map((f) => f.replace(/\.tsx?$/, '.js')));
    for (const src of sources) {
      const code = await fs.readFile(path.join(ROOT, src), 'utf8');
      const { code: js } = await esbuild.transform(code, { loader: src.endsWith('.tsx') ? 'tsx' : 'ts', format: 'esm', target: 'es2022', jsx: 'automatic', legalComments: 'none', charset: 'utf8' });
      const outRel = src.replace(/\.tsx?$/, '.js');
      const fixed = js.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)"(\.{1,2}\/[^"]+)"/g, (_m, lead: string, spec: string) => {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(outRel), spec));
        const resolved = [`${target}.js`, `${target}/index.js`].find((c) => outputs.has(c)) ?? fail(`${src} : import introuvable dans le kit « ${spec} »`);
        return `${lead}"${path.posix.relative(path.posix.dirname(outRel), resolved).replace(/^(?!\.)/, './')}"`;
      });
      await write(path.join(pkgDir, 'dist', outRel), `${banner}\n${fixed}`);
    }
    log(`  ✔ ${sources.length} fichiers JavaScript`);

    /* 2. Déclarations TypeScript : émises par tsc, puis seules celles atteignables depuis les entrées. */
    const typesDir = path.join(staging, 'types');
    const tsconfig = path.join(ROOT, '.sdk-pack.tsconfig.json');
    await fs.writeFile(
      tsconfig,
      JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: { noEmit: false, declaration: true, emitDeclarationOnly: true, outDir: typesDir, rootDir: '.', skipLibCheck: true },
        files: ENTRIES.map((e) => `sdk/${e}.ts${e.startsWith('ui/') ? 'x' : ''}`),
      })
    );
    try {
      execFileSync(path.join(ROOT, 'node_modules/.bin/tsc'), ['-p', tsconfig], { cwd: ROOT, stdio: 'inherit' });
    } finally {
      await fs.rm(tsconfig, { force: true });
    }
    const queue = ENTRIES.map((e) => `sdk/${e}.d.ts`);
    const reachable = new Set<string>();
    const externals = new Set<string>();
    while (queue.length) {
      const file = queue.shift()!;
      if (reachable.has(file)) continue;
      reachable.add(file);
      const text = await fs.readFile(path.join(typesDir, file), 'utf8').catch(() => fail(`Déclaration absente : ${file}`));
      for (const [, spec] of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g)) {
        if (!spec.startsWith('.')) {
          if (spec.startsWith('@/')) fail(`${file} : alias interne « ${spec} » dans une déclaration publique`);
          externals.add(spec);
          continue;
        }
        const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec.replace(/\.(tsx?|js)$/, '')));
        const candidates = [`${base}.d.ts`, `${base}/index.d.ts`];
        const found = await (async () => {
          for (const c of candidates) if (await fs.access(path.join(typesDir, c)).then(() => true, () => false)) return c;
          return null;
        })();
        queue.push(found ?? fail(`${file} : déclaration introuvable pour « ${spec} »`));
      }
    }
    for (const file of reachable) await write(path.join(pkgDir, 'dist', file), withKitHeader(await fs.readFile(path.join(typesDir, file), 'utf8'), banner));
    const typeDeps = [...externals].map((s) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0]));
    const missingTypes = typeDeps.filter((d) => !(d in pkgTemplate.dependencies) && !(d in pkgTemplate.peerDependencies) && d !== '@types/react');
    log(`  ✔ ${reachable.size} déclarations (.d.ts) — dépendances de types : ${[...new Set(typeDeps)].join(', ') || 'aucune'}`);
    if (missingTypes.length) log(`  ! types sans dépendance déclarée (résolus en any chez le développeur) : ${[...new Set(missingTypes)].join(', ')}`);

    /* 3. Feuilles de style et classes des composants d'administration prêtés aux modules. */
    for (const css of ['theme.css', 'admin.css']) await write(path.join(pkgDir, 'css', css), withKitHeader(await fs.readFile(path.join(ROOT, 'sdk', css), 'utf8'), banner.replace(/^\/\*!/, '/*')));
    const scanner = new Scanner({
      sources: await Promise.all(
        REPO_LAYOUT.adminSources.map(async (p) =>
          (await fs.stat(p)).isDirectory() ? { base: p, pattern: '**/*', negated: false } : { base: path.dirname(p), pattern: path.basename(p), negated: false }
        )
      ),
    });
    const candidates = scanner.scan();
    const design = await __unstable__loadDesignSystem(`@import "tailwindcss";\n@import ${JSON.stringify(REPO_LAYOUT.adminCss)};`, { base: ROOT });
    const css = design.candidatesToCss(candidates);
    const classes = candidates.filter((_, i) => css[i]).sort();
    await write(path.join(pkgDir, 'css', 'admin-kit.classes.txt'), `${classes.join('\n')}\n`);
    log(`  ✔ ${classes.length} classes des composants d’administration`);

    /* 4. Outil `snapify` : un seul fichier, dépendances npm externes. */
    const cli = path.join(pkgDir, 'bin', 'snapify.mjs');
    await esbuild.build({
      entryPoints: [path.join(KIT, 'cli.ts')],
      outfile: cli,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      packages: 'external',
      legalComments: 'none',
      charset: 'utf8',
      banner: { js: `#!/usr/bin/env node\n${banner}` },
      define: { __SDK_VERSION__: JSON.stringify(version), __SDK_DEPENDENCY__: JSON.stringify(sdkDependency) },
      logLevel: 'warning',
    });
    await fs.chmod(cli, 0o755);
    const cliCode = await fs.readFile(cli, 'utf8');
    const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
    const imported = new Set(
      [...cliCode.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s*"([^"]+)";?$|^import\s*"([^"]+)";?$|\bimport\(\s*"([^"]+)"\s*\)/gm)]
        .map((m) => m[1] ?? m[2] ?? m[3])
        .filter((s) => !s.startsWith('.'))
    );
    const undeclared = [...imported]
      .filter((s) => !builtins.has(s))
      .map((s) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0]))
      .filter((d) => !(d in pkgTemplate.dependencies) && !(d in pkgTemplate.peerDependencies));
    if (undeclared.length) fail(`snapify.mjs importe des paquets absents des dépendances : ${undeclared.join(', ')}`);
    log(`  ✔ bin/snapify.mjs (${(cliCode.length / 1024).toFixed(0)} Ko)`);

    /* 5. Modèles, documentation, manifeste npm. */
    for (const file of await walk(path.join(KIT, 'templates'))) {
      await write(path.join(pkgDir, 'templates', path.relative(path.join(KIT, 'templates'), file)), await fs.readFile(file));
    }
    await write(path.join(pkgDir, 'README.md'), (await fs.readFile(path.join(KIT, 'README.md'), 'utf8')).replaceAll('__SDK_TARBALL_URL__', tarballUrl).replaceAll('__SDK_VERSION__', version));
    for (const doc of ['LICENSE.md', 'CHANGELOG.md']) await fs.copyFile(path.join(KIT, doc), path.join(pkgDir, doc));
    await write(path.join(pkgDir, 'package.json'), `${JSON.stringify(pkgTemplate, null, 2)}\n`);

    /* 6. Contrôle : ni clé privée ni secret dans le kit. */
    const SECRET = /-----BEGIN [A-Z ]*PRIVATE KEY-----|SNAPIFY_SIGNING_KEY\s*=|ADMIN_PASSWORD\s*=|DATABASE_URL\s*=|postgres(?:ql)?:\/\/[^\s"'`]*@/;
    for (const file of await walk(pkgDir)) {
      if (/\.(jpe?g|png|webp)$/i.test(file)) continue;
      if (SECRET.test(await fs.readFile(file, 'utf8'))) fail(`Donnée sensible détectée dans ${path.relative(pkgDir, file)}`);
    }
    log('  ✔ aucun secret dans le kit');

    /* 7. Paquet npm. */
    const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', staging], { cwd: pkgDir, encoding: 'utf8' })) as { filename: string; files: unknown[] }[];
    await fs.copyFile(path.join(staging, packed[0].filename), path.join(OUT, tarballName));
    await fs.mkdir(NPM_OUT, { recursive: true });
    await fs.copyFile(path.join(staging, packed[0].filename), path.join(NPM_OUT, `${pkgTemplate.name}-${version}.tgz`));
    log(`  ✔ ${tarballName} (${packed[0].files.length} fichiers)`);

    /* 7 bis. `create-snapify` : `npm create snapify@latest` lance `snapify create` de la même version. */
    const createSrc = path.join(KIT, 'create-snapify');
    const createDir = path.join(staging, 'create-snapify');
    const createPkg = JSON.parse(await fs.readFile(path.join(createSrc, 'package.template.json'), 'utf8'));
    createPkg.version = version;
    createPkg.dependencies = { [pkgTemplate.name]: version };
    await write(path.join(createDir, 'package.json'), `${JSON.stringify(createPkg, null, 2)}\n`);
    await write(path.join(createDir, 'bin', 'create-snapify.mjs'), await fs.readFile(path.join(createSrc, 'create-snapify.mjs')));
    await fs.chmod(path.join(createDir, 'bin', 'create-snapify.mjs'), 0o755);
    await fs.copyFile(path.join(createSrc, 'README.md'), path.join(createDir, 'README.md'));
    await fs.copyFile(path.join(KIT, 'LICENSE.md'), path.join(createDir, 'LICENSE.md'));
    const createPacked = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', staging], { cwd: createDir, encoding: 'utf8' })) as { filename: string }[];
    await fs.copyFile(path.join(staging, createPacked[0].filename), path.join(NPM_OUT, `create-snapify-${version}.tgz`));
    log(`  ✔ create-snapify-${version}.tgz`);

    /* 8. Projets de départ, générés par l'outil lui-même. */
    const starterRoot = path.join(staging, 'starter');
    await fs.mkdir(starterRoot, { recursive: true });
    const env = { ...process.env, SNAPIFY_SDK_VERSION: version, SNAPIFY_SDK_DEPENDENCY: sdkDependency, NO_COLOR: '1' };
    const tsx = path.join(ROOT, 'node_modules/.bin/tsx');
    for (const [dir, extra] of [['snapify-module-starter', ['--id', 'monagence.mon-module', '--name', 'Mon module']], ['snapify-theme-starter', ['--theme', '--id', 'monagence.mon-theme', '--name', 'Mon thème']]] as const) {
      execFileSync(tsx, [path.join(KIT, 'cli.ts'), 'create', dir, ...extra, '--author', 'Mon Agence', '--email', 'dev@monagence.tn'], { cwd: starterRoot, env, stdio: 'ignore' });
    }
    const zip = path.join(OUT, starterName);
    await fs.rm(zip, { force: true });
    execFileSync('python3', ['-m', 'zipfile', '-c', zip, 'snapify-module-starter', 'snapify-theme-starter'], { cwd: starterRoot });
    log(`  ✔ ${starterName}`);

    /* 9. Sommes de contrôle et index du portail. */
    const files = await Promise.all(
      [
        { name: tarballName, kind: 'sdk' },
        { name: starterName, kind: 'starter' },
      ].map(async (f) => {
        const buf = await fs.readFile(path.join(OUT, f.name));
        return { ...f, size: buf.length, sha256: sha256(buf) };
      })
    );
    await fs.writeFile(path.join(OUT, sumsName), files.map((f) => `${f.sha256}  ${f.name}\n`).join(''));
    const indexFile = path.join(OUT, 'index.json');
    const index = JSON.parse(await fs.readFile(indexFile, 'utf8').catch(() => '{"releases":[]}')) as { latest?: string; releases: { version: string }[] };
    const release = { version, api: SNAPIFY_MODULE_API_VERSION, date: new Date().toISOString(), checksums: sumsName, npm: { sdk: pkgTemplate.name, create: 'create-snapify' }, files };
    index.releases = [release, ...index.releases.filter((r) => r.version !== version)];
    index.latest = version;
    await fs.writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`);
    for (const f of files) log(`  ${f.sha256}  ${f.name} (${(f.size / 1024).toFixed(0)} Ko)`);
    log(`✔ Kit ${version} prêt dans ${rel(OUT)}`);
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
