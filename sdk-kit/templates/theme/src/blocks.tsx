import type { ReactNode } from 'react';
import type { BlockProps } from '@snapify/sdk/theme';
import type { BlockStyle } from '@snapify/sdk/content';
import { Buttons, cx, useText } from './site';

const SPACING = { none: '0', sm: '2rem', md: '4rem', lg: '6rem', xl: '8rem' } as const;
const WIDTH = { narrow: 'max-w-3xl', default: 'max-w-6xl', wide: 'max-w-7xl', full: 'max-w-none' } as const;
const BACKGROUND: Partial<Record<BlockStyle['background'], string>> = {
  white: 'bg-white',
  surface: 'bg-px-surface',
  soft: 'bg-px-primary-light/40',
  navy: 'bg-px-navy text-white',
  brand: 'bg-px-primary text-white',
};

/** Enveloppe commune : fond, marges verticales et largeur choisis dans l’éditeur. */
function Section({ style, children, className }: { style: BlockStyle; children: ReactNode; className?: string }) {
  return (
    <section className={cx(BACKGROUND[style.background], className)} style={{ paddingTop: SPACING[style.paddingTop], paddingBottom: SPACING[style.paddingBottom] }}>
      <div className={cx('mx-auto w-[min(100%-2.5rem,80rem)]', WIDTH[style.width])}>{children}</div>
    </section>
  );
}

export function HeroBlock({ d, style }: BlockProps<'hero'>) {
  const t = useText();
  const centered = d.layout === 'centered';
  return (
    <Section style={style}>
      <div className={cx('grid items-center gap-12', !centered && d.mainImage && 'lg:grid-cols-2', centered && 'text-center')}>
        <div className={cx('space-y-6', centered && 'mx-auto max-w-3xl')}>
          {d.badgeText ? <p className="text-sm font-semibold uppercase tracking-wider text-px-primary">{t(d.badgeText)}</p> : null}
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            {t(d.title)} {d.highlight ? <span className="text-px-primary">{t(d.highlight)}</span> : null}
          </h1>
          {d.subtitle ? <p className="text-lg opacity-80">{t(d.subtitle)}</p> : null}
          <Buttons buttons={d.buttons} className={centered ? 'justify-center' : undefined} />
        </div>
        {!centered && d.media === 'image' && d.mainImage ? <img src={d.mainImage} alt={d.mainImageAlt ?? ''} className="w-full rounded-2xl object-cover" /> : null}
      </div>
    </Section>
  );
}

export function PageHeaderBlock({ d, style }: BlockProps<'pageHeader'>) {
  const t = useText();
  return (
    <Section style={style}>
      {d.eyebrow ? <p className="text-sm font-semibold uppercase tracking-wider text-px-primary">{t(d.eyebrow)}</p> : null}
      <h1 className="mt-2 text-4xl font-bold">
        {t(d.title)} {d.highlight ? <span className="text-px-primary">{t(d.highlight)}</span> : null}
      </h1>
      {d.intro ? <p className="mt-4 max-w-2xl text-lg opacity-80">{t(d.intro)}</p> : null}
      <Buttons buttons={d.buttons} className="mt-6" />
    </Section>
  );
}

export function RichTextBlock({ d, style }: BlockProps<'richText'>) {
  return (
    <Section style={{ ...style, width: style.width === 'default' ? 'narrow' : style.width }}>
      <div className={cx('st-prose', d.size === 'large' && 'text-lg')} dangerouslySetInnerHTML={{ __html: d.html }} />
    </Section>
  );
}

export function ImageBlock({ d, style }: BlockProps<'image'>) {
  if (!d.url) return null;
  return (
    <Section style={style}>
      <figure>
        <img src={d.url} alt={d.alt} loading="lazy" className={cx('w-full object-cover', d.rounded && 'rounded-2xl')} />
        {d.caption ? <figcaption className="mt-3 text-center text-sm opacity-70">{d.caption}</figcaption> : null}
      </figure>
    </Section>
  );
}

export function CtaBlock({ d, style }: BlockProps<'cta'>) {
  const t = useText();
  const dark = d.variant !== 'light';
  return (
    <Section style={style}>
      <div className={cx('rounded-3xl p-10 text-center sm:p-16', dark ? 'bg-px-navy text-white' : 'border border-black/10 bg-white')}>
        <h2 className="text-3xl font-bold">
          {t(d.title)} {d.highlight ? <span className="text-px-primary">{t(d.highlight)}</span> : null}
        </h2>
        {d.text ? <p className="mx-auto mt-4 max-w-2xl opacity-80">{t(d.text)}</p> : null}
        <Buttons buttons={d.buttons} className="mt-8 justify-center" />
      </div>
    </Section>
  );
}
