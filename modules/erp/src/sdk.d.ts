// Le SDK Snapify n'est pas installé dans ce dépôt : déclarations MINIMALES pour que `npm run typecheck` vérifie notre code hors du CMS.
// (Les vrais types viennent de @snapify/sdk dans le projet hôte.)
declare module '@snapify/sdk' { export function defineServerModule<T>(def: { activate(ctx: any): void | Promise<void> }): any; }
declare module '@snapify/sdk/admin' {
  import type { ComponentType, ReactNode } from 'react';
  export interface AdminPageProps<T = unknown> { api: { get<R>(p: string): Promise<R>; post<R>(p: string, b?: unknown): Promise<R> }; navigate(p: string): void; subpath: string; settings?: T }
  type Kids = { children?: ReactNode; className?: string };
  export const Button: ComponentType<Kids & { icon?: ComponentType<any>; loading?: boolean; disabled?: boolean; onClick?: () => void }>;
  export const Card: ComponentType<Kids & { padded?: boolean }>;
  export const EmptyState: ComponentType<{ icon?: ComponentType<any>; title: string; description?: string }>;
  export const ErrorState: ComponentType<{ message: string; onRetry?: () => void }>;
  export const Input: ComponentType<Kids & { value?: string; type?: string; max?: string; inputMode?: string; placeholder?: string; onChange?: (e: { target: { value: string } }) => void }>;
  export const PageHeader: ComponentType<{ title: string; description?: string; actions?: ReactNode }>;
  export const PageSkeleton: ComponentType<{}>;
  export const Pagination: ComponentType<{ page: number; pageSize: number; total: number; onPage(n: number): void; onPageSize(n: number): void; noun?: string }>;
  export const Select: ComponentType<Kids & { value: string; onChange(v: string): void; options: { value: string; label: string }[] }>;
  export const StatCard: ComponentType<{ label: string; value: string | number; icon?: ComponentType<any>; tone?: string }>;
  export const Table: ComponentType<Kids>, Td: ComponentType<Kids>, Th: ComponentType<Kids>;
  export function defineAdminModule<T>(def: { pages: Record<string, ComponentType<AdminPageProps<T>>> }): unknown;
  export const errorMessage: (e: unknown) => string, fmtDate: (d: string) => string, fmtDateTime: (d: string) => string;
  export const toast: { success(m: string): void; error(m: string): void };
  export function useAsync<T>(fn: () => Promise<T>, deps?: unknown[]): { data: T | undefined; error: string | null; reload: () => Promise<void> };
  export function useConfirm(): (o: { title: string; message?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  export function usePaging(key: string, o?: { resetKey?: unknown }): { page: number; setPage(n: number): void; pageSize: number; setPageSize(n: number): void };
  export type { ReactNode };
}
