/**
 * Snapify — module Articles IA
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
export interface Settings {
  provider: 'openai' | 'anthropic' | 'gemini';
  apiKey: string;
  openaiModel: string;
  anthropicModel: string;
  geminiModel: string;
  generateImages: boolean;
  defaultTone: string;
  defaultLang: string;
  pageTitle: string;
  pageIntro: string;
}

export interface AiArticle {
  title: string;
  slug: string;
  excerpt: string;
  html: string;
  coverImage: string;
  topic: string;
  provider: string;
  model: string;
  status: 'draft' | 'published';
  seoTitle: string;
  seoDescription: string;
}
