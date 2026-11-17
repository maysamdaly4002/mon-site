/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Compilation d'un module ou d'un thème : bundle navigateur (React fourni par le site hôte),
 * feuille de style Tailwind autonome et, pour un module, bundle serveur sans dépendance externe.
 */
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { build, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { SCREENSHOT_FILES, type ModuleManifest, type PackagedManifest, type ScreenshotFile } from './index';
import { checkManifest, PackageError, sha256 } from './package';

/** Emplacement des fichiers du SDK utilisés à la compilation (dépôt Snapify ou kit développeur publié). */
export interface SdkLayout {
  /** Point d'entrée de `@snapify/sdk`. */
  entry: string;
  /** Dossier résolu pour `@snapify/sdk/<chemin>`. */
  dir: string;
  themeCss: string;
  adminCss: string;
  /** Fichiers dont les classes Tailwind sont ajoutées à la feuille publique (composants `@snapify/sdk/ui`). */
  publicSources: string[];
  /**
   * Composants de l'administration prêtés aux modules (`ADMIN_KIT`) : ils s'affichent dans le conteneur
   * du module, dont la feuille doit donc aussi porter leurs classes, sinon une utilitaire du module
   * (`.flex-col`) l'emporte sur leurs variantes responsives (`sm:flex-row`) définies par l'hôte.
   */
  adminSources: string[];
}

const SDK_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_LAYOUT: SdkLayout = {
  entry: path.join(SDK_DIR, 'index.ts'),
  dir: SDK_DIR,
  themeCss: path.join(SDK_DIR, 'theme.css'),
  adminCss: path.join(SDK_DIR, 'admin.css'),
  publicSources: [path.join(SDK_DIR, 'ui')],
  adminSources: ['../src/admin/ui', '../src/admin/editor/RichTextEditor.tsx'].map((p) => path.join(SDK_DIR, p)),
};
export const MANIFEST_FILE = 'snapify.module.json';
export const THEME_MANIFEST_FILE = 'snapify.theme.json';

/** Modules fournis par le site hôte au lieu d'être inclus dans le bundle du module. */
const SHARED: Record<string, string> = {
  react: 'React',
  'react/jsx-runtime': 'jsxRuntime',
  'react/jsx-dev-runtime': 'jsxRuntime',
  'react-dom': 'ReactDOM',
};

function sharedRuntime(): Plugin {
  const require = createRequire(import.meta.url);
  return {
    name: 'snapify-shared-runtime',
    enforce: 'pre',
    resolveId(id) {
      return id in SHARED ? `\0snapify-shared:${id}` : null;
    },
    load(id) {
      if (!id.startsWith('\0snapify-shared:')) return null;
      const spec = id.slice('\0snapify-shared:'.length);
      const names = Object.keys(require(spec)).filter((n) => n !== 'default' && /^[A-Za-z_$][\w$]*$/.test(n));
      return [
        `const m = globalThis.__SNAPIFY_RUNTIME__.${SHARED[spec]};`,
        'export default m;',
        ...names.map((n) => `export const ${n} = m.${n};`),
      ].join('\n');
    },
  };
}

async function readManifest(moduleDir: string): Promise<ModuleManifest> {
  const themeFile = path.join(moduleDir, THEME_MANIFEST_FILE);
  const isTheme = await fs.access(themeFile).then(() => true, () => false);
  const file = isTheme ? themeFile : path.join(moduleDir, MANIFEST_FILE);
  let manifest: ModuleManifest;
  try {
    manifest = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    throw new PackageError(`${MANIFEST_FILE} ou ${THEME_MANIFEST_FILE} introuvable ou invalide dans ${moduleDir}`);
  }
  if (isTheme) manifest.kind = 'theme';
  else if (manifest.kind === 'theme') throw new PackageError(`Un thème se décrit dans ${THEME_MANIFEST_FILE}`);
  return { ...manifest, slots: manifest.slots ?? [], permissions: manifest.permissions ?? [], settings: manifest.settings ?? [] };
}

/** Attribut posé par le site hôte sur le conteneur de chaque module. */
export const scopeSelector = (id: string) => `:where([data-snapify-scope="${id}"])`;

/**
 * Limite la feuille d'un module à son conteneur. Sans cela, une utilitaire chargée après le
 * thème (ex. `.flex-col`) l'emporte sur ses variantes responsives (`sm:flex-row`) dans toute la page.
 */
async function scopeModuleCss(css: Buffer, id: string): Promise<Buffer> {
  const { default: postcss } = await import('postcss');
  const scope = scopeSelector(id);
  const root = postcss.parse(css.toString('utf8'));
  root.walkRules((rule) => {
    const parent = rule.parent;
    if (parent?.type === 'atrule' && /keyframes$/i.test((parent as { name: string }).name)) return;
    rule.selectors = rule.selectors.map((s) => (/^(:root|:host|html|body)\b/.test(s) ? s : `${scope} ${s}`));
  });
  return Buffer.from(root.toString());
}

function sourcePath(moduleDir: string, rel: string | undefined): string | undefined {
  if (!rel) return undefined;
  const abs = path.resolve(moduleDir, rel);
  if (!abs.startsWith(path.resolve(moduleDir) + path.sep)) throw new PackageError(`Entrée hors du module : ${rel}`);
  return abs;
}

export async function buildModule(
  moduleDir: string,
  layout: SdkLayout = REPO_LAYOUT
): Promise<{ manifest: PackagedManifest; files: Map<string, Buffer> }> {
  const dir = path.resolve(moduleDir);
  const resolveCss = createRequire(import.meta.url).resolve;
  const manifest = await readManifest(dir);
  const issues = checkManifest(manifest as PackagedManifest, false);
  if (issues.length) throw new PackageError(`Manifeste invalide : ${issues.join(', ')}`);

  const publicSrc = sourcePath(dir, manifest.entries.public);
  const serverSrc = sourcePath(dir, manifest.entries.server);
  const adminSrc = sourcePath(dir, manifest.entries.admin);
  const work = path.join(dir, '.snapify-build');
  await fs.rm(work, { recursive: true, force: true });
  await fs.mkdir(work, { recursive: true });
  const files = new Map<string, Buffer>();
  const alias = [
    { find: /^@snapify\/sdk$/, replacement: layout.entry },
    { find: /^@snapify\/sdk\/(.+)$/, replacement: `${layout.dir}/$1` },
  ];

  /** Bundle navigateur + feuille Tailwind limitée aux classes utilisées dans le dossier de l'entrée. */
  const browserBundle = async (name: 'public' | 'admin', src: string, themeCss: string[]) => {
    const css = [
      '@layer theme, base, components, utilities;',
      `@import ${JSON.stringify(resolveCss('tailwindcss/theme.css'))} theme(reference inline);`,
      `@import ${JSON.stringify(resolveCss('tailwindcss/utilities.css'))} layer(utilities) source(none);`,
      ...themeCss,
      `@source ${JSON.stringify(path.dirname(src))};`,
      ...(name === 'public' ? layout.publicSources : layout.adminSources).map((p) => `@source ${JSON.stringify(p)};`),
    ].join('\n');
    const out = path.join(work, name);
    await fs.writeFile(path.join(work, `${name}.css`), css);
    await fs.writeFile(path.join(work, `${name}-entry.tsx`), `import './${name}.css';\nexport { default } from ${JSON.stringify(src)};\n`);
    // Le plugin React choisit jsxDEV si process.env.NODE_ENV === 'development' (ex. CLI locale).
    // L'hôte ne fournit que jsx/jsxs → « y is not a function » à l'exécution.
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({
        configFile: false,
        root: work,
        logLevel: 'warn',
        mode: 'production',
        plugins: [sharedRuntime(), react(), tailwindcss()],
        resolve: { alias },
        define: { 'process.env.NODE_ENV': JSON.stringify('production') },
        build: {
          outDir: out,
          emptyOutDir: true,
          minify: true,
          lib: { entry: path.join(work, `${name}-entry.tsx`), formats: ['es'], fileName: () => `${name}.js`, cssFileName: name },
        },
      });
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
    files.set(`${name}.js`, await fs.readFile(path.join(out, `${name}.js`)));
    const style = await fs.readFile(path.join(out, `${name}.css`)).catch(() => null);
    if (style?.length) files.set(`${name}.css`, manifest.kind === 'theme' ? style : await scopeModuleCss(style, manifest.id));
  };

  try {
    if (publicSrc) await browserBundle('public', publicSrc, [`@import ${JSON.stringify(layout.themeCss)};`]);
    if (adminSrc) await browserBundle('admin', adminSrc, [`@import ${JSON.stringify(layout.adminCss)};`]);

    if (serverSrc) {
      await build({
        configFile: false,
        root: work,
        logLevel: 'warn',
        mode: 'production',
        resolve: { alias },
        // React reste côté admin/public ; un import accidentel ne doit pas finir dans server.mjs
        // (marketplace refuse process.env issu des builds CJS de React).
        ssr: { noExternal: true, target: 'node', external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client'] },
        build: {
          ssr: serverSrc,
          outDir: path.join(work, 'server'),
          emptyOutDir: true,
          minify: false,
          target: 'node20',
          rollupOptions: {
            output: { format: 'es', entryFileNames: 'server.mjs' },
            external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client'],
          },
        },
      });
      const serverCode = await fs.readFile(path.join(work, 'server', 'server.mjs'), 'utf8');
      if (/\bprocess\.env\b/.test(serverCode) || /\bfrom\s+['"]react(?:\/[^'"]*)?['"]/.test(serverCode) || /\bimport\s+['"]react(?:\/[^'"]*)?['"]/.test(serverCode)) {
        throw new PackageError('Bundle serveur invalide : process.env ou import react détecté (séparer @snapify/sdk/recaptcha)');
      }
      files.set('server.mjs', Buffer.from(serverCode));
    }

    const readme = await fs.readFile(path.join(dir, 'README.md')).catch(() => null);
    if (readme) files.set('README.md', readme);

    if (manifest.screenshot) {
      const target = `screenshot${path.extname(manifest.screenshot).toLowerCase().replace('.jpeg', '.jpg')}` as ScreenshotFile;
      if (!SCREENSHOT_FILES.includes(target)) throw new PackageError('Capture d’écran : JPEG, PNG ou WebP attendu');
      const image = await fs.readFile(sourcePath(dir, manifest.screenshot)!).catch(() => null);
      if (!image) throw new PackageError(`Capture d’écran introuvable : ${manifest.screenshot}`);
      if (image.length > 2 * 1024 * 1024) throw new PackageError('Capture d’écran trop lourde (2 Mo maximum)');
      files.set(target, image);
    }
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }

  const packaged: PackagedManifest = {
    ...manifest,
    entries: {
      ...(files.has('public.js') ? { public: 'public.js' as const } : {}),
      ...(files.has('server.mjs') ? { server: 'server.mjs' as const } : {}),
      ...(files.has('admin.js') ? { admin: 'admin.js' as const } : {}),
    },
    ...(files.has('public.css') ? { styles: 'public.css' as const } : {}),
    ...(files.has('admin.css') ? { adminStyles: 'admin.css' as const } : {}),
    screenshot: SCREENSHOT_FILES.find((f) => files.has(f)),
    files: Object.fromEntries([...files].map(([name, data]) => [name, { sha256: sha256(data), size: data.length }])),
    builtAt: new Date().toISOString(),
  };
  const packagedIssues = checkManifest(packaged, true);
  if (packagedIssues.length) throw new PackageError(`Paquet invalide : ${packagedIssues.join(', ')}`);
  return { manifest: packaged, files };
}
