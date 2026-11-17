/**
 * Branche menus + accueil sur la boutique (widgets shop) pour le thème Mahdia.
 * Ne change pas le thème actif.
 */
import 'dotenv/config';
import crypto from 'crypto';
import { runMigrations } from '../server/db/client';
import { loadSnapshot, updateSnapshot } from '../server/cms/store';
import { button, uid } from '../server/cms/blocks';
import { BLOCK_CATALOG } from '../server/cms/blockCatalog';
import type { CmsBlock, MenuConfig, MenuItem } from '../server/cms/types';

function block(type: CmsBlock['type'], data: Record<string, unknown>, style?: CmsBlock['style']): CmsBlock {
  return { id: uid('b'), type, data, style: style || { paddingTop: 'md', paddingBottom: 'md' } };
}

function moduleBlock(widget: string, options: Record<string, unknown>): CmsBlock {
  return block('module', { module: 'novalabs.shop', widget, options });
}

const HOME: CmsBlock[] = [
  block(
    'hero',
    {
      ...BLOCK_CATALOG.hero.defaults(),
      layout: 'split',
      badgeTag: 'Boutique',
      badgeText: 'Mahdia',
      title: 'L’esprit Méditerranée, chez vous',
      subtitle: 'Découvrez une sélection démo : déco, mode, bien-être et gourmet — livrée partout en Tunisie.',
      buttons: [
        button('Voir la boutique', '/boutique/'),
        button('Promotions', '/boutique/?promo=1', 'secondary', 'none'),
      ],
      media: 'image',
      mainImage: '/images/photos/terrasse-blanche-mer-voilier.jpg',
      mainImageAlt: 'Terrasse face à la mer',
      marquee: ['Maison & déco', 'Mode', 'Bien-être', 'Gourmet', 'Livraison Tunisie', 'Paiement à la livraison'],
    },
    { ...BLOCK_CATALOG.hero.style, paddingTop: 'lg', paddingBottom: 'lg', background: 'soft' }
  ),
  moduleBlock('categories', {
    eyebrow: 'Collections',
    title: 'Parcourir par catégorie',
    subtitle: '',
    limit: 4,
    style: 'tiles',
  }),
  moduleBlock('products', {
    eyebrow: 'Sélection',
    title: 'Nos coups de cœur',
    subtitle: 'Produits mis en avant pour la démo Snapify.',
    source: 'featured',
    category: '',
    limit: 8,
    columns: '4',
    buttonLabel: 'Voir toute la boutique',
  }),
  block(
    'cta',
    {
      ...BLOCK_CATALOG.cta.defaults(),
      title: 'Livraison partout en Tunisie',
      text: 'Paiement à la livraison, retours sous 14 jours.',
      buttons: [button('Commander maintenant', '/boutique/', 'dark')],
    },
    { paddingTop: 'lg', paddingBottom: 'lg' }
  ),
  moduleBlock('products', {
    eyebrow: 'Promotions',
    title: 'Bonnes affaires',
    subtitle: '',
    source: 'sale',
    category: '',
    limit: 4,
    columns: '4',
    buttonLabel: 'Toutes les promotions',
  }),
  block('steps', {
    ...BLOCK_CATALOG.steps.defaults(),
    title: 'Commander en 3 étapes',
    items: [
      { id: uid('k'), num: '01', title: 'Choisir', text: 'Parcourez la boutique et ajoutez au panier.' },
      { id: uid('k'), num: '02', title: 'Valider', text: 'Renseignez l’adresse et le mode de paiement.' },
      { id: uid('k'), num: '03', title: 'Recevoir', text: 'Livraison sous 24 à 72 h en Tunisie.' },
    ],
  }),
  moduleBlock('products', {
    eyebrow: 'Nouveautés',
    title: 'Derniers arrivages',
    subtitle: '',
    source: 'latest',
    category: '',
    limit: 4,
    columns: '4',
    buttonLabel: '',
  }),
  block('faq', {
    ...BLOCK_CATALOG.faq.defaults(),
    title: 'Questions fréquentes',
    items: [
      {
        id: uid('k'),
        question: 'Quels sont les délais de livraison ?',
        answer: '<p>En général 24 à 72 h partout en Tunisie (démo illustrative).</p>',
      },
      {
        id: uid('k'),
        question: 'Puis-je payer à la livraison ?',
        answer: '<p>Oui, le paiement à la livraison est proposé dans le module Commande.</p>',
      },
    ],
  }),
  block(
    'cta',
    {
      ...BLOCK_CATALOG.cta.defaults(),
      title: 'Prêt à explorer la boutique ?',
      text: '12 produits démo vous attendent.',
      buttons: [button('Ouvrir la boutique', '/boutique/', 'dark')],
    },
    { paddingTop: 'lg', paddingBottom: 'lg' }
  ),
];

function menus(): MenuConfig[] {
  const shopChildren: MenuItem[] = [
    { id: 'm-shop-maison', label: 'Maison & déco', path: '/boutique/maison-deco/' },
    { id: 'm-shop-mode', label: 'Mode', path: '/boutique/mode/' },
    { id: 'm-shop-bienetre', label: 'Bien-être', path: '/boutique/bien-etre/' },
    { id: 'm-shop-gourmet', label: 'Gourmet', path: '/boutique/gourmet/' },
  ];
  const primary: MenuConfig = {
    id: 'primary',
    label: 'Menu principal (desktop)',
    items: [
      { id: 'm-shop', label: 'Boutique', path: '/boutique/', children: shopChildren },
      { id: 'm-promo', label: 'Promotions', path: '/boutique/?promo=1' },
      { id: 'm-home', label: 'Accueil', path: '/' },
      { id: 'm-contact', label: 'Contact', path: '/contact/', highlight: true },
    ],
  };
  const mobile: MenuConfig = {
    id: 'mobile',
    label: 'Menu mobile',
    items: JSON.parse(JSON.stringify(primary.items)) as MenuItem[],
  };
  const footer: MenuConfig = {
    id: 'footer',
    label: 'Pied de page',
    items: [
      { id: 'f-shop', label: 'Boutique', path: '/boutique/' },
      { id: 'f-promo', label: 'Promotions', path: '/boutique/?promo=1' },
      { id: 'f-contact', label: 'Contact', path: '/contact/', highlight: true },
      { id: 'f-legal', label: 'Mentions légales', path: '/mentions-legales/' },
      { id: 'f-privacy', label: 'Confidentialité', path: '/politique-de-confidentialite/' },
      { id: 'f-cookies', label: 'Cookies', path: '/cookies/' },
    ],
  };
  return [primary, mobile, footer];
}

await runMigrations();
await loadSnapshot();

await updateSnapshot((s) => {
  const home = s.pages.find((p) => p.path === '/' || p.path === '');
  if (home) {
    home.blocks = HOME;
    home.title = 'Accueil';
    home.seo = {
      ...home.seo,
      seoTitle: 'Snapify Boutique — Mahdia',
      metaDescription: 'Découvrez 12 produits démo et 4 catégories sur Snapify.',
      ogTitle: 'Accueil — Boutique',
      ogDescription: 'Boutique démo Snapify : déco, mode, bien-être et gourmet.',
    };
    home.updatedAt = new Date().toISOString();
  }
  const byId = new Map(s.menus.map((m) => [m.id, m]));
  for (const m of menus()) {
    const existing = byId.get(m.id);
    if (existing) {
      existing.items = m.items;
      existing.label = m.label;
    } else {
      s.menus.push(m);
    }
  }
  s.branding.siteName = s.branding.siteName || 'Snapify';
  s.branding.tagline = 'Boutique démo — Tunisie';
});

console.log('[ecom-home] accueil + menus boutique appliqués');
void crypto;
process.exit(0);
