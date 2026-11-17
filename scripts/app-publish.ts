/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Publie create-snapify-app sur npm :
 *
 *   npm run app:publish -- --dry-run
 *   npm run app:publish -- --otp 123456
 */
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const otpIndex = argv.indexOf('--otp');
const otp = otpIndex >= 0 ? argv[otpIndex + 1] : undefined;

async function main() {
  const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'create-snapify-app/package.json'), 'utf8')) as {
    name: string;
    version: string;
  };
  const file = path.join(ROOT, 'releases/npm', `${pkg.name}-${pkg.version}.tgz`);
  await fs.access(file).catch(() => {
    throw new Error(`${path.relative(ROOT, file)} absent : lancez npm run app:pack`);
  });

  const token = (process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN || '').trim();
  const npmEnv = { ...process.env };
  if (token) {
    // Auth non interactive (CI / serveur) — ne pas écrire .npmrc disque
    npmEnv.NPM_CONFIG_USERCONFIG = path.join(ROOT, 'releases/npm/.npmrc.publish');
    await fs.mkdir(path.dirname(npmEnv.NPM_CONFIG_USERCONFIG), { recursive: true });
    await fs.writeFile(
      npmEnv.NPM_CONFIG_USERCONFIG,
      `//registry.npmjs.org/:_authToken=${token}\nalways-auth=true\n`,
      { mode: 0o600 },
    );
  }

  if (!dryRun) {
    let user = '';
    try {
      user = execFileSync('npm', ['whoami'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: npmEnv,
      }).trim();
    } catch {
      throw new Error(
        'Aucun compte npm connecté : lancez `npm login` ou exportez NPM_TOKEN (automation token novalabsweb)',
      );
    }
    console.log(`• Compte npm : ${user}`);
  }

  let published = '';
  try {
    published = execFileSync('npm', ['view', `${pkg.name}@${pkg.version}`, 'version'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    published = '';
  }
  if (published === pkg.version) {
    console.log(`• ${pkg.name}@${pkg.version} déjà publié : ignoré`);
    return;
  }

  console.log(`• ${dryRun ? 'Contrôle' : 'Publication'} de ${pkg.name}@${pkg.version}`);
  try {
    execFileSync(
      'npm',
      ['publish', file, '--access', 'public', ...(dryRun ? ['--dry-run'] : []), ...(otp ? ['--otp', otp] : [])],
      { cwd: ROOT, stdio: 'inherit', env: npmEnv },
    );
  } finally {
    if (token && npmEnv.NPM_CONFIG_USERCONFIG) {
      await fs.rm(npmEnv.NPM_CONFIG_USERCONFIG, { force: true }).catch(() => undefined);
    }
  }
  if (dryRun) {
    console.log('✔ Contrôle terminé : rien n’a été publié');
    return;
  }

  // Vérifie version + tarball (CDN CF peut cacher un 404 ~5 min → cache-bust)
  let confirmed = '';
  let tarballOk = false;
  const maxTries = 24;
  for (let i = 0; i < maxTries; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 3000 : 5000));
    try {
      confirmed = execFileSync('npm', ['view', `${pkg.name}@${pkg.version}`, 'version'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: npmEnv,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      confirmed = '';
    }
    try {
      const tarball = execFileSync('npm', ['view', `${pkg.name}@${pkg.version}`, 'dist.tarball'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: npmEnv,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (tarball.startsWith('http')) {
        const bust = `${tarball}${tarball.includes('?') ? '&' : '?'}cb=${Date.now()}`;
        const head = execFileSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '-L', bust], {
          encoding: 'utf8',
        }).trim();
        tarballOk = head === '200';
      }
    } catch {
      tarballOk = false;
    }
    if (confirmed === pkg.version && tarballOk) break;
    console.log(
      `• Attente npm… (${i + 1}/${maxTries}) version=${confirmed || '—'} tarball=${tarballOk ? 'ok' : '404'}`,
    );
  }
  if (confirmed !== pkg.version || !tarballOk) {
    throw new Error(
      `Publication incomplète : ${pkg.name}@${pkg.version} version=${confirmed || 'absente'} tarball=${tarballOk ? 'ok' : '404'}. ` +
        `Souvent un publish « staged » sans blob (auth navigateur / OTP). Republie avec --otp, ou vérifie npmjs.com.`,
    );
  }
  console.log(
    `✔ Publié et confirmé (tarball 200) : https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}\n` +
      `  Install : npx create-snapify-app@${pkg.version}`,
  );
}

main().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
