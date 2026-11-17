/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Phone, Plus, Quote, X } from 'lucide-react';
import type { BlockProps } from '@snapify/sdk/theme';
import type { CardItem, CardsData } from '@snapify/sdk/content';
import { useOptions } from '../site';
import { ButtonRow, CountUp, cx, Frame, hasIcon, Icon, Reveal, RichHtml, Section, SectionHeading, useCms, useGo } from '../kit';

const COLS = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' } as const;

/* ------------------------------------------------------------------ Cartes */

function CardText({ it, d }: { it: CardItem; d: CardsData }) {
  const { t } = useCms();
  if (!it.text) return null;
  return (
    <p className="text-[0.95rem] leading-relaxed text-(--mh-fg-2)">
      {d.textPrefix ? <strong className="font-semibold text-(--mh-fg)">{t(d.textPrefix)} </strong> : null}
      {t(it.text)}
    </p>
  );
}

function CardFooter({ it, d }: { it: CardItem; d: CardsData }) {
  const { t } = useCms();
  const go = useGo();
  return (
    <>
      {it.tags.length ? (
        <div className="space-y-2">
          {d.tagsLabel ? <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--mh-fg-2)">{t(d.tagsLabel)}</div> : null}
          <div className="flex flex-wrap gap-1.5">
            {it.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-(--mh-rule) px-2.5 py-1 text-[11px] font-medium text-(--mh-fg-2) transition-colors group-hover:border-current">
                {t(tag)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {it.link ? (
        <button type="button" onClick={() => go(it.link)} className="mh-link mt-auto self-start">
          {t(it.linkLabel) || 'En savoir plus'}
          <ArrowRight className="mh-btn-arrow h-4 w-4" />
        </button>
      ) : null}
    </>
  );
}

export function CardsBlock({ d, style }: BlockProps<'cards'>) {
  const { t } = useCms();
  const go = useGo();
  const grid = cx('grid grid-cols-1', COLS[d.columns] ?? COLS[3]);

  let body: React.ReactNode;
  if (d.style === 'numbered') {
    body = (
      <div className={cx(grid, 'border-t border-(--mh-rule)')}>
        {d.items.map((it, i) => (
          <Reveal key={it.id} delay={i * 80} className="flex h-full flex-col gap-5 border-b border-(--mh-rule) py-10 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0">
            <span className="mh-num text-6xl leading-none text-(--mh-accent-text)">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="text-xl font-semibold leading-snug">{t(it.title)}</h3>
            <CardText it={it} d={d} />
            <CardFooter it={it} d={d} />
          </Reveal>
        ))}
      </div>
    );
  } else if (d.style === 'minimal') {
    body = (
      <div className={cx(grid, 'gap-x-10 gap-y-12')}>
        {d.items.map((it, i) => (
          <Reveal key={it.id} delay={i * 70} className="flex h-full flex-col gap-4 border-t-2 border-(--mh-fg) pt-6">
            <div className="flex items-center gap-3">
              <Icon name={it.icon} className="h-5 w-5 text-(--mh-accent-text)" />
              <h3 className="text-lg font-semibold leading-snug">{t(it.title)}</h3>
            </div>
            <CardText it={it} d={d} />
            <CardFooter it={it} d={d} />
          </Reveal>
        ))}
      </div>
    );
  } else if (d.style === 'image') {
    body = (
      <div className={cx(grid, 'gap-x-8 gap-y-14')}>
        {d.items.map((it, i) => (
          <Reveal key={it.id} delay={i * 80}>
            <article className="group flex h-full flex-col gap-5">
              <Frame shaped={i % 2 === 0} className="aspect-[4/5]">
                {it.image ? (
                  <img src={it.image} alt={t(it.title)} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Icon name={it.icon} className="h-10 w-10 text-(--mh-accent-text)" />
                  </div>
                )}
              </Frame>
              <h3 className="mh-display text-3xl">{t(it.title)}</h3>
              <CardText it={it} d={d} />
              <CardFooter it={it} d={d} />
            </article>
          </Reveal>
        ))}
      </div>
    );
  } else {
    const dark = d.style === 'hoverDark';
    body = (
      <div className={cx(grid, 'gap-5')}>
        {d.items.map((it, i) => (
          <Reveal key={it.id} delay={i * 70} className="h-full">
            <article
              onClick={dark && it.link ? () => go(it.link) : undefined}
              className={cx('mh-card group relative flex h-full flex-col gap-5 overflow-hidden p-8 sm:p-10', dark ? 'cursor-pointer transition-colors duration-500 hover:border-(--mh-ink)' : 'mh-card-hover')}
            >
              {dark ? <div className="absolute inset-0 origin-bottom scale-y-0 bg-(--mh-ink) transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100" /> : null}
              <div className={cx('relative flex h-full flex-col gap-5', dark && 'transition-colors duration-500 group-hover:text-[#fbf8f3] group-hover:[--mh-fg:#fbf8f3] group-hover:[--mh-fg-2:rgb(251_248_243/0.7)] group-hover:[--mh-rule:rgb(255_255_255/0.18)] group-hover:[--mh-accent-text:color-mix(in_oklab,var(--mh-accent)_55%,white)]')}>
                <div className="flex items-start justify-between">
                  {hasIcon(it.icon) ? (
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-(--mh-rule) text-(--mh-accent-text) transition-colors">
                      <Icon name={it.icon} className="h-6 w-6" />
                    </span>
                  ) : (
                    <span className="mt-2 h-0.5 w-10 bg-(--mh-accent-text)" />
                  )}
                  {dark ? <ArrowUpRight className="h-5 w-5 text-(--mh-fg-2) transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1" /> : null}
                </div>
                <h3 className={cx('leading-snug', dark ? 'mh-display text-[2rem]' : 'text-xl font-semibold')}>{t(it.title)}</h3>
                <CardText it={it} d={d} />
                <CardFooter it={it} d={d} />
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    );
  }

  return (
    <Section style={style}>
      <SectionHeading h={d} />
      {body}
    </Section>
  );
}

/* ------------------------------------------------------------------ Vitrine à onglets */

export function ShowcaseBlock({ d, style }: BlockProps<'showcase'>) {
  const { t } = useCms();
  const go = useGo();
  const { animations } = useOptions();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const delay = Math.max(d.interval || 7, 3) * 1000;
  const items = d.items;

  useEffect(() => {
    if (paused || items.length < 2 || !animations) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % items.length), delay);
    return () => window.clearTimeout(id);
  }, [active, paused, items.length, delay, animations]);

  if (!items.length) return null;
  const cur = items[Math.min(active, items.length - 1)];

  return (
    <Section style={style}>
      <SectionHeading h={d} />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <Reveal className="lg:col-span-5">
          <ol className="border-t border-(--mh-rule)">
            {items.map((it, i) => (
              <li key={it.id} className="border-b border-(--mh-rule)">
                <button type="button" onClick={() => setActive(i)} className="group w-full py-5 text-left" aria-expanded={i === active}>
                  <span className="flex items-baseline gap-5">
                    <span className={cx('mh-num text-lg transition-colors', i === active ? 'text-(--mh-accent-text)' : 'text-(--mh-fg-2)')}>{String(i + 1).padStart(2, '0')}</span>
                    <span className={cx('text-lg font-semibold transition-colors sm:text-xl', i === active ? 'text-(--mh-fg)' : 'text-(--mh-fg-2) group-hover:text-(--mh-fg)')}>{t(it.title)}</span>
                  </span>
                  <span className={cx('grid transition-all duration-500', i === active ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                    <span className="overflow-hidden pl-11">
                      {it.text ? <span className="block pt-3 text-[0.95rem] leading-relaxed text-(--mh-fg-2)">{t(it.text)}</span> : null}
                    </span>
                  </span>
                  <span className="mt-4 block h-px overflow-hidden bg-transparent">
                    {i === active && animations && items.length > 1 ? <span key={`${active}-${paused}`} className={cx('block h-full bg-(--mh-accent)', !paused && 'mh-progress')} style={{ animationDuration: `${delay}ms` }} /> : null}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal delay={120} className="lg:col-span-7">
          <div className="relative overflow-hidden rounded-(--mh-r-lg) bg-(--mh-ink)">
            <div className="aspect-[4/3] w-full">
              {cur.image ? <img key={cur.id} src={cur.image} alt={t(cur.title)} className="mh-word-in h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-white/40"><Icon name={cur.icon} className="h-16 w-16" /></div>}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/5" />
            <div key={cur.id} className="mh-word-in mh-dark absolute inset-x-0 bottom-0 space-y-5 p-7 text-(--mh-fg) sm:p-10">
              <div className="flex items-center gap-3">
                {hasIcon(cur.icon) ? (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-(--mh-accent) text-(--mh-on-accent)">
                    <Icon name={cur.icon} className="h-5 w-5" />
                  </span>
                ) : null}
                <h3 className="mh-display text-3xl sm:text-4xl">{t(cur.title)}</h3>
              </div>
              {cur.chips.length ? (
                <div className="flex flex-wrap gap-2">
                  {cur.chips.map((c) => (
                    <span key={c} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                      {t(c)}
                    </span>
                  ))}
                </div>
              ) : null}
              {cur.link ? (
                <button type="button" onClick={() => go(cur.link)} className="mh-btn mh-btn-light">
                  {t(cur.buttonLabel) || 'Découvrir'}
                  <ArrowRight className="mh-btn-arrow h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ Étapes */

export function StepsBlock({ d, style }: BlockProps<'steps'>) {
  const { t } = useCms();
  const deliverable = (text?: string) =>
    text ? (
      <div className="rounded-(--mh-r) border border-dashed border-(--mh-rule) px-4 py-3 text-xs">
        <span className="font-semibold uppercase tracking-[0.14em] text-(--mh-accent-text)">{t(d.deliverableLabel) || 'Livrable'}</span>
        <span className="mt-1 block text-(--mh-fg)">{t(text)}</span>
      </div>
    ) : null;

  let body: React.ReactNode;
  if (d.style === 'list') {
    body = (
      <ol className="border-t border-(--mh-rule)">
        {d.items.map((s, i) => (
          <Reveal key={s.id} delay={i * 60}>
            <li className="grid grid-cols-1 gap-5 border-b border-(--mh-rule) py-10 md:grid-cols-12 md:gap-8">
              <span className="mh-num text-6xl leading-none text-(--mh-accent-text) md:col-span-2">{t(s.num) || String(i + 1).padStart(2, '0')}</span>
              <div className="space-y-3 md:col-span-6">
                <h3 className="mh-display text-3xl">{t(s.title)}</h3>
                {s.text ? <p className="leading-relaxed text-(--mh-fg-2)">{t(s.text)}</p> : null}
              </div>
              <div className="md:col-span-4 md:pt-2">{deliverable(s.deliverable)}</div>
            </li>
          </Reveal>
        ))}
      </ol>
    );
  } else if (d.style === 'compact') {
    body = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {d.items.map((s, i) => (
          <Reveal key={s.id} delay={i * 60} className="mh-card flex h-full flex-col gap-3 p-6">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-(--mh-accent-text)">Étape {t(s.num) || i + 1}</span>
            <h3 className="text-lg font-semibold leading-snug">{t(s.title)}</h3>
            {s.text ? <p className="text-sm leading-relaxed text-(--mh-fg-2)">{t(s.text)}</p> : null}
          </Reveal>
        ))}
      </div>
    );
  } else {
    body = (
      <div className="relative">
        <div className="absolute left-0 right-0 top-7 hidden h-px bg-(--mh-rule) lg:block" />
        <ol className={cx('relative grid grid-cols-1 gap-10 sm:grid-cols-2', d.items.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
          {d.items.map((s, i) => (
            <Reveal key={s.id} delay={i * 110}>
              <li className="flex h-full flex-col gap-5">
                <span className="mh-num flex h-14 w-14 items-center justify-center rounded-full border border-(--mh-rule) bg-(--mh-paper) text-xl text-(--mh-fg) shadow-[0_0_0_8px_var(--mh-paper)]">{t(s.num) || i + 1}</span>
                <h3 className="text-xl font-semibold leading-snug">{t(s.title)}</h3>
                {s.text ? <p className="text-[0.95rem] leading-relaxed text-(--mh-fg-2)">{t(s.text)}</p> : null}
                <div className="mt-auto">{deliverable(s.deliverable)}</div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <Section style={style}>
      <SectionHeading h={d} />
      {body}
      <ButtonRow buttons={d.buttons} className="mt-14" center={d.align === 'center'} />
    </Section>
  );
}

/* ------------------------------------------------------------------ Chiffres */

export function StatsBlock({ d, style }: BlockProps<'stats'>) {
  const { t } = useCms();
  const value = (s: (typeof d.items)[number]) => <CountUp value={`${t(s.prefix)}${t(s.value)}${t(s.suffix)}`} animate={d.countUp} />;
  const cols = d.items.length >= 4 ? 'lg:grid-cols-4' : d.items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';
  const wordy = d.items.some((s) => `${t(s.prefix)}${t(s.value)}${t(s.suffix)}`.length > 9);

  let body: React.ReactNode;
  if (d.style === 'strip') {
    body = (
      <div className={cx('mh-dark grid grid-cols-2 overflow-hidden rounded-(--mh-r-lg) bg-(--mh-ink) text-(--mh-fg)', cols)}>
        {d.items.map((s, i) => (
          <Reveal key={s.id} delay={i * 80} className="border-white/10 p-7 sm:p-9 [&:not(:last-child)]:border-r">
            <div className={cx('mh-num', wordy ? 'text-2xl leading-tight sm:text-3xl' : 'text-4xl leading-none sm:text-5xl')}>{value(s)}</div>
            <div className="mt-3 text-sm text-(--mh-fg-2)">{t(s.label)}</div>
          </Reveal>
        ))}
      </div>
    );
  } else if (d.style === 'inline') {
    body = (
      <div className={cx('grid grid-cols-2 gap-y-10 border-y border-(--mh-rule) py-10', cols)}>
        {d.items.map((s, i) => (
          <Reveal key={s.id} delay={i * 80} className="px-4 text-center sm:px-6 lg:[&:not(:last-child)]:border-r lg:[&:not(:last-child)]:border-(--mh-rule)">
            <div className={cx('mh-num', wordy ? 'text-3xl leading-tight sm:text-4xl' : 'text-5xl leading-none sm:text-6xl')}>{value(s)}</div>
            <div className="mt-3 text-sm font-medium">{t(s.label)}</div>
            {s.hint ? <div className="mt-1 text-xs text-(--mh-fg-2)">{t(s.hint)}</div> : null}
          </Reveal>
        ))}
      </div>
    );
  } else {
    body = (
      <div className={cx('grid grid-cols-1 gap-4 sm:grid-cols-2', cols)}>
        {d.items.map((s, i) => (
          <Reveal key={s.id} delay={i * 80} className="mh-card flex h-full flex-col justify-between gap-10 p-8 backdrop-blur-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--mh-fg-2)">{String(i + 1).padStart(2, '0')}</div>
            <div>
              <div className={cx('mh-num', wordy ? 'text-3xl leading-tight sm:text-4xl' : 'text-5xl leading-none sm:text-6xl')}>{value(s)}</div>
              <div className="mt-4 text-[0.95rem] font-semibold">{t(s.label)}</div>
              {s.hint ? <div className="mt-1 text-sm text-(--mh-fg-2)">{t(s.hint)}</div> : null}
            </div>
          </Reveal>
        ))}
      </div>
    );
  }

  return (
    <Section style={style}>
      <SectionHeading h={d} />
      {body}
    </Section>
  );
}

/* ------------------------------------------------------------------ Panneaux */

export function PanelsBlock({ d, style }: BlockProps<'panels'>) {
  const { t } = useCms();
  const go = useGo();
  return (
    <Section style={style}>
      <SectionHeading h={d} />
      <div className={cx('grid grid-cols-1 gap-5', d.items.length >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2')}>
        {d.items.map((p, i) => (
          <Reveal key={p.id} delay={i * 90} className="h-full">
            <article
              onClick={p.link ? () => go(p.link) : undefined}
              className={cx('group mh-dark relative flex h-full min-h-[32rem] flex-col justify-end overflow-hidden rounded-(--mh-r-lg) bg-(--mh-ink) text-(--mh-fg)', p.link && 'cursor-pointer')}
            >
              {p.image ? <img src={p.image} alt={t(p.title)} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80 transition-all duration-[1.2s] group-hover:scale-105 group-hover:opacity-60" /> : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5" />
              <div className="relative space-y-4 p-8">
                {hasIcon(p.icon) ? (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur">
                    <Icon name={p.icon} className="h-5 w-5" />
                  </span>
                ) : null}
                <h3 className="mh-display text-[2.1rem] leading-tight">{t(p.title)}</h3>
                {p.text ? <p className="text-sm leading-relaxed text-(--mh-fg-2)">{t(p.text)}</p> : null}
                {p.bullets.length ? (
                  <div className="grid grid-rows-[0fr] transition-all duration-500 group-hover:grid-rows-[1fr] max-lg:grid-rows-[1fr]">
                    <ul className="space-y-1.5 overflow-hidden">
                      {p.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-white/85">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-(--mh-accent-text)" />
                          {t(b)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {p.link ? (
                  <span className="mh-link pt-2">
                    {t(p.linkLabel) || 'Découvrir'}
                    <ArrowRight className="mh-btn-arrow h-4 w-4" />
                  </span>
                ) : null}
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ Galerie */

function Lightbox({ items, index, onClose, onMove }: { items: { image: string; caption?: string }[]; index: number; onClose: () => void; onMove: (step: number) => void }) {
  const { t } = useCms();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onMove(1);
      if (e.key === 'ArrowLeft') onMove(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onMove]);
  const it = items[index];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-white" aria-label="Fermer">
        <X className="h-5 w-5" />
      </button>
      <button type="button" onClick={(e) => (e.stopPropagation(), onMove(-1))} className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/25 text-white hover:bg-white/10" aria-label="Précédente">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <img src={it.image} alt={t(it.caption)} className="max-h-[80vh] w-auto rounded-(--mh-r)" />
        {it.caption ? <figcaption className="mh-display mt-4 text-center text-2xl text-white">{t(it.caption)}</figcaption> : null}
      </figure>
      <button type="button" onClick={(e) => (e.stopPropagation(), onMove(1))} className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/25 text-white hover:bg-white/10" aria-label="Suivante">
        <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}

export function GalleryBlock({ d, style }: BlockProps<'gallery'>) {
  const { t } = useCms();
  const items = d.items.filter((i) => i.image);
  const [open, setOpen] = useState<number | null>(null);
  const move = (step: number) => setOpen((i) => (i === null ? i : (i + step + items.length) % items.length));

  let body: React.ReactNode;
  if (d.style === 'polaroid') {
    const tilt = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2', 'rotate-0', '-rotate-3'];
    body = (
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
        {items.map((it, i) => (
          <Reveal key={it.id} delay={(i % 4) * 70}>
            <button type="button" onClick={() => setOpen(i)} className={cx('block w-full bg-white p-2.5 pb-4 text-left shadow-[0_25px_50px_-25px_rgba(26,22,18,0.45)] transition-transform duration-500 hover:z-10 hover:-translate-y-2 hover:rotate-0', tilt[i % tilt.length])}>
              <img src={it.image} alt={t(it.caption)} loading="lazy" className="aspect-square w-full object-cover" />
              {it.caption ? <span className="mh-display mt-3 block px-1 text-center text-lg leading-tight text-(--mh-ink)">{t(it.caption)}</span> : null}
            </button>
          </Reveal>
        ))}
      </div>
    );
  } else if (d.style === 'masonry') {
    body = (
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
        {items.map((it, i) => (
          <Reveal key={it.id} delay={(i % 3) * 70} className="break-inside-avoid">
            <button type="button" onClick={() => setOpen(i)} className="group relative block w-full overflow-hidden rounded-(--mh-r-lg)">
              <img src={it.image} alt={t(it.caption)} loading="lazy" className="w-full transition-transform duration-700 group-hover:scale-105" />
              {it.caption ? <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/75 to-transparent p-5 text-left text-sm text-white transition-transform duration-500 group-hover:translate-y-0">{t(it.caption)}</span> : null}
            </button>
          </Reveal>
        ))}
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {items.map((it, i) => (
          <Reveal key={it.id} delay={(i % 4) * 60} className={cx(i % 5 === 0 && 'col-span-2 row-span-2')}>
            <button type="button" onClick={() => setOpen(i)} className="group relative block h-full w-full overflow-hidden rounded-(--mh-r-lg)">
              <img src={it.image} alt={t(it.caption)} loading="lazy" className="aspect-square h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              {it.caption ? <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-left text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">{t(it.caption)}</span> : null}
            </button>
          </Reveal>
        ))}
      </div>
    );
  }

  return (
    <Section style={style}>
      <SectionHeading h={d} />
      {body}
      {d.handNote || d.note ? (
        <Reveal className="mt-14 flex flex-col items-center gap-2 text-center">
          {d.handNote ? <p className="mh-display text-3xl text-(--mh-accent-text)">{t(d.handNote)}</p> : null}
          {d.note ? <p className="max-w-2xl text-sm text-(--mh-fg-2)">{t(d.note)}</p> : null}
        </Reveal>
      ) : null}
      {open !== null && items[open] ? <Lightbox items={items} index={open} onClose={() => setOpen(null)} onMove={move} /> : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ Listes à cocher */

export function ChecklistBlock({ d, style }: BlockProps<'checklist'>) {
  const { t } = useCms();
  return (
    <Section style={style}>
      <SectionHeading h={d} />
      <div className={cx('grid grid-cols-1 gap-5', d.cards.length >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2')}>
        {d.cards.map((c, i) => (
          <Reveal key={c.id} delay={i * 80} className="h-full">
            <div className="mh-card relative flex h-full flex-col gap-6 overflow-hidden p-8">
              <span className="absolute inset-x-0 top-0 h-1 bg-(--mh-accent)" style={{ opacity: 1 - i * 0.25 }} />
              <div className="flex items-center justify-between">
                {hasIcon(c.icon) ? (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-(--mh-paper-2) text-(--mh-accent-text)">
                    <Icon name={c.icon} className="h-5 w-5" />
                  </span>
                ) : <span />}
                {c.tag ? <span className="rounded-full border border-(--mh-rule) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-(--mh-fg-2)">{t(c.tag)}</span> : null}
              </div>
              {c.title ? <h3 className="mh-display text-[1.9rem] leading-tight">{t(c.title)}</h3> : null}
              <ul className="space-y-4">
                {c.entries.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--mh-accent) text-(--mh-on-accent)">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{t(e.title)}</span>
                      {e.text ? <span className="mt-0.5 block text-sm leading-relaxed text-(--mh-fg-2)">{t(e.text)}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ Questions fréquentes */

export function FaqBlock({ d, style }: BlockProps<'faq'>) {
  const { t, tokens } = useCms();
  const [open, setOpen] = useState<string | null>(d.items[0]?.id ?? null);
  const list = (
    <div className="border-t border-(--mh-rule)">
      {d.items.map((q, i) => {
        const isOpen = open === q.id;
        return (
          <Reveal key={q.id} delay={Math.min(i, 6) * 40}>
            <div className="border-b border-(--mh-rule)">
              <button type="button" onClick={() => setOpen(isOpen ? null : q.id)} className="flex w-full items-start justify-between gap-6 py-6 text-left" aria-expanded={isOpen}>
                <span className="text-lg font-semibold leading-snug">{t(q.question)}</span>
                <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300', isOpen ? 'rotate-45 border-(--mh-accent) bg-(--mh-accent) text-(--mh-on-accent)' : 'border-(--mh-rule)')}>
                  <Plus className="h-4 w-4" />
                </span>
              </button>
              <div className={cx('grid transition-all duration-500', isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                <div className="overflow-hidden">
                  <RichHtml html={q.answer} className="pb-7 pr-12 text-[0.98rem]!" />
                </div>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );

  const contact = d.showContactCard ? (
    <Reveal delay={100}>
      <div className="mh-dark mt-10 rounded-(--mh-r-lg) bg-(--mh-ink) p-8 text-(--mh-fg)">
        <p className="mh-display text-2xl">{t(d.contactLabel) || 'Une autre question ?'}</p>
        <a href={`tel:${tokens.phoneClean}`} className="mt-6 inline-flex items-center gap-3 text-lg font-semibold transition-colors hover:text-(--mh-accent-text)">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-(--mh-accent) text-(--mh-on-accent)">
            <Phone className="h-4 w-4" />
          </span>
          {tokens.phone}
        </a>
      </div>
    </Reveal>
  ) : null;

  if (d.layout === 'stacked') {
    return (
      <Section style={style}>
        <div className="mx-auto max-w-3xl">
          <SectionHeading h={{ ...d, align: d.align ?? 'center' }} />
          {list}
          {contact}
        </div>
      </Section>
    );
  }
  return (
    <Section style={style}>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <SectionHeading h={{ ...d, align: 'left', headerLink: undefined }} className="mb-0! sm:mb-0!" />
            {contact}
          </div>
        </div>
        <div className="lg:col-span-7">{list}</div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ Témoignages */

export function TestimonialsBlock({ d, style }: BlockProps<'testimonials'>) {
  const { t } = useCms();
  const [index, setIndex] = useState(0);
  if (!d.items.length) return null;
  const cur = d.items[Math.min(index, d.items.length - 1)];
  const move = (step: number) => setIndex((i) => (i + step + d.items.length) % d.items.length);
  return (
    <Section style={style}>
      <SectionHeading h={d} />
      <Reveal>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-1">
            <Quote className="h-12 w-12 text-(--mh-accent-text)" strokeWidth={1.2} />
          </div>
          <div className="lg:col-span-11">
            <blockquote key={cur.id} className="mh-word-in mh-display text-3xl leading-[1.2] sm:text-4xl lg:text-[2.9rem]">
              « {t(cur.quote)} »
            </blockquote>
            <div className="mt-10 flex flex-col gap-6 border-t border-(--mh-rule) pt-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {cur.image ? <img src={cur.image} alt={t(cur.author)} className="h-14 w-14 rounded-full object-cover" /> : <span className="mh-display flex h-14 w-14 items-center justify-center rounded-full bg-(--mh-paper-2) text-2xl text-(--mh-ink)">{t(cur.author).charAt(0)}</span>}
                <div>
                  <div className="font-semibold">{t(cur.author)}</div>
                  {cur.role ? <div className="text-sm text-(--mh-fg-2)">{t(cur.role)}</div> : null}
                </div>
              </div>
              {d.items.length > 1 ? (
                <div className="flex items-center gap-3">
                  <span className="mr-2 font-mono text-xs text-(--mh-fg-2)">
                    {String(index + 1).padStart(2, '0')} / {String(d.items.length).padStart(2, '0')}
                  </span>
                  <button type="button" onClick={() => move(-1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-(--mh-rule) transition-colors hover:bg-(--mh-fg) hover:text-(--mh-paper)" aria-label="Témoignage précédent">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => move(1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-(--mh-rule) transition-colors hover:bg-(--mh-fg) hover:text-(--mh-paper)" aria-label="Témoignage suivant">
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
