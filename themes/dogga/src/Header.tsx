/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, Mail, Minus, Phone, Plus, X } from 'lucide-react';
import type { ThemeChromeProps } from '@snapify/sdk/theme';
import { useSnapify } from '@snapify/sdk/theme';
import { followLink, useMenus, useOptions, type MenuItemDto } from './site';
import { Brand } from './Brand';
import { cx } from './kit';

export function Header({ path, navigate }: ThemeChromeProps) {
  const { info, site } = useSnapify();
  const o = useOptions();
  const { primary, mobile, cta } = useMenus();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const floating = (site.floatingButtons ?? []).filter((b) => b.enabled && b.label).slice(0, 2);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setDrawer(false);
    setOpen(null);
  }, [path]);

  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer]);

  const go = (item: Pick<MenuItemDto, 'path' | 'openInNewTab'>) => {
    setDrawer(false);
    setOpen(null);
    followLink(item.path, navigate, item.openInNewTab);
  };
  const isActive = (p: string) => (p === '/' ? path === '/' : path.startsWith(p.replace(/\/$/, '')));
  const nav = primary.filter((i) => !i.highlight);

  return (
    <>
      {o.topBar ? (
        <div className="hidden bg-(--dg-ink) text-[#f5f0e8]/70 lg:block">
          <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-8 text-xs">
            <span className="tracking-wide">{info.slogan || info.baseline}</span>
            <div className="flex items-center gap-6">
              <a href={`tel:${info.phoneClean}`} className="inline-flex items-center gap-2 transition-colors hover:text-white">
                <Phone className="h-3.5 w-3.5" />
                {info.phone}
              </a>
              <a href={`mailto:${info.contactEmail}`} className="inline-flex items-center gap-2 transition-colors hover:text-white">
                <Mail className="h-3.5 w-3.5" />
                {info.contactEmail}
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <header
        className={cx(
          'top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300',
          o.stickyHeader ? 'sticky' : 'relative',
          scrolled ? 'border-(--dg-line) bg-(--dg-paper)/85 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)] backdrop-blur-xl' : 'border-transparent bg-(--dg-paper)'
        )}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Brand onClick={() => go({ path: '/' })} />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
            {nav.map((item) =>
              item.children?.length ? (
                <div key={item.id} className="relative" onMouseEnter={() => setOpen(item.id)} onMouseLeave={() => setOpen(null)}>
                  <button
                    type="button"
                    onClick={() => go(item)}
                    aria-expanded={open === item.id}
                    className={cx('flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.9rem] font-medium transition-colors', isActive(item.path) ? 'text-(--dg-ink)' : 'text-(--dg-muted) hover:text-(--dg-ink)')}
                  >
                    {item.label}
                    <ChevronDown className={cx('h-3.5 w-3.5 transition-transform duration-300', open === item.id && 'rotate-180')} />
                  </button>
                  {isActive(item.path) ? <span className="absolute inset-x-4 -bottom-[1.55rem] h-0.5 bg-(--dg-accent)" /> : null}
                  <div className={cx('absolute left-1/2 top-full z-50 w-[38rem] -translate-x-1/2 pt-4 transition-all duration-300', open === item.id ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-2 opacity-0')}>
                    <div className="grid grid-cols-[13rem_1fr] overflow-hidden rounded-(--dg-r-lg) border border-(--dg-line) bg-(--dg-card) shadow-[0_40px_80px_-40px_rgba(0,0,0,0.35)]">
                      <div className="dg-dark flex flex-col justify-between bg-(--dg-ink) p-6 text-(--dg-fg)">
                        <div className="dg-display text-3xl">{item.label}</div>
                        <button type="button" onClick={() => go(item)} className="dg-link mt-8 self-start">
                          Tout voir
                          <ArrowRight className="dg-btn-arrow h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-1 p-3">
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => go(child)}
                            className="group flex items-center justify-between rounded-(--dg-r) px-4 py-3 text-left text-sm font-medium text-(--dg-ink) transition-colors hover:bg-(--dg-paper)"
                          >
                            {child.label}
                            <ArrowUpRight className="h-4 w-4 text-(--dg-muted) opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-(--dg-accent) group-hover:opacity-100" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item)}
                  className={cx('relative rounded-full px-4 py-2 text-[0.9rem] font-medium transition-colors', isActive(item.path) ? 'text-(--dg-ink)' : 'text-(--dg-muted) hover:text-(--dg-ink)')}
                >
                  {item.label}
                  {isActive(item.path) ? <span className="absolute inset-x-4 -bottom-[1.55rem] h-0.5 bg-(--dg-accent)" /> : null}
                </button>
              )
            )}
          </nav>

          <div className="hidden items-center gap-5 lg:flex">
            {o.headerPhone ? (
              <a href={`tel:${info.phoneClean}`} className="hidden items-center gap-2 text-sm font-semibold text-(--dg-ink) transition-colors hover:text-(--dg-accent) xl:inline-flex">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-(--dg-line)">
                  <Phone className="h-4 w-4" />
                </span>
                {info.phone}
              </a>
            ) : null}
            <button type="button" onClick={() => go(cta)} className="dg-btn dg-btn-primary dg-light">
              {cta.label}
              <ArrowRight className="dg-btn-arrow h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex h-11 items-center gap-3 rounded-full border border-(--dg-line) pl-4 pr-1.5 text-sm font-semibold text-(--dg-ink) lg:hidden"
            aria-label="Ouvrir le menu"
          >
            Menu
            <span className="flex h-8 w-8 flex-col items-center justify-center gap-1 rounded-full bg-(--dg-ink)">
              <span className="h-px w-3.5 bg-white" />
              <span className="h-px w-3.5 bg-white" />
            </span>
          </button>
        </div>
      </header>

      {/* Menu mobile plein écran */}
      <div className={cx('dg-dark fixed inset-0 z-[60] flex flex-col bg-(--dg-ink) text-(--dg-fg) transition-[opacity,visibility] duration-300 lg:hidden', drawer ? 'visible opacity-100' : 'invisible opacity-0')}>
        <div className="flex h-20 shrink-0 items-center justify-between px-5 sm:px-8">
          <Brand dark onClick={() => go({ path: '/' })} />
          <button type="button" onClick={() => setDrawer(false)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20" aria-label="Fermer le menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-5 pb-8 pt-4 sm:px-8">
          {mobile.map((item, i) => (
            <div key={item.id} className="border-b border-white/10" style={{ transitionDelay: `${i * 40}ms` }}>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => go(item)} className={cx('dg-display py-4 text-left text-[2.1rem] leading-tight', item.highlight && 'text-(--dg-accent-text)')}>
                  {item.label}
                </button>
                {item.children?.length ? (
                  <button type="button" onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15" aria-label={`Sous-menu ${item.label}`}>
                    {expanded === item.id ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                ) : null}
              </div>
              {item.children?.length && expanded === item.id ? (
                <div className="space-y-1 pb-4">
                  {item.children.map((child) => (
                    <button key={child.id} type="button" onClick={() => go(child)} className="flex w-full items-center justify-between py-2 text-left text-sm text-(--dg-fg-2)">
                      {child.label}
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="shrink-0 space-y-3 border-t border-white/10 px-5 py-6 sm:px-8">
          <a href={`tel:${info.phoneClean}`} className="dg-btn dg-btn-outline w-full">
            <Phone className="h-4 w-4" />
            {info.phone}
          </a>
          <button type="button" onClick={() => go(cta)} className="dg-btn dg-btn-primary w-full">
            {cta.label}
            <ArrowRight className="dg-btn-arrow h-4 w-4" />
          </button>
        </div>
      </div>

      {o.mobileBar ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-(--dg-line) bg-(--dg-paper)/95 px-4 py-3 backdrop-blur-lg lg:hidden">
          {floating.length ? (
            floating.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => go({ path: b.path })}
                className={cx('dg-btn flex-1 py-2.5! text-xs', b.style === 'primary' ? 'dg-btn-primary' : b.style === 'outline' ? 'dg-btn-outline' : 'bg-(--dg-paper-2) text-(--dg-ink)')}
              >
                {b.label}
              </button>
            ))
          ) : (
            <>
              <a href={`tel:${info.phoneClean}`} className="dg-btn dg-btn-outline flex-1 py-2.5! text-xs">
                <Phone className="h-3.5 w-3.5" />
                Appeler
              </a>
              <button type="button" onClick={() => go(cta)} className="dg-btn dg-btn-primary flex-1 py-2.5! text-xs">
                {cta.label}
              </button>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
