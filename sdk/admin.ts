/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Pages d'administration des modules (`entries.admin`, importé via `@snapify/sdk/admin`).
 * Les composants du back-office (boutons, tableaux, fenêtres, médiathèque…) sont prêtés par
 * l'administration à l'exécution : une page de module a la même apparence que le reste du back-office.
 */
import type { ComponentType } from 'react';
import type { AdminKit } from '../src/admin/modules/kit';

export interface AdminApi {
  get: <T = unknown>(path: string) => Promise<T>;
  post: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  put: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  delete: <T = unknown>(path: string) => Promise<T>;
}

export interface AdminPageProps<S = Record<string, unknown>> {
  /** Identifiant de la page déclarée dans `adminPages`. */
  page: string;
  /** Suite de l'adresse après la page, ex. `/123` pour /administrator/m/<module>/<page>/123. */
  subpath: string;
  /** Navigue dans la page du module (`navigate('/123')`) ou vers une autre page (`navigate('/m/<id>/<page>')` avec `absolute`). */
  navigate: (subpath: string, opts?: { absolute?: boolean }) => void;
  /** Routes d'administration du module (/api/admin/modules/<id>/api/…). */
  api: AdminApi;
  module: { id: string; version: string };
  /** Réglages complets du module. */
  settings: S;
  user: { id: string; name: string; email: string };
  /** L'utilisateur peut-il modifier les réglages du module ? */
  canConfigure: boolean;
}

export interface AdminModule<S = Record<string, unknown>> {
  pages: Record<string, ComponentType<AdminPageProps<S>>>;
}

export function defineAdminModule<S = Record<string, unknown>>(mod: AdminModule<S>): AdminModule<S> {
  return mod;
}

const kit = (globalThis as { __SNAPIFY_ADMIN__?: AdminKit }).__SNAPIFY_ADMIN__ ?? ({} as AdminKit);

export const {
  Alert,
  Badge,
  Button,
  Card,
  cx,
  Drawer,
  Dropdown,
  DropdownItem,
  EmptyState,
  ErrorState,
  Field,
  ImageField,
  Input,
  MediaPicker,
  Modal,
  PageHeader,
  PageSkeleton,
  Pagination,
  RichTextEditor,
  Section,
  Segmented,
  Select,
  Skeleton,
  Spinner,
  StatCard,
  Switch,
  Table,
  Tabs,
  TagInput,
  Td,
  Textarea,
  Th,
  toast,
  useAsync,
  useConfirm,
  useDebounced,
  usePagination,
  usePaging,
  errorMessage,
  fmtDate,
  fmtDateTime,
  fmtNumber,
  timeAgo,
  slugify,
  downloadCsv,
} = kit;
