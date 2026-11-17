/**
 * Contenu lié au thème (accueil + menus + branding léger).
 * Chaque thème a son pack : activer un thème restaure son contenu
 * sans écraser celui des autres.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { siteSettings } from '../db/schema';
import { updateSnapshot, loadSnapshot } from './store';
import { button, uid } from './blocks';
import { BLOCK_CATALOG } from './blockCatalog';
import { defaultSeoForPath } from './defaults';
import type { CmsBlock, CmsPage, MenuConfig, MenuItem, SeoMeta, ThemeBranding } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = path.join(__dirname, 'themePacks');

const KEY = (themeId: string) => `theme.content.${themeId}`;

export interface ThemePageSeed {
  path: string;
  title: string;
  blocks: CmsBlock[];
  seo?: Partial<SeoMeta>;
  template?: CmsPage['template'];
}

export interface ThemeContentPack {
  version: 1;
  themeId: string;
  savedAt: string;
  home: {
    title: string;
    blocks: CmsBlock[];
    seo?: Partial<SeoMeta>;
  };
  pages?: ThemePageSeed[];
  menus: MenuConfig[];
  branding?: Partial<ThemeBranding>;
}

function block(type: CmsBlock['type'], data: Record<string, unknown>, style?: CmsBlock['style']): CmsBlock {
  return { id: uid('b'), type, data, style: style || { paddingTop: 'md', paddingBottom: 'md' } };
}

function moduleBlock(widget: string, options: Record<string, unknown>): CmsBlock {
  return block('module', { module: 'novalabs.shop', widget, options });
}

function classicMenus(labels: { primary: MenuItem[]; footer: MenuItem[] }): MenuConfig[] {
  const primary: MenuConfig = { id: 'primary', label: 'Menu principal (desktop)', items: labels.primary };
  const mobile: MenuConfig = {
    id: 'mobile',
    label: 'Menu mobile',
    items: JSON.parse(JSON.stringify(labels.primary)) as MenuItem[],
  };
  const footer: MenuConfig = { id: 'footer', label: 'Pied de page', items: labels.footer };
  return [primary, mobile, footer];
}

/** Pack boutique Mahdia (widgets shop). */
export function buildMahdiaPack(): ThemeContentPack {
  const shopChildren: MenuItem[] = [
    { id: 'm-shop-maison', label: 'Maison & déco', path: '/boutique/maison-deco/' },
    { id: 'm-shop-mode', label: 'Mode', path: '/boutique/mode/' },
    { id: 'm-shop-bienetre', label: 'Bien-être', path: '/boutique/bien-etre/' },
    { id: 'm-shop-gourmet', label: 'Gourmet', path: '/boutique/gourmet/' },
  ];
  const homeBlocks: CmsBlock[] = [
    block(
      'hero',
      {
        ...BLOCK_CATALOG.hero.defaults(),
        layout: 'split',
        badgeTag: 'Boutique',
        badgeText: 'Mahdia',
        title: 'L’esprit Méditerranée, chez vous',
        subtitle: 'Découvrez une sélection démo : déco, mode, bien-être et gourmet — livrée partout en Tunisie.',
        buttons: [button('Voir la boutique', '/boutique/'), button('Promotions', '/boutique/?promo=1', 'secondary', 'none')],
        media: 'image',
        mainImage: '/images/photos/terrasse-blanche-mer-voilier.jpg',
        mainImageAlt: 'Terrasse face à la mer',
        marquee: ['Maison & déco', 'Mode', 'Bien-être', 'Gourmet', 'Livraison Tunisie'],
      },
      { ...BLOCK_CATALOG.hero.style, paddingTop: 'lg', paddingBottom: 'lg', background: 'soft' }
    ),
    moduleBlock('categories', { eyebrow: 'Collections', title: 'Parcourir par catégorie', subtitle: '', limit: 4, style: 'tiles' }),
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
        { id: uid('k'), question: 'Quels sont les délais de livraison ?', answer: '<p>En général 24 à 72 h partout en Tunisie.</p>' },
        { id: uid('k'), question: 'Puis-je payer à la livraison ?', answer: '<p>Oui, via le module Commande.</p>' },
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
  return {
    version: 1,
    themeId: 'novalabs.mahdia',
    savedAt: new Date().toISOString(),
    home: {
      title: 'Accueil',
      blocks: homeBlocks,
      seo: {
        seoTitle: 'Snapify Boutique — Mahdia',
        metaDescription: 'Découvrez 12 produits démo et 4 catégories.',
        ogTitle: 'Accueil — Boutique',
        ogDescription: 'Boutique démo Snapify.',
      },
    },
    menus: classicMenus({
      primary: [
        { id: 'm-shop', label: 'Boutique', path: '/boutique/', children: shopChildren },
        { id: 'm-promo', label: 'Promotions', path: '/boutique/?promo=1' },
        { id: 'm-home', label: 'Accueil', path: '/' },
        { id: 'm-contact', label: 'Contact', path: '/contact/', highlight: true },
      ],
      footer: [
        { id: 'f-shop', label: 'Boutique', path: '/boutique/' },
        { id: 'f-promo', label: 'Promotions', path: '/boutique/?promo=1' },
        { id: 'f-contact', label: 'Contact', path: '/contact/', highlight: true },
        { id: 'f-legal', label: 'Mentions légales', path: '/mentions-legales/' },
        { id: 'f-privacy', label: 'Confidentialité', path: '/politique-de-confidentialite/' },
        { id: 'f-cookies', label: 'Cookies', path: '/cookies/' },
      ],
    }),
    branding: {
      tagline: 'Boutique démo — Tunisie',
      colors: {
        primary: '#0E7C86',
        primaryHover: '#0A5E66',
        accent: '#D97706',
        navy: '#0F262B',
        background: '#FAF6EF',
        text: '#0F262B',
        muted: '#66716F',
        border: '#E5DCCD',
      },
      fonts: { heading: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans' },
    },
  };
}

/** Pack éditorial Dogga (vitrine, sans boutique). */
export function buildDoggaPack(): ThemeContentPack {
  const homeBlocks: CmsBlock[] = [
    block(
      'hero',
      {
        ...BLOCK_CATALOG.hero.defaults(),
        layout: 'centered',
        badgeTag: 'Dogga',
        badgeText: 'Éditorial',
        title: 'Une présence éditoriale, sobre et durable',
        subtitle: 'Grands titres, images en arche et sections aérées — le thème Dogga pour une vitrine corporate.',
        buttons: [button('Nos expertises', '/expertises/'), button('Nous contacter', '/contact/', 'secondary', 'none')],
        media: 'none',
      },
      { ...BLOCK_CATALOG.hero.style, paddingTop: 'lg', paddingBottom: 'lg', background: 'soft' }
    ),
    block('stats', {
      ...BLOCK_CATALOG.stats.defaults(),
      items: [
        { id: uid('k'), value: '25', suffix: '+', label: 'Blocs du constructeur' },
        { id: uid('k'), value: '100', suffix: ' %', label: 'Personnalisable' },
        { id: uid('k'), value: '48', suffix: ' h', label: 'Mise en ligne' },
      ],
    }),
    block('steps', {
      ...BLOCK_CATALOG.steps.defaults(),
      title: 'Notre méthode',
      items: [
        { id: uid('k'), num: '01', title: 'Comprendre', text: 'Cadrage du message et de l’identité.' },
        { id: uid('k'), num: '02', title: 'Composer', text: 'Pages et blocs dans le constructeur.' },
        { id: uid('k'), num: '03', title: 'Publier', text: 'SEO, menus et formulaires prêts.' },
      ],
    }),
    block('projects', { ...BLOCK_CATALOG.projects.defaults(), title: 'Réalisations' }),
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
  return {
    version: 1,
    themeId: 'novalabs.dogga',
    savedAt: new Date().toISOString(),
    home: {
      title: 'Accueil',
      blocks: homeBlocks,
      seo: {
        seoTitle: 'Snapify — Dogga',
        metaDescription: 'Vitrine éditoriale Snapify avec le thème Dogga.',
        ogTitle: 'Accueil',
        ogDescription: 'Thème éditorial Dogga.',
      },
    },
    menus: classicMenus({
      primary: [
        { id: 'm-exp', label: 'Expertises', path: '/expertises/' },
        { id: 'm-sec', label: 'Secteurs', path: '/secteurs/' },
        { id: 'm-real', label: 'Réalisations', path: '/realisations/' },
        { id: 'm-approche', label: 'Notre approche', path: '/notre-approche/' },
        { id: 'm-contact', label: 'Contact', path: '/contact/', highlight: true },
      ],
      footer: [
        { id: 'f-real', label: 'Réalisations', path: '/realisations/' },
        { id: 'f-approche', label: 'Notre approche', path: '/notre-approche/' },
        { id: 'f-contact', label: 'Contact', path: '/contact/', highlight: true },
        { id: 'f-legal', label: 'Mentions légales', path: '/mentions-legales/' },
        { id: 'f-privacy', label: 'Confidentialité', path: '/politique-de-confidentialite/' },
        { id: 'f-cookies', label: 'Cookies', path: '/cookies/' },
      ],
    }),
    branding: {
      tagline: 'Éditorial & corporate — Tunisie',
      colors: {
        primary: '#B4532A',
        primaryHover: '#93401E',
        accent: '#2D3D78',
        navy: '#1A1612',
        background: '#F5F1EA',
        text: '#1A1612',
        muted: '#6F665B',
        border: '#DDD3C4',
      },
      fonts: { heading: 'Instrument Serif', body: 'Manrope' },
    },
  };
}

async function loadSidibouDefault(): Promise<ThemeContentPack> {
  const home = JSON.parse(await fs.readFile(path.join(PACKS_DIR, 'sidibou-home.json'), 'utf8')) as {
    blocks: CmsBlock[];
    title: string;
    seo?: Partial<SeoMeta>;
  };
  const menus = JSON.parse(await fs.readFile(path.join(PACKS_DIR, 'sidibou-menus.json'), 'utf8')) as MenuConfig[];
  let branding: ThemeContentPack['branding'];
  try {
    const b = JSON.parse(await fs.readFile(path.join(PACKS_DIR, 'sidibou-branding.json'), 'utf8')) as ThemeBranding;
    branding = { siteName: b.siteName, tagline: b.tagline, colors: b.colors, fonts: b.fonts };
  } catch {
    branding = { tagline: 'Ingénierie & performance énergétique' };
  }
  return {
    version: 1,
    themeId: 'novalabs.sidibou',
    savedAt: new Date().toISOString(),
    home: { title: home.title || 'Accueil', blocks: home.blocks, seo: home.seo },
    menus,
    branding,
  };
}

export async function readThemePack(themeId: string): Promise<ThemeContentPack | null> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, KEY(themeId)));
  if (!row?.value || typeof row.value !== 'object') return null;
  const v = row.value as ThemeContentPack;
  if (v.version !== 1 || !Array.isArray(v.home?.blocks) || !Array.isArray(v.menus)) return null;
  return v;
}

export async function writeThemePack(pack: ThemeContentPack): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key: KEY(pack.themeId), value: pack, updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: pack, updatedAt: new Date() } });
}

/** Capture l’accueil + menus actuels dans le pack du thème. */
export async function captureLiveThemeContent(themeId: string): Promise<ThemeContentPack> {
  const s = await loadSnapshot();
  const home = s.pages.find((p) => p.path === '/' || p.path === '');
  const pack: ThemeContentPack = {
    version: 1,
    themeId,
    savedAt: new Date().toISOString(),
    home: {
      title: home?.title || 'Accueil',
      blocks: structuredClone(home?.blocks || []),
      seo: home?.seo ? structuredClone(home.seo) : undefined,
    },
    menus: structuredClone(s.menus),
    branding: {
      siteName: s.branding.siteName,
      tagline: s.branding.tagline,
      logoUrl: s.branding.logoUrl,
      logoDarkUrl: s.branding.logoDarkUrl,
      faviconUrl: s.branding.faviconUrl,
      colors: structuredClone(s.branding.colors),
      fonts: structuredClone(s.branding.fonts),
    },
  };
  await writeThemePack(pack);
  return pack;
}

/** Applique un pack sur le snapshot CMS (accueil + pages du thème + menus + identité visuelle). */
export async function applyThemePack(pack: ThemeContentPack): Promise<void> {
  const t = new Date().toISOString();
  await updateSnapshot((s) => {
    const home = s.pages.find((p) => p.path === '/' || p.path === '');
    if (home) {
      home.blocks = structuredClone(pack.home.blocks);
      home.title = pack.home.title || 'Accueil';
      if (pack.home.seo) home.seo = { ...home.seo, ...pack.home.seo };
      home.updatedAt = t;
    }
    if (Array.isArray(pack.pages)) {
      for (const pg of pack.pages) {
        const existing = s.pages.find((p) => p.path === pg.path);
        if (existing) {
          existing.title = pg.title || existing.title;
          existing.blocks = structuredClone(pg.blocks);
          existing.status = 'published';
          existing.publishedAt = existing.publishedAt || t;
          existing.contentSource = 'cms';
          if (pg.template) existing.template = pg.template;
          if (pg.seo) existing.seo = { ...existing.seo, ...pg.seo };
          existing.updatedAt = t;
        } else {
          s.pages.push({
            id: uid('page'),
            path: pg.path,
            title: pg.title,
            status: 'published',
            publishedAt: t,
            contentSource: 'cms',
            template: pg.template || 'default',
            blocks: structuredClone(pg.blocks),
            seo: { ...defaultSeoForPath(pg.path, pg.title), ...(pg.seo || {}) },
            createdAt: t,
            updatedAt: t,
          });
        }
      }
    }
    const byId = new Map(s.menus.map((m) => [m.id, m]));
    for (const m of pack.menus) {
      const existing = byId.get(m.id);
      if (existing) {
        existing.items = structuredClone(m.items);
        if (m.label) existing.label = m.label;
      } else {
        s.menus.push(structuredClone(m));
      }
    }
    if (pack.branding?.tagline !== undefined) s.branding.tagline = pack.branding.tagline;
    if (pack.branding?.siteName) s.branding.siteName = pack.branding.siteName;
    if (pack.branding?.logoUrl !== undefined) s.branding.logoUrl = pack.branding.logoUrl;
    if (pack.branding?.logoDarkUrl !== undefined) s.branding.logoDarkUrl = pack.branding.logoDarkUrl;
    if (pack.branding?.faviconUrl !== undefined) s.branding.faviconUrl = pack.branding.faviconUrl;
    if (pack.branding?.colors) s.branding.colors = { ...s.branding.colors, ...pack.branding.colors };
    if (pack.branding?.fonts) s.branding.fonts = { ...s.branding.fonts, ...pack.branding.fonts };
  });
}

/** Pack Preveris — bureau d’études sécurité incendie & accessibilité ERP (contenu PDF). */
export function buildPreverisPack(): ThemeContentPack {
  const homeBlocks: CmsBlock[] = [
    block(
      'hero',
      {
        ...BLOCK_CATALOG.hero.defaults(),
        layout: 'split',
        badgeTag: 'Bureau d’études',
        badgeText: 'Sécurité incendie · Accessibilité ERP',
        title: 'PRÉVÉRIS, votre bureau d’études en',
        highlight: 'sécurité incendie et accessibilité',
        subtitle:
          'Garantir l’ouverture de votre ERP dans un temps et un budget maîtrisés. Études, suivi et assistance pour exploitants et collectivités.',
        buttons: [
          button('Parler de votre projet', '/contact/'),
          button('Nos études', '/etudes/autorisation-travaux/', 'secondary', 'none'),
        ],
        media: 'image',
        mainImage: '/images/photos/preveris-hero-erp.jpg',
        mainImageAlt: 'Préventionniste PRÉVÉRIS — inspection sécurité incendie et plans ERP',
        marquee: ['Autorisation de travaux', 'Permis de construire', 'Coordination SSI', 'RUS', 'Collectivités', 'Audit accessibilité'],
        liveText: 'Fondé en 2017 · France entière',
        trustItems: ['Autorisation de travaux', 'Commissions de sécurité', 'Accompagnement A à Z'],
      },
      { ...BLOCK_CATALOG.hero.style, paddingTop: 'lg', paddingBottom: 'lg', background: 'soft', decor: 'glow', animation: 'fade-up' }
    ),
    block(
      'stats',
      {
        ...BLOCK_CATALOG.stats.defaults(),
        eyebrow: 'Chiffres clés',
        title: 'Une expertise de terrain,',
        highlight: 'au service de vos ERP.',
        style: 'cards',
        countUp: true,
        items: [
          { id: uid('k'), value: '2017', suffix: '', label: 'Année de création' },
          { id: uid('k'), value: '95', suffix: ' %', label: 'Dossiers validés au 1er dépôt' },
          { id: uid('k'), value: '48', suffix: ' h', label: 'Délai moyen de premier échange' },
          { id: uid('k'), value: '31', suffix: '+', label: 'Collectivités accompagnées' },
        ],
      },
      { paddingTop: 'lg', paddingBottom: 'lg', background: 'navy', decor: 'glow', animation: 'fade-up' }
    ),
    block(
      'cards',
      {
        ...BLOCK_CATALOG.cards.defaults(),
        eyebrow: 'Besoin d’une étude ?',
        title: 'Dossiers conformes,',
        highlight: 'ouverture sécurisée.',
        intro: 'PRÉVÉRIS constitue les dossiers techniques complets pour vos autorisations de travaux, permis et systèmes SSI.',
        style: 'hoverDark',
        columns: 3,
        items: [
          {
            id: uid('k'),
            icon: 'file-check',
            title: 'Autorisation de travaux',
            text: 'Plans cotés, notices sécurité incendie et accessibilité, Cerfa : déposez en mairie un projet conforme dès le 1er passage.',
            tags: ['AT ERP · 95 % validés'],
            link: '/etudes/autorisation-travaux/',
            linkLabel: 'En savoir plus',
          },
          {
            id: uid('k'),
            icon: 'building',
            title: 'Permis de construire',
            text: 'Accompagnement clé en main avec architectes HMONP partenaires, notices réglementaires et suivi d’instruction.',
            tags: ['PC · Architecte HMONP'],
            link: '/etudes/permis-construire/',
            linkLabel: 'En savoir plus',
          },
          {
            id: uid('k'),
            icon: 'shield',
            title: 'Coordination SSI',
            text: 'Conception, cahier des charges fonctionnel, essais techniques et dossier d’identité SSI supervisés par d’anciens officiers.',
            tags: ['CSSI · NF S 61-932'],
            link: '/etudes/coordination-ssi/',
            linkLabel: 'En savoir plus',
          },
        ],
      },
      { paddingTop: 'lg', paddingBottom: 'lg', background: 'white', animation: 'fade-up' }
    ),
    block(
      'textMedia',
      {
        ...BLOCK_CATALOG.textMedia.defaults(),
        eyebrow: 'Expertise prévention incendie',
        title: 'D’anciens officiers préventionnistes',
        highlight: 'à vos côtés.',
        html: '<p>Fondé en 2017, le bureau d’études <strong>PRÉVÉRIS</strong> réunit des préventionnistes issus des commissions de sécurité, des dessinateurs projeteurs et des coordinateurs SSI.</p><p>Notre mission : traduire une réglementation incendie et accessibilité complexe en solutions concrètes, économiques et défendables devant les autorités.</p>',
        bullets: [
          'Supervision par d’anciens officiers de sapeurs-pompiers préventionnistes',
          'Solutions compensatoires et demandes de dérogation argumentées',
          'Présence physique à vos côtés lors des commissions de sécurité',
          'Intervention sur toute la France métropolitaine sous 48 h',
        ],
        buttons: [
          button('Découvrir nos études', '/etudes/'),
          button('Parler à un préventionniste', '/contact/', 'secondary', 'none'),
        ],
        mediaType: 'image',
        image: '/images/photos/preveris-etudes-plans.jpg',
        imageAlt: 'Ingénieurs préventionnistes analysant des plans d’évacuation et de sécurité incendie ERP',
        caption: 'Étude sur plans, notices réglementaires et préparation des commissions de sécurité.',
        mediaPosition: 'right',
        mediaStyle: 'framed',
        ratio: 'landscape',
      },
      { paddingTop: 'lg', paddingBottom: 'lg', background: 'soft', animation: 'fade-up' }
    ),
    block(
      'steps',
      {
        ...BLOCK_CATALOG.steps.defaults(),
        eyebrow: 'Notre méthodologie',
        title: 'Votre conformité ERP',
        highlight: 'en 4 étapes maîtrisées.',
        style: 'timeline',
        deliverableLabel: 'Livrable clé',
        items: [
          {
            id: uid('st'),
            num: '01',
            title: 'Diagnostic & faisabilité',
            text: 'Analyse du classement ERP (type et catégorie), visite sur site, relevés géométriques et identification des points bloquants.',
            deliverable: 'Compte-rendu d’audit & chiffrage',
          },
          {
            id: uid('st'),
            num: '02',
            title: 'Dossier réglementaire & SSI',
            text: 'Rédaction des notices sécurité incendie et accessibilité, plans cotés, cahier des charges fonctionnel SSI et Cerfa.',
            deliverable: 'Dossier AT / PC / CSSI complet',
          },
          {
            id: uid('st'),
            num: '03',
            title: 'Instruction & suivi mairie',
            text: 'Dépôt dématérialisé ou papier, échanges directs avec les services instructeurs et la sous-commission départementale.',
            deliverable: 'Complétude sous 48 h & avis favorable',
          },
          {
            id: uid('st'),
            num: '04',
            title: 'Commission & ouverture',
            text: 'Réception technique, préparation du registre de sécurité et présence d’un préventionniste le jour de la visite.',
            deliverable: 'Arrêté d’ouverture & suivi annuel',
          },
        ],
      },
      { paddingTop: 'lg', paddingBottom: 'lg', background: 'white', animation: 'fade-up' }
    ),
    block(
      'panels',
      {
        ...BLOCK_CATALOG.panels.defaults(),
        eyebrow: 'Besoin d’un suivi ?',
        title: 'Maintenir la conformité',
        highlight: 'dans la durée.',
        items: [
          {
            id: uid('k'),
            image: '/images/photos/preveris-ssi-incendie.jpg',
            icon: 'calendar',
            title: 'Suivi annuel',
            text: 'Accompagnement toute l’année pour maintenir la conformité incendie de vos établissements et préparer les visites périodiques.',
            bullets: ['Tenue du registre de sécurité', 'Visite annuelle sur site', 'Présence en commission'],
            link: '/suivi/annuel/',
            linkLabel: 'Découvrir',
          },
          {
            id: uid('k'),
            image: '/images/photos/preveris-accessibilite-erp.jpg',
            icon: 'users',
            title: 'Responsable Unique de Sécurité',
            text: 'Externalisation complète de la mission réglementaire de RUS pour centres commerciaux et groupements d’ERP.',
            bullets: ['Plus de 50 groupements suivis', 'Visa des dossiers preneurs', 'Registre unique & SOGS'],
            link: '/suivi/rus/',
            linkLabel: 'Découvrir',
          },
          {
            id: uid('k'),
            image: '/images/photos/preveris-suivi-hotel.jpg',
            icon: 'hotel',
            title: 'Suivi hôtel (Type O)',
            text: 'Veille renforcée pour les ERP avec locaux à sommeil face aux risques d’incendie et aux visites inopinées.',
            bullets: ['Audit annuel Type O', 'Suivi SDI & désenfumage', 'Assistance commission'],
            link: '/suivi/hotel/',
            linkLabel: 'Découvrir',
          },
        ],
      },
      { paddingTop: 'lg', paddingBottom: 'lg', background: 'soft', animation: 'fade-up' }
    ),
    block(
      'showcase',
      {
        ...BLOCK_CATALOG.showcase.defaults(),
        eyebrow: 'Assistance & Collectivités',
        title: 'Des interventions ciblées',
        highlight: 'pour chaque situation.',
        interval: 6,
        items: [
          {
            id: uid('sh'),
            icon: 'check-circle',
            title: 'Audit accessibilité & dérogations PMR',
            text: 'Diagnostic complet de la chaîne du déplacement (stationnement, accès, circulations, sanitaires) et constitution des dossiers de dérogation motivés en CCDSA.',
            image: '/images/photos/preveris-accessibilite-erp.jpg',
            chips: ['Loi 2005', 'Dérogations motivées', 'Espaces d’Attente Sécurisés'],
            link: '/assistance/audit-accessibilite/',
            buttonLabel: 'Voir l’audit accessibilité',
          },
          {
            id: uid('sh'),
            icon: 'file-text',
            title: 'Documents obligatoires : GN8, SOGS, GE5 & plans',
            text: 'Rédaction sur mesure de vos procédures d’évacuation des personnes en situation de handicap (GN8), SOGS, plans d’intervention pompiers et registres.',
            image: '/images/photos/preveris-etudes-plans.jpg',
            chips: ['Procédure GN8', 'SOGS (art. M 31)', 'Plans d’évacuation NF X 08-070'],
            link: '/assistance/documents/',
            buttonLabel: 'Commander mes documents',
          },
          {
            id: uid('sh'),
            icon: 'wind',
            title: 'Études de désenfumage (IT 246) & avis défavorables',
            text: 'Dimensionnement au plus juste des installations de désenfumage naturel ou mécanique, levée de prescriptions et visio-conseil dès 100 € TTC.',
            image: '/images/photos/preveris-ssi-incendie.jpg',
            chips: ['Instruction Technique 246', 'Levée de réserves', 'Visio-conseil expert'],
            link: '/assistance/missions-ponctuelles/',
            buttonLabel: 'Nos missions ponctuelles',
          },
          {
            id: uid('sh'),
            icon: 'building',
            title: 'Services aux collectivités — « Vous décidez, nous éclairons »',
            text: 'Instruction externalisée des AT ERP 5e catégorie sous 30 jours (complétude 48 h), secrétariat CCSA, appui ADS et audit du patrimoine communal.',
            image: '/images/photos/preveris-collectivites.jpg',
            chips: ['31 communes partenaires', 'Près de 1 000 dossiers instruits', 'Chorus Pro sans engagement'],
            link: '/collectivites/',
            buttonLabel: 'Offre collectivités',
          },
        ],
      },
      { paddingTop: 'lg', paddingBottom: 'lg', background: 'white', animation: 'fade-up' }
    ),
    block(
      'checklist',
      {
        ...BLOCK_CATALOG.checklist.defaults(),
        eyebrow: 'Les + de PRÉVÉRIS',
        title: 'Pourquoi nous confier',
        highlight: 'votre établissement.',
        cards: [
          {
            id: uid('k'),
            icon: 'shieldCheck',
            tag: 'Expertise',
            title: 'Rigueur réglementaire',
            entries: [
              { id: uid('e'), title: '95 % de dossiers validés au 1er dépôt', text: 'Des notices complètes et argumentées qui évitent les demandes de pièces complémentaires.' },
              { id: uid('e'), title: 'Anciens officiers préventionnistes', text: 'Une maîtrise parfaite des attentes des commissions de sécurité et d’accessibilité.' },
              { id: uid('e'), title: 'Veille réglementaire continue', text: 'Code de la construction, règlement du 25 juin 1980, arrêtés spécifiques et IT 246.' },
            ],
          },
          {
            id: uid('k'),
            icon: 'clock',
            tag: 'Réactivité',
            title: 'Délais & budget maîtrisés',
            entries: [
              { id: uid('e'), title: 'Premier échange sous 48 h', text: 'Qualification rapide de votre besoin et chiffrage transparent sans mauvaise surprise.' },
              { id: uid('e'), title: 'Solutions techniques pragmatiques', text: 'Priorité aux aménagements et mesures compensatoires qui préservent votre budget travaux.' },
              { id: uid('e'), title: 'Dossiers livrés en 10 à 30 jours', text: 'Planification serrée pour sécuriser votre date d’ouverture ou de livraison.' },
            ],
          },
          {
            id: uid('k'),
            icon: 'users',
            tag: 'Proximité',
            title: 'Accompagnement humain',
            entries: [
              { id: uid('e'), title: 'Binôme référent dédié', text: 'Un préventionniste et un chargé de suivi qui connaissent votre établissement.' },
              { id: uid('e'), title: 'Présence le jour J en commission', text: 'Nous défendons votre dossier sur place face aux pompiers et aux instructeurs.' },
              { id: uid('e'), title: 'Intervention France entière', text: 'Exploitants privés, enseignes nationales, architectes et collectivités territoriales.' },
            ],
          },
        ],
      },
      { paddingTop: 'lg', paddingBottom: 'lg', background: 'soft', animation: 'fade-up' }
    ),
    block(
      'testimonials',
      {
        ...BLOCK_CATALOG.testimonials.defaults(),
        eyebrow: 'Ils nous font confiance',
        title: 'Retours de terrain',
        highlight: 'exploitants & partenaires.',
        items: [
          {
            id: uid('k'),
            quote:
              'PRÉVÉRIS ce n’est pas juste un passage ou deux par an. C’est un réel accompagnement. L’avantage est que PRÉVÉRIS sont là le jour de la commission de sécurité.',
            author: 'Alain Salmeron',
            role: 'Président, Les Cottages de France',
          },
          {
            id: uid('k'),
            quote: 'À chaque fois la société PRÉVÉRIS a été présente pour instruire de A à Z les dossiers dans un temps record.',
            author: 'Michel Laskar',
            role: 'Président & Conseiller, Immobilier Commercial',
          },
          {
            id: uid('k'),
            quote: 'Il y a vraiment de la proximité avec PRÉVÉRIS. Lorsque j’ai un souci, j’appelle et la personne au bout du fil est toujours disponible.',
            author: 'Jonathan Tergemina',
            role: 'Président & Restaurateur, La Côte et l’Arête',
          },
        ],
      },
      { paddingTop: 'lg', paddingBottom: 'lg', background: 'navy', decor: 'glow', animation: 'fade-up' }
    ),
    block(
      'faq',
      {
        ...BLOCK_CATALOG.faq.defaults(),
        eyebrow: 'Questions fréquentes',
        title: 'Vos questions sur la',
        highlight: 'conformité incendie & ERP.',
        layout: 'split',
        showContactCard: true,
        contactLabel: 'Besoin d’un avis immédiat ?',
        items: [
          {
            id: uid('q'),
            question: 'Quand faut-il déposer une Autorisation de Travaux (AT) en ERP ?',
            answer:
              '<p>Toute création, aménagement intérieur, modification des circulations ou changement de destination d’un Établissement Recevant du Public (même sans permis de construire) nécessite une Autorisation de Travaux au titre de l’article L. 122-3 du CCH avant le démarrage du chantier.</p>',
          },
          {
            id: uid('q'),
            question: 'Que faire après un avis défavorable de la commission de sécurité ?',
            answer:
              '<p>Ne restez pas seul : nos préventionnistes analysent le procès-verbal, hiérarchisent les prescriptions, proposent un échéancier réaliste au maire et vous accompagnent jusqu’à la contre-visite de levée de réserves.</p>',
          },
          {
            id: uid('q'),
            question: 'Quels établissements ont l’obligation de désigner un RUS ?',
            answer:
              '<p>Les groupements d’établissements non isolés entre eux (centres commerciaux, galeries, bâtiments tertiaires multi-locataires en ERP) doivent obligatoirement désigner un Responsable Unique de Sécurité (art. R. 143-21 du CCH).</p>',
          },
          {
            id: uid('q'),
            question: 'Dans quels délais intervenez-vous et sur quelle zone géographique ?',
            answer:
              '<p>Nous organisons un premier échange sous 48 h ouvrées et livrons vos dossiers d’études sous 10 à 30 jours en moyenne, partout en France métropolitaine.</p>',
          },
        ],
      },
      { paddingTop: 'lg', paddingBottom: 'lg', background: 'white', animation: 'fade-up' }
    ),
    block(
      'marquee',
      {
        ...BLOCK_CATALOG.marquee.defaults(),
        speed: 'slow',
        items: [
          'Ville de Bondy',
          'Cottages de France',
          'Intermarché',
          'Leclerc',
          'Meaux',
          'Frey',
          'Halles Market',
          'Romainville',
          'Super U',
          'Parrot World',
        ].map((text) => ({ id: uid('m'), text })),
      },
      { paddingTop: 'sm', paddingBottom: 'sm', background: 'soft' }
    ),
    block(
      'cta',
      {
        ...BLOCK_CATALOG.cta.defaults(),
        variant: 'gradient',
        layout: 'centered',
        eyebrow: 'Parlons de votre projet',
        title: 'Mettez votre ERP',
        highlight: 'en conformité.',
        text: 'PRÉVÉRIS met à votre service son réseau de spécialistes pour la sécurité et l’accessibilité de votre établissement.',
        buttons: [
          button('Demander un échange', '/contact/', 'primary'),
          button('07 44 84 45 19', 'tel:+33744844519', 'secondary', 'none'),
        ],
      },
      { paddingTop: 'lg', paddingBottom: 'lg', background: 'soft', animation: 'fade-up' }
    ),
  ];

  const pvPage = (opts: {
    path: string;
    title: string;
    eyebrow: string;
    highlight?: string;
    intro: string;
    parentLabel?: string;
    parentLink?: string;
    image?: string;
    cardsTitle?: string;
    cardsHighlight?: string;
    cards?: { icon: string; title: string; text: string; tags?: string[]; link?: string; linkLabel?: string }[];
    stepsTitle?: string;
    steps?: { num: string; title: string; text: string }[];
    faq?: { question: string; answer: string }[];
    html?: string;
  }): ThemePageSeed => {
    const blocks: CmsBlock[] = [
      block(
        'pageHeader',
        {
          ...BLOCK_CATALOG.pageHeader.defaults(),
          breadcrumb: true,
          parentLabel: opts.parentLabel || '',
          parentLink: opts.parentLink || '',
          eyebrow: opts.eyebrow,
          title: opts.title,
          highlight: opts.highlight || '',
          intro: opts.intro,
          image: opts.image || '/images/photos/preveris-hero-erp.jpg',
          imageAlt: opts.title,
          buttons: [
            button('Demander un devis', '/contact/'),
            button('07 44 84 45 19', 'tel:+33744844519', 'secondary', 'none'),
          ],
        },
        { paddingTop: 'lg', paddingBottom: 'lg', background: 'soft', decor: 'glow', animation: 'fade-up' }
      ),
    ];

    if (opts.html) {
      blocks.push(
        block(
          'richText',
          { ...BLOCK_CATALOG.richText.defaults(), html: opts.html, size: 'normal' },
          { width: 'narrow', paddingTop: 'md', paddingBottom: 'md', background: 'white' }
        )
      );
    }

    if (opts.cards?.length) {
      blocks.push(
        block(
          'cards',
          {
            ...BLOCK_CATALOG.cards.defaults(),
            eyebrow: opts.eyebrow,
            title: opts.cardsTitle || 'Nos prestations',
            highlight: opts.cardsHighlight || 'sur mesure.',
            style: 'hoverDark',
            columns: opts.cards.length === 2 ? 2 : 3,
            items: opts.cards.map((c) => ({
              id: uid('k'),
              icon: c.icon,
              title: c.title,
              text: c.text,
              tags: c.tags || [],
              link: c.link || '/contact/',
              linkLabel: c.linkLabel || 'Demander un échange',
            })),
          },
          { paddingTop: 'lg', paddingBottom: 'lg', background: 'white', animation: 'fade-up' }
        )
      );
    }

    if (opts.steps?.length) {
      blocks.push(
        block(
          'steps',
          {
            ...BLOCK_CATALOG.steps.defaults(),
            eyebrow: 'Méthodologie',
            title: opts.stepsTitle || 'Les étapes de votre dossier',
            style: 'timeline',
            deliverableLabel: 'Étape',
            items: opts.steps.map((s) => ({ id: uid('st'), num: s.num, title: s.title, text: s.text })),
          },
          { paddingTop: 'lg', paddingBottom: 'lg', background: 'soft', animation: 'fade-up' }
        )
      );
    }

    if (opts.faq?.length) {
      blocks.push(
        block(
          'faq',
          {
            ...BLOCK_CATALOG.faq.defaults(),
            eyebrow: 'Questions fréquentes',
            title: 'Tout comprendre',
            highlight: 'avant de démarrer.',
            layout: 'split',
            showContactCard: true,
            items: opts.faq.map((q) => ({ id: uid('q'), question: q.question, answer: q.answer })),
          },
          { paddingTop: 'lg', paddingBottom: 'lg', background: 'white', animation: 'fade-up' }
        )
      );
    }

    blocks.push(
      block(
        'cta',
        {
          ...BLOCK_CATALOG.cta.defaults(),
          variant: 'gradient',
          layout: 'centered',
          eyebrow: 'PRÉVÉRIS · France entière',
          title: 'Parlons de votre',
          highlight: 'établissement.',
          text: 'Un préventionniste dédié analyse votre besoin et vous répond sous 48 h.',
          buttons: [
            button('Prendre contact', '/contact/', 'primary'),
            button('07 44 84 45 19', 'tel:+33744844519', 'secondary', 'none'),
          ],
        },
        { paddingTop: 'lg', paddingBottom: 'lg', background: 'soft', animation: 'fade-up' }
      )
    );

    return {
      path: opts.path,
      title: `${opts.title} ${opts.highlight || ''}`.trim(),
      blocks,
      seo: {
        seoTitle: `${opts.title} ${opts.highlight || ''} — PRÉVÉRIS`.trim(),
        metaDescription: opts.intro,
      },
    };
  };

  const pages: ThemePageSeed[] = [
    pvPage({
      path: '/etudes/',
      title: 'Études réglementaires',
      highlight: 'ERP & incendie',
      eyebrow: 'Études',
      image: '/images/photos/preveris-etudes-plans.jpg',
      intro: 'Autorisation de travaux, permis de construire et coordination SSI : des dossiers complets et conformes dès le premier dépôt.',
      cardsTitle: 'Trois pôles d’études',
      cardsHighlight: 'complémentaires.',
      cards: [
        { icon: 'file-check', title: 'Autorisation de travaux', text: 'Notices sécurité et accessibilité, plans et Cerfa pour déposer en mairie sans stress.', tags: ['AT ERP'], link: '/etudes/autorisation-travaux/', linkLabel: 'Découvrir' },
        { icon: 'building', title: 'Permis de construire', text: 'Accompagnement de A à Z avec architecte HMONP partenaire et notices réglementaires.', tags: ['PC'], link: '/etudes/permis-construire/', linkLabel: 'Découvrir' },
        { icon: 'shield', title: 'Coordination SSI', text: 'Conception, cahier des charges fonctionnel, réception technique et dossier d’identité SSI.', tags: ['CSSI'], link: '/etudes/coordination-ssi/', linkLabel: 'Découvrir' },
      ],
    }),
    pvPage({
      path: '/etudes/autorisation-travaux/',
      title: 'Autorisation de travaux',
      highlight: 'ERP sans retard',
      eyebrow: 'Études · AT ERP',
      parentLabel: 'Études',
      parentLink: '/etudes/',
      image: '/images/photos/preveris-etudes-plans.jpg',
      intro: 'Nous constituons pour vous un dossier complet (plans, notices sécurité et accessibilité, Cerfa) pour déposer en mairie un projet conforme. 95 % des dossiers validés dès le premier dépôt.',
      cardsTitle: 'Quand déposer',
      cardsHighlight: 'une AT ERP ?',
      cards: [
        { icon: 'building', title: 'Construction ou aménagement', text: 'Tout réaménagement des circulations, cloisonnements, dégagements ou création d’ERP.', tags: ['Neuf & aménagement'] },
        { icon: 'sparkles', title: 'Changement de destination', text: 'Local transformé en restaurant, commerce, cabinet ou établissement recevant du public.', tags: ['Transformation'] },
        { icon: 'shieldCheck', title: 'Mise en conformité', text: 'Travaux correctifs après prescriptions de la commission de sécurité ou d’accessibilité.', tags: ['Prescriptions'] },
      ],
      stepsTitle: 'Les 5 étapes de votre autorisation de travaux',
      steps: [
        { num: '01', title: 'Analyse réglementaire préalable', text: 'Classement (type et catégorie), textes applicables et diagnostic de l’existant.' },
        { num: '02', title: 'Constitution du dossier technique', text: 'Plans cotés, notices sécurité incendie et accessibilité, calculs d’effectifs et Cerfa.' },
        { num: '03', title: 'Dépôt en mairie', text: 'Transmission en mairie et suivi de la complétude auprès de la sous-commission.' },
        { num: '04', title: 'Commission de sécurité', text: 'Instruction (4 mois max) et avis des commissions sécurité et accessibilité.' },
        { num: '05', title: 'Réception & ouverture', text: 'Assistance à la visite d’ouverture et obtention de l’arrêté municipal.' },
      ],
      faq: [
        { question: 'Quel est le coût d’un dossier d’autorisation de travaux ?', answer: '<p>À partir de 1 000 € HT selon la complexité et la catégorie de l’ERP (jusqu’à 3 000–4 000 € HT pour les projets complexes). Devis gratuit après un premier échange.</p>' },
        { question: 'Quel est le délai de réalisation ?', answer: '<p>10 à 30 jours calendaires (environ 20 jours en moyenne) pour constituer le dossier complet.</p>' },
        { question: 'Peut-on ouvrir sans attendre l’autorisation ?', answer: '<p>Non : ouvrir sans autorisation constitue une infraction pénale (art. L. 122-5 du CCH) et expose à une fermeture administrative immédiate.</p>' },
        { question: 'Et si je n’ai pas de plans ?', answer: '<p>Un dessinateur se déplace pour effectuer les relevés géométriques ou nous travaillons à partir des plans de votre architecte.</p>' },
      ],
    }),
    pvPage({
      path: '/etudes/permis-construire/',
      title: 'Permis de construire',
      highlight: 'ERP clé en main',
      eyebrow: 'Études · Urbanisme & ERP',
      parentLabel: 'Études',
      parentLink: '/etudes/',
      image: '/images/photos/preveris-etudes-plans.jpg',
      intro: 'Un accompagnement de A à Z pour les maîtres d’ouvrage et les architectes : plans d’architecture HMONP, notices sécurité incendie et accessibilité, formulaires Cerfa.',
      cardsTitle: 'Contenu du pack',
      cardsHighlight: 'permis de construire.',
      cards: [
        { icon: 'layers', title: 'Plans d’architecture', text: 'Relevés géométriques sur site et plans de l’existant et du projet par nos architectes HMONP partenaires.', tags: ['Architecte HMONP'] },
        { icon: 'shield', title: 'Notice de sécurité incendie', text: 'Classement, nouvel effectif, dégagements, désenfumage et conformité de l’alarme.', tags: ['Sécurité'] },
        { icon: 'check-circle', title: 'Notice d’accessibilité & Cerfa', text: 'Chaîne du déplacement PMR, dérogations éventuelles et formulaires administratifs complets.', tags: ['Accessibilité'] },
      ],
      stepsTitle: 'Préparer votre permis avec PRÉVÉRIS',
      steps: [
        { num: '01', title: 'Étude de faisabilité & relevés', text: 'Déplacement sur site, relevés géométriques et analyse des contraintes financières et techniques.' },
        { num: '02', title: 'Conception concertée', text: 'Échanges continus entre architecte et préventionniste ; validation des plans aménagés.' },
        { num: '03', title: 'Dépôt & suivi (5 mois max)', text: 'Dépôt en mairie du dossier complet et suivi jusqu’à l’arrêté de permis.' },
      ],
    }),
    pvPage({
      path: '/etudes/coordination-ssi/',
      title: 'Coordination SSI',
      highlight: '(CSSI)',
      eyebrow: 'Études · Système de Sécurité Incendie',
      parentLabel: 'Études',
      parentLink: '/etudes/',
      image: '/images/photos/preveris-ssi-incendie.jpg',
      intro: 'Concevoir le système d’alarme et de mise en sécurité incendie adapté à votre ERP. Tous nos dossiers sont supervisés par un préventionniste expert, ancien officier de sapeurs-pompiers.',
      cardsTitle: 'Mission complète',
      cardsHighlight: 'de coordination SSI.',
      cards: [
        { icon: 'file-text', title: 'Cahier des charges fonctionnel', text: 'Analyse du projet, définition des zones de détection/mise en sécurité et cahier des charges pour l’installateur.', tags: ['Phase conception'] },
        { icon: 'check-square', title: 'Réception & essais techniques', text: 'Contrôle point par point de toute la chaîne de sécurité incendie et rapport de réception technique.', tags: ['Phase réalisation'] },
        { icon: 'book-open', title: 'Dossier d’identité SSI', text: 'Constitution de la carte d’identité du SSI (consignes, plans, schémas, notices) et assistance en commission.', tags: ['Livraison'] },
      ],
    }),
    pvPage({
      path: '/suivi/',
      title: 'Suivi réglementaire',
      highlight: 'de vos établissements',
      eyebrow: 'Suivi',
      image: '/images/photos/preveris-ssi-incendie.jpg',
      intro: 'Maintenez la conformité de vos ERP toute l’année : suivi technique annuel, mission de Responsable Unique de Sécurité (RUS) et veille dédiée aux hôtels.',
      cardsTitle: 'Trois formules',
      cardsHighlight: 'de suivi.',
      cards: [
        { icon: 'calendar', title: 'Suivi annuel', text: 'Visites annuelles, tenue du registre de sécurité et présence lors des commissions.', tags: ['ERP'], link: '/suivi/annuel/', linkLabel: 'Découvrir' },
        { icon: 'users', title: 'Responsable Unique de Sécurité', text: 'Externalisation complète de la mission RUS pour centres commerciaux et groupements.', tags: ['RUS'], link: '/suivi/rus/', linkLabel: 'Découvrir' },
        { icon: 'building', title: 'Suivi hôtel (type O)', text: 'Veille renforcée pour les établissements avec locaux à sommeil.', tags: ['Hôtellerie'], link: '/suivi/hotel/', linkLabel: 'Découvrir' },
      ],
    }),
    pvPage({
      path: '/suivi/annuel/',
      title: 'Suivi technique annuel',
      highlight: 'incendie & ERP',
      eyebrow: 'Suivi · Accompagnement annuel',
      parentLabel: 'Suivi',
      parentLink: '/suivi/',
      image: '/images/photos/preveris-hero-erp.jpg',
      intro: 'Ne craignez plus les commissions de sécurité. Un binôme référent (agent administratif + préventionniste) suit votre registre, prépare vos contrôles et vous assiste le jour J.',
      cardsTitle: 'Votre protection',
      cardsHighlight: 'au quotidien.',
      cards: [
        { icon: 'shield', title: 'Préparation des commissions', text: 'Suivi constant du registre, présence pendant la visite et proposition de solutions alternatives maîtrisant les coûts.', tags: ['Commission'] },
        { icon: 'file-check', title: 'Protection juridique', text: 'Traçabilité des opérations de maintenance et de formation pour vous prémunir de toute mise en cause.', tags: ['Traçabilité'] },
        { icon: 'users', title: 'Binôme référent dédié', text: 'Visite annuelle par un préventionniste avec rapport détaillé et suivi administratif régulier.', tags: ['Proximité'] },
      ],
    }),
    pvPage({
      path: '/suivi/rus/',
      title: 'Responsable Unique de Sécurité',
      highlight: '(RUS externalisé)',
      eyebrow: 'Suivi · Groupements d’ERP',
      parentLabel: 'Suivi',
      parentLink: '/suivi/',
      image: '/images/photos/preveris-accessibilite-erp.jpg',
      intro: 'Plus de 50 groupements et centres commerciaux suivis en France. PRÉVÉRIS assume la mission réglementaire de RUS avec neutralité, expertise d’officiers préventionnistes et pérennité.',
      cardsTitle: 'Missions réglementaires',
      cardsHighlight: 'du RUS.',
      cards: [
        { icon: 'shieldCheck', title: 'Commissions & registre unique', text: 'Accueil de la commission de sécurité, ouverture et mise à jour du registre (art. R 143-44 CCH) et rédaction du SOGS.', tags: ['R 143-44 CCH'] },
        { icon: 'file-text', title: 'Visa des dossiers preneurs', text: 'Examen et visa des dossiers d’AT/PC des cellules, suivi des RVRAT et transmission au maire.', tags: ['Cellules'] },
        { icon: 'check-circle', title: 'Contrôles & vérifications', text: 'Vérification des contrats de maintenance, permanence SSIAP, exercices d’évacuation et levée des prescriptions.', tags: ['Terrain'] },
      ],
    }),
    pvPage({
      path: '/suivi/hotel/',
      title: 'Suivi sécurité incendie',
      highlight: 'des hôtels (type O)',
      eyebrow: 'Suivi · Locaux à sommeil',
      parentLabel: 'Suivi',
      parentLink: '/suivi/',
      image: '/images/photos/preveris-suivi-hotel.jpg',
      intro: '« Dormez sur vos deux oreilles » : PRÉVÉRIS veille sur la conformité de vos hôtels face aux risques d’incendie et de fermeture administrative (visites périodiques tous les 3 ou 5 ans et visites inopinées).',
      cardsTitle: 'Nos missions',
      cardsHighlight: 'auprès des hôteliers.',
      cards: [
        { icon: 'calendar', title: 'Visites annuelles sur site', text: 'Inspection complète de chaque hôtel par un préventionniste et remise d’un rapport d’audit détaillé.', tags: ['Type O'] },
        { icon: 'clipboard', title: 'Suivi externalisé de la maintenance', text: 'Tenue administrative du registre de sécurité, suivi du système de détection incendie et des vérifications périodiques.', tags: ['SDI / Alarme'] },
        { icon: 'shield', title: 'Soutien en commission', text: 'Préparation du passage de la commission de sécurité et présence à vos côtés le jour de la visite.', tags: ['Sérénité'] },
      ],
    }),
    pvPage({
      path: '/assistance/',
      title: 'Assistance & audits',
      highlight: 'réglementaires ERP',
      eyebrow: 'Assistance',
      image: '/images/photos/preveris-accessibilite-erp.jpg',
      intro: 'Audit d’accessibilité, rédaction de documents obligatoires, missions ponctuelles et consultations d’experts en visioconférence.',
      cardsTitle: 'Nos prestations',
      cardsHighlight: 'd’assistance.',
      cards: [
        { icon: 'check-circle', title: 'Audit accessibilité', text: 'Diagnostic complet de conformité PMR et demandes de dérogations motivées.', link: '/assistance/audit-accessibilite/', linkLabel: 'Découvrir' },
        { icon: 'file-text', title: 'Documents administratifs', text: 'GE5, procédure GN8, SOGS, plans d’évacuation/intervention, registre et main courante SSI.', link: '/assistance/documents/', linkLabel: 'Découvrir' },
        { icon: 'zap', title: 'Missions ponctuelles & Conseil', text: 'Assistance en commission, étude de désenfumage, AMO et visio-conseil dès 100 € TTC.', link: '/assistance/missions-ponctuelles/', linkLabel: 'Découvrir' },
      ],
    }),
    pvPage({
      path: '/assistance/audit-accessibilite/',
      title: 'Audit accessibilité',
      highlight: 'rendre vos ERP accessibles',
      eyebrow: 'Assistance · Accessibilité PMR',
      parentLabel: 'Assistance',
      parentLink: '/assistance/',
      image: '/images/photos/preveris-accessibilite-erp.jpg',
      intro: 'Rendre les ERP accessibles est une obligation légale (jusqu’à 45 000 € d’amende) qui couvre tous les types de handicap, visibles ou invisibles. PRÉVÉRIS réalise votre diagnostic et instruit vos demandes de dérogation.',
      cardsTitle: 'Les + de PRÉVÉRIS',
      cardsHighlight: 'en accessibilité.',
      cards: [
        { icon: 'search', title: 'Diagnostic complet sur site', text: 'Cheminements extérieurs, stationnement, accès, circulations, sanitaires et équipements analysés point par point.', tags: ['Loi 2005'] },
        { icon: 'file-check', title: 'Dérogations argumentées', text: 'Dossiers de dérogation pour impossibilité technique, disproportion manifeste ou préservation du patrimoine.', tags: ['CCDSA'] },
        { icon: 'users', title: 'Approche globale & coûts maîtrisés', text: 'Prise en compte simultanée de la sécurité incendie et du code du travail, avec présence en commission.', tags: ['Économie'] },
      ],
    }),
    pvPage({
      path: '/assistance/documents/',
      title: 'Documents administratifs',
      highlight: 'obligatoires en ERP',
      eyebrow: 'Assistance · Conformité documentaire',
      parentLabel: 'Assistance',
      parentLink: '/assistance/',
      image: '/images/photos/preveris-etudes-plans.jpg',
      intro: 'Affichage GE5, procédure d’évacuation GN8, SOGS, plans d’évacuation et d’intervention, registre de sécurité et main courante SSI : nous rédigeons vos documents réglementaires sur mesure.',
      cardsTitle: 'Documents réalisés',
      cardsHighlight: 'par nos experts.',
      cards: [
        { icon: 'file-text', title: 'Procédure GN8 & SOGS', text: 'Organisation de l’évacuation des personnes en situation de handicap (GN8) et Schéma d’Organisation Globale de la Sécurité (art. M 31).', tags: ['GN8 · SOGS'] },
        { icon: 'map', title: 'Plans d’évacuation & d’intervention', text: 'Plans réglementaires pour les occupants et plans d’intervention détaillant zones à risques et coupures pour les secours.', tags: ['Plans'] },
        { icon: 'book', title: 'Registre & main courante SSI', text: 'Classeur registre de sécurité personnalisé, affichage GE5 d’entrée et main courante annuelle SSI (catégories A et B).', tags: ['Registres'] },
      ],
    }),
    pvPage({
      path: '/assistance/missions-ponctuelles/',
      title: 'Missions ponctuelles',
      highlight: 'études, audits & commissions',
      eyebrow: 'Assistance · Interventions ciblées',
      parentLabel: 'Assistance',
      parentLink: '/assistance/',
      image: '/images/photos/preveris-ssi-incendie.jpg',
      intro: 'Nos préventionnistes accompagnent les exploitants avant, pendant et après la visite de la commission de sécurité, ou sur des problématiques techniques ciblées.',
      cardsTitle: 'Interventions',
      cardsHighlight: 'à la carte.',
      cards: [
        { icon: 'shield', title: 'Assistance commission de sécurité', text: 'Audit préalable, recommandations et présence aux côtés du chef d’établissement lors des visites d’ouverture, périodiques ou inopinées.', tags: ['Visite'] },
        { icon: 'wind', title: 'Étude de désenfumage (IT 246)', text: 'Dimensionnement au plus juste des extracteurs de fumées et amenées d’air par nos préventionnistes spécialisés.', tags: ['Désenfumage'] },
        { icon: 'compass', title: 'Audit avant acquisition & AMO', text: 'Rapport d’écarts réglementaires avant bail ou rachat, suivi de chantier et interface avec le bureau de contrôle.', tags: ['AMO'] },
      ],
    }),
    pvPage({
      path: '/assistance/conseil-erp/',
      title: 'Conseil en réglementation ERP',
      highlight: 'en visioconférence',
      eyebrow: 'Assistance · Visio expert',
      parentLabel: 'Assistance',
      parentLink: '/assistance/',
      image: '/images/photos/preveris-hero-erp.jpg',
      intro: 'Réponses claires et rapides : un préventionniste expert vous reçoit en visio pour analyser votre cas précis, lever un avis défavorable ou valider la faisabilité d’un projet. Montant déduit si vous nous confiez la mission.',
      cardsTitle: 'Trois formats',
      cardsHighlight: 'réservables en ligne.',
      cards: [
        { icon: 'clock', title: '30 min — 100 € TTC', text: 'Traitement d’un avis défavorable, lecture de prescriptions ou question réglementaire ciblée.', tags: ['Avis défavorable'] },
        { icon: 'message-circle', title: '45 min — 180 € TTC', text: 'Consultation générale ERP : ouverture d’un commerce, classement, obligations incendie et accessibilité.', tags: ['Faisabilité'] },
        { icon: 'shieldCheck', title: '1h30 — 360 € TTC', text: 'Préparation approfondie à une commission de sécurité ou analyse d’une mise en demeure.', tags: ['Commission'] },
      ],
    }),
    pvPage({
      path: '/collectivites/',
      title: 'Services aux collectivités',
      highlight: '« Vous décidez, nous éclairons »',
      eyebrow: 'Collectivités · 31 communes accompagnées',
      image: '/images/photos/preveris-collectivites.jpg',
      intro: 'Service externalisé d’expertise réglementaire pour mairies et EPCI : instruction des AT ERP de 5e catégorie sous 30 jours (complétude 48 h), appui ADS, secrétariat de commissions CCSA, audits du patrimoine, PPMS et PCS.',
      cardsTitle: 'Quatre piliers',
      cardsHighlight: 'pour vos services.',
      cards: [
        { icon: 'file-check', title: 'Instruction AT ERP 5e catégorie', text: 'Près de 1 000 dossiers instruits. Rapport motivé par volet (sécurité incendie & accessibilité) sous 30 jours, sans engagement de volume.', tags: ['Complétude 48 h'] },
        { icon: 'users', title: 'Appui ADS & Commissions CCSA', text: 'Expert ERP aux côtés de vos instructeurs, secrétariat complet des commissions communales et visites préparatoires.', tags: ['Mairies & EPCI'] },
        { icon: 'building', title: 'Patrimoine, AMO, PPMS & PCS', text: 'Audit et régularisation des ERP communaux, AMO préventionniste, Plan Communal de Sauvegarde et formation des agents.', tags: ['Patrimoine public'] },
      ],
      stepsTitle: 'Instruction d’un dossier AT 5e catégorie',
      steps: [
        { num: '01', title: 'Réception & complétude (48 h)', text: 'Vérification des pièces obligatoires sous 48 h ouvrées et qualification réglementaire.' },
        { num: '02', title: 'Analyse incendie & accessibilité', text: 'Instruction technique indépendante par des préventionnistes issus des commissions de sécurité.' },
        { num: '03', title: 'Rapport motivé & décision du Maire', text: 'Remise d’un rapport opposable avec avis proposé et prescriptions ; la collectivité reste seule décisionnaire.' },
      ],
      faq: [
        { question: 'Faut-il passer un marché public formalisé ?', answer: '<p>Les prestations sont facturées au forfait par dossier via une convention-cadre de 3 ans et des bons de commande Chorus Pro, sans abonnement ni engagement de volume.</p>' },
        { question: 'Qui signe l’autorisation ou l’arrêté ?', answer: '<p>Toujours l’autorité compétente (le Maire). PRÉVÉRIS éclaire la décision par un rapport motivé mais ne se substitue jamais à la collectivité.</p>' },
        { question: 'Quelles collectivités nous font confiance ?', answer: '<p>31 collectivités dont Meaux, Bondy, Sèvres, Conflans-Sainte-Honorine, Montereau-Fault-Yonne, Romainville, Serris, ainsi que des institutions publiques et culturelles de premier plan.</p>' },
      ],
    }),
    pvPage({
      path: '/blog/',
      title: 'Ressources & guides',
      highlight: 'sécurité incendie et ERP',
      eyebrow: 'Blog PRÉVÉRIS',
      image: '/images/photos/preveris-etudes-plans.jpg',
      intro: 'Décryptages réglementaires, retours d’expérience et guides pratiques rédigés par nos préventionnistes pour les exploitants d’ERP et les collectivités.',
      cardsTitle: 'Guides essentiels',
      cardsHighlight: 'à consulter.',
      cards: [
        { icon: 'alert-triangle', title: 'Avis défavorable de la commission : que faire ?', text: 'Comprendre les prescriptions, organiser la levée des réserves et éviter la fermeture administrative.', tags: ['Commission'], link: '/assistance/conseil-erp/', linkLabel: 'Consulter un expert' },
        { icon: 'wind', title: 'Comprendre le désenfumage dans un ERP', text: 'Naturel ou mécanique, IT 246, seuils d’obligation et erreurs de dimensionnement à éviter.', tags: ['Technique'], link: '/assistance/missions-ponctuelles/', linkLabel: 'Étude désenfumage' },
        { icon: 'file-check', title: 'Autorisation de travaux ERP : guide complet', text: 'Procédure, délais d’instruction, pièces obligatoires et différences entre 1er et 2e groupe.', tags: ['Dossier AT'], link: '/etudes/autorisation-travaux/', linkLabel: 'Monter mon dossier' },
        { icon: 'building', title: 'ADS mutualisé & instruction AT 5e catégorie', text: 'Comment sécuriser l’instruction des dossiers ERP des communes membres sans alourdir les équipes.', tags: ['Collectivités'], link: '/collectivites/', linkLabel: 'Offre collectivités' },
        { icon: 'check-circle', title: 'Obligations d’accessibilité ERP & EAS', text: 'Normes PMR, espaces d’attente sécurisés (EAS), attestations et cas de dérogation.', tags: ['Accessibilité'], link: '/assistance/audit-accessibilite/', linkLabel: 'Audit PMR' },
        { icon: 'shield', title: 'Externaliser la mission de RUS', text: 'Responsabilités en centre commercial et groupement d’ERP, registre unique et SOGS.', tags: ['RUS'], link: '/suivi/rus/', linkLabel: 'Mission RUS' },
      ],
    }),
  ];

  return {
    version: 1,
    themeId: 'hamdiayari.preveris',
    savedAt: new Date().toISOString(),
    home: {
      title: 'Accueil',
      blocks: homeBlocks,
      seo: {
        seoTitle: 'PRÉVÉRIS — Bureau d’études sécurité incendie et accessibilité ERP',
        metaDescription:
          'Bureau d’études spécialisé sécurité incendie et accessibilité des ERP. Autorisation de travaux, SSI, RUS, suivi annuel et appui aux collectivités.',
        ogTitle: 'PRÉVÉRIS — Sécurité incendie & accessibilité ERP',
        ogDescription: 'Garantir l’ouverture de votre ERP dans un temps et un budget maîtrisés.',
      },
    },
    pages,
    menus: classicMenus({
      primary: [
        {
          id: 'm-etudes',
          label: 'Études',
          path: '/etudes/',
          children: [
            { id: 'm-at', label: 'Autorisation de travaux', path: '/etudes/autorisation-travaux/' },
            { id: 'm-pc', label: 'Permis de construire', path: '/etudes/permis-construire/' },
            { id: 'm-ssi', label: 'Coordination SSI', path: '/etudes/coordination-ssi/' },
          ],
        },
        {
          id: 'm-suivi',
          label: 'Suivi',
          path: '/suivi/',
          children: [
            { id: 'm-annuel', label: 'Suivi annuel', path: '/suivi/annuel/' },
            { id: 'm-rus', label: 'Responsable Unique de Sécurité', path: '/suivi/rus/' },
            { id: 'm-hotel', label: 'Suivi hôtel', path: '/suivi/hotel/' },
          ],
        },
        {
          id: 'm-assist',
          label: 'Assistance',
          path: '/assistance/',
          children: [
            { id: 'm-audit', label: 'Audit accessibilité', path: '/assistance/audit-accessibilite/' },
            { id: 'm-docs', label: 'Documents administratifs', path: '/assistance/documents/' },
            { id: 'm-ponct', label: 'Missions ponctuelles', path: '/assistance/missions-ponctuelles/' },
            { id: 'm-conseil', label: 'Conseil ERP', path: '/assistance/conseil-erp/' },
          ],
        },
        { id: 'm-coll', label: 'Collectivités', path: '/collectivites/' },
        { id: 'm-blog', label: 'Blog', path: '/blog/' },
        { id: 'm-contact', label: 'Contact', path: '/contact/', highlight: true },
      ],
      footer: [
        { id: 'f-etudes', label: 'Études', path: '/etudes/' },
        { id: 'f-suivi', label: 'Suivi', path: '/suivi/' },
        { id: 'f-assist', label: 'Assistance', path: '/assistance/' },
        { id: 'f-coll', label: 'Collectivités', path: '/collectivites/' },
        { id: 'f-blog', label: 'Blog', path: '/blog/' },
        { id: 'f-contact', label: 'Contact', path: '/contact/', highlight: true },
        { id: 'f-legal', label: 'Mentions légales', path: '/mentions-legales/' },
        { id: 'f-privacy', label: 'Confidentialité', path: '/politique-de-confidentialite/' },
        { id: 'f-cookies', label: 'Cookies', path: '/cookies/' },
      ],
    }),
    branding: {
      siteName: 'PRÉVÉRIS',
      tagline: 'Sécurité incendie & accessibilité ERP',
      colors: {
        primary: '#E85D04',
        primaryHover: '#C2410C',
        accent: '#F48C06',
        navy: '#0A101D',
        background: '#F8F9FC',
        text: '#0A101D',
        muted: '#556078',
        border: '#E2E6F0',
      },
      fonts: {
        heading: 'Poppins',
        body: 'Poppins',
      },
    },
  };
}

async function defaultPackFor(themeId: string): Promise<ThemeContentPack | null> {
  if (themeId === 'novalabs.mahdia') return buildMahdiaPack();
  if (themeId === 'novalabs.dogga') return buildDoggaPack();
  if (themeId === 'novalabs.sidibou') return loadSidibouDefault();
  if (themeId === 'hamdiayari.preveris') return buildPreverisPack();
  return null;
}

/** Installe les packs par défaut s’ils n’existent pas encore. */
export async function ensureDefaultThemePacks(): Promise<void> {
  for (const id of ['novalabs.sidibou', 'novalabs.dogga', 'novalabs.mahdia', 'hamdiayari.preveris'] as const) {
    const existing = await readThemePack(id);
    if (existing) continue;
    const pack = await defaultPackFor(id);
    if (pack) {
      await writeThemePack(pack);
      console.log(`[themes] pack contenu par défaut : ${id}`);
    }
  }
}

/**
 * Avant d’activer `nextId` : sauvegarde le contenu du thème courant,
 * puis restaure le pack du thème cible.
 */
export async function switchThemeContent(previousThemeId: string | null, nextThemeId: string): Promise<void> {
  await ensureDefaultThemePacks();
  if (previousThemeId && previousThemeId !== nextThemeId) {
    try {
      await captureLiveThemeContent(previousThemeId);
      console.log(`[themes] contenu sauvegardé pour ${previousThemeId}`);
    } catch (e) {
      console.error(`[themes] sauvegarde contenu ${previousThemeId} impossible`, e);
    }
  }
  const pack = (await readThemePack(nextThemeId)) || (await defaultPackFor(nextThemeId));
  if (!pack) {
    console.warn(`[themes] pas de pack contenu pour ${nextThemeId} — contenu laissé tel quel`);
    return;
  }
  if (!(await readThemePack(nextThemeId))) await writeThemePack(pack);
  await applyThemePack(pack);
  console.log(`[themes] contenu restauré pour ${nextThemeId} (${pack.home.blocks.length} blocs)`);
}
