/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React from 'react';
import { Phone, ArrowUpRight, ShieldCheck, CheckCircle } from 'lucide-react';
import { useSiteInfo, useSiteConfig } from './site';
import { SnapifyLogo } from './SnapifyLogo';

interface FooterProps {
  onNavigate: (path: string) => void;
  onOpenCookies: () => void;
}

const LEGAL = ['/mentions-legales/', '/politique-de-confidentialite/', '/cookies/'];

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenCookies }) => {
  const SITE_INFO = useSiteInfo();
  const siteConfig = useSiteConfig();
  const [newsEmail, setNewsEmail] = React.useState('');
  const [newsMsg, setNewsMsg] = React.useState('');

  const navigateTo = (path: string) => {
    if (/^(https?:|mailto:|tel:)/.test(path)) {
      window.open(path, '_blank', 'noopener,noreferrer');
      return;
    }
    onNavigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const footerMenu = siteConfig?.menus.find((m) => m.id === 'footer')?.items;
  const col1 = siteConfig?.menus.find((m) => m.id === 'footer-col-1')?.items;
  const col2 = siteConfig?.menus.find((m) => m.id === 'footer-col-2')?.items;
  const col3 = siteConfig?.menus.find((m) => m.id === 'footer-col-3')?.items;

  const legalLinks =
    footerMenu?.filter((i) => LEGAL.includes(i.path)).map((i) => ({ label: i.label, path: i.path })) ||
    [
      { label: 'Mentions légales', path: '/mentions-legales/' },
      { label: 'Politique de confidentialité', path: '/politique-de-confidentialite/' },
      { label: 'Cookies', path: '/cookies/' },
    ];

  const companyLinks = footerMenu?.filter((i) => !LEGAL.includes(i.path)).map((i) => ({ label: i.label, path: i.path, highlight: !!i.highlight })) || [];

  const LinkCol = ({ title, items }: { title: string; items?: { id: string; label: string; path: string; highlight?: boolean }[] }) => {
    if (!items?.length) return null;
    return (
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">{title}</div>
        <ul className="space-y-2 text-xs">
          {items.map((l) => (
            <li key={l.id || l.path}>
              <button
                type="button"
                onClick={() => navigateTo(l.path)}
                className={l.highlight ? 'flex items-center gap-1 font-semibold text-px-primary-light hover:underline' : 'text-left text-slate-400 transition-colors hover:text-white'}
              >
                <span>{l.label}</span>
                {l.highlight ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <footer className="border-t border-slate-800 bg-px-navy pb-24 pt-16 text-white lg:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 border-b border-slate-800/80 pb-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-4 lg:col-span-4">
            <div onClick={() => navigateTo('/')} className="group inline-flex cursor-pointer items-center gap-3">
              {siteConfig?.branding.logoDarkUrl ? (
                <img src={siteConfig.branding.logoDarkUrl} alt={SITE_INFO.name} className="h-11 w-auto max-w-[200px] object-contain" />
              ) : (
                <>
                  <SnapifyLogo className="h-9 w-9 !border-slate-700 !bg-slate-900" />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xl font-bold tracking-tight text-white">{SITE_INFO.name.replace(/®$/, '')}</span>
                      {SITE_INFO.name.endsWith('®') && <span className="text-[10px] font-bold text-slate-400">®</span>}
                    </div>
                    <div className="text-[11px] font-normal leading-none text-slate-400">{SITE_INFO.baseline}</div>
                  </div>
                </>
              )}
            </div>
            <div className="text-xs font-medium tracking-wide text-px-primary-light">{SITE_INFO.slogan}</div>
            <p className="max-w-sm text-xs leading-relaxed text-slate-400">{SITE_INFO.baseline}</p>
            <div className="pt-2">
              <a
                href={`tel:${SITE_INFO.phoneClean}`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-white transition-colors hover:text-px-primary-light"
              >
                <Phone className="h-4 w-4 text-px-primary" />
                <span className="font-mono">{SITE_INFO.phone}</span>
              </a>
            </div>
          </div>
          <div className="lg:col-span-3">
            <LinkCol title={col1?.[0] ? 'Navigation' : 'Liens'} items={col1?.length ? col1 : companyLinks.slice(0, Math.ceil(companyLinks.length / 2)).map((l, i) => ({ id: `c${i}`, ...l }))} />
          </div>
          <div className="lg:col-span-2">
            <LinkCol title="Explorer" items={col2?.length ? col2 : companyLinks.slice(Math.ceil(companyLinks.length / 2)).map((l, i) => ({ id: `d${i}`, ...l }))} />
          </div>
          <div className="lg:col-span-3">
            <LinkCol title="Contact" items={col3?.length ? col3 : companyLinks.filter((l) => l.highlight).map((l, i) => ({ id: `e${i}`, ...l }))} />
            <div className="mt-4 border-t border-slate-800 pt-4 text-[11px] text-slate-400">
              <div className="mb-1 font-semibold text-slate-300">{SITE_INFO.legalName || SITE_INFO.name}</div>
              <div>{SITE_INFO.address}</div>
            </div>
          </div>
        </div>

        {siteConfig?.newsletterEnabled ? (
          <div className="border-b border-slate-800/80 py-8">
            <div className="max-w-md">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">Newsletter</p>
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setNewsMsg('');
                  const r = await fetch('/api/public/newsletter/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: newsEmail }),
                  });
                  const j = await r.json().catch(() => ({}));
                  if (r.ok) {
                    setNewsMsg(j.pending ? 'Vérifiez votre boîte mail pour confirmer.' : 'Inscription enregistrée.');
                    setNewsEmail('');
                  } else setNewsMsg(j.error || 'Erreur');
                }}
              >
                <input
                  type="email"
                  required
                  value={newsEmail}
                  onChange={(e) => setNewsEmail(e.target.value)}
                  placeholder="E-mail professionnel"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
                <button type="submit" className="rounded-lg bg-px-primary px-4 py-2 text-xs font-semibold text-px-navy">
                  S&apos;inscrire
                </button>
              </form>
              {newsMsg ? <p className="mt-2 text-[11px] text-px-primary-light">{newsMsg}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col items-center justify-between gap-6 pt-8 text-xs text-slate-400 lg:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 lg:justify-start">
            <div className="inline-flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5 text-px-primary" />
              <span>{SITE_INFO.slaHours || 'Support réactif'}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300">
              <CheckCircle className="h-3.5 w-3.5 text-px-primary" />
              <span>{SITE_INFO.address ? 'Présence locale' : 'France'}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px]">
            <span>
              © {new Date().getFullYear()} {SITE_INFO.name}
            </span>
            {legalLinks.map((l) => (
              <React.Fragment key={l.path}>
                <span aria-hidden="true">·</span>
                <button type="button" onClick={() => navigateTo(l.path)} className="underline-offset-2 transition-colors hover:text-white hover:underline">
                  {l.label}
                </button>
              </React.Fragment>
            ))}
            <span aria-hidden="true">·</span>
            <button type="button" onClick={onOpenCookies} className="font-medium underline underline-offset-2 transition-colors hover:text-px-primary-light">
              Gérer mes cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
