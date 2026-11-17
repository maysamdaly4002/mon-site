/**
 * Snapify — restaure une accueil « classique » (sans widgets e-commerce orphelins)
 * après bascule Mahdia → SidiBou / modules shop désactivés.
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import { button, uid } from './blocks';
import { BLOCK_CATALOG } from './blockCatalog';
import { cmsNow } from './defaults';
import { updateSnapshot } from './store';
import type { CmsBlock, MenuConfig } from './types';

function block(type: CmsBlock['type'], data: Record<string, unknown>, style?: CmsBlock['style']): CmsBlock {
  return {
    id: uid('b'),
    type,
    data,
    style: style || { paddingTop: 'md', paddingBottom: 'md' },
  };
}

const CLASSIC_HOME: CmsBlock[] = [
  block(
    'hero',
    {
      ...BLOCK_CATALOG.hero.defaults(),
      layout: 'centered',
      badgeTag: 'CMS',
      badgeText: 'Snapify',
      title: 'Un site moderne, prêt pour la Tunisie',
      subtitle:
        'Éditez vos pages, publiez vos contenus et étendez Snapify avec modules et thèmes. Simple, rapide, multi-domaines.',
      buttons: [
        button('Nous contacter', '/contact/'),
        button('Nos expertises', '/expertises/', 'secondary', 'none'),
      ],
      media: 'none',
    },
    { ...BLOCK_CATALOG.hero.style, paddingTop: 'lg', paddingBottom: 'lg', background: 'soft' }
  ),
  block('stats', {
    ...BLOCK_CATALOG.stats.defaults(),
    items: [
      { id: uid('k'), value: '25', suffix: '+', label: 'Blocs du constructeur' },
      { id: uid('k'), value: '48', suffix: ' h', label: 'Installation plateforme' },
      { id: uid('k'), value: '100', suffix: ' %', label: 'Contrôle depuis l’admin' },
    ],
  }),
  block('steps', {
    ...BLOCK_CATALOG.steps.defaults(),
    title: 'Comment ça marche',
    items: [
      { id: uid('k'), num: '01', title: 'Concevoir', text: 'Composez vos pages avec les blocs du thème actif.' },
      { id: uid('k'), num: '02', title: 'Publier', text: 'SEO, menus, médias et formulaires dans le même back-office.' },
      { id: uid('k'), num: '03', title: 'Étendre', text: 'Ajoutez boutique, panier ou WhatsApp via la marketplace quand vous en avez besoin.' },
    ],
  }),
  block('faq', {
    ...BLOCK_CATALOG.faq.defaults(),
    title: 'Questions fréquentes',
    items: [
      {
        id: uid('k'),
        question: 'Puis-je activer l’e-commerce plus tard ?',
        answer:
          '<p>Oui. Installez les modules Boutique / Panier / Commande et un thème e-commerce (ex. Mahdia), puis placez des widgets boutique sur vos pages.</p>',
      },
      {
        id: uid('k'),
        question: 'Pourquoi des blocs ont disparu ?',
        answer:
          '<p>Les widgets d’un module désactivé ne s’affichent plus (ex. grille produits). Réactivez le module ou retirez ces blocs dans l’éditeur.</p>',
      },
    ],
  }),
  block(
    'cta',
    {
      ...BLOCK_CATALOG.cta.defaults(),
      title: 'Parlons de votre projet',
      text: 'Une équipe Snapify vous répond rapidement.',
      buttons: [button('Contact', '/contact/', 'dark')],
    },
    { paddingTop: 'lg', paddingBottom: 'lg' }
  ),
];

function classicMenus(): MenuConfig[] {
  const primary: MenuConfig = {
    id: 'primary',
    label: 'Menu principal (desktop)',
    items: [
      { id: 'm-home', label: 'Accueil', path: '/' },
      { id: 'm-exp', label: 'Expertises', path: '/expertises/' },
      { id: 'm-sec', label: 'Secteurs', path: '/secteurs/' },
      { id: 'm-real', label: 'Réalisations', path: '/realisations/' },
      { id: 'm-approche', label: 'Notre approche', path: '/notre-approche/' },
      { id: 'm-contact', label: 'Contact', path: '/contact/', highlight: true },
    ],
  };
  const mobile: MenuConfig = {
    id: 'mobile',
    label: 'Menu mobile',
    items: JSON.parse(JSON.stringify(primary.items)) as MenuConfig['items'],
  };
  const footer: MenuConfig = {
    id: 'footer',
    label: 'Pied de page',
    items: [
      { id: 'f-real', label: 'Réalisations', path: '/realisations/' },
      { id: 'f-approche', label: 'Notre approche', path: '/notre-approche/' },
      { id: 'f-contact', label: 'Contact', path: '/contact/', highlight: true },
      { id: 'f-legal', label: 'Mentions légales', path: '/mentions-legales/' },
      { id: 'f-privacy', label: 'Confidentialité', path: '/politique-de-confidentialite/' },
      { id: 'f-cookies', label: 'Cookies', path: '/cookies/' },
    ],
  };
  return [primary, mobile, footer];
}

function isShopModule(mod: string): boolean {
  return (
    mod.startsWith('novalabs.shop') ||
    mod.startsWith('novalabs.cart') ||
    mod.startsWith('novalabs.checkout') ||
    mod.startsWith('novalabs.customers')
  );
}

/** Retire les blocs module orphelins et restaure une accueil + menus classiques. */
export async function restoreClassicHomeAndMenus(): Promise<{ removedModuleBlocks: number; homeReplaced: boolean }> {
  let removedModuleBlocks = 0;
  let homeReplaced = false;
  const t = cmsNow();
  await updateSnapshot((s) => {
    const home = s.pages.find((p) => p.path === '/' || p.path === '');
    if (home) {
      removedModuleBlocks = home.blocks.filter((b) => {
        if (b.type !== 'module') return false;
        const mod = String((b.data as { module?: string })?.module || '');
        return isShopModule(mod);
      }).length;
      // Restauration volontaire : toujours remplacer l’accueil par la structure classique SidiBou
      home.blocks = CLASSIC_HOME;
      homeReplaced = true;
      home.title = 'Accueil';
      home.seo = {
        ...home.seo,
        seoTitle: 'Snapify — CMS & marketplace Tunisie',
        metaDescription: 'Éditez vos pages, publiez vos contenus et étendez Snapify avec modules et thèmes.',
        ogTitle: 'Accueil — Snapify',
        ogDescription: 'CMS Snapify : pages, modules et thèmes pour la Tunisie.',
      };
      home.updatedAt = t;
    }

    const byId = new Map(s.menus.map((m) => [m.id, m]));
    for (const m of classicMenus()) {
      const existing = byId.get(m.id);
      if (existing) {
        existing.items = m.items;
        existing.label = m.label;
      } else {
        s.menus.push(m);
      }
    }

    // Identité / textes généraux trop « démo Mahdia »
    const brandBlob = `${s.branding?.siteName || ''} ${s.branding?.tagline || ''} ${s.general?.baseline || ''} ${s.general?.slogan || ''}`;
    if (/magna|mahdia|boutique|vulputate|vehicula|bibendum|commodo|lobortis|lorem/i.test(brandBlob)) {
      s.branding.siteName = 'Snapify';
      s.branding.tagline = 'CMS & marketplace — Tunisie';
      s.general.baseline = 'CMS & marketplace pour la Tunisie';
      s.general.slogan = 'Éditez. Publiez. Étendez.';
      s.general.legalName = 'Snapify SAS';
      s.general.phone = '+216 24 734 647';
      s.general.phoneClean = '+21624734647';
      s.general.contactEmail = 'contact@novalabs.tn';
      s.general.address = 'Tunisie';
      s.general.slaHours = '48 h';
    }
  });
  return { removedModuleBlocks, homeReplaced };
}
