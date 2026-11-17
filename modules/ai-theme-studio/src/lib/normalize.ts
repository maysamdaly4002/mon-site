/** Valide et complète un ThemeSpec pour qu’il soit 100 % applicable Snapify. */
import {
  ALLOWED_FONTS,
  ALLOWED_HOME_TYPES,
  type BrandColors,
  type HomeBlock,
  type ThemeSettingsSpec,
  type ThemeSpec,
} from '../types';

const HEX = /^#[0-9A-Fa-f]{6}$/;

function hex(v: unknown, fallback: string): string {
  const s = String(v || '').trim();
  return HEX.test(s) ? s.toUpperCase() : fallback;
}

function font(v: unknown, fallback: string): string {
  const s = String(v || '').trim();
  return (ALLOWED_FONTS as readonly string[]).includes(s) ? s : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function str(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function button(raw: unknown, fallbackLabel: string, fallbackLink = '/contact/') {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const variant = ['primary', 'secondary', 'dark', 'light', 'glass', 'link'].includes(String(o.variant))
    ? String(o.variant)
    : 'primary';
  const icon = ['arrow', 'arrow-up-right', 'phone', 'mail', 'download', 'none'].includes(String(o.icon))
    ? String(o.icon)
    : 'arrow';
  return {
    id: str(o.id, 40) || uid('btn'),
    label: str(o.label, 60) || fallbackLabel,
    link: str(o.link, 200) || fallbackLink,
    variant,
    icon,
    newTab: !!o.newTab,
  };
}

function style(raw: unknown): Record<string, unknown> {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const bg = ['none', 'white', 'surface', 'soft', 'navy', 'brand'].includes(String(o.background))
    ? String(o.background)
    : 'white';
  const pad = ['none', 'sm', 'md', 'lg', 'xl'].includes(String(o.paddingTop)) ? String(o.paddingTop) : 'lg';
  const padB = ['none', 'sm', 'md', 'lg', 'xl'].includes(String(o.paddingBottom)) ? String(o.paddingBottom) : 'lg';
  const width = ['narrow', 'default', 'wide', 'full'].includes(String(o.width)) ? String(o.width) : 'default';
  const animation = ['none', 'fade-up', 'fade', 'zoom'].includes(String(o.animation)) ? String(o.animation) : 'fade-up';
  return {
    background: bg,
    decor: 'none',
    paddingTop: pad,
    paddingBottom: padB,
    width,
    animation,
  };
}

function heading(o: Record<string, unknown>) {
  return {
    eyebrow: str(o.eyebrow, 80) || undefined,
    title: str(o.title, 120) || 'Section',
    highlight: str(o.highlight, 80) || undefined,
    intro: str(o.intro, 400) || undefined,
    align: o.align === 'center' ? 'center' : 'left',
  };
}

function normalizeBlock(raw: unknown, index: number): HomeBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const type = String(b.type || '');
  if (!(ALLOWED_HOME_TYPES as readonly string[]).includes(type)) return null;
  const dataIn = b.data && typeof b.data === 'object' ? (b.data as Record<string, unknown>) : {};
  const st = style(b.style);

  if (type === 'hero') {
    let buttons = Array.isArray(dataIn.buttons)
      ? dataIn.buttons.slice(0, 3).map((x, i) =>
          button(
            x,
            i === 0 ? 'Nous contacter' : 'En savoir plus',
            i === 0 ? '/contact/' : '/services/'
          )
        )
      : [];
    if (!buttons.length) {
      buttons = [
        button({ variant: 'primary', icon: 'arrow', label: 'Nous contacter', link: '/contact/' }, 'Nous contacter'),
        button({ variant: 'secondary', icon: 'arrow-up-right', label: 'Nos services', link: '/services/' }, 'Nos services', '/services/'),
      ];
    } else if (buttons.length === 1) {
      buttons.push(button({ variant: 'secondary', icon: 'arrow-up-right', label: 'En savoir plus', link: '/a-propos/' }, 'En savoir plus', '/a-propos/'));
    }
    // Premier = primary, second = secondary si non précisé
    if (buttons[0]) buttons[0] = { ...buttons[0], variant: buttons[0].variant === 'secondary' ? 'primary' : buttons[0].variant };
    if (buttons[1] && buttons[1].variant === 'primary') buttons[1] = { ...buttons[1], variant: 'secondary' };

    let trustItems = Array.isArray(dataIn.trustItems)
      ? dataIn.trustItems.map((t) => str(t, 80)).filter(Boolean).slice(0, 4)
      : [];
    if (trustItems.length < 2) {
      trustItems = ['Réponse sous 24 h', 'Équipe locale', 'Devis clair'].slice(0, 3);
    }

    return {
      type,
      data: {
        layout: dataIn.layout === 'centered' ? 'centered' : 'split',
        badgeText: str(dataIn.badgeText, 60),
        title: str(dataIn.title, 120) || 'Bienvenue',
        highlight: str(dataIn.highlight, 80),
        subtitle: str(dataIn.subtitle, 300),
        rotatingWords: Array.isArray(dataIn.rotatingWords)
          ? dataIn.rotatingWords.map((w) => str(w, 40)).filter(Boolean).slice(0, 4)
          : [],
        buttons,
        liveText: str(dataIn.liveText, 80),
        trustItems,
        media: 'image',
        mainImage: str(dataIn.mainImage, 500),
        mainImageAlt: str(dataIn.mainImageAlt, 120),
        parallax: bool(dataIn.parallax, false),
        marquee: [],
      },
      style: { ...st, background: st.background === 'white' ? 'soft' : st.background, paddingTop: 'xl', paddingBottom: 'xl' },
    };
  }

  if (type === 'stats') {
    const items = (Array.isArray(dataIn.items) ? dataIn.items : []).slice(0, 4).map((it, i) => {
      const o = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
      return {
        id: str(o.id, 40) || uid('st'),
        value: str(o.value, 20) || String((i + 1) * 10),
        prefix: str(o.prefix, 8) || undefined,
        suffix: str(o.suffix, 8) || undefined,
        label: str(o.label, 60) || 'Indicateur',
        hint: str(o.hint, 80) || undefined,
      };
    });
    while (items.length < 3) {
      items.push({ id: uid('st'), value: String(items.length * 25 + 50), label: 'Résultat', prefix: undefined, suffix: '+', hint: undefined });
    }
    return {
      type,
      data: { ...heading(dataIn), style: 'cards', countUp: true, items },
      style: st,
    };
  }

  if (type === 'cards') {
    const icons = ['sparkles', 'shield', 'heart', 'star', 'check', 'phone'];
    const items = (Array.isArray(dataIn.items) ? dataIn.items : []).slice(0, 6).map((it, i) => {
      const o = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
      return {
        id: str(o.id, 40) || uid('cd'),
        icon: str(o.icon, 40) || icons[i % icons.length]!,
        title: str(o.title, 80) || 'Service',
        text: str(o.text, 240) || 'Une offre claire, adaptée à vos besoins.',
        image: str(o.image, 500) || undefined,
        tags: [],
        linkLabel: str(o.linkLabel, 40) || 'En savoir plus',
        link: str(o.link, 200) || '/services/',
      };
    });
    while (items.length < 3) {
      const i = items.length;
      items.push({
        id: uid('cd'),
        icon: icons[i % icons.length]!,
        title: 'Offre',
        text: 'Description à personnaliser.',
        image: undefined,
        tags: [],
        linkLabel: 'En savoir plus',
        link: '/services/',
      });
    }
    const hasAnyImage = items.some((it) => !!it.image);
    return {
      type,
      data: {
        ...heading(dataIn),
        style: hasAnyImage ? 'image' : 'card',
        columns: items.length >= 4 ? 4 : 3,
        items,
      },
      style: st,
    };
  }

  if (type === 'steps') {
    const items = (Array.isArray(dataIn.items) ? dataIn.items : []).slice(0, 5).map((it, i) => {
      const o = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
      return {
        id: str(o.id, 40) || uid('sp'),
        num: str(o.num, 4) || String(i + 1).padStart(2, '0'),
        title: str(o.title, 80) || `Étape ${i + 1}`,
        text: str(o.text, 240) || '',
        deliverable: str(o.deliverable, 120) || undefined,
      };
    });
    while (items.length < 3) {
      const i = items.length;
      items.push({ id: uid('sp'), num: String(i + 1).padStart(2, '0'), title: `Étape ${i + 1}`, text: '', deliverable: undefined });
    }
    return {
      type,
      data: {
        ...heading(dataIn),
        style: 'timeline',
        deliverableLabel: str(dataIn.deliverableLabel, 40) || 'Livrable',
        items,
        buttons: [button(Array.isArray(dataIn.buttons) ? dataIn.buttons[0] : {}, 'Démarrer')],
      },
      style: st,
    };
  }

  if (type === 'faq') {
    const items = (Array.isArray(dataIn.items) ? dataIn.items : []).slice(0, 8).map((it) => {
      const o = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
      return {
        id: str(o.id, 40) || uid('fq'),
        question: str(o.question || o.title, 160) || 'Question ?',
        answer: str(o.answer || o.text, 600) || 'Réponse à compléter.',
      };
    });
    while (items.length < 3) {
      items.push({ id: uid('fq'), question: 'Une question fréquente ?', answer: 'Nous vous répondons rapidement.' });
    }
    return {
      type,
      data: {
        ...heading(dataIn),
        layout: dataIn.layout === 'stacked' ? 'stacked' : 'split',
        showContactCard: bool(dataIn.showContactCard, true),
        contactLabel: str(dataIn.contactLabel, 60) || 'Une autre question ?',
        items,
      },
      style: st,
    };
  }

  if (type === 'testimonials') {
    const items = (Array.isArray(dataIn.items) ? dataIn.items : []).slice(0, 6).map((it) => {
      const o = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
      return {
        id: str(o.id, 40) || uid('tm'),
        quote: str(o.quote || o.text, 400) || 'Un retour client positif.',
        author: str(o.author || o.name, 80) || 'Client',
        role: str(o.role, 80) || '',
        image: '',
      };
    });
    while (items.length < 2) {
      items.push({ id: uid('tm'), quote: 'Excellent accompagnement.', author: 'Client satisfait', role: '', image: '' });
    }
    return {
      type,
      data: { ...heading(dataIn), items },
      style: st,
    };
  }

  if (type === 'cta') {
    let buttons = Array.isArray(dataIn.buttons)
      ? dataIn.buttons.slice(0, 2).map((x, i) =>
          button(
            x,
            i === 0 ? 'Parler à un expert' : 'Voir nos services',
            i === 0 ? '/contact/' : '/services/'
          )
        )
      : [
          button({ variant: 'primary', icon: 'arrow', label: 'Parler à un expert', link: '/contact/' }, 'Parler à un expert'),
          button({ variant: 'light', icon: 'arrow-up-right', label: 'Nos services', link: '/services/' }, 'Nos services', '/services/'),
        ];
    if (buttons.length === 1) {
      buttons.push(button({ variant: 'light', icon: 'arrow-up-right', label: 'Nos services', link: '/services/' }, 'Nos services', '/services/'));
    }
    const ctaVariant = dataIn.variant === 'light' ? 'light' : dataIn.variant === 'gradient' ? 'gradient' : 'dark';
    // Sur fond sombre : primaire + light (blanc) pour contraste
    if (buttons[0]) buttons[0] = { ...buttons[0], variant: 'primary', icon: buttons[0].icon === 'none' ? 'arrow' : buttons[0].icon };
    if (buttons[1]) {
      buttons[1] = {
        ...buttons[1],
        variant: ctaVariant === 'light' ? 'secondary' : 'light',
        icon: buttons[1].icon === 'none' ? 'arrow-up-right' : buttons[1].icon,
      };
    }
    return {
      type,
      data: {
        variant: ctaVariant,
        layout: dataIn.layout === 'centered' ? 'centered' : 'split',
        eyebrow: str(dataIn.eyebrow, 60) || 'Prochaine étape',
        title: str(dataIn.title, 120) || 'Prêts à démarrer ?',
        highlight: str(dataIn.highlight, 80),
        text: str(dataIn.text, 300) || 'Parlez-nous de votre projet — réponse sous 24 h.',
        buttons,
        image: str(dataIn.image, 500),
        imageAlt: str(dataIn.imageAlt, 120),
      },
      style: { ...st, background: 'navy', paddingTop: 'xl', paddingBottom: 'xl' },
    };
  }

  if (type === 'textMedia') {
    let bullets = Array.isArray(dataIn.bullets) ? dataIn.bullets.map((x) => str(x, 120)).filter(Boolean).slice(0, 6) : [];
    if (bullets.length < 3) {
      bullets = [
        'Une approche claire et personnalisée',
        'Des interlocuteurs joignables et réactifs',
        'Un suivi transparent à chaque étape',
      ];
    }
    let tmButtons = Array.isArray(dataIn.buttons)
      ? dataIn.buttons.slice(0, 2).map((x, i) => button(x, i === 0 ? 'À propos' : 'Nous contacter', i === 0 ? '/a-propos/' : '/contact/'))
      : [button({ variant: 'primary', icon: 'arrow', label: 'À propos', link: '/a-propos/' }, 'À propos', '/a-propos/')];
    if (tmButtons.length === 1) {
      tmButtons.push(button({ variant: 'secondary', icon: 'arrow-up-right', label: 'Nous contacter', link: '/contact/' }, 'Nous contacter', '/contact/'));
    }
    return {
      type,
      data: {
        ...heading(dataIn),
        html: str(dataIn.html, 4000) || `<p>${str(dataIn.intro || dataIn.text, 400) || 'Présentation de votre activité.'}</p>`,
        bullets,
        buttons: tmButtons,
        mediaType: 'image',
        image: str(dataIn.image, 500),
        imageAlt: str(dataIn.imageAlt, 120),
        videoSource: 'file',
        mediaPosition: dataIn.mediaPosition === 'left' ? 'left' : 'right',
        mediaStyle: 'rounded',
        ratio: 'landscape',
        autoplay: false,
      },
      style: st,
    };
  }

  if (type === 'checklist') {
    const entries = (Array.isArray(dataIn.items) ? dataIn.items : Array.isArray(dataIn.entries) ? dataIn.entries : [])
      .slice(0, 8)
      .map((it) => {
        const o = typeof it === 'string' ? { title: it } : it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
        return {
          id: str(o.id, 40) || uid('ck'),
          title: str(o.title || o.text, 120) || 'Point clé',
          text: str(o.text, 200) || undefined,
        };
      });
    while (entries.length < 3) entries.push({ id: uid('ck'), title: 'Avantage clé', text: undefined });
    return {
      type,
      data: {
        ...heading(dataIn),
        cards: [
          {
            id: uid('card'),
            icon: 'check',
            tag: str(dataIn.tag, 40) || 'Inclus',
            title: str(dataIn.cardTitle, 80) || str(dataIn.title, 80) || 'Ce que vous obtenez',
            entries,
          },
        ],
      },
      style: st,
    };
  }

  if (type === 'contactForm') {
    return {
      type,
      data: {
        formId: str(dataIn.formId, 40) || 'contact',
        title: str(dataIn.title, 120) || 'Contactez-nous',
        intro: str(dataIn.intro, 300) || 'Réponse sous 24 h ouvrées.',
        phoneLabel: str(dataIn.phoneLabel, 40) || 'Téléphone',
        phoneHint: str(dataIn.phoneHint, 80) || '',
        listTitle: str(dataIn.listTitle, 80) || 'Pourquoi nous écrire',
        listItems: Array.isArray(dataIn.listItems)
          ? dataIn.listItems.map((x) => str(x, 120)).filter(Boolean).slice(0, 5)
          : ['Devis sous 48 h', 'Écoute personnalisée', 'Suivi clair'],
        submitLabel: str(dataIn.submitLabel, 40) || 'Envoyer',
      },
      style: st,
    };
  }

  if (type === 'showcase') {
    const items = (Array.isArray(dataIn.items) ? dataIn.items : []).slice(0, 4).map((it) => {
      const o = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
      return {
        id: str(o.id, 40) || uid('sh'),
        icon: str(o.icon, 40) || 'star',
        title: str(o.title, 80) || 'Projet',
        text: str(o.text, 240) || '',
        image: '',
        chips: [],
        buttonLabel: str(o.buttonLabel, 40) || undefined,
        link: str(o.link, 200) || undefined,
      };
    });
    while (items.length < 2) {
      items.push({ id: uid('sh'), icon: 'star', title: 'Réalisation', text: '', image: '', chips: [], buttonLabel: undefined, link: undefined });
    }
    return {
      type,
      data: { ...heading(dataIn), interval: 6, items },
      style: st,
    };
  }

  if (type === 'spacer') {
    const height = Math.min(160, Math.max(24, Number(dataIn.height) || 64));
    return { type, data: { height, divider: !!dataIn.divider }, style: { ...st, paddingTop: 'none', paddingBottom: 'none' } };
  }

  // pageHeader / gallery fallbacks kept minimal
  if (type === 'pageHeader') {
    return {
      type,
      data: {
        breadcrumb: false,
        title: str(dataIn.title, 120) || 'Page',
        highlight: str(dataIn.highlight, 80),
        intro: str(dataIn.intro, 300),
        buttons: [],
      },
      style: st,
    };
  }

  void index;
  return null;
}

function defaultColors(): BrandColors {
  return {
    primary: '#0D9488',
    primaryHover: '#0F766E',
    accent: '#F59E0B',
    navy: '#0F172A',
    background: '#F8FAFC',
    text: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0',
  };
}

function defaultSettings(): ThemeSettingsSpec {
  return {
    stickyHeader: true,
    headerPhone: true,
    buttonShape: 'pill',
    cardRadius: 20,
    density: 'comfortable',
    animations: true,
    mobileBar: true,
    backToTop: false,
  };
}

/** Alternance de fonds + ordre marketing classique. */
function polishStructure(blocks: HomeBlock[]): HomeBlock[] {
  const preferred = ['hero', 'stats', 'cards', 'textMedia', 'steps', 'testimonials', 'faq', 'cta', 'contactForm'];
  const byType = new Map<string, HomeBlock>();
  for (const b of blocks) {
    if (!byType.has(b.type) || b.type === 'spacer') byType.set(b.type, b);
  }
  // garder steps OU showcase (priorité steps)
  if (byType.has('steps') && byType.has('showcase')) byType.delete('showcase');
  // si trop dense : privilégier testimonials, garder faq en plus seulement si < 8
  const ordered: HomeBlock[] = [];
  for (const t of preferred) {
    const b = byType.get(t);
    if (b) ordered.push(b);
  }
  for (const b of blocks) {
    if (!ordered.includes(b) && ordered.length < 8) ordered.push(b);
  }

  // Cap à 8 blocs : hero + stats + cards + textMedia + steps + social proof + cta (+ contact)
  const capped = ordered.slice(0, 8);
  const bgs = ['soft', 'white', 'surface', 'white', 'soft', 'white', 'navy', 'surface'];
  return capped.map((b, i) => {
    if (b.type === 'cta') {
      return { ...b, style: { ...b.style, background: 'navy', paddingTop: 'xl', paddingBottom: 'xl', animation: 'fade-up' } };
    }
    if (b.type === 'hero') {
      return { ...b, style: { ...b.style, background: 'soft', paddingTop: 'xl', paddingBottom: 'xl', animation: 'fade-up' } };
    }
    if (b.type === 'contactForm') {
      return { ...b, style: { ...b.style, background: 'surface', paddingTop: 'xl', paddingBottom: 'xl', animation: 'fade-up' } };
    }
    return { ...b, style: { ...b.style, background: bgs[i] || 'white', paddingTop: 'lg', paddingBottom: 'lg', animation: 'fade-up' } };
  });
}

export function extractImagePrompts(raw: unknown): { hero?: string; secondary?: string; cards?: string[] } {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const ip = o.imagePrompts && typeof o.imagePrompts === 'object' ? (o.imagePrompts as Record<string, unknown>) : {};
  return {
    hero: str(ip.hero, 400) || undefined,
    secondary: str(ip.secondary, 400) || undefined,
    cards: Array.isArray(ip.cards) ? ip.cards.map((c) => str(c, 300)).filter(Boolean).slice(0, 3) : undefined,
  };
}

export function normalizeThemeSpec(raw: unknown): ThemeSpec {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const brandingIn = o.branding && typeof o.branding === 'object' ? (o.branding as Record<string, unknown>) : {};
  const colorsIn = brandingIn.colors && typeof brandingIn.colors === 'object' ? (brandingIn.colors as Record<string, unknown>) : {};
  const fontsIn = brandingIn.fonts && typeof brandingIn.fonts === 'object' ? (brandingIn.fonts as Record<string, unknown>) : {};
  const settingsIn = o.themeSettings && typeof o.themeSettings === 'object' ? (o.themeSettings as Record<string, unknown>) : {};
  const base = defaultColors();
  const settings = defaultSettings();

  const shape = String(settingsIn.buttonShape);
  const density = String(settingsIn.density);
  const cardRadius = Math.min(28, Math.max(12, Math.round(Number(settingsIn.cardRadius) || settings.cardRadius)));

  let blocks = (Array.isArray(o.homeBlocks) ? o.homeBlocks : [])
    .map((b, i) => normalizeBlock(b, i))
    .filter((b): b is HomeBlock => !!b);

  if (!blocks.length || blocks[0]?.type !== 'hero') {
    const hero = normalizeBlock(
      {
        type: 'hero',
        data: {
          title: str(o.siteName, 80) || 'Votre marque',
          subtitle: str(o.tagline, 200),
          layout: 'split',
          badgeText: str(o.industry, 40),
        },
      },
      0
    )!;
    blocks = [hero, ...blocks.filter((b) => b.type !== 'hero')];
  }
  if (!blocks.some((b) => b.type === 'stats')) {
    const stats = normalizeBlock(
      {
        type: 'stats',
        data: {
          title: 'Ils nous font confiance',
          items: [
            { value: '10', suffix: '+', label: 'Années' },
            { value: '500', suffix: '+', label: 'Clients' },
            { value: '98', suffix: '%', label: 'Satisfaction' },
            { value: '24', suffix: 'h', label: 'Réponse' },
          ],
        },
      },
      1
    );
    if (stats) blocks.splice(1, 0, stats);
  }
  if (!blocks.some((b) => b.type === 'cards')) {
    const cards = normalizeBlock(
      {
        type: 'cards',
        data: {
          title: 'Nos expertises',
          intro: str(o.tagline, 160),
          items: [
            { icon: 'sparkles', title: 'Conseil', text: 'Un accompagnement clair, adapté à votre contexte.', linkLabel: 'En savoir plus', link: '/services/' },
            { icon: 'shield', title: 'Qualité', text: 'Des standards élevés, de A à Z.', linkLabel: 'En savoir plus', link: '/services/' },
            { icon: 'heart', title: 'Proximité', text: 'Une équipe joignable et réactive.', linkLabel: 'En savoir plus', link: '/services/' },
          ],
        },
      },
      2
    );
    if (cards) blocks.splice(2, 0, cards);
  }
  if (!blocks.some((b) => b.type === 'textMedia')) {
    const tm = normalizeBlock(
      {
        type: 'textMedia',
        data: {
          title: `Pourquoi ${str(o.siteName, 40) || 'nous'}`,
          intro: str(o.tagline, 200) || 'Une équipe engagée à vos côtés.',
          bullets: ['Expertise terrain', 'Communication claire', 'Résultats mesurables'],
        },
      },
      3
    );
    if (tm) {
      const afterCards = blocks.findIndex((b) => b.type === 'cards');
      blocks.splice(afterCards >= 0 ? afterCards + 1 : blocks.length, 0, tm);
    }
  }
  if (!blocks.some((b) => b.type === 'steps') && !blocks.some((b) => b.type === 'showcase')) {
    const steps = normalizeBlock(
      {
        type: 'steps',
        data: {
          title: 'Comment ça se passe',
          items: [
            { title: 'Échange', text: 'Nous clarifions vos objectifs et contraintes.' },
            { title: 'Proposition', text: 'Un plan d’action clair, avec un devis transparent.' },
            { title: 'Réalisation', text: 'Livraison soignée et suivi jusqu’au résultat.' },
          ],
        },
      },
      4
    );
    if (steps) {
      const afterTm = blocks.findIndex((b) => b.type === 'textMedia');
      blocks.splice(afterTm >= 0 ? afterTm + 1 : blocks.length, 0, steps);
    }
  }
  if (!blocks.some((b) => b.type === 'testimonials') && !blocks.some((b) => b.type === 'faq')) {
    const testimonials = normalizeBlock(
      {
        type: 'testimonials',
        data: {
          title: 'Ils nous recommandent',
          items: [
            { quote: 'Un accompagnement pro, réactif et vraiment à l’écoute.', author: 'Client satisfait', role: 'Dirigeant' },
            { quote: 'Des résultats concrets, sans jargon inutile.', author: 'Partenaire', role: 'Responsable projet' },
          ],
        },
      },
      5
    );
    if (testimonials) {
      const beforeCta = blocks.findIndex((b) => b.type === 'cta');
      blocks.splice(beforeCta >= 0 ? beforeCta : blocks.length, 0, testimonials);
    }
  }
  if (!blocks.some((b) => b.type === 'cta')) {
    const cta = normalizeBlock(
      {
        type: 'cta',
        data: {
          title: 'Parlons de votre projet',
          text: str(o.tagline, 200),
          highlight: 'dès aujourd’hui',
          buttons: [
            { label: 'Nous contacter', link: '/contact/', variant: 'primary', icon: 'arrow' },
            { label: 'Nos services', link: '/services/', variant: 'light', icon: 'arrow-up-right' },
          ],
        },
      },
      blocks.length
    );
    if (cta) blocks.push(cta);
  }

  blocks = polishStructure(blocks);

  return {
    siteName: str(o.siteName, 80) || 'Mon site',
    tagline: str(o.tagline, 160) || '',
    industry: str(o.industry, 80) || '',
    mood: str(o.mood, 80) || '',
    rationale: str(o.rationale, 600) || '',
    branding: {
      colors: {
        primary: hex(colorsIn.primary, base.primary),
        primaryHover: hex(colorsIn.primaryHover, base.primaryHover),
        accent: hex(colorsIn.accent, base.accent),
        navy: hex(colorsIn.navy, base.navy),
        background: hex(colorsIn.background, base.background),
        text: hex(colorsIn.text, base.text),
        muted: hex(colorsIn.muted, base.muted),
        border: hex(colorsIn.border, base.border),
      },
      fonts: {
        heading: font(fontsIn.heading, 'Plus Jakarta Sans'),
        body: font(fontsIn.body, 'Manrope'),
      },
    },
    themeSettings: {
      stickyHeader: bool(settingsIn.stickyHeader, settings.stickyHeader),
      headerPhone: bool(settingsIn.headerPhone, settings.headerPhone),
      buttonShape: shape === 'rounded' || shape === 'square' ? shape : 'pill',
      cardRadius,
      density: density === 'compact' || density === 'airy' ? density : 'comfortable',
      animations: bool(settingsIn.animations, settings.animations),
      mobileBar: bool(settingsIn.mobileBar, settings.mobileBar),
      backToTop: bool(settingsIn.backToTop, true),
    },
    homeBlocks: blocks,
  };
}

export function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Réponse IA invalide (JSON attendu).');
  return JSON.parse(cleaned.slice(start, end + 1));
}
