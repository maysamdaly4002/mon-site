import { useSnapify, type ThemeChromeProps } from '@snapify/sdk/theme';
import { SiteLink, useMenu, useOptions, useText } from './site';

export function Footer({ openCookies }: ThemeChromeProps) {
  const { site, info } = useSnapify();
  const options = useOptions();
  const t = useText();
  const menu = useMenu('footer');

  return (
    <footer className="mt-24 bg-px-navy text-sm text-white/75">
      <div className="st-container grid gap-10 py-14 md:grid-cols-3">
        <div className="space-y-3">
          <p className="text-lg font-bold text-white">{site.branding.siteName}</p>
          <p>{t(options.footerText)}</p>
        </div>
        <nav className="flex flex-col gap-2">
          {menu.map((item) => (
            <SiteLink key={item.id} href={item.path} newTab={item.openInNewTab} className="hover:text-white">
              {item.label}
            </SiteLink>
          ))}
        </nav>
        <div className="space-y-2">
          {info.phone ? <a href={`tel:${info.phoneClean}`} className="block hover:text-white">{info.phone}</a> : null}
          {info.contactEmail ? <a href={`mailto:${info.contactEmail}`} className="block hover:text-white">{info.contactEmail}</a> : null}
          {info.address ? <p>{info.address}</p> : null}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="st-container flex flex-wrap items-center justify-between gap-3 py-5 text-xs">
          <span>© {new Date().getFullYear()} {info.legalName || site.branding.siteName}</span>
          <button type="button" className="hover:text-white" onClick={openCookies}>
            Gestion des cookies
          </button>
        </div>
      </div>
    </footer>
  );
}
