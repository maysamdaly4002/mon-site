/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Briques communes du thème Mahdia. Les couleurs passent par des variables sémantiques
 * (--mh-fg, --mh-fg-2, --mh-rule…) redéfinies dans les sections sombres (classe mh-dark) :
 * un composant s'adapte à son fond sans connaître la section qui le contient.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Download, Mail, Phone } from 'lucide-react';
import { applyTokens, type BlockStyle, type ButtonData, type SectionHeading as HeadingData } from '@snapify/sdk/content';
import { cmsIcon } from '@snapify/sdk/icons';
import { useSnapify } from '@snapify/sdk/theme';
import { IS_PREVIEW, useOptions } from './site';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ Données et liens */

export function useCms() {
  const { navigate, tokens } = useSnapify();
  const t = (s?: string) => applyTokens(s, tokens);
  return { navigate, tokens, t };
}

export function useGo() {
  const { navigate, t } = useCms();
  return (raw?: string, newTab?: boolean) => {
    const link = t(raw).trim();
    if (!link) return;
    if (IS_PREVIEW && !link.startsWith('/') && !link.startsWith('#')) return;
    if (link === '#preferences-cookies') window.dispatchEvent(new CustomEvent('snapify:open-cookies'));
    else if (/^(https?:)?\/\//.test(link) || newTab) window.open(link, '_blank', 'noopener');
    else if (/^(tel|mailto):/.test(link)) window.location.href = link;
    else if (link.startsWith('#')) document.getElementById(link.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else {
      navigate(link);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
}

const DarkContext = createContext(false);
export const useDark = () => useContext(DarkContext);

/* ------------------------------------------------------------------ Animation */

export function useInView<T extends Element>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

const AnimationContext = createContext<BlockStyle['animation']>('fade-up');

export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const animation = useContext(AnimationContext);
  const { animations } = useOptions();
  const { ref, inView } = useInView<HTMLDivElement>();
  if (animation === 'none' || !animations) return <div className={className}>{children}</div>;
  return (
    <div ref={ref} data-anim={animation} style={{ transitionDelay: `${delay}ms` }} className={cx('mh-reveal', inView && 'is-visible', className)}>
      {children}
    </div>
  );
}

/** Nombre animé : « 1 250 », « -35 % » ou « 4,8 » ; une valeur non numérique est affichée telle quelle. */
export function CountUp({ value, animate = true }: { value: string; animate?: boolean }) {
  const match = value.match(/^(\D*?)(-?\d+(?:[\s\u00a0\u202f]\d{3})*(?:[.,]\d+)?)(.*)$/);
  const { ref, inView } = useInView<HTMLSpanElement>(0.4);
  const { animations } = useOptions();
  const target = match ? Number(match[2].replace(/\s/g, '').replace(',', '.')) : 0;
  const decimals = match?.[2].match(/[.,](\d+)/)?.[1].length ?? 0;
  const [shown, setShown] = useState(animate && animations ? 0 : target);
  useEffect(() => {
    if (!match || !inView || !animate || !animations) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1600, 1);
      setShown(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target, animate, animations]);
  if (!match) return <span>{value}</span>;
  return (
    <span ref={ref} className="tabular-nums">
      {match[1]}
      {shown.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {match[3]}
    </span>
  );
}

/* ------------------------------------------------------------------ Section */

const PAD_TOP: Record<BlockStyle['paddingTop'], string> = { none: 'pt-0', sm: 'pt-10 sm:pt-12', md: 'pt-14 sm:pt-20', lg: 'pt-20 sm:pt-28', xl: 'pt-28 sm:pt-40' };
const PAD_BOTTOM: Record<BlockStyle['paddingBottom'], string> = { none: 'pb-0', sm: 'pb-10 sm:pb-12', md: 'pb-14 sm:pb-20', lg: 'pb-20 sm:pb-28', xl: 'pb-28 sm:pb-40' };
export const WIDTH: Record<BlockStyle['width'], string> = {
  narrow: 'mx-auto max-w-3xl px-5 sm:px-8',
  default: 'mx-auto max-w-7xl px-5 sm:px-8',
  wide: 'mx-auto max-w-[96rem] px-5 sm:px-8',
  full: 'w-full',
};
const BG: Record<BlockStyle['background'], string> = {
  none: '',
  white: 'bg-(--mh-card)',
  surface: 'bg-(--mh-paper-2)',
  soft: 'mh-bg-soft',
  navy: 'bg-(--mh-ink) mh-dark',
  brand: 'bg-(--mh-accent) mh-dark mh-brand',
  image: 'bg-(--mh-ink)',
  video: 'bg-(--mh-ink)',
};

export function isDarkStyle(s: BlockStyle) {
  return s.background === 'navy' || s.background === 'brand' || ((s.background === 'image' || s.background === 'video') && s.overlayTone !== 'light');
}

function Decor({ decor }: { decor: BlockStyle['decor'] }) {
  switch (decor) {
    case 'dots':
      return <div className="mh-decor mh-dots inset-y-0 right-0 w-2/3" />;
    case 'grid':
      return <div className="mh-decor mh-grid inset-0" />;
    case 'rings':
      return <div className="mh-decor mh-waves -bottom-[30rem] -right-[18rem] h-[60rem] w-[60rem]" />;
    case 'diagonal':
      return <div className="mh-decor mh-hatch inset-y-0 left-0 w-1/2" />;
    case 'glow':
      return (
        <>
          <div className="mh-decor -top-40 right-[8%] h-[30rem] w-[30rem] rounded-full bg-(--mh-accent)/15 blur-[120px]" />
          <div className="mh-decor -bottom-48 -left-24 h-[26rem] w-[26rem] rounded-full bg-(--mh-accent)/10 blur-[120px]" />
        </>
      );
    default:
      return null;
  }
}

export function Section({ style, children, className, contentClassName }: { style: BlockStyle; children: React.ReactNode; className?: string; contentClassName?: string }) {
  const dark = isDarkStyle(style);
  const overlay = Math.min(Math.max(style.overlay ?? 55, 0), 95) / 100;
  const media = style.background === 'image' || style.background === 'video';
  return (
    <AnimationContext.Provider value={style.animation}>
      <DarkContext.Provider value={dark}>
        <section
          id={style.anchor || undefined}
          className={cx(
            'mh-section scroll-mt-28 text-(--mh-fg)',
            BG[style.background],
            media && dark && 'mh-dark',
            PAD_TOP[style.paddingTop],
            PAD_BOTTOM[style.paddingBottom],
            style.borderTop && 'border-t border-(--mh-rule)',
            style.hideOnMobile && 'hidden md:block',
            style.hideOnDesktop && 'md:hidden',
            className
          )}
        >
          {style.background === 'image' && style.backgroundImage ? (
            <div className="mh-decor inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${style.backgroundImage}')` }} />
          ) : null}
          {style.background === 'video' && style.backgroundVideo ? (
            <video className="mh-decor inset-0 h-full w-full object-cover" src={style.backgroundVideo} poster={style.backgroundImage} autoPlay muted loop playsInline />
          ) : null}
          {media ? (
            dark ? (
              <div className="mh-decor inset-0 bg-(--mh-ink)" style={{ opacity: overlay }} />
            ) : (
              <>
                <div className="mh-decor inset-0 bg-(--mh-paper)" style={{ opacity: overlay }} />
                <div className="mh-decor inset-0 bg-gradient-to-r from-(--mh-paper) via-(--mh-paper)/60 to-transparent" />
              </>
            )
          ) : null}
          <Decor decor={style.decor} />
          <div className={cx(WIDTH[style.width], contentClassName)}>{children}</div>
        </section>
      </DarkContext.Provider>
    </AnimationContext.Provider>
  );
}

/* ------------------------------------------------------------------ Typographie */

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('inline-flex items-center gap-2 rounded-full bg-(--mh-accent)/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-(--mh-accent-text)', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </div>
  );
}

/** Titre avec sa partie mise en avant, en italique et couleur d'accent. */
export function Highlighted({ title, highlight }: { title?: string; highlight?: string }) {
  const { t } = useCms();
  return (
    <>
      {t(title)}
      {highlight ? (
        <>
          {' '}
          <em className="mh-em">{t(highlight)}</em>
        </>
      ) : null}
    </>
  );
}

export function SectionHeading({ h, className, as = 'h2' }: { h: HeadingData; className?: string; as?: 'h1' | 'h2' }) {
  const go = useGo();
  const { t } = useCms();
  if (!h.eyebrow && !h.title && !h.intro) return null;
  const center = h.align === 'center';
  const Tag = as;
  return (
    <Reveal className={cx('mb-10 flex flex-col gap-6 sm:mb-12', center ? 'items-center text-center' : 'lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className={cx('space-y-5', center ? 'max-w-3xl' : 'max-w-3xl')}>
        {h.eyebrow ? <Eyebrow>{t(h.eyebrow)}</Eyebrow> : null}
        {h.title ? (
          <Tag className="mh-display text-[2.1rem] sm:text-[2.6rem] lg:text-5xl">
            <Highlighted title={h.title} highlight={h.highlight} />
          </Tag>
        ) : null}
        {h.intro ? <p className={cx('text-base leading-relaxed text-(--mh-fg-2) sm:text-lg', center && 'mx-auto max-w-2xl')}>{t(h.intro)}</p> : null}
      </div>
      {h.headerLinkLabel && h.headerLink && !center ? (
        <button type="button" onClick={() => go(h.headerLink)} className="mh-link shrink-0">
          {t(h.headerLinkLabel)}
          <ArrowUpRight className="h-4 w-4" />
        </button>
      ) : null}
    </Reveal>
  );
}

/** HTML de l'éditeur riche : variables remplacées, liens internes routés côté client. */
export function RichHtml({ html, className }: { html: string; className?: string }) {
  const { t } = useCms();
  const go = useGo();
  return (
    <div
      className={cx('mh-prose', className)}
      dangerouslySetInnerHTML={{ __html: t(html) }}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest('a');
        const href = a?.getAttribute('href');
        if (!a || !href || a.target === '_blank' || /^(https?:|mailto:|tel:)/.test(href)) return;
        e.preventDefault();
        go(href);
      }}
    />
  );
}

export const hasIcon = (name?: string) => Boolean(cmsIcon(name));

export function Icon({ name, className }: { name?: string; className?: string }) {
  const C = cmsIcon(name);
  return C ? <C className={className ?? 'h-5 w-5'} strokeWidth={1.6} /> : null;
}

/* ------------------------------------------------------------------ Boutons */

const BTN_ICON = { arrow: ArrowRight, 'arrow-up-right': ArrowUpRight, phone: Phone, mail: Mail, download: Download, none: null } as const;

export function CmsButton({ b, size = 'md', className }: { b: ButtonData; size?: 'md' | 'lg'; className?: string }) {
  const go = useGo();
  const { t } = useCms();
  const IconC = BTN_ICON[b.icon] ?? null;
  const lead = b.icon === 'phone' || b.icon === 'mail';
  const variant = { primary: 'mh-btn-primary', secondary: 'mh-btn-outline', dark: 'mh-btn-dark', light: 'mh-btn-light', glass: 'mh-btn-glass', link: 'mh-link' }[b.variant] ?? 'mh-btn-primary';
  const icon = IconC ? <IconC className={cx('h-4 w-4 shrink-0', !lead && 'mh-btn-arrow')} /> : null;
  return (
    <button type="button" onClick={() => go(b.link, b.newTab)} className={cx(b.variant === 'link' ? variant : cx('mh-btn', variant, size === 'lg' && 'mh-btn-lg'), className)}>
      {lead ? icon : null}
      <span>{t(b.label)}</span>
      {!lead ? icon : null}
    </button>
  );
}

export function ButtonRow({ buttons, className, size, center }: { buttons?: ButtonData[]; className?: string; size?: 'md' | 'lg'; center?: boolean }) {
  if (!buttons?.length) return null;
  return (
    <div className={cx('flex flex-wrap items-center gap-3', center && 'justify-center', className)}>
      {buttons.map((b) => (
        <CmsButton key={b.id} b={b} size={size} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Médias */

/** Visuel principal : en vague (signature du thème, coins opposés très arrondis) ou rectangle selon les options. */
export function Frame({ shaped, className, children }: { shaped?: boolean; className?: string; children: React.ReactNode }) {
  const { shapes } = useOptions();
  return <div className={cx('relative overflow-hidden bg-(--mh-paper-2)', shaped && shapes ? 'mh-shape' : 'rounded-(--mh-r-lg)', className)}>{children}</div>;
}

export function toEmbedUrl(url: string, autoplay = false): string | null {
  try {
    const u = new URL(url);
    const params = autoplay ? '?autoplay=1&mute=1&rel=0' : '?rel=0';
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}${params}`;
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}${params}` : null;
    }
    if (host.endsWith('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}${autoplay ? '?autoplay=1&muted=1' : ''}` : null;
    }
    return url;
  } catch {
    return null;
  }
}

export function VideoPlayer({ source, url, poster, autoplay, title, className }: { source: 'file' | 'embed'; url?: string; poster?: string; autoplay?: boolean; title?: string; className?: string }) {
  if (!url) return <Placeholder label="Vidéo à choisir" className={className} />;
  if (source === 'embed') {
    const src = toEmbedUrl(url, autoplay);
    return src ? <iframe src={src} title={title || 'Vidéo'} className={cx('h-full w-full', className)} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" loading="lazy" /> : null;
  }
  return autoplay ? (
    <video src={url} poster={poster} className={cx('h-full w-full object-cover', className)} autoPlay muted loop playsInline />
  ) : (
    <video src={url} poster={poster} className={cx('h-full w-full object-cover', className)} controls preload="metadata" />
  );
}

export function Placeholder({ label, className }: { label: string; className?: string }) {
  return <div className={cx('flex items-center justify-center bg-(--mh-paper-2) text-sm text-(--mh-fg-2)', className)}>{label}</div>;
}
