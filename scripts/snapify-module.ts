/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Outil des modules Snapify.
 *
 *   npm run module -- build <dossier-du-module-ou-thème> [--out marketplace/packages] [--unsigned]
 *   npm run module -- verify <fichier.snapmod|.snaptheme>
 *   npm run module -- license --module <id> --licensee "<titulaire>" --domains exemple.fr,*.exemple.fr [--plan standard] [--expires 2027-12-31]
 *   npm run module -- catalog [marketplace]
 *   npm run module -- keygen [--out ~/.snapify/keys] [--kid novalabs-2026]
 *
 * Signature : clé privée Ed25519 désignée par SNAPIFY_SIGNING_KEY (chemin PEM) ou --key,
 * identifiant de clé SNAPIFY_SIGNING_KID ou --kid. La clé privée ne doit jamais être versionnée.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { buildModule } from '../sdk/build';
import {
  checkLicensePayload,
  compareVersions,
  decodePackage,
  encodeLicenseKey,
  encodePackage,
  PACKAGE_EXTENSIONS,
  PACKAGE_FORMAT,
  packageExtension,
  sha256,
  sign,
  verify,
  type ModulePackage,
} from '../sdk/package';
import { packageKind, type LicensePayload, type SignedLicense } from '../sdk/index';
import { TRUSTED_KEYS } from '../server/modules/trust';

const [, , command, ...rest] = process.argv;

function args() {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) flags[a.slice(2)] = true;
      else flags[a.slice(2)] = rest[++i];
    } else positional.push(a);
  }
  return { positional, flags };
}

const expandHome = (p: string) => (p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p);

async function signingKey(flags: Record<string, string | true>) {
  const keyPath = typeof flags.key === 'string' ? flags.key : process.env.SNAPIFY_SIGNING_KEY;
  const kid = typeof flags.kid === 'string' ? flags.kid : process.env.SNAPIFY_SIGNING_KID || 'novalabs-2026';
  if (!keyPath) return null;
  return { pem: await fs.readFile(expandHome(keyPath), 'utf8'), kid };
}

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function freeLicense(moduleId: string, key: { pem: string; kid: string }): SignedLicense {
  const payload: LicensePayload = {
    v: 1,
    licenseId: `free-${moduleId}`,
    moduleId,
    licensee: 'Licence gratuite',
    plan: 'free',
    domains: ['*'],
    issuedAt: new Date().toISOString(),
    expiresAt: null,
  };
  return { payload, signature: sign(payload, key.pem, key.kid) };
}

async function cmdBuild() {
  const { positional, flags } = args();
  const dir = positional[0] || fail('Dossier du module ou du thème manquant');
  const outDir = path.resolve(typeof flags.out === 'string' ? flags.out : 'marketplace/packages');
  const key = flags.unsigned ? null : await signingKey(flags);
  if (!key && !flags.unsigned) fail('Clé de signature absente : définissez SNAPIFY_SIGNING_KEY ou utilisez --unsigned (mode développeur)');

  console.log(`• Compilation de ${dir}…`);
  const { manifest, files } = await buildModule(dir);
  const pkg: ModulePackage = {
    format: PACKAGE_FORMAT,
    manifest,
    files: Object.fromEntries([...files].map(([n, d]) => [n, d.toString('base64')])),
  };
  if (key) {
    pkg.signature = sign(manifest, key.pem, key.kid);
    if (manifest.pricing === 'free') pkg.license = freeLicense(manifest.id, key);
  }
  await fs.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${manifest.id}-${manifest.version}${packageExtension(packageKind(manifest))}`);
  await fs.writeFile(file, encodePackage(pkg));
  for (const [name, meta] of Object.entries(manifest.files)) console.log(`  ${name.padEnd(12)} ${(meta.size / 1024).toFixed(1).padStart(8)} Ko`);
  console.log(`✔ ${path.relative(process.cwd(), file)} ${key ? `(signé : ${key.kid})` : '(NON signé — mode développeur uniquement)'}`);
}

async function cmdVerify() {
  const { positional } = args();
  const file = positional[0] || fail('Fichier .snapmod ou .snaptheme manquant');
  const { pkg } = decodePackage(await fs.readFile(file));
  const m = pkg.manifest;
  console.log(`${packageKind(m) === 'theme' ? 'Thème' : 'Module'} ${m.name} ${m.version} (${m.id}) — ${m.author.name}`);
  console.log(`  Permissions : ${m.permissions.join(', ') || 'aucune'}`);
  console.log(`  Fichiers    : ${Object.keys(m.files).join(', ')}`);
  console.log(`  Signature   : ${verify(m, pkg.signature, TRUSTED_KEYS) ? `valide (${pkg.signature!.kid})` : pkg.signature ? 'INVALIDE' : 'absente'}`);
  if (pkg.license) console.log(`  Licence     : ${verify(pkg.license.payload, pkg.license.signature, TRUSTED_KEYS) ? 'valide' : 'INVALIDE'} (${pkg.license.payload.plan})`);
}

async function cmdLicense() {
  const { flags } = args();
  const key = (await signingKey(flags)) || fail('Clé de signature absente (SNAPIFY_SIGNING_KEY ou --key)');
  const payload: LicensePayload = {
    v: 1,
    licenseId: crypto.randomUUID(),
    moduleId: String(flags.module || fail('--module requis')),
    licensee: String(flags.licensee || fail('--licensee requis')),
    plan: (typeof flags.plan === 'string' ? flags.plan : 'standard') as LicensePayload['plan'],
    domains: String(flags.domains || fail('--domains requis')).split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
    issuedAt: new Date().toISOString(),
    expiresAt: typeof flags.expires === 'string' ? new Date(`${flags.expires}T23:59:59Z`).toISOString() : null,
  };
  const issues = checkLicensePayload(payload);
  if (issues.length) fail(issues.join(', '));
  console.log(encodeLicenseKey({ payload, signature: sign(payload, key.pem, key.kid) }));
}

async function cmdCatalog() {
  const { positional } = args();
  const root = path.resolve(positional[0] || 'marketplace');
  const pkgDir = path.join(root, 'packages');
  const shotDir = path.join(root, 'screenshots');
  const latest = new Map<string, Record<string, unknown>>();
  const shots = new Map<string, { name: string; data: Buffer }>();
  for (const name of (await fs.readdir(pkgDir)).filter((f) => PACKAGE_EXTENSIONS.some((ext) => f.endsWith(ext))).sort()) {
    const buf = await fs.readFile(path.join(pkgDir, name));
    const { pkg, files } = decodePackage(buf);
    const m = pkg.manifest;
    const prev = latest.get(m.id);
    if (prev && compareVersions(String(prev.version), m.version) >= 0) continue;
    const shot = m.screenshot ? files.get(m.screenshot) : undefined;
    if (shot) shots.set(m.id, { name: `${m.id}-${m.version}${path.extname(m.screenshot!)}`, data: shot });
    else shots.delete(m.id);
    latest.set(m.id, {
      id: m.id,
      kind: packageKind(m),
      name: m.name,
      version: m.version,
      description: m.description,
      author: m.author,
      pricing: m.pricing,
      category: m.category,
      icon: m.icon,
      permissions: m.permissions,
      engines: m.engines,
      ...(shot ? { screenshot: `screenshots/${shots.get(m.id)!.name}` } : {}),
      package: `packages/${name}`,
      sha256: sha256(buf),
      size: buf.length,
      signed: !!pkg.signature,
    });
  }
  for (const [id, entry] of latest) {
    const files = await fs.readdir(path.join(root, 'gallery', id)).catch(() => [] as string[]);
    const gallery = files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().slice(0, 8);
    if (gallery.length) entry.gallery = gallery.map((f) => `gallery/${id}/${f}`);
  }
  await fs.rm(shotDir, { recursive: true, force: true });
  if (shots.size) await fs.mkdir(shotDir, { recursive: true });
  for (const { name, data } of shots.values()) await fs.writeFile(path.join(shotDir, name), data);
  const catalog = { format: 'snapify-catalog/1', generatedAt: new Date().toISOString(), modules: [...latest.values()] };
  await fs.writeFile(path.join(root, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  const themes = [...latest.values()].filter((e) => e.kind === 'theme').length;
  console.log(`✔ catalog.json : ${latest.size - themes} module(s), ${themes} thème(s)`);
}

async function cmdKeygen() {
  const { flags } = args();
  const out = expandHome(typeof flags.out === 'string' ? flags.out : '~/.snapify/keys');
  const kid = typeof flags.kid === 'string' ? flags.kid : 'novalabs-2026';
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  await fs.mkdir(out, { recursive: true, mode: 0o700 });
  const file = path.join(out, `${kid}.pem`);
  await fs.writeFile(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' }).catch(() => fail(`${file} existe déjà`));
  console.log(`✔ Clé privée : ${file} (à conserver hors du dépôt)`);
  console.log(`  Clé publique à ajouter dans server/modules/trust.ts :\n  '${kid}': '${publicKey.export({ type: 'spki', format: 'der' }).toString('base64')}',`);
}

const commands: Record<string, () => Promise<void>> = { build: cmdBuild, verify: cmdVerify, license: cmdLicense, catalog: cmdCatalog, keygen: cmdKeygen };
const run = commands[command || ''];
if (!run) {
  console.log('Commandes : build, verify, license, catalog, keygen');
  process.exit(command ? 1 : 0);
}
run().catch((e) => fail(e instanceof Error ? e.message : String(e)));
