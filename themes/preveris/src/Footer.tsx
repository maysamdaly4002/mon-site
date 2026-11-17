/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useState } from 'react';
import { ArrowRight, ArrowUp, ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import type { ThemeChromeProps } from '@snapify/sdk/theme';
import { useSnapify } from '@snapify/sdk/theme';
import { followLink, IS_PREVIEW, useMenus, useOptions } from './site';
import { Brand } from './Brand';
import { cx } from './kit';

const LEGAL = ['/mentions-legales/', '/politique-de-confidentialite/', '/cookies/'];

function Newsletter() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="w-full max-w-md"
      onSubmit={async (e) => {
        e.preventDefault();
        if (IS_PREVIEW || busy) return;
        setBusy(true);
        setMsg(null);
        const r = await fetch('/api/public/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => null);
        const j = await r?.json().catch(() => ({}));
        setBusy(false);
        if (r?.ok) {
          setEmail('');
          setMsg({ ok: true, text: j?.pending ? 'Vérifiez votre boîte mail pour confirmer votre inscription.' : 'Inscription enregistrée, merci !' });
        } else setMsg({ ok: false, text: j?.error || 'Inscription impossible pour le moment.' });
      }}
    >
      <label htmlFor="pv-news" className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f5f0e8]/55">
        Lettre d’information
      </label>
      <div className="flex items-center gap-2 border-b border-white/25 pb-2 focus-within:border-white">
        <input
          id="pv-news"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre adresse e-mail"
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-white placeholder:text-white/40 focus:outline-none"
        />
        <button type="submit" disabled={busy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--pv-accent) text-(--pv-on-accent) transition-transform hover:scale-105 disabled:opacity-60" aria-label="S’inscrire">
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {msg ? <p className={cx('mt-2 text-xs', msg.ok ? 'text-[#f5f0e8]/75' : 'text-rose-300')}>{msg.text}</p> : null}
    </form>
  );
}

export function Footer({ navigate, openCookies }: ThemeChromeProps) {
  const { info, site } = useSnapify();
  const o = useOptions();
  const { primary, footer, cta } = useMenus();
  const go = (path: string, newTab?: boolean) => followLink(path, navigate, newTab);

  const menuById = (id: string) => site.menus?.find((m) => m.id === id)?.items || [];
  const colMenus = [
    { id: 'footer-col-1', title: site.menus?.find((m) => m.id === 'footer-col-1')?.label || 'Navigation', links: menuById('footer-col-1') },
    { id: 'footer-col-2', title: site.menus?.find((m) => m.id === 'footer-col-2')?.label || 'Explorer', links: menuById('footer-col-2') },
  ].filter((c) => c.links.length);
  const groups = colMenus.length ? [] : primary.filter((i) => i.children?.length).slice(0, 2);
  const pages = colMenus.length
    ? []
    : [...primary.filter((i) => !i.children?.length && !i.highlight), ...footer.filter((i) => !LEGAL.includes(i.path) && !primary.some((p) => p.path === i.path))];
  const legal = footer.filter((i) => LEGAL.includes(i.path));
  const legalLinks = legal.length
    ? legal
    : [
        { id: 'ml', label: 'Mentions légales', path: '/mentions-legales/' },
        { id: 'pc', label: 'Politique de confidentialité', path: '/politique-de-confidentialite/' },
      ];
  const name = (site.branding.siteName || info.name).replace(/®$/, '');

  return (
    <footer className="pv-dark relative overflow-hidden bg-(--pv-ink) pb-24 text-(--pv-fg) lg:pb-0">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-10 border-b border-white/10 py-16 lg:flex-row lg:items-end lg:justify-between lg:py-20">
          <div className="max-w-2xl space-y-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--pv-accent-text)">{info.baseline || 'Parlons de votre projet'}</div>
            <p className="pv-display text-4xl sm:text-5xl lg:text-6xl">{info.slogan || name}</p>
            <button type="button" onClick={() => go(cta.path)} className="pv-btn pv-btn-primary pv-btn-lg">
              {cta.label}
              <ArrowRight className="pv-btn-arrow h-4 w-4" />
            </button>
          </div>
          {site.newsletterEnabled ? <Newsletter /> : null}
        </div>

        <div className="grid grid-cols-1 gap-12 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-6 lg:col-span-4">
            <Brand dark onClick={() => go('/')} />
            <ul className="space-y-3 text-sm text-(--pv-fg-2)">
              <li>
                <a href={`tel:${info.phoneClean}`} className="inline-flex items-center gap-3 transition-colors hover:text-white">
                  <Phone className="h-4 w-4 text-(--pv-accent-text)" />
                  {info.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${info.contactEmail}`} className="inline-flex items-center gap-3 transition-colors hover:text-white">
                  <Mail className="h-4 w-4 text-(--pv-accent-text)" />
                  {info.contactEmail}
                </a>
              </li>
              {info.address ? (
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-(--pv-accent-text)" />
                  {info.address}
                </li>
              ) : null}
            </ul>
          </div>

          {colMenus.map((g) => (
            <div key={g.id} className="space-y-5 lg:col-span-3">
              <div className="text-[11px] leading-5 font-semibold uppercase tracking-[0.22em] text-[#f5f0e8]/55">{g.title}</div>
              <ul className="space-y-3">
                {g.links.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => go(c.path, c.openInNewTab)} className="text-left text-sm text-(--pv-fg-2) transition-colors hover:text-white">
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {groups.map((g) => (
            <div key={g.id} className="space-y-5 lg:col-span-3">
              <button type="button" onClick={() => go(g.path)} className="block text-[11px] leading-5 font-semibold uppercase tracking-[0.22em] text-[#f5f0e8]/55 transition-colors hover:text-white">
                {g.label}
              </button>
              <ul className="space-y-3">
                {g.children!.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => go(c.path, c.openInNewTab)} className="text-left text-sm text-(--pv-fg-2) transition-colors hover:text-white">
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {pages.length ? (
            <div className={cx('space-y-5', groups.length >= 2 ? 'lg:col-span-2' : 'lg:col-span-3')}>
              <div className="text-[11px] leading-5 font-semibold uppercase tracking-[0.22em] text-[#f5f0e8]/55">Navigation</div>
              <ul className="space-y-3">
                {pages.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => go(p.path, p.openInNewTab)} className={cx('group inline-flex items-center gap-1 text-left text-sm transition-colors hover:text-white', p.highlight ? 'text-(--pv-accent-text)' : 'text-(--pv-fg-2)')}>
                      {p.label}
                      {p.highlight ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {o.footerWordmark ? (
        <div className="pointer-events-none -mb-[0.12em] overflow-hidden text-center" aria-hidden="true">
          <div className="pv-wordmark">{name}</div>
        </div>
      ) : null}

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-6 text-xs text-(--pv-fg-2) sm:px-8 lg:flex-row">
          <span>
            © {new Date().getFullYear()} {info.legalName || name}. Tous droits réservés.
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legalLinks.map((l) => (
              <button key={l.id} type="button" onClick={() => go(l.path)} className="transition-colors hover:text-white">
                {l.label}
              </button>
            ))}
            <button type="button" onClick={openCookies} className="transition-colors hover:text-white">
              Gérer mes cookies
            </button>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="ml-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white hover:text-(--pv-ink)" aria-label="Revenir en haut">
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
