/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import {
  BarChart3,
  FileText,
  Globe2,
  Image,
  Inbox,
  LayoutDashboard,
  Mail,
  Menu,
  MousePointerClick,
  Newspaper,
  LayoutTemplate,
  Paintbrush,
  Palette,
  Puzzle,
  Search,
  Settings,
  ShieldAlert,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '../../../server/cms/permissions';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Au moins une de ces permissions ; absent = toute personne connectée. */
  perms?: Permission[];
  keywords?: string;
}

export const NAV: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, keywords: 'accueil dashboard' },
      { to: '/analytics', label: 'Statistiques', icon: BarChart3, perms: ['analytics.view'], keywords: 'visites audience pays trafic' },
    ],
  },
  {
    title: 'Éditorial',
    items: [
      { to: '/pages', label: 'Pages', icon: FileText, keywords: 'contenu hero éditeur' },
      { to: '/posts', label: 'Articles', icon: Newspaper, keywords: 'blog actualités' },
      { to: '/media', label: 'Médiathèque', icon: Image, keywords: 'images vidéos fichiers upload' },
      { to: '/menus', label: 'Menus', icon: Menu, perms: ['menus.edit'], keywords: 'navigation mobile footer' },
      { to: '/widgets', label: 'Widgets', icon: LayoutTemplate, perms: ['widgets.edit'], keywords: 'sidebar footer zones apparence' },
    ],
  },
  {
    title: 'Contacts',
    items: [
      { to: '/forms', label: 'Formulaires', icon: Inbox, perms: ['forms.view', 'forms.manage'], keywords: 'messages demandes contact' },
      { to: '/newsletter', label: 'Newsletter', icon: Mail, perms: ['newsletter.manage'], keywords: 'abonnés inscrits' },
      { to: '/engagement', label: 'Boutons flottants', icon: MousePointerClick, perms: ['engagement.edit'], keywords: 'cta flottant mobile appeler' },
    ],
  },
  {
    title: 'Apparence',
    items: [
      { to: '/themes', label: 'Thèmes', icon: LayoutTemplate, perms: ['appearance.themes', 'appearance.customize'], keywords: 'thème apparence design sidibou installer marketplace' },
      { to: '/themes/customize', label: 'Personnaliser', icon: Paintbrush, perms: ['appearance.customize'], keywords: 'options thème en-tête boutons animations customizer' },
      { to: '/branding', label: 'Identité visuelle', icon: Palette, perms: ['appearance.customize'], keywords: 'logo couleurs polices favicon' },
    ],
  },
  {
    title: 'Modules',
    items: [
      { to: '/marketplace', label: 'Marketplace', icon: Store, perms: ['modules.manage', 'appearance.themes'], keywords: 'modules extensions installer télécharger plugins' },
      { to: '/modules', label: 'Modules installés', icon: Puzzle, perms: ['modules.manage', 'modules.settings'], keywords: 'modules extensions licence whatsapp assistant ia chat' },
    ],
  },
  {
    title: 'Référencement',
    items: [{ to: '/seo', label: 'SEO', icon: Search, perms: ['seo.edit'], keywords: 'google search console redirections sitemap robots yoast' }],
  },
  {
    title: 'Site',
    items: [
      { to: '/general', label: 'Informations', icon: Globe2, perms: ['site.general'], keywords: 'téléphone adresse email société' },
      { to: '/maintenance', label: 'Maintenance', icon: ShieldAlert, perms: ['site.maintenance', 'settings.manage'], keywords: 'mode maintenance hors ligne' },
      { to: '/settings', label: 'Paramètres', icon: Settings, perms: ['settings.manage'], keywords: 'cookies url analytics smtp e-mail sécurité limites quotas rétention 2fa' },
      { to: '/users', label: 'Utilisateurs', icon: Users, perms: ['users.view', 'audit.view'], keywords: 'comptes rôles accès permissions invitations journal activité' },
    ],
  },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);
