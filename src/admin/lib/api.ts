/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import type {
  BlogPost,
  CmsPage,
  CmsSnapshot,
  ContactFormConfig,
  ContactSubmission,
  MediaAsset,
  MenuItem,
  BlockPattern,
  WidgetArea,
  NewsletterSubscriber,
  RedirectRule,
  SeoMeta,
  SystemSettings,
  UserStatus,
} from '../../../server/cms/types';
import type { Permission, RoleDefinition, RoleTone } from '../../../server/cms/permissions';
import type { SeoAnalysis } from '../../../server/cms/seoAnalyzer';
import type { AnalyticsSummary } from '../../../server/cms/types';
import type { InstalledModuleDetail, InstalledModuleInfo, InstalledThemeDetail, InstalledThemeInfo, MarketplaceListing, StagedPackageInfo } from '../../../server/modules/types';

const TOKEN_KEY = 'snapify_admin_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)),
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>, public code?: string) {
    super(message);
  }
}

/** Routes appelées sans session : un 401 y signifie « identifiants refusés », pas « session expirée ». */
const ANONYMOUS = ['/login', '/login/2fa', '/password/forgot', '/password/token', '/password/reset'];

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api/admin${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Connexion au serveur impossible. Vérifiez votre réseau.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  const anonymous = ANONYMOUS.some((p) => path.split('?')[0] === p);
  if (res.status === 401 && !anonymous && token) {
    tokenStore.set(null);
    window.dispatchEvent(new CustomEvent('admin:session-expired', { detail: data?.error }));
  }
  if (res.status === 403 && (data?.code === 'PASSWORD_CHANGE_REQUIRED' || data?.code === 'TWO_FACTOR_REQUIRED')) {
    window.dispatchEvent(new Event('admin:requirements'));
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || `Erreur ${res.status}`, data?.fields, data?.code);
  return data as T;
}

const get = <T>(p: string) => request<T>(p);
const queryString = (q: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();
const send = <T>(method: string, p: string, body?: unknown) =>
  request<T>(p, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: UserStatus;
  avatarUrl?: string;
  title?: string;
  phone?: string;
  totpEnabled: boolean;
  mustChangePassword: boolean;
  passwordChangedAt?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  loginCount: number;
  invitedBy?: string;
  createdAt?: string;
}
export interface PasswordPolicy {
  passwordMinLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}
export interface MeUser extends PublicUser {
  roleName: string;
  isSuper: boolean;
  permissions: Permission[];
  recoveryCodesLeft: number;
  mustSetup2fa: boolean;
  twoFactorRequired: boolean;
  policy: PasswordPolicy & { idleMinutes: number };
}
export interface UserRow extends PublicUser {
  roleName: string;
  activeSessions: number;
  inviteExpiresAt?: string;
}
export interface RoleRow extends RoleDefinition {
  locked: boolean;
  hasDefault: boolean;
  userCount: number;
}
export interface SessionRow {
  id: string;
  current: boolean;
  device: string;
  userAgent?: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  remember: boolean;
}
export interface AuditEntry {
  id: number;
  ts: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
}
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface MailLogEntry {
  id: number;
  ts: string;
  kind: string;
  toAddr: string;
  subject: string;
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
}
export type SystemView = Omit<SystemSettings, 'smtp'> & { smtp: Omit<SystemSettings['smtp'], 'passwordEnc'> & { hasPassword: boolean } };
export interface SystemMeta {
  clientIp: string;
  smtpSource: 'settings' | 'env' | 'none';
  envSmtp?: boolean;
  ipBypass?: boolean;
  dedicatedSecretKey?: boolean;
}
export interface SystemInfo {
  app: { name: string; version: string; environment: string };
  runtime: { node: string; platform: string; uptimeSec: number; memoryMb: number; cpus: number };
  database: { version: string; sizeBytes: number; analyticsEvents: number; auditEntries: number; mailLog: number; activeSessions: number; revisions: number };
  content: Record<'pages' | 'posts' | 'media' | 'submissions' | 'subscribers' | 'users', number>;
  uploads: { files: number; bytes: number };
}
export interface LinkDelivery {
  url: string;
  expiresAt: string;
  emailSent: boolean;
  emailError?: string;
}
export type LoginResult = { token: string; user: MeUser; expiresAt: string } | { twoFactor: true; challenge: string };
export type { Permission, RoleTone };

export type ClientSnapshot = Omit<CmsSnapshot, 'users' | 'formSubmissions' | 'subscribers' | 'google' | 'system'> & {
  users: PublicUser[];
  google: Omit<CmsSnapshot['google'], 'oauthRefreshToken' | 'oauthClientSecretEnc'> & { hasRefreshToken: boolean };
};
export type PageWithScore = CmsPage & { seoScore: number };
export type PostWithScore = BlogPost & { seoScore: number };
export interface Revision {
  id: string;
  label: string;
  title: string;
  createdAt: string;
  authorEmail?: string;
}
export interface DashboardData {
  /** Les sections absentes (null) ne sont pas couvertes par les droits de l'utilisateur. */
  analytics: AnalyticsSummary | null;
  counts: Record<'pages' | 'publishedPages' | 'posts' | 'draftPosts' | 'media', number> &
    Record<'unreadSubmissions' | 'submissions' | 'subscribers', number | null>;
  seoAverage: number;
  recentSubmissions: ContactSubmission[] | null;
  maintenance: boolean;
  health: { smtp: boolean; gemini: boolean; google: boolean; googleOAuthConfigured: boolean } | null;
}
export interface SeoOverviewRow {
  kind: 'page' | 'post';
  id: string;
  title: string;
  url: string;
  status: string;
  seo: SeoMeta;
  analysis: SeoAnalysis;
}
export interface GoogleStatus {
  configured: boolean;
  /** Origine des identifiants OAuth : administration, fichier .env, ou aucun. */
  source: 'settings' | 'env' | 'none';
  clientId: string;
  connected: boolean;
  accountEmail?: string;
  property?: string;
  lastSyncAt?: string;
  redirectUri: string;
  javascriptOrigin: string;
  publicUrl: string;
  verificationTag: boolean;
}
export interface SearchPerformance {
  range: { start: string; end: string };
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  timeseries: { date: string; clicks: number; impressions: number }[];
  queries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
}

export const api = {
  login: (email: string, password: string, remember: boolean) => send<LoginResult>('POST', '/login', { email, password, remember }),
  login2fa: (challenge: string, code: string) => send<{ token: string; user: MeUser }>('POST', '/login/2fa', { challenge, code }),
  logout: () => send<{ ok: true }>('POST', '/logout'),
  forgotPassword: (email: string) => send<{ ok: true }>('POST', '/password/forgot', { email }),
  passwordToken: (token: string) =>
    get<{ kind: 'invite' | 'reset'; email: string; name: string; expiresAt: string; policy: PasswordPolicy }>(`/password/token?token=${encodeURIComponent(token)}`),
  resetPassword: (token: string, password: string, name?: string) => send<{ ok: true; email: string }>('POST', '/password/reset', { token, password, name }),

  me: () => get<{ user: MeUser }>('/me'),
  updateMe: (body: { name?: string; title?: string; phone?: string; email?: string; currentPassword?: string }) => send<{ user: MeUser }>('PATCH', '/me', body),
  uploadAvatar: (image: { dataBase64: string; mimeType: string }) => send<{ user: MeUser }>('POST', '/me/avatar', image),
  removeAvatar: () => send<{ user: MeUser }>('DELETE', '/me/avatar'),
  changePassword: (current: string, next: string) => send<{ token: string; user: MeUser; closedSessions: number }>('PUT', '/me/password', { current, next }),
  twoFactor: {
    setup: () => send<{ secret: string; otpauthUrl: string; qrDataUrl: string }>('POST', '/me/2fa/setup'),
    enable: (code: string) => send<{ recoveryCodes: string[]; user: MeUser }>('POST', '/me/2fa/enable', { code }),
    disable: (password: string) => send<{ user: MeUser }>('POST', '/me/2fa/disable', { password }),
    recoveryCodes: (password: string) => send<{ recoveryCodes: string[]; user: MeUser }>('POST', '/me/2fa/recovery-codes', { password }),
  },
  mySessions: () => get<SessionRow[]>('/me/sessions'),
  revokeMySession: (id: string) => send('DELETE', `/me/sessions/${id}`),
  revokeOtherSessions: () => send<{ closed: number }>('POST', '/me/sessions/revoke-others'),
  myActivity: (page = 1, pageSize = 25) => get<Paged<AuditEntry>>(`/me/activity?page=${page}&pageSize=${pageSize}`),

  snapshot: () => get<ClientSnapshot>('/snapshot'),
  dashboard: () => get<DashboardData>('/dashboard'),
  saveSection: (section: 'general' | 'branding' | 'settings' | 'newsletter' | 'google' | 'seo-settings', body: unknown) =>
    send<{ ok: true }>('PUT', `/${section}`, body),
  saveFloatingButtons: (buttons: unknown) => send('PUT', '/floating-buttons', { buttons }),
  saveMenu: (id: string, items: MenuItem[], label?: string) => send('PUT', `/menus/${id}`, { items, ...(label !== undefined ? { label } : {}) }),
  createMenu: (id: string, label: string) => send<{ ok: true; id: string }>('POST', '/menus', { id, label }),
  deleteMenu: (id: string) => send('DELETE', `/menus/${id}`),
  saveWidgetAreas: (areas: WidgetArea[]) => send<{ ok: true; areas: WidgetArea[] }>('PUT', '/widget-areas', { areas }),
  saveWidgetArea: (areaId: string, widgets: WidgetArea['widgets']) => send('PUT', `/widget-areas/${areaId}`, { widgets }),
  blockPatterns: () => get<BlockPattern[]>('/block-patterns'),
  saveBlockPatterns: (patterns: BlockPattern[]) => send<{ ok: true; patterns: BlockPattern[] }>('PUT', '/block-patterns', { patterns }),
  createBlockPattern: (body: Pick<BlockPattern, 'name' | 'blocks'> & { id?: string; description?: string }) =>
    send<BlockPattern>('POST', '/block-patterns', body),
  deleteBlockPattern: (id: string) => send('DELETE', `/block-patterns/${id}`),
  saveRedirects: (redirects: RedirectRule[]) => send('PUT', '/redirects', { redirects }),

  pages: () => get<PageWithScore[]>('/pages'),
  createPage: (body: Partial<CmsPage>) => send<CmsPage>('POST', '/pages', body),
  updatePage: (id: string, body: Partial<CmsPage>) => send<PageWithScore>('PUT', `/pages/${id}`, body),
  deletePage: (id: string) => send('DELETE', `/pages/${id}`),
  pageRevisions: (id: string) => get<Revision[]>(`/pages/${id}/revisions`),
  restorePage: (id: string, rev: string) => send<CmsPage>('POST', `/pages/${id}/revisions/${rev}/restore`),

  posts: () => get<PostWithScore[]>('/posts'),
  createPost: (body: Partial<BlogPost>) => send<BlogPost>('POST', '/posts', body),
  updatePost: (id: string, body: Partial<BlogPost>) => send<PostWithScore>('PUT', `/posts/${id}`, body),
  deletePost: (id: string) => send('DELETE', `/posts/${id}`),
  postRevisions: (id: string) => get<Revision[]>(`/posts/${id}/revisions`),
  restorePost: (id: string, rev: string) => send<BlogPost>('POST', `/posts/${id}/revisions/${rev}/restore`),

  modules: {
    list: () => get<{ modules: InstalledModuleInfo[]; devMode: boolean }>('/modules'),
    detail: (id: string) => get<InstalledModuleDetail>(`/modules/${id}`),
    saveSettings: (id: string, settings: Record<string, unknown>) => send<{ settings: Record<string, unknown> }>('PUT', `/modules/${id}/settings`, { settings }),
    setEnabled: (id: string, enabled: boolean) => send<InstalledModuleInfo>('POST', `/modules/${id}/enabled`, { enabled }),
    setLicense: (id: string, key: string) => send<InstalledModuleInfo>('POST', `/modules/${id}/license`, { key }),
    uninstall: (id: string) => send('DELETE', `/modules/${id}`),
    upload: (filename: string, dataBase64: string) => send<StagedPackageInfo>('POST', '/modules/upload', { filename, dataBase64 }),
    install: (token: string) => send<InstalledModuleInfo>('POST', '/modules/install', { token }),
    marketplace: (refresh = false) => get<MarketplaceListing>(`/marketplace${refresh ? '?refresh=1' : ''}`),
    stage: (id: string) => send<StagedPackageInfo>('POST', `/marketplace/${id}/stage`),
    checkout: (id: string) =>
      send<{
        purchaseId: string;
        paymentLink: string;
        paymentId: string;
        amountMillimes: number;
        amountLabel: string;
        moduleId: string;
        moduleName: string;
      }>('POST', `/marketplace/${id}/checkout`),
    purchase: (purchaseId: string) =>
      get<{
        purchase: {
          id: string;
          moduleId: string;
          moduleName: string;
          status: string;
          amountMillimes: number;
          licenseKey?: string | null;
          paymentId?: string | null;
        };
      }>(`/marketplace/purchases/${purchaseId}`),
    /** Routes d'administration propres à un module (pages ajoutées par le module). */
    client: (id: string) => {
      const base = `/modules/${id}/api`;
      const rel = (p: string) => `${base}${p.startsWith('/') ? p : `/${p}`}`;
      return {
        get: <T,>(p: string) => get<T>(rel(p)),
        post: <T,>(p: string, body?: unknown) => send<T>('POST', rel(p), body ?? {}),
        put: <T,>(p: string, body?: unknown) => send<T>('PUT', rel(p), body ?? {}),
        delete: <T,>(p: string) => send<T>('DELETE', rel(p)),
      };
    },
  },

  themes: {
    list: () => get<{ themes: InstalledThemeInfo[]; devMode: boolean }>('/themes'),
    detail: (id: string) => get<InstalledThemeDetail>(`/themes/${id}`),
    activate: (id: string) => send<InstalledThemeInfo>('POST', `/themes/${id}/activate`),
    saveSettings: (id: string, settings: Record<string, unknown>) => send<{ settings: Record<string, unknown> }>('PUT', `/themes/${id}/settings`, { settings }),
    uninstall: (id: string) => send('DELETE', `/themes/${id}`),
  },

  seoOverview: () => get<SeoOverviewRow[]>('/seo/overview'),

  forms: () => get<{ forms: ContactFormConfig[]; submissions: ContactSubmission[] }>('/forms'),
  saveForm: (id: string, body: ContactFormConfig) => send('PUT', `/forms/${id}`, body),
  markSubmission: (id: string, read: boolean) => send('PATCH', `/submissions/${id}`, { read }),
  deleteSubmission: (id: string) => send('DELETE', `/submissions/${id}`),

  analytics: (days: number) => get<AnalyticsSummary>(`/analytics?days=${days}`),

  media: () => get<MediaAsset[]>('/media'),
  upload: (payload: { filename: string; dataBase64: string; mimeType: string; alt?: string }) => send<MediaAsset>('POST', '/media/upload', payload),
  updateMedia: (id: string, alt: string) => send('PATCH', `/media/${id}`, { alt }),
  deleteMedia: (id: string) => send('DELETE', `/media/${id}`),

  subscribers: () => get<Omit<NewsletterSubscriber, 'confirmToken'>[]>('/subscribers'),
  setSubscriberStatus: (id: string, status: NewsletterSubscriber['status']) => send('PATCH', `/subscribers/${id}`, { status }),
  deleteSubscriber: (id: string) => send('DELETE', `/subscribers/${id}`),

  users: () => get<UserRow[]>('/users'),
  createUser: (body: { email: string; name: string; role: string; title?: string; mode: 'invite' | 'password'; password?: string; mustChangePassword?: boolean }) =>
    send<{ user: PublicUser; invite?: LinkDelivery }>('POST', '/users', body),
  updateUser: (id: string, body: { name?: string; title?: string; phone?: string; role?: string; email?: string }) => send<{ user: PublicUser }>('PATCH', `/users/${id}`, body),
  setUserStatus: (id: string, status: 'active' | 'suspended') => send<{ user: PublicUser }>('POST', `/users/${id}/status`, { status }),
  setUserPassword: (id: string, password: string, mustChangePassword: boolean) =>
    send<{ ok: true; closedSessions: number }>('POST', `/users/${id}/password`, { password, mustChangePassword }),
  userResetLink: (id: string, send_: boolean) => send<LinkDelivery>('POST', `/users/${id}/reset-link`, { send: send_ }),
  resetUser2fa: (id: string) => send('POST', `/users/${id}/2fa/reset`),
  userSessions: (id: string) => get<SessionRow[]>(`/users/${id}/sessions`),
  revokeUserSessions: (id: string, sessionId?: string) => send<{ closed: number }>('POST', `/users/${id}/sessions/revoke`, { sessionId }),
  userActivity: (id: string, page = 1, pageSize = 25) => get<Paged<AuditEntry>>(`/users/${id}/activity?page=${page}&pageSize=${pageSize}`),
  deleteUser: (id: string) => send('DELETE', `/users/${id}`),

  roles: () => get<RoleRow[]>('/roles'),
  createRole: (body: Pick<RoleDefinition, 'name' | 'description' | 'tone' | 'permissions'>) => send<RoleDefinition>('POST', '/roles', body),
  updateRole: (id: string, body: Partial<Pick<RoleDefinition, 'name' | 'description' | 'tone' | 'permissions'>>) => send<RoleDefinition>('PUT', `/roles/${id}`, body),
  resetRole: (id: string) => send<RoleDefinition>('POST', `/roles/${id}/reset`),
  deleteRole: (id: string, reassignTo?: string) => send('DELETE', `/roles/${id}${reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : ''}`),

  audit: (q: Record<string, string | number | undefined>) => get<Paged<AuditEntry>>(`/audit?${queryString(q)}`),
  auditExport: async (q: Record<string, string | number | undefined>) => {
    const res = await fetch(`/api/admin/audit/export?${queryString(q)}`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
    if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => null))?.error || `Erreur ${res.status}`);
    return res.blob();
  },

  system: {
    get: () => get<{ system: SystemView; meta: SystemMeta }>('/system'),
    save: (body: unknown) => send<{ system: SystemView; meta: SystemMeta }>('PUT', '/system', body),
    testSmtp: (to: string, smtp?: unknown) => send<{ ok: boolean; error?: string; source: SystemMeta['smtpSource'] }>('POST', '/system/smtp/test', { to, smtp }),
    mailLog: (page = 1, pageSize = 25) => get<Paged<MailLogEntry>>(`/system/mail-log?page=${page}&pageSize=${pageSize}`),
    info: () => get<SystemInfo>('/system/info'),
    runRetention: () => send<Record<'analytics' | 'submissions' | 'audit' | 'mailLog' | 'sessions' | 'tokens', number>>('POST', '/system/retention/run'),
  },
  mediaLimits: () => get<SystemSettings['uploads'] & { label: string }>('/media/limits'),

  google: {
    status: () => get<GoogleStatus>('/google/status'),
    connect: () => get<{ authUrl: string }>('/google/connect'),
    sites: () => get<{ siteUrl: string; permissionLevel: string }[]>('/google/sites'),
    performance: (days: number) => get<SearchPerformance>(`/google/performance?days=${days}`),
    disconnect: () => send('POST', '/google/disconnect'),
    testCredentials: (clientId: string, clientSecret: string) => send<{ ok: boolean; error?: string }>('POST', '/google/credentials/test', { clientId, clientSecret }),
    saveCredentials: (clientId: string, clientSecret: string) => send<{ ok: true }>('PUT', '/google/credentials', { clientId, clientSecret }),
    deleteCredentials: () => send<{ ok: true }>('DELETE', '/google/credentials'),
  },
};
