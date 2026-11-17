/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Publie sur le registre npm la version du kit préparée par `npm run sdk:pack` :
 *
 *   npm run sdk:publish -- --dry-run          contrôle sans rien publier
 *   npm run sdk:publish [-- --otp 123456]     publication (compte npm connecté avec `npm login`)
 *
 * Publie `snapify-sdk` puis `create-snapify` (qui en dépend), depuis les archives de releases/npm/. L'archive
 * `snapify-sdk` doit être identique au kit téléchargeable de developers.snapify.tn (même empreinte SHA-256).
 */
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const otpIndex = argv.indexOf('--otp');
const otp = otpIndex >= 0 ? argv[otpIndex + 1] : undefined;

const sha256 = async (file: string) => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
const npm = (args: string[]) => execFileSync('npm', args, { cwd: ROOT, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] }).trim();

async function main() {
  const { name, version } = JSON.parse(await fs.readFile(path.join(ROOT, 'sdk-kit/package.template.json'), 'utf8')) as { name: string; version: string };
  const sdk = path.join(ROOT, 'releases/npm', `${name}-${version}.tgz`);
  const create = path.join(ROOT, 'releases/npm', `create-snapify-${version}.tgz`);
  const mirror = path.join(ROOT, 'releases/sdk', `snapify-sdk-${version}.tgz`);
  for (const file of [sdk, create, mirror]) {
    await fs.access(file).catch(() => {
      throw new Error(`${path.relative(ROOT, file)} absent : lancez d'abord npm run sdk:pack`);
    });
  }
  if ((await sha256(sdk)) !== (await sha256(mirror))) throw new Error(`${path.basename(sdk)} diffère du kit téléchargeable ${path.basename(mirror)}`);

  if (!dryRun) {
    const user = (() => {
      try {
        return npm(['whoami']);
      } catch {
        throw new Error('Aucun compte npm connecté sur cette machine : lancez npm login');
      }
    })();
    console.log(`• Compte npm : ${user}`);
  }

  for (const [pkg, file] of [[name, sdk], ['create-snapify', create]] as const) {
    const published = (() => {
      try {
        return execFileSync('npm', ['view', `${pkg}@${version}`, 'version'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      } catch {
        return '';
      }
    })();
    if (published === version) {
      console.log(`• ${pkg}@${version} déjà publié : ignoré`);
      continue;
    }
    console.log(`• ${dryRun ? 'Contrôle' : 'Publication'} de ${pkg}@${version}`);
    execFileSync('npm', ['publish', file, '--access', 'public', ...(dryRun ? ['--dry-run'] : []), ...(otp ? ['--otp', otp] : [])], { cwd: ROOT, stdio: 'inherit' });
  }
  console.log(dryRun ? '✔ Contrôle terminé : rien n’a été publié' : `✔ Publié : https://www.npmjs.com/package/${name}`);
}

main().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
