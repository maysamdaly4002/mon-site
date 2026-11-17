/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Sparkle } from 'lucide-react';
import type { BlockProps } from '@snapify/sdk/theme';
import type { HeroData } from '@snapify/sdk/content';
import { useOptions } from '../site';
import { ButtonRow, cx, Eyebrow, Frame, Highlighted, Reveal, Section, useCms, useGo, VideoPlayer } from '../kit';

function useRotatingWord(words: string[]) {
  const { animations } = useOptions();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (words.length < 2 || !animations) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), 2800);
    return () => window.clearInterval(id);
  }, [words.length, animations]);
  return words.length ? words[index % words.length] : '';
}

function useParallax(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || window.matchMedia('(pointer: coarse)').matches) return;
    const onMove = (e: MouseEvent) => {
      const r = node.getBoundingClientRect();
      setOffset({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [enabled]);
  const layer = (depth: number): React.CSSProperties => ({ transform: `translate3d(${offset.x * depth}px, ${offset.y * depth}px, 0)`, transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' });
  return { ref, layer };
}

const isEmbed = (url?: string) => !!url && /youtu\.?be|vimeo\.com/.test(url);

function HeroMedia({ d, centered }: { d: HeroData; centered: boolean }) {
  const { t } = useCms();
  const { animations } = useOptions();
  const { ref, layer } = useParallax(d.parallax && animations && !centered);

  const main =
    d.media === 'video' ? (
      <VideoPlayer source={isEmbed(d.video) ? 'embed' : 'file'} url={d.video} poster={d.videoPoster} autoplay />
    ) : d.mainImage ? (
      <img src={d.mainImage} alt={d.mainImageAlt || ''} className="dg-kenburns h-full w-full object-cover" fetchPriority="high" />
    ) : null;

  if (centered) {
    if (!main) return null;
    return (
      <Reveal delay={200} className="relative mt-16">
        <Frame className="aspect-[16/10] sm:aspect-[21/9]">{main}</Frame>
        {d.statValue ? (
          <div className="dg-card absolute -bottom-8 left-6 max-w-xs p-5 shadow-xl sm:left-10">
            <div className="dg-num text-4xl text-(--dg-fg)">{t(d.statValue)}</div>
            {d.statLabel ? <div className="mt-1 text-xs text-(--dg-fg-2)">{t(d.statLabel)}</div> : null}
          </div>
        ) : null}
      </Reveal>
    );
  }

  const composition = d.media === 'composition';
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[33rem] lg:mr-0">
      <Frame arch className="aspect-[4/5] shadow-[0_50px_100px_-50px_rgba(26,22,18,0.55)]">
        {main}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
        {composition && d.chipText ? (
          <div className="absolute inset-x-0 bottom-5 flex justify-center px-4">
            <span className="rounded-full border border-white/25 bg-black/30 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md">{t(d.chipText)}</span>
          </div>
        ) : null}
      </Frame>

      {composition && d.badgeCardTitle ? (
        <div style={layer(-14)} className="absolute -left-4 top-[18%] sm:-left-12">
          <div className="dg-float dg-dark flex items-center gap-3 rounded-(--dg-r-lg) bg-(--dg-ink) py-3 pl-3 pr-5 text-(--dg-fg) shadow-2xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-(--dg-accent) text-(--dg-on-accent)">
              <Check className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{t(d.badgeCardTitle)}</span>
              {d.badgeCardText ? <span className="block text-[11px] text-(--dg-fg-2)">{t(d.badgeCardText)}</span> : null}
            </span>
          </div>
        </div>
      ) : null}

      {composition && d.statValue ? (
        <div style={layer(18)} className="absolute -right-3 top-[52%] sm:-right-10">
          <div className="dg-float-late dg-card bg-(--dg-card)! p-5 shadow-2xl">
            <div className="dg-num text-[2.6rem] leading-none text-(--dg-ink)">{t(d.statValue)}</div>
            {d.statLabel ? <div className="mt-2 max-w-[11rem] text-[11px] leading-snug text-(--dg-muted)">{t(d.statLabel)}</div> : null}
          </div>
        </div>
      ) : null}

      {composition && d.secondaryImage ? (
        <figure style={layer(10)} className="absolute -bottom-10 -left-6 w-40 -rotate-3 bg-white p-2 pb-3 shadow-2xl sm:-left-16 sm:w-52">
          <img src={d.secondaryImage} alt={d.secondaryImageAlt || ''} loading="lazy" className="aspect-square w-full object-cover" />
          {d.secondaryCaption ? <figcaption className="dg-display mt-2 px-1 text-center text-base italic leading-tight text-(--dg-ink)">{t(d.secondaryCaption)}</figcaption> : null}
        </figure>
      ) : null}
    </div>
  );
}

export function HeroBlock({ d, style }: BlockProps<'hero'>) {
  const { t } = useCms();
  const words = d.rotatingWords.filter(Boolean).map((w) => t(w));
  const word = useRotatingWord(words);
  const centered = d.layout === 'centered' || d.media === 'none';

  const title = (
    <h1 className={cx('dg-display text-[2.9rem] sm:text-6xl lg:text-[5.2rem]', centered && 'mx-auto max-w-5xl')}>
      {t(d.title)}
      {word ? (
        <>
          {' '}
          <em key={word} className="dg-em dg-word-in inline-block">
            {word}
          </em>
        </>
      ) : d.highlight ? (
        <>
          {' '}
          <em className="dg-em">{t(d.highlight)}</em>
        </>
      ) : null}
    </h1>
  );

  const intro = (
    <>
      {d.badgeText ? (
        <div className="inline-flex max-w-full items-center gap-3 rounded-full border border-(--dg-rule) bg-(--dg-surface) py-1 pl-1 pr-4 text-xs text-(--dg-fg-2) backdrop-blur">
          {d.badgeTag ? <span className="rounded-full bg-(--dg-ink) px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#f5f0e8]">{t(d.badgeTag)}</span> : null}
          <span className="truncate">{t(d.badgeText)}</span>
        </div>
      ) : null}
      {title}
      {d.subtitle ? <p className={cx('max-w-xl text-lg leading-relaxed text-(--dg-fg-2)', centered && 'mx-auto')}>{t(d.subtitle)}</p> : null}
      <ButtonRow buttons={d.buttons} size="lg" center={centered} />
      {d.liveText || d.trustItems.length ? (
        <div className={cx('flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-(--dg-rule) pt-6 text-xs text-(--dg-fg-2)', centered && 'justify-center')}>
          {d.liveText ? (
            <span className="inline-flex items-center gap-2.5 font-semibold text-(--dg-fg)">
              <span className="dg-live h-2 w-2 rounded-full bg-(--dg-accent)" />
              {t(d.liveText)}
            </span>
          ) : null}
          {d.trustItems.map((it) => (
            <span key={it} className="inline-flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-(--dg-accent-text)" />
              {t(it)}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <Section style={style}>
        {centered ? (
          <div className="text-center">
            <Reveal className="space-y-8">{intro}</Reveal>
            <HeroMedia d={d} centered />
          </div>
        ) : (
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-10">
            <Reveal className="space-y-8 lg:col-span-6">{intro}</Reveal>
            <Reveal delay={150} className="pb-10 lg:col-span-6 lg:pb-0">
              {d.media === 'none' ? null : <HeroMedia d={d} centered={false} />}
            </Reveal>
          </div>
        )}
      </Section>
      {d.marquee.length ? <WordBand words={d.marquee.map((w) => t(w))} speed="normal" /> : null}
    </>
  );
}

function WordBand({ words, speed }: { words: string[]; speed: 'slow' | 'normal' | 'fast' }) {
  const loop = [...words, ...words];
  return (
    <div className="overflow-hidden border-y border-(--dg-line) bg-(--dg-paper) py-5 text-(--dg-ink)">
      <div className={cx('dg-marquee flex w-max items-center gap-10', speed === 'slow' && 'dg-marquee-slow', speed === 'fast' && 'dg-marquee-fast')}>
        {loop.map((w, i) => (
          <span key={i} className="flex items-center gap-10">
            <span className="dg-display whitespace-nowrap text-2xl italic sm:text-3xl">{w}</span>
            <Sparkle className="h-4 w-4 shrink-0 text-(--dg-accent)" strokeWidth={1.5} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function MarqueeBlock({ d, style }: BlockProps<'marquee'>) {
  const { t } = useCms();
  const items = d.items.filter((i) => i.text || i.logo);
  if (!items.length) return null;
  const logos = items.some((i) => i.logo);
  if (!logos) return <WordBand words={items.map((i) => t(i.text))} speed={d.speed} />;
  const loop = [...items, ...items];
  return (
    <Section style={style} contentClassName="overflow-hidden">
      <div className={cx('dg-marquee flex w-max items-center gap-16', d.speed === 'slow' && 'dg-marquee-slow', d.speed === 'fast' && 'dg-marquee-fast')}>
        {loop.map((it, i) =>
          it.logo ? (
            <img key={i} src={it.logo} alt={it.text || ''} loading="lazy" className="h-9 w-auto max-w-[9rem] object-contain opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0" />
          ) : (
            <span key={i} className="dg-display whitespace-nowrap text-2xl italic">
              {t(it.text)}
            </span>
          )
        )}
      </div>
    </Section>
  );
}

export function PageHeaderBlock({ d, style }: BlockProps<'pageHeader'>) {
  const { t } = useCms();
  const go = useGo();
  const crumbs = d.breadcrumb ? [{ label: 'Accueil', link: '/' }, ...(d.parentLabel ? [{ label: d.parentLabel, link: d.parentLink || '' }] : [])] : [];

  const text = (
    <Reveal className="space-y-7">
      {d.backLabel && d.backLink ? (
        <button type="button" onClick={() => go(d.backLink)} className="group inline-flex items-center gap-2 text-sm font-semibold text-(--dg-fg-2) transition-colors hover:text-(--dg-fg)">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          {t(d.backLabel)}
        </button>
      ) : null}
      {crumbs.length ? (
        <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-2 text-xs text-(--dg-fg-2)">
          {crumbs.map((c) => (
            <React.Fragment key={c.label}>
              <button type="button" onClick={() => go(c.link)} className="transition-colors hover:text-(--dg-fg)">
                {t(c.label)}
              </button>
              <ChevronRight className="h-3 w-3 opacity-60" />
            </React.Fragment>
          ))}
          <span className="font-medium text-(--dg-fg)">{t(d.title)}</span>
        </nav>
      ) : null}
      {d.eyebrow ? <Eyebrow>{t(d.eyebrow)}</Eyebrow> : null}
      <h1 className="dg-display text-[2.7rem] sm:text-6xl lg:text-7xl">
        <Highlighted title={d.title} highlight={d.highlight} />
      </h1>
      {d.intro ? <p className="max-w-2xl text-lg leading-relaxed text-(--dg-fg-2)">{t(d.intro)}</p> : null}
      <ButtonRow buttons={d.buttons} />
    </Reveal>
  );

  if (!d.image) {
    return (
      <Section style={style}>
        <div className="max-w-4xl">{text}</div>
        <div className="mt-14 h-px w-full bg-(--dg-rule)" />
      </Section>
    );
  }
  return (
    <Section style={style}>
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12">
        <div className="lg:col-span-7">{text}</div>
        <Reveal delay={150} className="lg:col-span-5">
          <Frame arch className="mx-auto aspect-[4/5] max-h-[34rem] w-full max-w-md lg:mr-0">
            <img src={d.image} alt={d.imageAlt || ''} className="dg-kenburns h-full w-full object-cover" fetchPriority="high" />
          </Frame>
        </Reveal>
      </div>
    </Section>
  );
}
