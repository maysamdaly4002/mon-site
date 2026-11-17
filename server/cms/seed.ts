/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import type { CmsPage, CmsSnapshot } from './types';
import { cmsNow, defaultSeoForPath } from './defaults';
import { ensureDefaultAdmin } from './auth';
import { wantDemoContent } from '../distro';

const CORE_PATHS: { path: string; title: string; template: CmsPage['template'] }[] = [
  { path: '/', title: 'Accueil', template: 'landing' },
  { path: '/expertises/', title: 'Lorem', template: 'default' },
  { path: '/secteurs/', title: 'Ipsum', template: 'default' },
  { path: '/realisations/', title: 'Réalisations', template: 'default' },
  { path: '/notre-approche/', title: 'Notre approche', template: 'default' },
  { path: '/contact/', title: 'Contact', template: 'default' },
  { path: '/mentions-legales/', title: 'Mentions légales', template: 'legal' },
  { path: '/politique-de-confidentialite/', title: 'Politique de confidentialité', template: 'legal' },
  { path: '/cookies/', title: 'Cookies', template: 'legal' },
];

export async function ensureSeeded(snapshot: CmsSnapshot): Promise<void> {
  snapshot.users = await ensureDefaultAdmin(snapshot.users);

  if (snapshot.pages.length === 0) {
    const t = cmsNow();
    snapshot.pages = CORE_PATHS.map((p, i) => ({
      id: `page-${i + 1}`,
      path: p.path,
      title: p.title,
      status: 'published' as const,
      publishedAt: t,
      contentSource: p.template === 'legal' ? ('cms' as const) : ('react' as const),
      template: p.template,
      blocks:
        p.path === '/'
          ? [
              {
                id: 'hero-home',
                type: 'hero' as const,
                data: {
                  title: 'Lorem ipsum dolor sit amet',
                  subtitle: 'Audit, travaux, financement CEE et suivi des économies — partout en France.',
                  ctaLabel: 'Lorem ipsum dolor',
                  ctaPath: '/contact/',
                  backgroundStyle: 'gradient',
                },
              },
            ]
          : [
              {
                id: `intro-${i}`,
                type: 'richText' as const,
                data: {
                  html: `<p>Contenu géré depuis le backoffice pour <strong>${p.title}</strong>. Le front React actuel reste la vue par défaut tant que la page n'est pas entièrement reconstruite en blocs.</p>`,
                },
              },
            ],
      seo: defaultSeoForPath(p.path, p.title),
      createdAt: t,
      updatedAt: t,
    }));
  }

  if (snapshot.redirects.length === 0) {
    snapshot.redirects = [
      { from: '/contactez-nous/', to: '/contact/', permanent: true },
      { from: '/nos-solutions/', to: '/expertises/', permanent: true },
    ];
  }

  if (wantDemoContent()) {
    seedDemoExtras(snapshot);
  }
}

/** Contenu démo optionnel (create-snapify-app --demo). */
function seedDemoExtras(snapshot: CmsSnapshot): void {
  const t = cmsNow();
  if (!snapshot.posts?.length) {
    snapshot.posts = [
      {
        id: 'demo-post-1',
        slug: 'bienvenue-snapify',
        title: 'Bienvenue sur votre site Snapify',
        excerpt: 'Article de démonstration — modifiez-le ou supprimez-le depuis le backoffice.',
        status: 'published',
        publishedAt: t,
        author: 'Admin',
        tags: ['demo'],
        blocks: [
          {
            id: 'demo-p1',
            type: 'richText',
            data: {
              html: '<p>Ceci est un <strong>article de démo</strong>. Éditez-le dans Articles.</p>',
            },
          },
        ],
        seo: defaultSeoForPath('/blog/bienvenue-snapify/', 'Bienvenue sur votre site Snapify'),
        createdAt: t,
        updatedAt: t,
      },
      {
        id: 'demo-post-2',
        slug: 'gerer-vos-pages',
        title: 'Gérer vos pages en 2 minutes',
        excerpt: 'Pages, blocs, menus et SEO depuis /administrator.',
        status: 'published',
        publishedAt: t,
        author: 'Admin',
        tags: ['demo', 'guide'],
        blocks: [
          {
            id: 'demo-p2',
            type: 'richText',
            data: {
              html: '<p>Ouvrez <code>/administrator</code> pour créer des pages, menus et médias.</p>',
            },
          },
        ],
        seo: defaultSeoForPath('/blog/gerer-vos-pages/', 'Gérer vos pages en 2 minutes'),
        createdAt: t,
        updatedAt: t,
      },
    ];
  }
  if (snapshot.site && !snapshot.site.name) {
    snapshot.site.name = 'Mon site démo';
    snapshot.site.baseline = 'Propulsé par Snapify';
    snapshot.site.slogan = 'Éditez ce texte dans Réglages → Général';
  }
}
