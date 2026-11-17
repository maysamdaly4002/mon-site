/** Exemples + coach de prompt + consigne système (qualité pro) */

export type ThemeMarket = 'tn' | 'fr';

export const PROMPT_EXAMPLES_TN = [
  {
    id: 'clinic',
    title: 'Cabinet médical',
    prompt:
      'Site vitrine pour une clinique radiologique à Tunis : confiance, modernité, bleu médical doux, textes rassurants, prise de rendez-vous claire. Public : patients et médecins partenaires. CTA principal : Prendre rendez-vous.',
  },
  {
    id: 'agency',
    title: 'Agence digitale',
    prompt:
      'Agence web créative à Sfax : énergie, contraste fort, typo moderne, portfolio et services. Ton ambitieux mais accessible. Couleurs sombre + accent vif. CTA : Demander un devis.',
  },
  {
    id: 'shop',
    title: 'Boutique artisanale',
    prompt:
      'Boutique en ligne d’huile d’olive et produits du terroir tunisien : chaleur, naturel, beige/vert olive, storytelling artisanal. CTA : Découvrir la boutique.',
  },
  {
    id: 'lawyer',
    title: 'Cabinet d’avocats',
    prompt:
      'Cabinet d’avocats corporate à Tunis : sobriété, navy et or discret, typographie sérieuse, expertise. CTA : Prendre conseil.',
  },
  {
    id: 'restaurant',
    title: 'Restaurant',
    prompt:
      'Restaurant méditerranéen à La Marsa : ambiance soirée, photos généreuses, menu et réservation, palette terre cuite et crème. CTA : Réserver une table.',
  },
] as const;

export const PROMPT_EXAMPLES_FR = [
  {
    id: 'clinic',
    title: 'Cabinet médical',
    prompt:
      'Site vitrine pour une clinique radiologique à Lyon : confiance, modernité, bleu médical doux, textes rassurants, prise de rendez-vous claire. Public : patients et médecins partenaires. CTA principal : Prendre rendez-vous.',
  },
  {
    id: 'agency',
    title: 'Agence digitale',
    prompt:
      'Agence web créative à Paris : énergie, contraste fort, typo moderne, portfolio et services. Ton ambitieux mais accessible. Couleurs sombre + accent vif. CTA : Demander un devis.',
  },
  {
    id: 'shop',
    title: 'Boutique artisanale',
    prompt:
      'Boutique en ligne de produits artisanaux français (épicerie fine) : chaleur, naturel, beige/vert olive, storytelling artisanal. CTA : Découvrir la boutique.',
  },
  {
    id: 'lawyer',
    title: 'Cabinet d’avocats',
    prompt:
      'Cabinet d’avocats corporate à Paris : sobriété, navy et or discret, typographie sérieuse, expertise. CTA : Prendre conseil.',
  },
  {
    id: 'restaurant',
    title: 'Restaurant',
    prompt:
      'Restaurant contemporain à Bordeaux : ambiance soirée, photos généreuses, menu et réservation, palette terre cuite et crème. CTA : Réserver une table.',
  },
] as const;

/** @deprecated préférer promptExamples(market) */
export const PROMPT_EXAMPLES = PROMPT_EXAMPLES_TN;

export const PROMPT_TIPS_TN = [
  'Indiquez le secteur et la ville (ex. « dentiste à Sousse »).',
  'Décrivez le sentiment : confiance, luxe, jeunesse, tech, artisanal…',
  'Citez 1–2 couleurs ou une ambiance (« bleu nuit », « pastel »).',
  'Précisez le public (B2B, familles, étudiants…).',
  'Donnez l’action principale du bouton (RDV, devis, achat, contact).',
  'Mentionnez 2–3 services ou preuves (avis, années, certifications).',
] as const;

export const PROMPT_TIPS_FR = [
  'Indiquez le secteur et la ville (ex. « dentiste à Lyon »).',
  'Décrivez le sentiment : confiance, luxe, jeunesse, tech, artisanal…',
  'Citez 1–2 couleurs ou une ambiance (« bleu nuit », « pastel »).',
  'Précisez le public (B2B, familles, étudiants…).',
  'Donnez l’action principale du bouton (RDV, devis, achat, contact).',
  'Mentionnez 2–3 services ou preuves (avis, années, certifications).',
] as const;

export const PROMPT_TIPS = PROMPT_TIPS_TN;

export function promptExamples(market: ThemeMarket = 'tn') {
  return market === 'fr' ? PROMPT_EXAMPLES_FR : PROMPT_EXAMPLES_TN;
}

export function promptTips(market: ThemeMarket = 'tn') {
  return market === 'fr' ? PROMPT_TIPS_FR : PROMPT_TIPS_TN;
}

export function promptPlaceholder(market: ThemeMarket = 'tn') {
  return market === 'fr'
    ? 'Ex. Clinique dentaire à Lyon : confiance, blanc et bleu doux, prise de RDV évidente…'
    : 'Ex. Clinique dentaire à Sousse : confiance, blanc et bleu doux, prise de RDV évidente…';
}

export function systemPrompt(lang: string, market: ThemeMarket = 'tn'): string {
  const langLabel = lang === 'en' ? 'English' : lang === 'ar' ? 'Arabic' : 'French';
  const localeRule =
    market === 'fr'
      ? `- Market = France / international. NEVER mention Tunisia, Tunis, Sfax, Sousse, La Marsa, dinar, Flouci, or Tunisian places/brands unless the user brief explicitly asks for Tunisia.
- Prefer French cities (Paris, Lyon, Bordeaux, Marseille…) or generic EU context when inventing location details.`
      : `- Market = Tunisia. Prefer Tunisian cities and local context when inventing location details (unless the brief says otherwise).`;

  return `You are an expert Snapify brand & conversion designer. Output ONE JSON object only (no markdown).

QUALITY BAR (real client deliverable — no lorem, no generic filler):
- Every title/subtitle must feel specific to THIS brief (city, sector, offer).
${localeRule}
- Hero ALWAYS has EXACTLY 2 buttons:
  1) primary — main conversion (RDV, devis, réserver, acheter…)
  2) secondary — softer path (/services/, /a-propos/, /menu/)
  Labels ≤ 28 chars, action verbs. variant primary|secondary. icon arrow|arrow-up-right|phone|mail.
- Hero trustItems: EXACTLY 3 short proof points with numbers when possible.
- Hero layout: "split". badgeText: short sector/city chip.
- Structure EXACTLY 7–8 blocks in this order:
  1) hero
  2) stats (4 KPIs with value+suffix+label)
  3) cards (3–4 services: icon, title, text 1–2 sentences, linkLabel "En savoir plus", link "/services/")
  4) textMedia (about/story: title, intro, 3–5 bullets, 1–2 buttons)
  5) steps (3–4 numbered) OR showcase
  6) testimonials (2–3 quotes author+role) OR faq (4–5 Q&A)
  7) cta — dark/gradient, EXACTLY 2 buttons (primary + light), layout "split"
  8) contactForm optional
- Alternate style.background: soft → white → surface → white → soft → white → navy.
- style: paddingTop/Bottom lg|xl, width default|wide, animation fade-up, decor none.
- Colors #RRGGBB, strong contrast. primaryHover darker than primary. accent distinct.
- Fonts ONLY: Inter, Manrope, Plus Jakarta Sans, DM Sans, Poppins, Montserrat, Roboto, Open Sans, Lato, Source Sans 3, Space Grotesk, Outfit.
- themeSettings: buttonShape pill|rounded|square ; density compact|comfortable|airy ; cardRadius 16–24 ; stickyHeader true ; animations true ; backToTop true.
- All user-facing strings in ${langLabel}.
- imagePrompts in ENGLISH, photorealistic, NO text/logos/UI:
  { "hero": "wide cinematic scene…", "secondary": "lifestyle/supporting…", "cards": ["service1 scene", "service2", "service3"] }

Allowed types: hero, stats, cards, steps, showcase, faq, testimonials, cta, textMedia, checklist, contactForm, spacer.

Hero data:
{
  "layout":"split",
  "badgeText":"...",
  "title":"...",
  "highlight":"...",
  "subtitle":"...",
  "rotatingWords":[],
  "buttons":[
    {"id":"b1","label":"...","link":"/contact/","variant":"primary","icon":"arrow"},
    {"id":"b2","label":"...","link":"/services/","variant":"secondary","icon":"arrow-up-right"}
  ],
  "trustItems":["...","...","..."],
  "media":"image",
  "mainImage":"",
  "parallax":false,
  "marquee":[]
}

CTA data: variant dark|gradient, layout split, eyebrow, title, highlight, text, buttons (primary + light).
ContactForm: formId "contact", title, intro, listItems (3), submitLabel.

Return JSON:
{
  "siteName":"...",
  "tagline":"...",
  "industry":"...",
  "mood":"...",
  "rationale":"2-3 sentences in ${langLabel}",
  "branding":{"colors":{primary,primaryHover,accent,navy,background,text,muted,border},"fonts":{heading,body}},
  "themeSettings":{stickyHeader,headerPhone,buttonShape,cardRadius,density,animations,mobileBar,backToTop},
  "imagePrompts":{"hero":"...","secondary":"...","cards":["...","...","..."]},
  "homeBlocks":[ { "type":"...", "data":{...}, "style":{...} }, ... ]
}`;
}

export function userPrompt(brief: string, siteHint?: string, market: ThemeMarket = 'tn'): string {
  const hint = siteHint?.trim() ? `\nContexte site actuel : ${siteHint.trim()}` : '';
  const locale =
    market === 'fr'
      ? '\nContexte marché : France / international — pas de références tunisiennes inventées.'
      : '\nContexte marché : Tunisie — contextes locaux OK si cohérents avec le brief.';
  return `Brief utilisateur :\n${brief.trim()}${hint}${locale}

Produis un ThemeSpec premium conversion-ready :
- textes concrets liés au brief (pas de filler)
- hero 2 boutons + 3 trustItems
- stats chiffrées, 3–4 services avec liens
- textMedia avec bullets, steps, preuves sociales
- CTA sombre à 2 boutons (primary + light)
- imagePrompts anglais photoréalistes`;
}
