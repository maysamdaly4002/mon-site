/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/** Rendu de secours, sans thème : navigation et textes uniquement. */
import React, { useContext } from 'react';
import type { BlockProps, ThemeChromeProps, ThemeDefinition } from '../../sdk/theme';
import { ThemeContext } from '../runtime';

function Header({ navigate }: ThemeChromeProps) {
  const ctx = useContext(ThemeContext);
  const items = ctx?.site.menus.find((m) => m.id === 'primary')?.items ?? ctx?.site.menus[0]?.items ?? [];
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-6 px-4 py-4">
        <button type="button" className="text-lg font-semibold" onClick={() => navigate('/')}>
          {ctx?.info.name || 'Accueil'}
        </button>
        <nav className="flex flex-wrap gap-4 text-sm">
          {items.map((item) => (
            <button key={item.id} type="button" className="hover:underline" onClick={() => navigate(item.path)}>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Footer({ navigate, openCookies }: ThemeChromeProps) {
  const ctx = useContext(ThemeContext);
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap gap-4 px-4 py-6 text-sm text-slate-500">
        <span>© {new Date().getFullYear()} {ctx?.info.legalName || ctx?.info.name}</span>
        <button type="button" className="hover:underline" onClick={() => navigate('/mentions-legales/')}>
          Mentions légales
        </button>
        <button type="button" className="hover:underline" onClick={openCookies}>
          Cookies
        </button>
      </div>
    </footer>
  );
}

export const FALLBACK_THEME: ThemeDefinition = {
  Header,
  Footer,
  blocks: {
    hero: ({ d }: BlockProps<'hero'>) => (
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-3xl font-bold">{d.title}</h1>
        {d.subtitle ? <p className="mt-3 text-slate-600">{d.subtitle}</p> : null}
      </section>
    ),
    pageHeader: ({ d }: BlockProps<'pageHeader'>) => (
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">{d.title}</h1>
      </section>
    ),
    richText: ({ d }: BlockProps<'richText'>) => (
      <section className="mx-auto max-w-3xl px-4 py-6">
        <div dangerouslySetInnerHTML={{ __html: d.html }} />
      </section>
    ),
  },
};
