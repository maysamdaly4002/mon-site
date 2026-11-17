/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Chargement des modules sur le site : React est partagé avec les bundles des modules
 * (globalThis.__SNAPIFY_RUNTIME__), chaque élément est isolé par une barrière d'erreur.
 * Un module peut fournir des éléments d'emplacement (bulle flottante, icônes d'en-tête),
 * des pages pour ses adresses (`routes`) et des widgets pour le bloc « Module ».
 */
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { createModuleApi, matchesPaths, type ModuleSlot, type PublicModule, type PublicModuleProps } from '../../sdk/index';
import { useSiteInfo, useSiteConfig, type PublicModuleDescriptor } from '../context/SiteConfigContext';
import { IS_PREVIEW } from '../preview';
import { ThemeContext } from '../runtime';

const loaded = new Map<string, Promise<PublicModule | null>>();

function loadModule(d: PublicModuleDescriptor): Promise<PublicModule | null> {
  let p = loaded.get(d.script);
  if (!p) {
    if (d.style && !document.querySelector(`link[data-snapify-module="${d.id}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = d.style;
      link.dataset.snapifyModule = d.id;
      document.head.appendChild(link);
    }
    p = import(/* @vite-ignore */ d.script)
      .then((m: { default?: PublicModule }) => (m.default && typeof m.default === 'object' ? m.default : null))
      .catch((e) => {
        console.error(`[modules] chargement impossible : ${d.id}`, e);
        return null;
      });
    loaded.set(d.script, p);
  }
  return p;
}

function useModule(descriptor: PublicModuleDescriptor | undefined): PublicModule | null | undefined {
  const [mod, setMod] = useState<PublicModule | null | undefined>(undefined);
  useEffect(() => {
    if (!descriptor) return;
    let alive = true;
    setMod(undefined);
    void loadModule(descriptor).then((m) => alive && setMod(m));
    return () => {
      alive = false;
    };
  }, [descriptor]);
  return descriptor ? mod : null;
}

class ModuleBoundary extends React.Component<{ id: string; fallback?: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(`[modules] ${this.props.id} a rencontré une erreur`, error);
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

function useBaseProps(descriptor: PublicModuleDescriptor, path: string, navigate: (p: string) => void): PublicModuleProps {
  const info = useSiteInfo();
  const api = useMemo(() => createModuleApi(descriptor.id), [descriptor.id]);
  return {
    settings: descriptor.settings,
    site: { name: info.name, legalName: info.legalName, phone: info.phone, phoneClean: info.phoneClean, email: info.contactEmail, slaHours: info.slaHours, address: info.address },
    path,
    isPreview: IS_PREVIEW,
    navigate,
    api,
    module: { id: descriptor.id, version: descriptor.version },
  };
}

function Scope({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div data-snapify-scope={id} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}

function ModuleWidget({ descriptor, slot, path, navigate }: { descriptor: PublicModuleDescriptor; slot: ModuleSlot; path: string; navigate: (p: string) => void }) {
  const mod = useModule(descriptor);
  const props = useBaseProps(descriptor, path, navigate);
  const Component = mod?.slots?.[slot];
  if (!Component) return null;
  return (
    <ModuleBoundary id={descriptor.id}>
      <Scope id={descriptor.id}>
        <Component {...props} />
      </Scope>
    </ModuleBoundary>
  );
}

/** Affiche les modules actifs déclarant l'emplacement `name`. */
export function ModuleSlotHost({ name, path, navigate }: { name: ModuleSlot; path: string; navigate: (p: string) => void }) {
  const cfg = useSiteConfig();
  const modules = (cfg?.modules ?? []).filter((m) => m.slots.includes(name));
  return (
    <>
      {modules.map((m) => (
        <ModuleWidget key={`${m.id}@${m.version}`} descriptor={m} slot={name} path={path} navigate={navigate} />
      ))}
    </>
  );
}

/** Emplacement placé par le thème (`<ModuleSlot name="header-actions" />`) : adresse et navigation viennent du contexte du thème. */
function ThemeSlot({ name }: { name: ModuleSlot }) {
  const ctx = useContext(ThemeContext);
  if (!ctx) return null;
  return <ModuleSlotHost name={name} path={ctx.path} navigate={ctx.navigate} />;
}

/** Publie pour les thèmes et les modules la liste des modules actifs et l'emplacement d'en-tête. */
export function useModuleRuntime() {
  const cfg = useSiteConfig();
  const modules = cfg?.modules;
  useMemo(() => {
    const rt = globalThis.__SNAPIFY_RUNTIME__;
    if (!rt) return;
    rt.ModuleSlot = ThemeSlot;
    rt.activeModules = (modules ?? []).map((m) => m.id);
    rt.slotModules = { 'header-actions': (modules ?? []).filter((m) => m.slots.includes('header-actions')).map((m) => m.id) };
  }, [modules]);
}

/** Module qui prend en charge cette adresse (routes déclarées dans son manifeste). */
export function useModuleRoute(path: string): PublicModuleDescriptor | undefined {
  const cfg = useSiteConfig();
  return useMemo(() => (cfg?.modules ?? []).find((m) => m.routes?.length && matchesPaths(m.routes, path)), [cfg?.modules, path]);
}

export function ModulePageHost({
  descriptor,
  path,
  search,
  navigate,
  onMeta,
  notFound,
}: {
  descriptor: PublicModuleDescriptor;
  path: string;
  search: string;
  navigate: (p: string) => void;
  onMeta: (meta: { title?: string; description?: string }) => void;
  notFound: React.ReactNode;
}) {
  const mod = useModule(descriptor);
  const props = useBaseProps(descriptor, path, navigate);
  if (mod === undefined) return <div className="min-h-[60vh]" aria-busy="true" />;
  const Page = mod?.page;
  if (!Page) return <>{notFound}</>;
  return (
    <ModuleBoundary id={descriptor.id} fallback={notFound}>
      <Scope id={descriptor.id}>
        <Page {...props} search={search} setMeta={onMeta} />
      </Scope>
    </ModuleBoundary>
  );
}

/** Bloc « Module » : widget d'un module actif, avec ses options. */
export function ModuleWidgetBlock({ moduleId, widget, options }: { moduleId: string; widget: string; options: Record<string, unknown> }) {
  const cfg = useSiteConfig();
  const ctx = useContext(ThemeContext);
  const descriptor = (cfg?.modules ?? []).find((m) => m.id === moduleId);
  const mod = useModule(descriptor && descriptor.widgets?.includes(widget) ? descriptor : undefined);
  const props = useBaseProps(descriptor ?? { id: moduleId, version: '', slots: [], routes: [], widgets: [], script: '', settings: {} }, ctx?.path ?? '/', ctx?.navigate ?? (() => undefined));
  const Widget = mod?.widgets?.[widget];
  if (!descriptor || !descriptor.widgets?.includes(widget)) {
    return IS_PREVIEW ? <PreviewNotice>Ce widget provient d’un module inactif ou désinstallé : il n’est pas affiché sur le site.</PreviewNotice> : null;
  }
  if (mod === undefined) return <div className="min-h-[200px]" aria-busy="true" />;
  if (!Widget) return null;
  return (
    <ModuleBoundary id={descriptor.id} fallback={IS_PREVIEW ? <PreviewNotice>Le widget ne peut pas s’afficher.</PreviewNotice> : null}>
      <Scope id={descriptor.id}>
        <Widget {...props} widget={widget} options={options} />
      </Scope>
    </ModuleBoundary>
  );
}

function PreviewNotice({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto my-6 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{children}</div>;
}
