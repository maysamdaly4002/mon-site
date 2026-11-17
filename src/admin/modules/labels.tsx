/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Bot,
  Calendar,
  Cookie,
  CreditCard,
  Database,
  FolderTree,
  Globe2,
  Heart,
  KeyRound,
  LayoutDashboard,
  Mail,
  MessageCircle,
  MessagesSquare,
  Package,
  Phone,
  Puzzle,
  Receipt,
  Route,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Ticket,
  Truck,
  UserRound,
  Users,
  Image as ImageIcon,
  type LucideIcon,
} from 'lucide-react';
import type { InstalledModuleInfo, ModuleStatusCode } from '../../../server/modules/types';
import { api } from '../lib/api';
import { Badge, cx } from '../ui/primitives';

const ICONS: Record<string, LucideIcon> = {
  bot: Bot,
  calendar: Calendar,
  'chart-bar': BarChart3,
  database: Database,
  globe: Globe2,
  mail: Mail,
  'message-circle': MessageCircle,
  'messages-square': MessagesSquare,
  phone: Phone,
  search: Search,
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  sparkles: Sparkles,
  store: Store,
  package: Package,
  receipt: Receipt,
  users: Users,
  user: UserRound,
  ticket: Ticket,
  tag: Tag,
  folder: FolderTree,
  truck: Truck,
  'credit-card': CreditCard,
  heart: Heart,
  'shield-check': ShieldCheck,
};

export const moduleIcon = (name?: string): LucideIcon => (name && ICONS[name]) || Puzzle;

export function ModuleIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = moduleIcon(name);
  return (
    <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100', className)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

/** Libellé lisible d'une permission, avec son icône. */
export function describePermission(p: string): { icon: LucideIcon; label: string } {
  if (p === 'site:read') return { icon: Globe2, label: 'Lire les informations publiques du site (nom, coordonnées, couleurs)' };
  if (p === 'storage') return { icon: Database, label: 'Enregistrer ses propres données dans la base du site' };
  if (p === 'http:routes') return { icon: Route, label: 'Exposer des points d’API publics sous /api/modules/' };
  if (p === 'database') return { icon: Database, label: 'Gérer ses propres collections de données (produits, commandes…)' };
  if (p === 'files') return { icon: ImageIcon, label: 'Enregistrer des images publiques (photos de profil…) dans /uploads/modules/' };
  if (p === 'http:cookies') return { icon: Cookie, label: 'Déposer des cookies de session pour les visiteurs (préfixe sm_)' };
  if (p === 'admin:routes') return { icon: LayoutDashboard, label: 'Ajouter des pages et des actions à l’administration' };
  if (p === 'mail:send') return { icon: Mail, label: 'Envoyer des e-mails via le serveur SMTP du site' };
  if (p.startsWith('env:')) return { icon: KeyRound, label: `Lire la variable serveur ${p.slice(4)}` };
  if (p.startsWith('net:')) return { icon: Globe2, label: `Envoyer des requêtes HTTPS vers ${p.slice(4)}` };
  return { icon: Puzzle, label: p };
}

const STATUS_TONE: Record<ModuleStatusCode, 'success' | 'neutral' | 'warning' | 'danger'> = {
  active: 'success',
  disabled: 'neutral',
  unsigned: 'danger',
  incompatible: 'danger',
  tampered: 'danger',
  license_missing: 'warning',
  license_invalid: 'danger',
  license_expired: 'warning',
  license_domain: 'warning',
  dependency: 'warning',
  error: 'danger',
};

const STATUS_LABEL: Record<ModuleStatusCode, string> = {
  active: 'Actif',
  disabled: 'Désactivé',
  unsigned: 'Signature invalide',
  incompatible: 'Incompatible',
  tampered: 'Fichiers altérés',
  license_missing: 'Licence requise',
  license_invalid: 'Licence invalide',
  license_expired: 'Licence expirée',
  license_domain: 'Domaine non couvert',
  dependency: 'Module requis',
  error: 'Erreur',
};

export function ModuleStatusBadge({ code }: { code: ModuleStatusCode }) {
  return (
    <Badge tone={STATUS_TONE[code]} dot>
      {STATUS_LABEL[code]}
    </Badge>
  );
}

export const PRICING_LABEL = { free: 'Gratuit', paid: 'Payant' } as const;

/* ------------------------------------------------------------------ */
/* Liste partagée des modules installés (menu latéral, pages)          */
/* ------------------------------------------------------------------ */

const CHANGED = 'snapify:modules-changed';
let cache: InstalledModuleInfo[] | null = null;

export const notifyModulesChanged = () => window.dispatchEvent(new Event(CHANGED));

export function useInstalledModules(): InstalledModuleInfo[] {
  const [list, setList] = useState<InstalledModuleInfo[]>(cache ?? []);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api.modules
        .list()
        .then((r) => {
          cache = r.modules;
          if (alive) setList(r.modules);
        })
        .catch(() => undefined);
    void load();
    window.addEventListener(CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(CHANGED, load);
    };
  }, []);
  return list;
}

export interface ModuleNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  moduleId: string;
  pageId: string;
}

/** Libellés sidebar distincts des titres CMS (évite deux « Contenu » / « Contact »). */
const MODULE_NAV_TITLE: Record<string, string> = {
  Contenu: 'Applications',
  Contact: 'Messagerie',
  Contacts: 'Messagerie',
};

/** Pages d'administration des modules actifs, regroupées par catégorie de module (ex. « E-commerce »). */
export function useModuleNav(enabled: boolean): { title: string; items: ModuleNavItem[] }[] {
  const installed = useInstalledModules();
  if (!enabled) return [];
  const groups = new Map<string, ModuleNavItem[]>();
  for (const m of installed) {
    if (!m.admin || !m.adminPages.length) continue;
    const raw = m.category || 'Modules';
    const title = MODULE_NAV_TITLE[raw] || raw;
    const list = groups.get(title) ?? [];
    for (const p of m.adminPages) list.push({ to: `/m/${m.id}/${p.id}`, label: p.label, icon: moduleIcon(p.icon ?? m.icon), moduleId: m.id, pageId: p.id });
    groups.set(title, list);
  }
  return [...groups].map(([title, items]) => ({ title, items }));
}

export function PermissionList({ permissions, hasServer }: { permissions: string[]; hasServer?: boolean }) {
  if (!permissions.length) {
    return <p className="text-sm text-slate-500">Aucune permission particulière : le module s’affiche uniquement sur le site{hasServer ? ' et exécute du code serveur sans accès externe' : ''}.</p>;
  }
  return (
    <ul className="space-y-2">
      {permissions.map((p) => {
        const { icon: Icon, label } = describePermission(p);
        return (
          <li key={p} className="flex items-start gap-2.5 text-sm text-slate-700">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
}
