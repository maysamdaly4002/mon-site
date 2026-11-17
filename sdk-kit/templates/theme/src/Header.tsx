import { useState } from 'react';
import { ModuleSlot, useSnapify, type ThemeChromeProps } from '@snapify/sdk/theme';
import { cx, SiteLink, useMenu, useOptions } from './site';

export function Header({ path }: ThemeChromeProps) {
  const { site } = useSnapify();
  const options = useOptions();
  const menu = useMenu('primary');
  const [open, setOpen] = useState(false);
  const dark = options.headerStyle === 'dark';
  const active = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));

  return (
    <header className={cx('z-30 border-b', options.stickyHeader && 'sticky top-0', dark ? 'border-white/10 bg-px-navy text-white' : 'border-black/10 bg-white text-px-navy')}>
      <div className="st-container flex h-16 items-center justify-between gap-6">
        <SiteLink href="/" className="flex items-center gap-3 font-bold">
          {site.branding.logoUrl ? <img src={dark && site.branding.logoDarkUrl ? site.branding.logoDarkUrl : site.branding.logoUrl} alt={site.branding.siteName} className="h-9 w-auto" /> : site.branding.siteName}
        </SiteLink>

        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {menu.map((item) => (
            <SiteLink key={item.id} href={item.path} newTab={item.openInNewTab} className={cx('hover:text-px-primary', active(item.path) && 'text-px-primary')}>
              {item.label}
            </SiteLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ModuleSlot name="header-actions" />
          <button type="button" className="rounded-md p-2 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            ☰
          </button>
        </div>
      </div>

      {open ? (
        <nav className="st-container flex flex-col gap-1 pb-4 md:hidden" onClick={() => setOpen(false)}>
          {menu.map((item) => (
            <SiteLink key={item.id} href={item.path} newTab={item.openInNewTab} className="rounded-md px-3 py-2 hover:bg-black/5">
              {item.label}
            </SiteLink>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
