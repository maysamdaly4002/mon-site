/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Clock, Mail, Phone, ShieldCheck } from 'lucide-react';
import type { BlockProps } from '@snapify/sdk/theme';
import type { ContactFormConfig, ProjectMeta } from '@snapify/sdk/content';
import { getRecaptchaToken, RecaptchaField, type RecaptchaPublicConfig } from '@snapify/sdk/recaptcha';
import { IS_PREVIEW } from '../site';
import { ButtonRow, cx, Eyebrow, Frame, Highlighted, Placeholder, Reveal, Section, SectionHeading, useCms, useGo } from '../kit';

/* ------------------------------------------------------------------ Appel à l'action */

export function CtaBlock({ d, style }: BlockProps<'cta'>) {
  const { t } = useCms();
  const box = {
    gradient: 'pv-dark pv-brand bg-(--pv-accent)',
    dark: 'pv-dark bg-(--pv-ink)',
    image: 'pv-dark bg-(--pv-ink)',
    light: 'pv-light border border-(--pv-line) bg-(--pv-card)',
  }[d.variant];
  const centered = d.layout === 'centered';

  return (
    <Section style={style}>
      <Reveal>
        <div className={cx('relative isolate overflow-hidden rounded-(--pv-r-lg) text-(--pv-fg)', box, centered ? 'px-6 py-20 text-center sm:px-16 sm:py-28' : 'p-8 sm:p-12 lg:p-16')}>
          {d.backgroundImage && d.variant !== 'light' ? (
            <>
              <img src={d.backgroundImage} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-(--pv-ink) via-(--pv-ink)/85 to-(--pv-ink)/50" />
            </>
          ) : null}
          {d.variant !== 'light' ? <div className="pv-rings absolute -bottom-[26rem] -right-[20rem] -z-10 h-[50rem] w-[50rem] opacity-60" /> : null}
          {d.variant === 'dark' ? <div className="absolute -left-32 -top-32 -z-10 h-96 w-96 rounded-full bg-(--pv-accent)/25 blur-[120px]" /> : null}

          {centered ? (
            <div className="mx-auto max-w-3xl space-y-8">
              {d.badge || d.eyebrow ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-(--pv-rule) px-4 py-1.5 text-xs font-medium text-(--pv-fg-2)">
                  <Clock className="h-3.5 w-3.5 text-(--pv-accent-text)" />
                  {t(d.badge || d.eyebrow)}
                </div>
              ) : null}
              <h2 className="pv-display text-3xl sm:text-5xl lg:text-[3.25rem]">
                <Highlighted title={d.title} highlight={d.highlight} />
              </h2>
              {d.text ? <p className="mx-auto max-w-xl text-lg leading-relaxed text-(--pv-fg-2)">{t(d.text)}</p> : null}
              <ButtonRow buttons={d.buttons} center size="lg" />
            </div>
          ) : d.bigNumber ? (
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <div className="pv-num text-[6.5rem] leading-[0.85] text-(--pv-accent-text) sm:text-[9rem]">{t(d.bigNumber)}</div>
                <div className="mt-4 max-w-xs text-sm leading-snug text-(--pv-fg-2)">
                  {t(d.bigNumberLabel)} {d.bigNumberStrong ? <strong className="font-semibold text-(--pv-fg)">{t(d.bigNumberStrong)}</strong> : null}
                </div>
              </div>
              <div className="space-y-4 lg:col-span-4">
                {d.badge ? <Eyebrow>{t(d.badge)}</Eyebrow> : null}
                <h3 className="pv-display text-3xl sm:text-4xl">
                  <Highlighted title={d.title} highlight={d.highlight} />
                </h3>
                {d.text ? <p className="text-sm leading-relaxed text-(--pv-fg-2)">{t(d.text)}</p> : null}
              </div>
              <div className="lg:col-span-3 lg:flex lg:justify-end">
                <ButtonRow buttons={d.buttons} />
              </div>
            </div>
          ) : (
            <div className={cx('grid grid-cols-1 items-center gap-12', d.image && 'lg:grid-cols-[1fr_auto]')}>
              <div className="max-w-2xl space-y-7">
                {d.eyebrow ? <Eyebrow>{t(d.eyebrow)}</Eyebrow> : null}
                <h3 className="pv-display text-4xl sm:text-5xl">
                  <Highlighted title={d.title} highlight={d.highlight} />
                </h3>
                {d.text ? <p className="text-base leading-relaxed text-(--pv-fg-2) sm:text-lg">{t(d.text)}</p> : null}
                <ButtonRow buttons={d.buttons} />
              </div>
              {d.image ? (
                <figure className="mx-auto w-60 shrink-0 lg:mx-0 lg:w-72">
                  <Frame arch className="aspect-[4/5]">
                    <img src={d.image} alt={d.imageAlt || ''} loading="lazy" className="h-full w-full object-cover" />
                  </Frame>
                  {d.imageCaption ? <figcaption className="pv-display mt-3 text-center text-lg italic text-(--pv-fg-2)">{t(d.imageCaption)}</figcaption> : null}
                </figure>
              ) : null}
            </div>
          )}
        </div>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ Réalisations */

type ProjectCard = ProjectMeta & { id: string; path: string; title: string };

let projectsCache: Promise<ProjectCard[]> | null = null;
const loadProjects = () =>
  (projectsCache ??= fetch('/api/public/projects')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []));

function useProjects() {
  const [list, setList] = useState<ProjectCard[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadProjects().then((p) => alive && setList(p));
    return () => {
      alive = false;
    };
  }, []);
  return list;
}

function ProjectTile({ p, size = 'md', onOpen }: { p: ProjectCard; size?: 'md' | 'lg'; onOpen: () => void }) {
  const { t } = useCms();
  return (
    <button type="button" onClick={onOpen} className="group flex h-full w-full flex-col text-left">
      <div className={cx('relative w-full overflow-hidden rounded-(--pv-r-lg) bg-(--pv-paper-2)', size === 'lg' ? 'aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[34rem]' : 'aspect-[4/3]')}>
        <img src={p.image} alt={`${p.solution} — ${p.client}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-105" />
        <div className={cx('absolute inset-0 bg-gradient-to-t transition-opacity', size === 'lg' ? 'from-black/90 via-black/35 to-black/0' : 'from-black/50 via-black/0 to-black/0 opacity-70 group-hover:opacity-100')} />
        <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-(--pv-ink)">{p.sector}</span>
        <span className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-(--pv-ink) transition-all duration-500 group-hover:rotate-45 group-hover:bg-(--pv-accent) group-hover:text-(--pv-on-accent)">
          <ArrowUpRight className="h-4 w-4" />
        </span>
        {size === 'lg' ? (
          <div className="absolute inset-x-0 bottom-0 space-y-3 p-7 text-white sm:p-9">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
              {p.client} · {p.location}
            </div>
            <h3 className="pv-display max-w-xl text-4xl leading-tight sm:text-5xl">{p.solution}</h3>
            {p.results.length ? (
              <ul className="flex flex-wrap gap-2 pt-2">
                {p.results.slice(0, 3).map((r) => (
                  <li key={r} className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs backdrop-blur">
                    <Check className="h-3 w-3" />
                    {t(r)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      {size === 'md' ? (
        <div className="space-y-2 pt-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--pv-accent-text)">
            {p.client} · {p.location}
            {p.department ? ` (${p.department})` : ''}
          </div>
          <h3 className="pv-display text-[1.75rem] leading-tight transition-colors">{p.solution}</h3>
          {p.summary ? <p className="line-clamp-2 text-sm leading-relaxed text-(--pv-fg-2)">{p.summary}</p> : null}
        </div>
      ) : null}
    </button>
  );
}

export function ProjectsBlock({ d, style }: BlockProps<'projects'>) {
  const all = useProjects();
  const go = useGo();
  const [filter, setFilter] = useState('all');

  const projects = useMemo(() => {
    let list = all || [];
    if (d.filter === 'sector' && d.sector) list = list.filter((p) => p.sector.toLowerCase().includes(d.sector!.toLowerCase()));
    if (filter !== 'all') list = list.filter((p) => p.sector === filter);
    return d.limit > 0 ? list.slice(0, d.limit) : list;
  }, [all, d.filter, d.sector, d.limit, filter]);
  const sectors = useMemo(() => [...new Set((all || []).map((p) => p.sector))], [all]);

  if (all && !projects.length && filter === 'all') {
    return IS_PREVIEW ? (
      <Section style={style}>
        <Placeholder label="Aucune réalisation publiée pour ce filtre" className="h-40 rounded-(--pv-r-lg)" />
      </Section>
    ) : null;
  }

  let body: React.ReactNode;
  if (!all) {
    body = (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-[4/3] animate-pulse rounded-(--pv-r-lg) bg-(--pv-paper-2)" />
        ))}
      </div>
    );
  } else if (d.layout === 'featured') {
    const [first, ...rest] = [...projects].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    body = (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <ProjectTile p={first} size="lg" onOpen={() => go(first.path)} />
        </Reveal>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          {rest.slice(0, 3).map((p, i) => (
            <Reveal key={p.id} delay={100 + i * 80}>
              <button type="button" onClick={() => go(p.path)} className="group grid w-full grid-cols-[8.5rem_1fr] items-center gap-5 text-left sm:grid-cols-[10rem_1fr]">
                <div className="aspect-square overflow-hidden rounded-(--pv-r)">
                  <img src={p.image} alt={`${p.solution} — ${p.client}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--pv-accent-text)">
                    {p.client} · {p.sector}
                  </div>
                  <h3 className="pv-display text-2xl leading-tight">{p.solution}</h3>
                  <span className="pv-link text-xs">
                    Voir le projet
                    <ArrowRight className="pv-btn-arrow h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    );
  } else {
    body = (
      <>
        {d.showFilters && sectors.length > 1 && d.layout === 'grid' ? (
          <div className="pv-scroll-x mb-10 flex gap-2 overflow-x-auto">
            {['all', ...sectors].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={cx('shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors', filter === s ? 'border-(--pv-fg) bg-(--pv-fg) text-(--pv-paper)' : 'border-(--pv-rule) text-(--pv-fg-2) hover:border-(--pv-fg) hover:text-(--pv-fg)')}
              >
                {s === 'all' ? 'Tous les projets' : s}
              </button>
            ))}
          </div>
        ) : null}
        <div className={cx('grid grid-cols-1 gap-x-8 gap-y-14', d.layout === 'compact' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2')}>
          {projects.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 80}>
              <ProjectTile p={p} onOpen={() => go(p.path)} />
            </Reveal>
          ))}
        </div>
      </>
    );
  }

  return (
    <Section style={style}>
      <SectionHeading h={d} />
      {body}
    </Section>
  );
}

/* ------------------------------------------------------------------ Estimateur */

const SITE_TYPES = [
  { id: 'a', label: 'Et / Dolore', factor: 1 },
  { id: 'b', label: 'Ea commodo', factor: 1.25 },
  { id: 'c', label: 'Duis aute', factor: 0.85 },
] as const;
const LEVELS = [
  { id: 'essentiel', label: 'Essentiel', saving: 18, cover: 64 },
  { id: 'avance', label: 'Avancé', saving: 24, cover: 72 },
  { id: 'complet', label: 'Complet', saving: 31, cover: 79 },
] as const;

export function SimulatorBlock({ d, style }: BlockProps<'simulator'>) {
  const go = useGo();
  const [site, setSite] = useState<(typeof SITE_TYPES)[number]['id']>('a');
  const [surface, setSurface] = useState(2500);
  const [level, setLevel] = useState<(typeof LEVELS)[number]['id']>('avance');

  const type = SITE_TYPES.find((s) => s.id === site)!;
  const lvl = LEVELS.find((l) => l.id === level)!;
  const volume = Math.round((surface * 480 * type.factor) / 1000) * 1000;
  const saving = Math.round(lvl.saving * (0.9 + type.factor / 10));
  const fmt = (n: number) => n.toLocaleString('fr-FR');

  const segmented = <T extends string>(options: readonly { id: T; label: string }[], value: T, set: (v: T) => void) => (
    <div className="grid grid-cols-3 gap-1 rounded-(--pv-r) border border-(--pv-rule) bg-(--pv-paper) p-1">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => set(o.id)} className={cx('rounded-[calc(var(--pv-r)-3px)] px-3 py-2.5 text-sm font-medium transition-all', value === o.id ? 'bg-(--pv-ink) text-[#f5f0e8] shadow' : 'text-(--pv-fg-2) hover:text-(--pv-fg)')}>
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <Section style={style}>
      <SectionHeading h={{ ...d, align: d.align ?? 'center' }} />
      <Reveal>
        <div className="pv-light grid grid-cols-1 overflow-hidden rounded-(--pv-r-lg) border border-(--pv-line) bg-(--pv-card) text-(--pv-fg) shadow-[0_50px_100px_-60px_rgba(26,22,18,0.5)] lg:grid-cols-12">
          <div className="space-y-9 p-8 sm:p-12 lg:col-span-7">
            <div className="space-y-3">
              <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--pv-fg-2)">1 · Type de projet</label>
              {segmented(SITE_TYPES, site, setSite)}
            </div>
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <label htmlFor="pv-surface" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--pv-fg-2)">
                  2 · Surface concernée
                </label>
                <span className="pv-num text-3xl">
                  {fmt(surface)} <span className="text-base text-(--pv-fg-2)">m²</span>
                </span>
              </div>
              <input id="pv-surface" type="range" min={200} max={20000} step={100} value={surface} onChange={(e) => setSurface(Number(e.target.value))} className="w-full accent-(--pv-accent)" />
              <div className="flex justify-between text-[11px] text-(--pv-fg-2)">
                <span>200 m²</span>
                <span>20 000 m²</span>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--pv-fg-2)">3 · Niveau d’accompagnement</label>
              {segmented(LEVELS, level, setLevel)}
            </div>
          </div>
          <div className="pv-dark relative flex flex-col justify-between gap-10 overflow-hidden bg-(--pv-ink) p-8 text-(--pv-fg) sm:p-12 lg:col-span-5">
            <div className="pv-rings absolute -right-64 -top-64 h-[34rem] w-[34rem] opacity-50" />
            <div className="relative space-y-8">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--pv-fg-2)">Estimation indicative</div>
              <div>
                <div className="pv-num text-7xl leading-none text-(--pv-accent-text)">−{saving} %</div>
                <div className="mt-2 text-sm text-(--pv-fg-2)">Économies estimées sur la consommation</div>
              </div>
              <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-6">
                <div>
                  <div className="pv-num text-3xl">{fmt(volume)}</div>
                  <div className="mt-1 text-xs text-(--pv-fg-2)">Volume valorisable</div>
                </div>
                <div>
                  <div className="pv-num text-3xl">{lvl.cover} %</div>
                  <div className="mt-1 text-xs text-(--pv-fg-2)">Prise en charge possible</div>
                </div>
              </div>
            </div>
            <div className="relative space-y-4">
              <button type="button" onClick={() => go('/contact/')} className="pv-btn pv-btn-primary w-full">
                Recevoir une étude détaillée
                <ArrowRight className="pv-btn-arrow h-4 w-4" />
              </button>
              <p className="flex items-center gap-2 text-[11px] text-(--pv-fg-2)">
                <ShieldCheck className="h-3.5 w-3.5" />
                Estimation non contractuelle, affinée lors de l’étude.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ Formulaire de contact */

type PublicForm = Omit<ContactFormConfig, 'recipientEmails'> & { recaptcha?: RecaptchaPublicConfig };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactFormBlock({ d, style }: BlockProps<'contactForm'>) {
  const { t, tokens } = useCms();
  const go = useGo();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [failed, setFailed] = useState(false);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/public/forms/${encodeURIComponent(d.formId || 'contact-main')}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setForm)
      .catch(() => setFailed(true));
  }, [d.formId]);

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const f of form?.fields || []) {
      const v = values[f.name];
      const empty = v === undefined || v === '' || v === false;
      if (f.required && empty) errs[f.name] = f.type === 'checkbox' ? 'Cette case doit être cochée.' : `Merci de renseigner : ${f.label.toLowerCase()}.`;
      else if (!empty && f.type === 'email' && !EMAIL_RE.test(String(v))) errs[f.name] = 'Veuillez saisir un e-mail valide.';
      else if (!empty && f.type === 'tel' && String(v).replace(/\D/g, '').length < 8) errs[f.name] = 'Numéro de téléphone incomplet.';
    }
    return errs;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || honeypot || IS_PREVIEW) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    setSubmitError('');
    void (async () => {
      try {
        let recaptchaToken = '';
        if (form.recaptcha?.siteKey) recaptchaToken = await getRecaptchaToken(form.recaptcha);
        const r = await fetch(`/api/public/forms/${encodeURIComponent(form.id)}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...values,
            ...(form.honeypotField ? { [form.honeypotField]: honeypot } : {}),
            ...(recaptchaToken ? { 'g-recaptcha-response': recaptchaToken, recaptchaToken } : {}),
          }),
        });
        const res = await r.json().catch(() => ({}));
        setSubmitting(false);
        if (r.ok) return go(res.redirect || form.successPath || '/contact/merci/');
        if (res.fields) setErrors(res.fields);
        setSubmitError(r.status === 429 ? 'Trop de demandes envoyées. Merci de patienter quelques minutes ou de nous appeler directement.' : res.error || 'L’envoi a échoué. Merci de réessayer ou de nous appeler directement.');
      } catch (err) {
        setSubmitting(false);
        setSubmitError(err instanceof Error ? err.message : 'Connexion impossible. Vérifiez votre réseau puis réessayez.');
      }
    })();
  };

  const set = (name: string, v: string | boolean) => setValues((s) => ({ ...s, [name]: v }));
  const label = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-(--pv-fg-2)';

  return (
    <Section style={style}>
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
        <Reveal className="space-y-10 lg:col-span-5">
          <div className="space-y-6">
            <Eyebrow>Contact</Eyebrow>
            <h1 className="pv-display text-5xl sm:text-6xl">{t(d.title)}</h1>
            {d.intro ? <p className="text-lg leading-relaxed text-(--pv-fg-2)">{t(d.intro)}</p> : null}
          </div>
          <div className="divide-y divide-(--pv-rule) border-y border-(--pv-rule)">
            <a href={`tel:${tokens.phoneClean}`} className="group flex items-center gap-5 py-5">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-(--pv-ink) text-[#f5f0e8] transition-colors group-hover:bg-(--pv-accent)">
                <Phone className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-xs text-(--pv-fg-2)">{t(d.phoneLabel) || 'Ligne directe'}</span>
                <span className="pv-num block text-2xl">{tokens.phone}</span>
              </span>
            </a>
            <a href={`mailto:${tokens.email}`} className="group flex items-center gap-5 py-5">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-(--pv-rule) transition-colors group-hover:border-(--pv-accent) group-hover:text-(--pv-accent-text)">
                <Mail className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-xs text-(--pv-fg-2)">E-mail</span>
                <span className="block font-semibold">{tokens.email}</span>
              </span>
            </a>
            {d.phoneHint ? (
              <div className="flex items-center gap-3 py-4 text-sm text-(--pv-fg-2)">
                <Clock className="h-4 w-4 shrink-0 text-(--pv-accent-text)" />
                {t(d.phoneHint)}
              </div>
            ) : null}
          </div>
          {d.listItems.length ? (
            <div className="space-y-4">
              {d.listTitle ? <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--pv-fg-2)">{t(d.listTitle)}</div> : null}
              <ul className="space-y-3">
                {d.listItems.map((it) => (
                  <li key={it} className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-(--pv-accent-text)" />
                    {t(it)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Reveal>

        <Reveal delay={120} className="lg:col-span-7">
          <form onSubmit={submit} noValidate className="pv-light space-y-7 rounded-(--pv-r-lg) border border-(--pv-line) bg-(--pv-card) p-7 text-(--pv-fg) shadow-[0_50px_100px_-60px_rgba(26,22,18,0.45)] sm:p-10">
            <div className="hidden" aria-hidden="true">
              <input type="text" name="user_extra_check" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
            </div>
            {failed ? (
              <p className="text-sm text-(--pv-fg-2)">Le formulaire est momentanément indisponible. Appelez-nous au {tokens.phone}.</p>
            ) : !form ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-(--pv-r) bg-(--pv-paper-2)" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {form.fields.map((f) => {
                  const full = f.width === 'full' || f.type === 'textarea' || f.type === 'checkbox';
                  const err = errors[f.name];
                  if (f.type === 'checkbox') {
                    const parts = f.label.split(/(politique de confidentialité)/i);
                    return (
                      <div key={f.id} className="sm:col-span-2">
                        <label className="flex cursor-pointer select-none items-start gap-3">
                          <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer accent-(--pv-accent)" />
                          <span className="text-xs leading-relaxed text-(--pv-fg-2)">
                            {parts.map((p, i) =>
                              /politique de confidentialité/i.test(p) ? (
                                <button key={i} type="button" onClick={() => go('/politique-de-confidentialite/')} className="font-semibold text-(--pv-fg) underline underline-offset-2">
                                  {p}
                                </button>
                              ) : (
                                <React.Fragment key={i}>{p}</React.Fragment>
                              )
                            )}
                            {f.required ? ' *' : ''}
                          </span>
                        </label>
                        {err ? <p className="mt-1.5 text-xs text-rose-700">{err}</p> : null}
                      </div>
                    );
                  }
                  return (
                    <div key={f.id} className={full ? 'sm:col-span-2' : ''}>
                      <label htmlFor={`f-${f.id}`} className={label}>
                        {f.label}
                        {f.required ? ' *' : ''}
                      </label>
                      {f.type === 'select' ? (
                        <select id={`f-${f.id}`} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} className="pv-input">
                          <option value="">{f.placeholder || 'Sélectionnez…'}</option>
                          {(f.options || []).map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea id={`f-${f.id}`} rows={5} placeholder={f.placeholder} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} className="pv-input leading-relaxed" />
                      ) : (
                        <input id={`f-${f.id}`} type={f.type} placeholder={f.placeholder} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} className={cx('pv-input', err && 'border-rose-400!')} />
                      )}
                      {err ? <p className="mt-1.5 text-xs text-rose-700">{err}</p> : null}
                    </div>
                  );
                })}
              </div>
            )}

            {form?.recaptcha ? <RecaptchaField config={form.recaptcha} /> : null}

            {submitError ? (
              <div role="alert" className="rounded-(--pv-r) border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-col-reverse justify-between gap-4 border-t border-(--pv-rule) pt-6 sm:flex-row sm:items-center">
              <span className="text-xs text-(--pv-fg-2)">* Champs obligatoires</span>
              <button type="submit" disabled={submitting || !form} className="pv-btn pv-btn-primary pv-btn-lg disabled:opacity-60">
                {submitting ? 'Envoi en cours…' : t(d.submitLabel) || 'Envoyer ma demande'}
                <ArrowRight className="pv-btn-arrow h-4 w-4" />
              </button>
            </div>
          </form>
        </Reveal>
      </div>
    </Section>
  );
}
