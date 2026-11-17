/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Page d'administration fournie par un module (/administrator/m/<module>/<page>/…) : le bundle
 * `admin.js` du module est chargé à la demande et reçoit les composants du back-office.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PuzzleIcon } from 'lucide-react';
import type { AdminModule } from '../../../sdk/admin';
import '../../runtime';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { ADMIN_KIT, AdminScopeContext } from '../modules/kit';
import { useInstalledModules } from '../modules/labels';
import { EmptyState, ErrorState, PageSkeleton } from '../ui/primitives';

declare global {
  // eslint-disable-next-line no-var
  var __SNAPIFY_ADMIN__: typeof ADMIN_KIT | undefined;
}

const bundles = new Map<string, Promise<AdminModule | null>>();

function loadAdminBundle(id: string, script: string, style?: string): Promise<AdminModule | null> {
  globalThis.__SNAPIFY_ADMIN__ = ADMIN_KIT;
  let p = bundles.get(script);
  if (!p) {
    if (style && !document.querySelector(`link[data-snapify-admin="${id}"][href="${style}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = style;
      link.dataset.snapifyAdmin = id;
      document.head.appendChild(link);
    }
    p = import(/* @vite-ignore */ script)
      .then((m: { default?: AdminModule }) => (m.default && typeof m.default.pages === 'object' ? m.default : null))
      .catch((e) => {
        console.error(`[modules] administration de ${id} indisponible`, e);
        return null;
      });
    bundles.set(script, p);
  }
  return p;
}

class PageBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
  componentDidCatch(e: unknown) {
    console.error('[modules] page d’administration', e);
  }
  render() {
    return this.state.error ? <ErrorState message={`Cette page du module a rencontré une erreur : ${this.state.error}`} /> : this.props.children;
  }
}

export default function ModuleAdminPage() {
  const { moduleId = '', pageId = '', '*': rest = '' } = useParams();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const installed = useInstalledModules();
  const info = installed.find((m) => m.id === moduleId);
  const detail = useAsync(() => api.modules.detail(moduleId), [moduleId]);
  const [bundle, setBundle] = useState<AdminModule | null | undefined>(undefined);
  const client = useMemo(() => api.modules.client(moduleId), [moduleId]);

  useEffect(() => {
    if (!info?.admin) return;
    let alive = true;
    void loadAdminBundle(info.id, info.admin.script, info.admin.style).then((b) => alive && setBundle(b));
    return () => {
      alive = false;
    };
  }, [info?.id, info?.admin?.script, info?.admin?.style]); // eslint-disable-line react-hooks/exhaustive-deps

  const page = info?.adminPages.find((p) => p.id === pageId);
  useEffect(() => {
    if (page) document.title = `${page.label} · Administration`;
  }, [page]);

  if (!installed.length || (info?.admin && bundle === undefined) || (detail.loading && !detail.data)) return <PageSkeleton />;
  if (!info || !page) return <EmptyState icon={PuzzleIcon} title="Page introuvable" description="Ce module n’est pas installé ou ne propose pas cette page." />;
  if (!info.admin) return <EmptyState icon={PuzzleIcon} title={`${info.name} est inactif`} description={info.status.message} />;
  const Page = bundle?.pages[pageId];
  if (!Page) return <ErrorState message="Le module n’a pas pu charger cette page." />;

  return (
    <AdminScopeContext.Provider value={info.id}>
      <div data-snapify-scope={info.id}>
        <PageBoundary key={`${moduleId}/${pageId}`}>
          <Page
            page={pageId}
            subpath={rest ? `/${rest}` : ''}
            navigate={(sub, opts) => navigate(opts?.absolute ? sub : `/m/${moduleId}/${pageId}${sub}`)}
            api={client}
            module={{ id: info.id, version: info.version }}
            settings={detail.data?.settings ?? {}}
            user={{ id: user?.id ?? '', name: user?.name ?? '', email: user?.email ?? '' }}
            canConfigure={can('modules.settings')}
          />
        </PageBoundary>
      </div>
    </AdminScopeContext.Provider>
  );
}
