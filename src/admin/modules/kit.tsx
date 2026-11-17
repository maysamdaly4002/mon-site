/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Composants et outils de l'administration prêtés aux pages d'administration des modules
 * (`@snapify/sdk/admin`) : un module garde ainsi l'apparence et le comportement du back-office.
 */
import React, { createContext, useContext } from 'react';
import { toast } from 'sonner';
import { RichTextEditor } from '../editor/RichTextEditor';
import { downloadCsv, fmtDate, fmtDateTime, fmtNumber, slugify, timeAgo } from '../lib/format';
import { errorMessage, useAsync, useDebounced } from '../lib/hooks';
import { Drawer as BaseDrawer, Dropdown, DropdownItem, Modal as BaseModal, useConfirm } from '../ui/overlays';
import { ImageField, MediaPicker } from '../ui/media';
import { Pagination, usePagination, usePaging } from '../ui/Pagination';
import {
  Alert,
  Badge,
  Button,
  Card,
  cx,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  PageSkeleton,
  Section,
  Segmented,
  Select,
  Skeleton,
  Spinner,
  StatCard,
  Switch,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
} from '../ui/primitives';
import { TagInput } from '../ui/TagInput';

/** Identifiant du module dont la page est affichée : les fenêtres (rendues hors de la page) gardent ses styles. */
export const AdminScopeContext = createContext<string>('');

function Scoped({ children }: { children: React.ReactNode }) {
  const id = useContext(AdminScopeContext);
  return (
    <div data-snapify-scope={id} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}

function Modal(props: React.ComponentProps<typeof BaseModal>) {
  return <BaseModal {...props} footer={props.footer ? <Scoped>{props.footer}</Scoped> : undefined}><Scoped>{props.children}</Scoped></BaseModal>;
}

function Drawer(props: React.ComponentProps<typeof BaseDrawer>) {
  return <BaseDrawer {...props} footer={props.footer ? <Scoped>{props.footer}</Scoped> : undefined}><Scoped>{props.children}</Scoped></BaseDrawer>;
}

type ToastMessage = string | React.ReactNode;
type ToastOptions = { description?: React.ReactNode; duration?: number };

/** Notifications prêtées aux modules : partie stable de l'API de `sonner`, sans dépendre de ses types. */
export interface AdminToast {
  (message: ToastMessage, options?: ToastOptions): string | number;
  success: (message: ToastMessage, options?: ToastOptions) => string | number;
  error: (message: ToastMessage, options?: ToastOptions) => string | number;
  info: (message: ToastMessage, options?: ToastOptions) => string | number;
  warning: (message: ToastMessage, options?: ToastOptions) => string | number;
  dismiss: (id?: string | number) => string | number;
}

export const ADMIN_KIT = {
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
  toast: toast as AdminToast,
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
};

export type AdminKit = typeof ADMIN_KIT;
