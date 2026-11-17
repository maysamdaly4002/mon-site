/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Search } from 'lucide-react';
import type { BlockProps } from '@snapify/sdk/theme';
import { useOptions } from '../site';
import { ButtonRow, CmsButton, cx, Frame, Placeholder, Reveal, RichHtml, Section, SectionHeading, useCms, useGo, VideoPlayer } from '../kit';

export function RichTextBlock({ d, style }: BlockProps<'richText'>) {
  return (
    <Section style={{ ...style, width: style.width === 'default' ? 'narrow' : style.width }}>
      <Reveal>
        <RichHtml html={d.html} className={d.size === 'large' ? 'dg-prose-lg' : undefined} />
      </Reveal>
    </Section>
  );
}

const RATIO = { landscape: 'aspect-[4/3]', square: 'aspect-square', portrait: 'aspect-[4/5]' } as const;

export function TextMediaBlock({ d, style }: BlockProps<'textMedia'>) {
  const { t } = useCms();
  const left = d.mediaPosition === 'left';
  const media =
    d.mediaType === 'video' ? (
      <VideoPlayer source={d.videoSource} url={d.video} poster={d.poster} autoplay={d.autoplay} title={d.title} />
    ) : d.image ? (
      <img src={d.image} alt={d.imageAlt || ''} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1.4s] group-hover:scale-[1.03]" />
    ) : (
      <Placeholder label="Image à choisir" className="h-full w-full" />
    );

  const visual =
    d.mediaStyle === 'framed' ? (
      <div className={cx('relative', left ? 'mr-4 mb-4' : 'ml-4 mb-4')}>
        <div className={cx('absolute inset-0 translate-y-4 rounded-(--dg-r-lg) border border-(--dg-accent)/60', left ? 'translate-x-4' : '-translate-x-4')} />
        <Frame className={cx('group', RATIO[d.ratio])}>{media}</Frame>
      </div>
    ) : (
      <Frame arch={d.mediaStyle === 'polaroid'} className={cx('group', RATIO[d.ratio])}>
        {media}
      </Frame>
    );

  return (
    <Section style={style}>
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal delay={100} className={cx(left ? 'lg:order-1' : 'lg:order-2')}>
          <figure>
            {visual}
            {d.caption ? <figcaption className="mt-4 text-sm italic text-(--dg-fg-2)">{t(d.caption)}</figcaption> : null}
          </figure>
        </Reveal>
        <div className={cx('space-y-8', left ? 'lg:order-2' : 'lg:order-1')}>
          <SectionHeading h={{ ...d, align: 'left', headerLink: undefined }} className="mb-0! sm:mb-0!" />
          <Reveal className="space-y-8">
            {d.html ? <RichHtml html={d.html} /> : null}
            {d.bullets.length ? (
              <ul className="divide-y divide-(--dg-rule) border-y border-(--dg-rule)">
                {d.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-4 py-3.5 text-[0.95rem] text-(--dg-fg)">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-(--dg-accent-text)" />
                    {t(b)}
                  </li>
                ))}
              </ul>
            ) : null}
            <ButtonRow buttons={d.buttons} />
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

export function ImageBlock({ d, style }: BlockProps<'image'>) {
  const { t } = useCms();
  if (!d.url) return null;
  const width = d.width === 'full' ? 'full' : d.width === 'wide' ? 'wide' : style.width;
  return (
    <Section style={{ ...style, width }}>
      <Reveal>
        <figure>
          <div className={cx('overflow-hidden', d.rounded && d.width !== 'full' && 'rounded-(--dg-r-lg)')}>
            <img src={d.url} alt={d.alt} loading="lazy" className="max-h-[80vh] w-full object-cover" />
          </div>
          {d.caption ? (
            <figcaption className={cx('mt-4 flex items-center gap-3 text-sm text-(--dg-fg-2)', d.width === 'full' && 'mx-auto max-w-7xl px-5 sm:px-8')}>
              <span className="h-px w-8 bg-(--dg-accent)" />
              {t(d.caption)}
            </figcaption>
          ) : null}
        </figure>
      </Reveal>
    </Section>
  );
}

export function VideoBlock({ d, style }: BlockProps<'video'>) {
  const { t } = useCms();
  const width = d.width === 'full' ? 'full' : d.width === 'wide' ? 'wide' : style.width;
  return (
    <Section style={{ ...style, width }}>
      <Reveal className="space-y-5">
        {d.title ? <h2 className="dg-display text-3xl sm:text-4xl">{t(d.title)}</h2> : null}
        <div className={cx('aspect-video overflow-hidden bg-black', d.width !== 'full' && 'rounded-(--dg-r-lg)')}>
          <VideoPlayer source={d.source} url={d.url} poster={d.poster} autoplay={d.autoplay} title={d.title} />
        </div>
      </Reveal>
    </Section>
  );
}

const SLIDE_HEIGHT = { md: 'h-[26rem] sm:h-[30rem]', lg: 'h-[32rem] sm:h-[38rem]', xl: 'h-[36rem] sm:h-[46rem]' } as const;

export function SlidesBlock({ d, style }: BlockProps<'slides'>) {
  const { t } = useCms();
  const go = useGo();
  const { animations } = useOptions();
  const slides = d.slides.filter((s) => s.image);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const delay = Math.max(d.interval || 6, 3) * 1000;

  useEffect(() => {
    if (!d.autoplay || paused || slides.length < 2) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % slides.length), delay);
    return () => window.clearTimeout(id);
  }, [d.autoplay, paused, slides.length, delay, index]);

  if (!slides.length) return null;
  const move = (step: number) => setIndex((i) => (i + step + slides.length) % slides.length);

  return (
    <Section style={style}>
      <Reveal>
        <div className={cx('relative overflow-hidden rounded-(--dg-r-lg) bg-(--dg-ink)', SLIDE_HEIGHT[d.height])} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          {slides.map((s, i) => (
            <div key={s.id} className={cx('absolute inset-0 transition-opacity duration-1000', i === index ? 'opacity-100' : 'pointer-events-none opacity-0')} aria-hidden={i !== index}>
              <img src={s.image} alt={s.alt || s.title || ''} loading={i ? 'lazy' : undefined} className={cx('h-full w-full object-cover', i === index && animations && 'dg-kenburns')} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              {s.title || s.text ? (
                <div className="dg-dark absolute inset-x-0 bottom-0 max-w-3xl space-y-4 p-8 text-(--dg-fg) sm:p-12">
                  {s.title ? <h3 className="dg-display text-4xl sm:text-5xl">{t(s.title)}</h3> : null}
                  {s.text ? <p className="text-base text-(--dg-fg-2) sm:text-lg">{t(s.text)}</p> : null}
                  {s.link ? (
                    <button type="button" onClick={() => go(s.link)} className="dg-link">
                      Découvrir
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {slides.length > 1 ? (
            <div className="absolute right-6 top-6 flex items-center gap-2 sm:right-8 sm:top-8">
              <span className="mr-2 font-mono text-xs text-white/80">
                {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
              </span>
              <button type="button" onClick={() => move(-1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/20 text-white backdrop-blur transition hover:bg-white hover:text-black" aria-label="Diapositive précédente">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/20 text-white backdrop-blur transition hover:bg-white hover:text-black" aria-label="Diapositive suivante">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          {slides.length > 1 ? (
            <div className="absolute inset-x-0 bottom-0 flex gap-1 px-8 pb-4 sm:px-12">
              {slides.map((s, i) => (
                <button key={s.id} type="button" onClick={() => setIndex(i)} className="h-6 flex-1" aria-label={`Diapositive ${i + 1}`}>
                  <span className="block h-0.5 overflow-hidden bg-white/25">
                    {i === index ? <span key={`${index}-${paused}`} className={cx('block h-full bg-white', d.autoplay && !paused ? 'dg-progress' : '')} style={{ animationDuration: `${delay}ms` }} /> : i < index ? <span className="block h-full bg-white" /> : null}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </Reveal>
    </Section>
  );
}

export function TableBlock({ d, style }: BlockProps<'table'>) {
  const { t } = useCms();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? d.rows.filter((r) => r.cells.some((c) => t(c).toLowerCase().includes(q))) : d.rows;
  }, [d.rows, query]);

  return (
    <Section style={style}>
      <SectionHeading h={d} />
      <Reveal>
        {d.searchable ? (
          <div className="relative mb-6 max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--dg-muted)" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(d.searchPlaceholder) || 'Rechercher…'} className="dg-input pl-11!" />
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-(--dg-r-lg) border border-(--dg-rule) bg-(--dg-surface)">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-(--dg-rule)">
                {d.columns.map((c) => (
                  <th key={c} scope="col" className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--dg-fg-2)">
                    {t(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-(--dg-rule) transition-colors last:border-0 hover:bg-(--dg-accent)/5">
                  {r.cells.map((c, i) => (
                    <td key={i} className={cx('px-5 py-4 align-top', i === 0 ? 'font-semibold text-(--dg-fg)' : 'text-(--dg-fg-2)')}>
                      {t(c)}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={d.columns.length} className="px-5 py-10 text-center text-(--dg-fg-2)">
                    Aucun résultat pour « {query} ».
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Reveal>
    </Section>
  );
}

export function DetailsBlock({ d, style }: BlockProps<'details'>) {
  const { t } = useCms();
  return (
    <Section style={style}>
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-12">
        <div className="space-y-14 lg:col-span-7">
          {d.sections.map((s, i) => (
            <Reveal key={s.id} delay={i * 60} className="grid grid-cols-[3rem_1fr] gap-4 border-t border-(--dg-rule) pt-8">
              <span className="dg-num text-2xl text-(--dg-accent-text)">{String(i + 1).padStart(2, '0')}</span>
              <div className="space-y-4">
                <h2 className="dg-display text-3xl sm:text-[2.4rem]">{t(s.title)}</h2>
                {s.text ? <p className="leading-relaxed text-(--dg-fg-2)">{t(s.text)}</p> : null}
                {s.bullets.length ? (
                  <ul className="space-y-2.5">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3 text-[0.95rem] text-(--dg-fg)">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-(--dg-accent-text)" />
                        {t(b)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>
        {d.facts.length || d.sideTitle ? (
          <aside className="lg:col-span-5">
            <Reveal delay={120} className="lg:sticky lg:top-28">
              <div className="dg-dark rounded-(--dg-r-lg) bg-(--dg-ink) p-8 text-(--dg-fg) sm:p-10">
                {d.sideTitle ? <h3 className="dg-display mb-8 text-3xl">{t(d.sideTitle)}</h3> : null}
                <dl className="divide-y divide-white/10">
                  {d.facts.map((f) => (
                    <div key={f.id} className="flex items-baseline justify-between gap-6 py-4">
                      <dt className="text-xs uppercase tracking-[0.16em] text-(--dg-fg-2)">{t(f.label)}</dt>
                      <dd className="text-right text-sm font-semibold">{t(f.value)}</dd>
                    </div>
                  ))}
                </dl>
                {d.sideButton ? <CmsButton b={d.sideButton} className="mt-8 w-full" /> : null}
              </div>
            </Reveal>
          </aside>
        ) : null}
      </div>
    </Section>
  );
}

export function SpacerBlock({ d }: BlockProps<'spacer'>) {
  return (
    <div style={{ height: Math.max(0, d.height) }} className="flex items-center">
      {d.divider ? <div className="mx-auto h-px w-full max-w-7xl bg-(--dg-line)" /> : null}
    </div>
  );
}

export function HtmlBlock({ d, style }: BlockProps<'html'>) {
  return (
    <Section style={style}>
      <div dangerouslySetInnerHTML={{ __html: d.html }} />
    </Section>
  );
}
