/**
 * Snapify SDK — outil en ligne de commande `snapify`
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 *
 *   snapify create [dossier] [--theme] [--id editeur.nom] [--name "Nom"] [--author "Nom"] [--email adresse]
 *     (sans dossier, dans un terminal : questions interactives — c'est ce que lance `npm create snapify@latest`)
 *   snapify build [dossier] [--out dist] [--no-check]
 *   snapify check <fichier.snapmod|.snaptheme>
 *   snapify verify <fichier.snapmod|.snaptheme>
 *
 * Les paquets produits ne sont pas signés : NOVALABS signe la version validée lors de la revue marketplace.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildModule, MANIFEST_FILE, THEME_MANIFEST_FILE, type SdkLayout } from '../sdk/build';
import { decodePackage, encodePackage, PACKAGE_EXTENSIONS, PACKAGE_FORMAT, packageExtension, verify, type ModulePackage } from '../sdk/package';
import { MODULE_ID_PATTERN, packageKind, SNAPIFY_MODULE_API_VERSION, type ModuleManifest } from '../sdk/index';
import { validateMarketplacePackage, type PackageValidationResult } from '../server/marketplace/packageValidate';
import { TRUSTED_KEYS } from '../server/modules/trust';

declare const __SDK_VERSION__: string | undefined;
declare const __SDK_DEPENDENCY__: string | undefined;

const SDK_VERSION = typeof __SDK_VERSION__ === 'string' ? __SDK_VERSION__ : process.env.SNAPIFY_SDK_VERSION || '0.0.0-dev';
/** Spécification npm de `@snapify/sdk` écrite dans les projets créés (alias du paquet npm `snapify`). */
const SDK_DEPENDENCY = typeof __SDK_DEPENDENCY__ === 'string' ? __SDK_DEPENDENCY__ : process.env.SNAPIFY_SDK_DEPENDENCY || `^${SDK_VERSION}`;
const RESERVED_PREFIXES = ['novalabs.', 'snapify.'];

/** Paquet publié (`bin/snapify.mjs`) ou exécution depuis le dépôt Snapify (`sdk-kit/cli.ts`). */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGED = path.basename(HERE) === 'bin';
const KIT_ROOT = path.resolve(HERE, '..');
const TEMPLATES = PACKAGED ? path.join(KIT_ROOT, 'templates') : path.join(HERE, 'templates');

/** Dans le dépôt, la compilation utilise les sources du SDK (`REPO_LAYOUT`). */
function kitLayout(): SdkLayout | undefined {
  if (!PACKAGED) return undefined;
  const dir = path.join(KIT_ROOT, 'dist', 'sdk');
  return {
    entry: path.join(dir, 'index.js'),
    dir,
    themeCss: path.join(KIT_ROOT, 'css', 'theme.css'),
    adminCss: path.join(KIT_ROOT, 'css', 'admin.css'),
    publicSources: [path.join(dir, 'ui')],
    adminSources: [path.join(KIT_ROOT, 'css', 'admin-kit.classes.txt')],
  };
}

/* ------------------------------------------------------------------ Affichage */

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number) => (s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = paint(32);
const red = paint(31);
const yellow = paint(33);
const dim = paint(2);
const bold = paint(1);

class CliError extends Error {}
const fail = (message: string): never => {
  throw new CliError(message);
};

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      positional.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split(/=(.*)/s, 2);
    if (inline !== undefined) flags[key] = inline;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[key] = argv[++i];
    else flags[key] = true;
  }
  return { positional, flags };
}

const str = (v: string | true | undefined) => (typeof v === 'string' ? v.trim() : undefined);
const exists = (p: string) => fs.access(p).then(() => true, () => false);

/* ------------------------------------------------------------------ create */

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '');

const titleCase = (slug: string) => slug.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

async function copyTemplate(from: string, to: string, vars: Record<string, string>) {
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const name = entry.name.replace(/^_/, '.').replace(/\.tpl$/, '');
    const dest = path.join(to, name);
    if (entry.isDirectory()) {
      await fs.mkdir(dest, { recursive: true });
      await copyTemplate(src, dest, vars);
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      await fs.copyFile(src, dest);
    } else {
      const text = (await fs.readFile(src, 'utf8')).replace(/__([A-Z_]+)__/g, (m, key: string) => vars[key] ?? m);
      await fs.writeFile(dest, text);
    }
  }
}

/** Questions posées quand `create` est lancé sans dossier dans un terminal (`npm create snapify@latest`). */
async function askCreateOptions(flags: Record<string, string | true>) {
  const { createInterface } = await import('readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (question: string, fallback = '') => {
    const answer = (await rl.question(`${green('?')} ${question}${fallback ? dim(` (${fallback})`) : ''} `)).trim();
    return answer || fallback;
  };
  try {
    console.log(`${bold('Snapify')} — nouveau projet ${dim(`(SDK ${SDK_VERSION}, API ${SNAPIFY_MODULE_API_VERSION})`)}\n`);
    let theme = flags.theme === true;
    if (!theme) {
      for (;;) {
        const kind = (await ask('Module ou thème ? [m/t]', 'm')).toLowerCase();
        if (['m', 'module'].includes(kind)) break;
        if (['t', 'theme', 'thème'].includes(kind)) {
          theme = true;
          break;
        }
      }
    }
    const target = await ask('Dossier du projet :', theme ? 'mon-theme' : 'mon-module');
    let id = str(flags.id);
    while (!id) {
      const publisher = slugify(await ask('Nom d’éditeur (début de l’identifiant, ex. monagence) :'));
      if (!publisher) continue;
      if (RESERVED_PREFIXES.some((p) => `${publisher}.`.startsWith(p))) {
        console.log(red(`  Les préfixes ${RESERVED_PREFIXES.join(' et ')} sont réservés à NOVALABS.`));
        continue;
      }
      id = `${publisher}.${slugify(path.basename(target)) || (theme ? 'mon-theme' : 'mon-module')}`;
    }
    const name = str(flags.name) || (await ask('Nom affiché :', titleCase(id.split('.')[1])));
    const author = str(flags.author) || (await ask('Auteur :', 'Mon Éditeur'));
    const email = str(flags.email) || (await ask('E-mail de contact :', 'contact@exemple.tn'));
    console.log('');
    const answers: Record<string, string | true> = { ...flags, id, name, author, email };
    if (theme) answers.theme = true;
    return { target, flags: answers };
  } finally {
    rl.close();
  }
}

async function cmdCreate(argv: string[]) {
  let { positional, flags } = parseArgs(argv);
  if (!positional[0] && process.stdin.isTTY && process.stdout.isTTY) {
    const answers = await askCreateOptions(flags);
    positional = [answers.target];
    flags = answers.flags;
  }
  const target = positional[0] || fail('Indiquez le dossier à créer : snapify create mon-module');
  const dir = path.resolve(target);
  if (await exists(dir)) {
    if ((await fs.readdir(dir)).length) fail(`${target} existe déjà et n’est pas vide`);
  }
  const theme = flags.theme === true;
  const slug = slugify(path.basename(dir)) || (theme ? 'mon-theme' : 'mon-module');
  const id = str(flags.id) || `monediteur.${slug}`;
  if (!MODULE_ID_PATTERN.test(id)) fail(`Identifiant invalide « ${id} » : « editeur.nom » en minuscules, chiffres et tirets`);
  if (RESERVED_PREFIXES.some((p) => id.startsWith(p))) fail(`Les préfixes ${RESERVED_PREFIXES.join(' et ')} sont réservés à NOVALABS`);
  const name = str(flags.name) || titleCase(slug);
  const author = str(flags.author) || 'Mon Éditeur';
  const email = str(flags.email) || 'contact@exemple.tn';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`Adresse e-mail invalide : ${email}`);

  const json = (s: string) => JSON.stringify(s).slice(1, -1);
  const vars: Record<string, string> = {
    ID: id,
    NAME: json(name),
    AUTHOR: json(author),
    EMAIL: json(email),
    PACKAGE_NAME: id.replace(/\./g, '-'),
    SDK_DEPENDENCY: SDK_DEPENDENCY,
    SDK_VERSION: SDK_VERSION,
    API_VERSION: SNAPIFY_MODULE_API_VERSION,
    KIND: theme ? 'Thème' : 'Module',
    EXT: theme ? '.snaptheme' : '.snapmod',
  };
  await fs.mkdir(dir, { recursive: true });
  await copyTemplate(path.join(TEMPLATES, 'common'), dir, vars);
  await copyTemplate(path.join(TEMPLATES, theme ? 'theme' : 'module'), dir, vars);

  const rel = path.relative(process.cwd(), dir) || '.';
  console.log(`${green('✔')} ${theme ? 'Thème' : 'Module'} ${bold(name)} (${id}) créé dans ${rel}`);
  if (!str(flags.id)) console.log(yellow(`! Identifiant provisoire « ${id} » : remplacez « monediteur » par votre nom d’éditeur dans le manifeste.`));
  console.log(`\n  cd ${rel}\n  npm install\n  npm run build\n`);
  console.log(dim('Documentation : https://developers.snapify.tn/docs'));
}

/* ------------------------------------------------------------------ build */

async function readManifest(dir: string): Promise<ModuleManifest> {
  for (const file of [THEME_MANIFEST_FILE, MANIFEST_FILE]) {
    const full = path.join(dir, file);
    if (await exists(full)) {
      try {
        return JSON.parse(await fs.readFile(full, 'utf8')) as ModuleManifest;
      } catch (e) {
        fail(`${file} : JSON invalide (${e instanceof Error ? e.message : e})`);
      }
    }
  }
  return fail(`Aucun ${MANIFEST_FILE} ni ${THEME_MANIFEST_FILE} dans ${dir}`);
}

function printReport(report: PackageValidationResult) {
  const groups = new Map<string, PackageValidationResult['checks']>();
  for (const c of report.checks) groups.set(c.group ?? 'Paquet', [...(groups.get(c.group ?? 'Paquet') ?? []), c]);
  for (const [group, checks] of groups) {
    console.log(`  ${bold(group)}`);
    for (const c of checks) {
      const mark = c.status === 'pass' ? green('✔') : c.status === 'warn' ? yellow('!') : red('✖');
      console.log(`    ${mark} ${c.label}${c.detail ? dim(` — ${c.detail}`) : ''}`);
    }
  }
  const summary = `${report.checks.length} contrôles, ${report.errors.length} erreur(s), ${report.warnings.length} avertissement(s)`;
  console.log(report.ok ? `${green('✔')} Analyse marketplace réussie : ${summary}` : `${red('✖')} Analyse marketplace échouée : ${summary}`);
  if (report.analysis?.capabilities.length) console.log(dim(`  Capacités serveur détectées : ${report.analysis.capabilities.join(', ')}`));
}

async function check(file: string, expected?: { kind: 'module' | 'theme'; id: string; version: string }) {
  const report = await validateMarketplacePackage(await fs.readFile(file), expected && {
    expectedKind: expected.kind,
    expectedModuleId: expected.id,
    expectedVersion: expected.version,
  });
  printReport(report);
  return report.ok;
}

async function cmdBuild(argv: string[]) {
  const { positional, flags } = parseArgs(argv);
  const dir = path.resolve(positional[0] || '.');
  const manifest = await readManifest(dir);
  const outDir = path.resolve(dir, str(flags.out) || 'dist');

  console.log(`• Compilation de ${bold(manifest.name || manifest.id)} ${manifest.version ?? ''}…`);
  const started = Date.now();
  const built = await buildModule(dir, kitLayout()).catch((e: unknown) => {
    const missing = e instanceof Error && /failed to resolve import "([^"]+)" from "([^"]+)"/.exec(e.message);
    if (missing) fail(`Dépendance introuvable « ${missing[1]} » (importée par ${path.relative(dir, missing[2])}) : npm install ${missing[1]}`);
    throw e;
  });
  const pkg: ModulePackage = {
    format: PACKAGE_FORMAT,
    manifest: built.manifest,
    files: Object.fromEntries([...built.files].map(([n, d]) => [n, d.toString('base64')])),
  };
  await fs.mkdir(outDir, { recursive: true });
  const kind = packageKind(built.manifest);
  const file = path.join(outDir, `${built.manifest.id}-${built.manifest.version}${packageExtension(kind)}`);
  await fs.writeFile(file, encodePackage(pkg));
  for (const [name, meta] of Object.entries(built.manifest.files)) console.log(`  ${name.padEnd(14)} ${(meta.size / 1024).toFixed(1).padStart(8)} Ko`);
  console.log(`${green('✔')} ${path.relative(process.cwd(), file)} ${dim(`(${((Date.now() - started) / 1000).toFixed(1)} s, non signé)`)}`);

  if (flags['no-check']) return;
  console.log('\n• Analyse marketplace');
  if (!(await check(file, { kind, id: built.manifest.id, version: built.manifest.version }))) process.exitCode = 1;
}

/* ------------------------------------------------------------------ check / verify */

function packageArg(argv: string[], usage: string) {
  const file = parseArgs(argv).positional[0] || fail(usage);
  if (!PACKAGE_EXTENSIONS.some((ext) => file.endsWith(ext))) fail(`${file} : fichier ${PACKAGE_EXTENSIONS.join(' ou ')} attendu`);
  return file;
}

async function cmdCheck(argv: string[]) {
  const file = packageArg(argv, 'Indiquez le paquet : snapify check dist/editeur.nom-1.0.0.snapmod');
  console.log(`• Analyse marketplace de ${path.basename(file)}`);
  if (!(await check(file))) process.exitCode = 1;
}

async function cmdVerify(argv: string[]) {
  const file = packageArg(argv, 'Indiquez le paquet : snapify verify editeur.nom-1.0.0.snapmod');
  const { pkg } = decodePackage(await fs.readFile(file));
  const m = pkg.manifest;
  const signature = pkg.signature
    ? verify(m, pkg.signature, TRUSTED_KEYS)
      ? green(`valide (NOVALABS, clé ${pkg.signature.kid})`)
      : red('INVALIDE')
    : yellow('absente (paquet de développement)');
  console.log(`${packageKind(m) === 'theme' ? 'Thème' : 'Module'} ${bold(m.name)} ${m.version} (${m.id}) — ${m.author.name}`);
  console.log(`  Permissions : ${m.permissions.join(', ') || 'aucune'}`);
  console.log(`  Fichiers    : ${Object.keys(m.files).join(', ')}`);
  console.log(`  Signature   : ${signature}`);
  if (pkg.license) {
    const ok = verify(pkg.license.payload, pkg.license.signature, TRUSTED_KEYS);
    console.log(`  Licence     : ${ok ? green('valide') : red('INVALIDE')} (${pkg.license.payload.plan})`);
  }
  if (pkg.signature && !verify(m, pkg.signature, TRUSTED_KEYS)) process.exitCode = 1;
}

/* ------------------------------------------------------------------ main */

const HELP = `${bold('snapify')} ${SDK_VERSION} — kit développeur Snapify (API ${SNAPIFY_MODULE_API_VERSION})

Commandes :
  create [dossier] [--theme]     Nouveau projet de module (ou de thème avec --theme) ;
                                 sans dossier : questions interactives
         [--id editeur.nom] [--name "Nom"] [--author "Nom"] [--email adresse]
  build [dossier] [--out dist]   Compile le paquet .snapmod / .snaptheme puis l’analyse
         [--no-check]
  check <paquet>                 Analyse du paquet, identique à celle de la marketplace
  verify <paquet>                Signature NOVALABS et licence d’un paquet reçu

Documentation : https://developers.snapify.tn/docs`;

const commands: Record<string, (argv: string[]) => Promise<void>> = { create: cmdCreate, build: cmdBuild, check: cmdCheck, verify: cmdVerify };

const [command, ...argv] = process.argv.slice(2);
if (command === '--version' || command === '-v') console.log(SDK_VERSION);
else if (!command || command === 'help' || command === '--help' || command === '-h') console.log(HELP);
else if (!commands[command]) {
  console.error(`${red('✖')} Commande inconnue : ${command}\n\n${HELP}`);
  process.exitCode = 1;
} else {
  commands[command](argv).catch((e: unknown) => {
    console.error(`${red('✖')} ${e instanceof Error ? e.message : String(e)}`);
    if (!(e instanceof CliError) && process.env.SNAPIFY_DEBUG && e instanceof Error) console.error(e.stack);
    process.exitCode = 1;
  });
}
