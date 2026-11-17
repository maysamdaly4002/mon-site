/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Heart, Home, Menu, Minus, Phone, Plus, Search, ShoppingBag, Store, UserRound, X } from 'lucide-react';
import { hasModuleSlot, isModuleActive, ModuleSlot, useSnapify, type ThemeChromeProps } from '@snapify/sdk/theme';
import { cart, useCart, useWishlist } from '@snapify/sdk/commerce';
import { followLink, shopActive, useMenus, useOptions, type MenuItemDto } from './site';
import { Brand } from './Brand';
import { cx } from './kit';

const SHOP_PATH = '/boutique/';

function SearchBox({ navigate, autoFocus, onDone, className }: { navigate: (p: string) => void; autoFocus?: boolean; onDone?: () => void; className?: string }) {
  const { path } = useSnapify();
  const [q, setQ] = useState('');
  useEffect(() => {
    setQ(path.startsWith(SHOP_PATH) ? new URLSearchParams(window.location.search).get('q') ?? '' : '');
  }, [path]);
  return (
    <form
      role="search"
      className={cx('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        navigate(term ? `${SHOP_PATH}?q=${encodeURIComponent(term)}` : SHOP_PATH);
        onDone?.();
      }}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--mh-muted)" />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit…" aria-label="Rechercher un produit" autoFocus={autoFocus} maxLength={100} className="mh-search" />
    </form>
  );
}

function MobileBar({ navigate, path }: { navigate: (p: string) => void; path: string }) {
  const { count } = useCart();
  const wish = useWishlist();
  const accounts = isModuleActive('novalabs.customers');
  const cartOn = isModuleActive('novalabs.cart');
  const items = [
    { id: 'home', label: 'Accueil', icon: Home, active: path === '/', onClick: () => followLink('/', navigate) },
    { id: 'shop', label: 'Boutique', icon: Store, active: path.startsWith(SHOP_PATH) || path.startsWith('/produit/'), onClick: () => followLink(SHOP_PATH, navigate) },
    ...(accounts
      ? [
          { id: 'wish', label: 'Favoris', icon: Heart, badge: wish.length, active: path === '/compte/favoris/', onClick: () => followLink('/compte/favoris/', navigate) },
          { id: 'account', label: 'Compte', icon: UserRound, active: path.startsWith('/compte/') && path !== '/compte/favoris/', onClick: () => followLink('/compte/', navigate) },
        ]
      : []),
    ...(cartOn ? [{ id: 'cart', label: 'Panier', icon: ShoppingBag, badge: count, active: path === '/panier/', onClick: () => cart.open() }] : []),
  ];
  return (
    <nav aria-label="Navigation boutique" className="fixed inset-x-0 bottom-0 z-40 border-t border-(--mh-line) bg-(--mh-card) pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-20px_rgba(0,0,0,0.25)] lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch">
        {items.map((it) => (
          <button key={it.id} type="button" onClick={it.onClick} aria-current={it.active ? 'page' : undefined} className={cx('relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors', it.active ? 'text-(--mh-accent-text)' : 'text-(--mh-muted)')}>
            <span className="relative">
              <it.icon className="h-5 w-5" strokeWidth={1.8} />
              {'badge' in it && it.badge ? <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--mh-accent) px-1 text-[10px] font-bold leading-none text-(--mh-on-accent)">{it.badge > 99 ? '99+' : it.badge}</span> : null}
            </span>
            {it.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function Header({ path, navigate }: ThemeChromeProps) {
  const { info, site } = useSnapify();
  const o = useOptions();
  const { primary, mobile, cta } = useMenus();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const shop = shopActive();
  const actions = hasModuleSlot('header-actions');
  const floating = (site.floatingButtons ?? []).filter((b) => b.enabled && b.label).slice(0, 2);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setDrawer(false);
    setOpen(null);
    setSearchOpen(false);
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
  const hover = (id: string | null) => {
    window.clearTimeout(closeTimer.current);
    if (id) setOpen(id);
    else closeTimer.current = window.setTimeout(() => setOpen(null), 120);
  };
  const announcement = o.announcement && o.announcementText.trim();

  return (
    <>
      {announcement ? (
        <div className="bg-(--mh-ink) text-(--mh-on-dark)">
          <div className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-6 px-4 text-center text-[12px] font-medium sm:px-6 lg:justify-between lg:px-8">
            <span className="hidden w-48 lg:block" />
            {o.announcementLink ? (
              <button type="button" onClick={() => go({ path: o.announcementLink })} className="truncate underline-offset-4 hover:underline">
                {o.announcementText}
              </button>
            ) : (
              <span className="truncate">{o.announcementText}</span>
            )}
            <a href={`tel:${info.phoneClean}`} className="hidden w-48 items-center justify-end gap-2 text-(--mh-on-dark)/75 transition-colors hover:text-(--mh-on-dark) lg:flex">
              <Phone className="h-3.5 w-3.5" />
              {info.phone}
            </a>
          </div>
        </div>
      ) : null}

      <header className={cx('top-0 z-50 border-b bg-(--mh-card) transition-shadow duration-300', o.stickyHeader ? 'sticky' : 'relative', scrolled ? 'border-(--mh-line) shadow-[0_12px_30px_-24px_rgba(0,0,0,0.35)]' : 'border-(--mh-line)/70')}>
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setDrawer(true)} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-(--mh-ink) hover:bg-(--mh-paper-2) lg:hidden" aria-label="Ouvrir le menu">
            <Menu className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </button>
          <Brand compact onClick={() => go({ path: '/' })} />

          {shop && o.headerSearch ? <SearchBox navigate={navigate} className="mx-auto hidden w-full max-w-xl md:block" /> : <div className="flex-1" />}

          <div className="ml-auto flex items-center gap-1 text-(--mh-ink) md:ml-0">
            {shop && o.headerSearch ? (
              <button type="button" onClick={() => setSearchOpen((s) => !s)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5 md:hidden" aria-label="Rechercher" aria-expanded={searchOpen}>
                {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-[21px] w-[21px]" strokeWidth={1.8} />}
              </button>
            ) : null}
            {actions ? (
              <ModuleSlot name="header-actions" />
            ) : (
              <button type="button" onClick={() => go(cta)} className="mh-btn mh-btn-primary hidden py-2.5! sm:inline-flex">
                {cta.label}
                <ArrowRight className="mh-btn-arrow h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {searchOpen ? (
          <div className="border-t border-(--mh-line) px-4 py-3 md:hidden">
            <SearchBox navigate={navigate} autoFocus onDone={() => setSearchOpen(false)} />
          </div>
        ) : null}

        <nav className="hidden border-t border-(--mh-line)/70 lg:block" aria-label="Navigation principale">
          <div className="mx-auto flex h-12 max-w-7xl items-center gap-1 px-6 lg:px-8">
            {primary.map((item) =>
              item.children?.length ? (
                <div key={item.id} className="relative h-full" onMouseEnter={() => hover(item.id)} onMouseLeave={() => hover(null)}>
                  <button type="button" onClick={() => go(item)} aria-expanded={open === item.id} className={cx('relative flex h-full items-center gap-1.5 px-3.5 text-[0.875rem] font-semibold transition-colors', isActive(item.path) ? 'text-(--mh-ink)' : 'text-(--mh-text) hover:text-(--mh-accent-text)')}>
                    {item.label}
                    <ChevronDown className={cx('h-3.5 w-3.5 transition-transform duration-200', open === item.id && 'rotate-180')} />
                    {isActive(item.path) ? <span className="absolute inset-x-3.5 bottom-0 h-0.5 rounded-full bg-(--mh-accent)" /> : null}
                  </button>
                  <div className={cx('absolute left-0 top-full z-50 min-w-[16rem] pt-2 transition-all duration-200', open === item.id ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0')}>
                    <div className="overflow-hidden rounded-(--mh-r-lg) border border-(--mh-line) bg-(--mh-card) p-2 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)]">
                      {item.children.map((child) => (
                        <button key={child.id} type="button" onClick={() => go(child)} className="flex w-full items-center rounded-(--mh-r) px-3.5 py-2.5 text-left text-sm font-medium text-(--mh-ink) transition-colors hover:bg-(--mh-paper-2)">
                          {child.label}
                        </button>
                      ))}
                      <button type="button" onClick={() => go(item)} className="mt-1 flex w-full items-center gap-2 rounded-(--mh-r) border-t border-(--mh-line) px-3.5 pb-2 pt-3 text-left text-[13px] font-semibold text-(--mh-accent-text)">
                        Tout voir <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button key={item.id} type="button" onClick={() => go(item)} className={cx('relative flex h-full items-center px-3.5 text-[0.875rem] font-semibold transition-colors', item.highlight ? 'text-(--mh-accent-text)' : isActive(item.path) ? 'text-(--mh-ink)' : 'text-(--mh-text) hover:text-(--mh-accent-text)')}>
                  {item.label}
                  {isActive(item.path) ? <span className="absolute inset-x-3.5 bottom-0 h-0.5 rounded-full bg-(--mh-accent)" /> : null}
                </button>
              )
            )}
            <a href={`tel:${info.phoneClean}`} className="ml-auto hidden items-center gap-2 text-[13px] font-semibold text-(--mh-text) transition-colors hover:text-(--mh-accent-text) xl:inline-flex">
              <Phone className="h-4 w-4" />
              {info.phone}
            </a>
          </div>
        </nav>
      </header>

      {/* Menu mobile : panneau latéral */}
      <div className={cx('fixed inset-0 z-[60] lg:hidden', drawer ? 'visible' : 'invisible')} aria-hidden={!drawer}>
        <div className={cx('absolute inset-0 bg-black/40 transition-opacity duration-300', drawer ? 'opacity-100' : 'opacity-0')} onClick={() => setDrawer(false)} />
        <aside className={cx('absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-(--mh-card) shadow-2xl transition-transform duration-300 ease-out', drawer ? 'translate-x-0' : '-translate-x-full')}>
          <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-(--mh-line) px-5">
            <Brand onClick={() => go({ path: '/' })} />
            <button type="button" onClick={() => setDrawer(false)} className="flex h-10 w-10 items-center justify-center rounded-full text-(--mh-ink) hover:bg-(--mh-paper-2)" aria-label="Fermer le menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          {shop && o.headerSearch ? (
            <div className="border-b border-(--mh-line) p-4">
              <SearchBox navigate={navigate} onDone={() => setDrawer(false)} />
            </div>
          ) : null}
          <nav className="flex-1 overflow-y-auto px-5 py-3">
            {mobile.map((item) => (
              <div key={item.id} className="border-b border-(--mh-line)/70">
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => go(item)} className={cx('flex-1 py-3.5 text-left text-[15px] font-semibold', item.highlight ? 'text-(--mh-accent-text)' : isActive(item.path) ? 'text-(--mh-ink)' : 'text-(--mh-text)')}>
                    {item.label}
                  </button>
                  {item.children?.length ? (
                    <button type="button" onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="flex h-9 w-9 items-center justify-center rounded-full text-(--mh-muted) hover:bg-(--mh-paper-2)" aria-label={`Sous-menu ${item.label}`} aria-expanded={expanded === item.id}>
                      {expanded === item.id ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                  ) : null}
                </div>
                {item.children?.length && expanded === item.id ? (
                  <div className="space-y-0.5 pb-3 pl-3">
                    {item.children.map((child) => (
                      <button key={child.id} type="button" onClick={() => go(child)} className="block w-full py-2 text-left text-sm text-(--mh-muted) hover:text-(--mh-ink)">
                        {child.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
          <div className="shrink-0 space-y-2 border-t border-(--mh-line) p-5">
            <a href={`tel:${info.phoneClean}`} className="mh-btn mh-btn-outline w-full">
              <Phone className="h-4 w-4" />
              {info.phone}
            </a>
            <button type="button" onClick={() => go(cta)} className="mh-btn mh-btn-primary w-full">
              {cta.label}
              <ArrowRight className="mh-btn-arrow h-4 w-4" />
            </button>
          </div>
        </aside>
      </div>

      {o.mobileBar ? (
        shop ? (
          <MobileBar navigate={navigate} path={path} />
        ) : (
          <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-(--mh-line) bg-(--mh-card) px-4 py-3 lg:hidden">
            {floating.length ? (
              floating.map((b) => (
                <button key={b.id} type="button" onClick={() => go({ path: b.path })} className={cx('mh-btn flex-1 py-2.5! text-xs', b.style === 'primary' ? 'mh-btn-primary' : b.style === 'outline' ? 'mh-btn-outline' : 'bg-(--mh-paper-2) text-(--mh-ink)')}>
                  {b.label}
                </button>
              ))
            ) : (
              <>
                <a href={`tel:${info.phoneClean}`} className="mh-btn mh-btn-outline flex-1 py-2.5! text-xs">
                  <Phone className="h-3.5 w-3.5" />
                  Appeler
                </a>
                <button type="button" onClick={() => go(cta)} className="mh-btn mh-btn-primary flex-1 py-2.5! text-xs">
                  {cta.label}
                </button>
              </>
            )}
          </div>
        )
      ) : null}
    </>
  );
}
