/** Types Atelier thème IA */

export type Provider = 'openai' | 'anthropic' | 'gemini';

export type Settings = {
  provider: Provider;
  apiKey: string;
  openaiModel: string;
  anthropicModel: string;
  geminiModel: string;
  defaultLang: 'fr' | 'ar' | 'en';
  autoApplyHome: boolean;
  /** OpenAI DALL·E / Gemini Imagen ; sinon images Unsplash adaptées au secteur. */
  generateImages: boolean;
};

export type BrandColors = {
  primary: string;
  primaryHover: string;
  accent: string;
  navy: string;
  background: string;
  text: string;
  muted: string;
  border: string;
};

export type ThemeSettingsSpec = {
  stickyHeader: boolean;
  headerPhone: boolean;
  buttonShape: 'pill' | 'rounded' | 'square';
  cardRadius: number;
  density: 'compact' | 'comfortable' | 'airy';
  animations: boolean;
  mobileBar: boolean;
  backToTop: boolean;
};

/** Bloc CMS simplifié — types sûrs pour la page d’accueil. */
export type HomeBlock = {
  type: string;
  data: Record<string, unknown>;
  style?: Record<string, unknown>;
};

export type ThemeSpec = {
  siteName: string;
  tagline: string;
  industry: string;
  mood: string;
  rationale: string;
  branding: {
    colors: BrandColors;
    fonts: { heading: string; body: string };
  };
  themeSettings: ThemeSettingsSpec;
  homeBlocks: HomeBlock[];
};

export type GenerationRecord = {
  id: string;
  createdAt: string;
  prompt: string;
  lang: string;
  provider: Provider;
  model: string;
  status: 'pending' | 'ready' | 'failed';
  error?: string;
  spec?: ThemeSpec;
  applied?: {
    branding: boolean;
    theme: boolean;
    home: boolean;
    at: string;
  };
};

export const AI_CANVAS_THEME_ID = 'hamdiayari.ai-canvas';

export const ALLOWED_FONTS = [
  'Inter',
  'Manrope',
  'Plus Jakarta Sans',
  'DM Sans',
  'Poppins',
  'Montserrat',
  'Roboto',
  'Open Sans',
  'Lato',
  'Source Sans 3',
  'Space Grotesk',
  'Outfit',
] as const;

export const ALLOWED_HOME_TYPES = [
  'hero',
  'pageHeader',
  'richText',
  'textMedia',
  'stats',
  'cards',
  'showcase',
  'steps',
  'faq',
  'testimonials',
  'cta',
  'contactForm',
  'gallery',
  'checklist',
  'panels',
  'spacer',
] as const;
