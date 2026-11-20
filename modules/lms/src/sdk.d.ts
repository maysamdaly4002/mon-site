// Le SDK Snapify n'est pas installé dans ce dépôt : déclarations MINIMALES, recopiées du contrat réel (sdk/index.ts du CMS),
// pour que `npm run typecheck` vérifie notre code hors du CMS. Les vrais types viennent de @snapify/sdk dans le projet hôte.
declare module '@snapify/sdk' {
  import type { ReactNode } from 'react';
  export type ComponentType<P = any> = (props: P) => any;
  export interface ModuleRequest {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; params: Record<string, string>; query: Record<string, string>; body: unknown;
    ip: string; userAgent: string; cookies: Record<string, string>; admin?: { id: string; email: string; name: string };
  }
  export type ModuleRouteHandler = (req: ModuleRequest) => unknown | Promise<unknown>;
  export interface StoredRecord<T> { id: string; createdAt: string; updatedAt: string }
  export interface ServerContext<S = Record<string, unknown>> {
    module: { id: string; version: string };
    settings: () => S;
    log: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void };
    http: { get(path: string, h: ModuleRouteHandler): void; post(path: string, h: ModuleRouteHandler): void };
    db: { collection: <T = Record<string, unknown>>(name: string) => any };
    lock: <T>(key: string, fn: () => Promise<T>) => Promise<T>;
    use: <T = Record<string, unknown>>(moduleId: string) => T | null;
    error: (status: number, message: string) => Error;
    admin: { status(p: () => unknown): void; get(path: string, h: ModuleRouteHandler): void; post(path: string, h: ModuleRouteHandler): void };
  }
  export function defineServerModule<S = Record<string, unknown>>(mod: { activate: (ctx: ServerContext<S>) => void | (() => void) | Promise<void | (() => void)> }): unknown;

  export interface ModuleApi { get: <T = unknown>(path: string) => Promise<T>; post: <T = unknown>(path: string, body?: unknown) => Promise<T> }
  export interface PublicPageProps<S = Record<string, unknown>> {
    settings: S; site: { name: string; email: string; phone: string }; path: string; isPreview: boolean; navigate: (path: string) => void;
    api: ModuleApi; module: { id: string; version: string }; search: string; setMeta: (m: { title?: string; description?: string }) => void;
  }
  export function definePublicModule<S = Record<string, unknown>>(mod: { page?: ComponentType<PublicPageProps<S>> }): unknown;
  export function isModuleActive(id: string): boolean;
  export type { ReactNode };
}
declare module '@snapify/sdk/admin' {
  import type { ComponentType, ReactNode } from 'react';
  export interface AdminPageProps<T = unknown> { module?: { id: string; version: string }; user?: { id: string; name: string; email: string }; api: { get<R>(p: string): Promise<R>; post<R>(p: string, b?: unknown): Promise<R> }; navigate(p: string): void; subpath: string; settings?: T }
  type Kids = { children?: ReactNode; className?: string };
  export const Badge: ComponentType<Kids>;
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

// Lecture des fichiers Excel (.xlsx) pour l'import : même dépendance que le module CRM.
declare module 'read-excel-file' { const readXlsxFile: (file: File | Blob) => Promise<unknown[][]>; export default readXlsxFile; }
