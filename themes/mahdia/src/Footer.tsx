/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useState } from 'react';
import { ArrowUp, Banknote, Headphones, Landmark, Mail, MapPin, Phone, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { isModuleActive, useSnapify, type ThemeChromeProps } from '@snapify/sdk/theme';
import { followLink, IS_PREVIEW, parseReassurance, shopActive, useMenus, useOptions } from './site';
import { Brand } from './Brand';
import { cx } from './kit';

const LEGAL = ['/mentions-legales/', '/politique-de-confidentialite/', '/cookies/'];
const REASSURANCE_ICONS = [Truck, Banknote, RotateCcw, Headphones];

function Newsletter() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="w-full"
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
      <p className="mh-display text-2xl text-(--mh-on-dark)">Restez informé</p>
      <p className="mt-2 text-sm text-(--mh-fg-2)">Nouveautés, ventes privées et codes promo : lorem ipsum dolor sit amet.</p>
      <div className="mt-5 flex items-center gap-2 rounded-(--mh-r-btn) bg-white/8 p-1.5 ring-1 ring-white/15 focus-within:ring-white/40">
        <label htmlFor="mh-news" className="sr-only">
          Adresse e-mail
        </label>
        <input id="mh-news" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Votre adresse e-mail" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/45 focus:outline-none" />
        <button type="submit" disabled={busy} className="mh-btn mh-btn-accent shrink-0 px-4! py-2.5! text-xs disabled:opacity-60">
          S’inscrire
        </button>
      </div>
      {msg ? <p className={cx('mt-2 text-xs', msg.ok ? 'text-(--mh-on-dark)/75' : 'text-rose-300')}>{msg.text}</p> : null}
    </form>
  );
}

function Reassurance({ items }: { items: { title: string; text: string }[] }) {
  if (!items.length) return null;
  return (
    <section className="border-t border-(--mh-line) bg-(--mh-card)">
      <div className={cx('mx-auto grid max-w-7xl gap-6 px-5 py-10 sm:grid-cols-2 sm:px-8', items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : '')}>
        {items.map((it, i) => {
          const Icon = REASSURANCE_ICONS[i % REASSURANCE_ICONS.length];
          return (
            <div key={i} className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px_5px_16px_5px] bg-(--mh-paper-2) text-(--mh-accent-text)">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div>
                <p className="text-sm font-bold text-(--mh-ink)">{it.title}</p>
                {it.text ? <p className="mt-0.5 text-[13px] leading-relaxed text-(--mh-muted)">{it.text}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Footer({ navigate, openCookies }: ThemeChromeProps) {
  const { info, site } = useSnapify();
  const o = useOptions();
  const { primary, footer } = useMenus();
  const go = (path: string, newTab?: boolean) => followLink(path, navigate, newTab);
  const shop = shopActive();

  const menuById = (id: string) => site.menus?.find((m) => m.id === id)?.items || [];
  const colMenus = [
    { id: 'footer-col-1', title: site.menus?.find((m) => m.id === 'footer-col-1')?.label || 'Navigation', links: menuById('footer-col-1') },
    { id: 'footer-col-2', title: site.menus?.find((m) => m.id === 'footer-col-2')?.label || 'Explorer', links: menuById('footer-col-2') },
    { id: 'footer-col-3', title: site.menus?.find((m) => m.id === 'footer-col-3')?.label || 'Infos', links: menuById('footer-col-3') },
  ].filter((c) => c.links.length);
  const groups = primary.filter((i) => i.children?.length).slice(0, 2);
  const pages = [...primary.filter((i) => !i.children?.length && !i.highlight), ...footer.filter((i) => !LEGAL.includes(i.path) && !primary.some((p) => p.path === i.path))];
  const legal = footer.filter((i) => LEGAL.includes(i.path));
  const legalLinks = legal.length
    ? legal
    : [
        { id: 'ml', label: 'Mentions légales', path: '/mentions-legales/' },
        { id: 'pc', label: 'Politique de confidentialité', path: '/politique-de-confidentialite/' },
      ];
  const shopLinks = shop
    ? [
        { id: 's-all', label: 'Tous les produits', path: '/boutique/' },
        { id: 's-sale', label: 'Promotions', path: '/boutique/?promo=1' },
        ...(isModuleActive('novalabs.customers') ? [{ id: 's-account', label: 'Mon compte', path: '/compte/' }] : []),
        ...(isModuleActive('novalabs.checkout') ? [{ id: 's-track', label: 'Suivre ma commande', path: '/commande/suivi/' }] : []),
      ]
    : [];
  const name = (site.branding.siteName || info.name).replace(/®$/, '');
  const columns = (
    colMenus.length
      ? colMenus
      : [
          ...(shopLinks.length ? [{ id: 'shop', title: 'Boutique', links: shopLinks }] : []),
          ...groups.map((g) => ({ id: g.id, title: g.label, links: g.children! })),
          ...(pages.length ? [{ id: 'nav', title: 'Informations', links: pages }] : []),
        ]
  ).slice(0, 3);

  return (
    <>
      {o.reassurance ? <Reassurance items={parseReassurance(o.reassuranceItems)} /> : null}
      <footer className="mh-dark relative bg-(--mh-ink) pb-24 text-(--mh-fg) lg:pb-0">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid grid-cols-1 gap-12 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10">
            <div className="space-y-6 lg:col-span-4">
              <Brand dark onClick={() => go('/')} />
              {info.slogan ? <p className="max-w-sm text-sm leading-relaxed text-(--mh-fg-2)">{info.slogan}</p> : null}
              <ul className="space-y-3 text-sm text-(--mh-fg-2)">
                <li>
                  <a href={`tel:${info.phoneClean}`} className="inline-flex items-center gap-3 transition-colors hover:text-white">
                    <Phone className="h-4 w-4 text-(--mh-accent-text)" />
                    {info.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${info.contactEmail}`} className="inline-flex items-center gap-3 transition-colors hover:text-white">
                    <Mail className="h-4 w-4 text-(--mh-accent-text)" />
                    {info.contactEmail}
                  </a>
                </li>
                {info.address ? (
                  <li className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-(--mh-accent-text)" />
                    {info.address}
                  </li>
                ) : null}
              </ul>
            </div>

            {columns.map((c) => (
              <div key={c.id} className="space-y-5 lg:col-span-2">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-(--mh-on-dark)/55">{c.title}</p>
                <ul className="space-y-3">
                  {c.links.map((l) => (
                    <li key={l.id}>
                      <button type="button" onClick={() => go(l.path, 'openInNewTab' in l ? !!l.openInNewTab : undefined)} className="text-left text-sm text-(--mh-fg-2) transition-colors hover:text-white">
                        {l.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {site.newsletterEnabled ? (
              <div className={cx('sm:col-span-2', columns.length >= 3 ? 'lg:col-span-12 lg:max-w-md' : 'lg:col-span-4')}>
                <Newsletter />
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-6 text-xs text-(--mh-fg-2) sm:px-8 lg:flex-row">
            <span>
              © {new Date().getFullYear()} {info.legalName || name}. Tous droits réservés.
            </span>
            {o.paymentBadges && shop ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  { icon: Banknote, label: 'Paiement à la livraison' },
                  { icon: Landmark, label: 'Virement bancaire' },
                  { icon: ShieldCheck, label: 'Commande sécurisée' },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-medium text-(--mh-on-dark)/80">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {legalLinks.map((l) => (
                <button key={l.id} type="button" onClick={() => go(l.path)} className="transition-colors hover:text-white">
                  {l.label}
                </button>
              ))}
              <button type="button" onClick={openCookies} className="transition-colors hover:text-white">
                Gérer mes cookies
              </button>
              <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white hover:text-(--mh-ink)" aria-label="Revenir en haut">
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
