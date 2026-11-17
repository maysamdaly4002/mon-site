/** Images hero / sections : IA (OpenAI / Gemini) + fallbacks Unsplash par secteur. */
import type { ServerContext } from '@snapify/sdk';
import type { HomeBlock, Settings, ThemeSpec } from '../types';

const STOCK: Record<string, string[]> = {
  medical: [
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&w=1400&q=80',
  ],
  agency: [
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1400&q=80',
  ],
  shop: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=80',
  ],
  lawyer: [
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1507679799987-4e9946940b41?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1436450412740-6b98866ce9a0?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1400&q=80',
  ],
  restaurant: [
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1550963211-0be95e3b5d3f?auto=format&fit=crop&w=1400&q=80',
  ],
  tech: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1400&q=80',
  ],
  default: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80',
  ],
};

function stockBucket(industry: string, mood: string): string[] {
  const hay = `${industry} ${mood}`.toLowerCase();
  if (/médic|medic|santé|sante|clinic|dent|radio|hôpital|hopital|doctor/.test(hay)) return STOCK.medical!;
  if (/resto|restaurant|café|cafe|food|cuisine|hôtel|hotel/.test(hay)) return STOCK.restaurant!;
  if (/avocat|lawyer|droit|jurid|notaire/.test(hay)) return STOCK.lawyer!;
  if (/boutique|shop|commerce|e-?commerce|retail|huile|artisan/.test(hay)) return STOCK.shop!;
  if (/agence|digital|marketing|créatif|creatif|design|studio/.test(hay)) return STOCK.agency!;
  if (/tech|saas|software|startup|it |dev/.test(hay)) return STOCK.tech!;
  return STOCK.default!;
}

function polishPrompt(raw: string): string {
  const base = raw.trim().slice(0, 700);
  const suffix =
    ', photorealistic editorial photography, natural lighting, shallow depth of field, premium website hero, no text, no watermark, no logo, no UI overlay';
  if (/no text|photorealistic/i.test(base)) return base.slice(0, 900);
  return `${base}${suffix}`.slice(0, 900);
}

async function dalle(ctx: ServerContext<Settings>, key: string, prompt: string): Promise<string | null> {
  try {
    const res = await ctx.fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: polishPrompt(prompt),
        size: '1792x1024',
        response_format: 'b64_json',
        n: 1,
        quality: 'standard',
      }),
    });
    if (!res.ok) {
      ctx.log.warn('image OpenAI', res.status);
      return null;
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return null;
    return ctx.files.saveImage({ dataBase64: b64, mimeType: 'image/png' }, { prefix: 'theme' });
  } catch (e) {
    ctx.log.warn('image OpenAI fail', e);
    return null;
  }
}

async function imagen(ctx: ServerContext<Settings>, key: string, prompt: string): Promise<string | null> {
  const body = JSON.stringify({
    instances: [{ prompt: polishPrompt(prompt) }],
    parameters: { sampleCount: 1, aspectRatio: '16:9' },
  });
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${encodeURIComponent(key)}`;
    const res = await ctx.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!res.ok) {
      const url2 = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(key)}`;
      const res2 = await ctx.fetch(url2, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instances: [{ prompt: polishPrompt(prompt) }], parameters: { sampleCount: 1 } }),
      });
      if (!res2.ok) return null;
      const j2 = (await res2.json()) as { predictions?: { bytesBase64Encoded?: string }[] };
      const b2 = j2.predictions?.[0]?.bytesBase64Encoded;
      if (!b2) return null;
      return ctx.files.saveImage({ dataBase64: b2, mimeType: 'image/png' }, { prefix: 'theme' });
    }
    const json = (await res.json()) as { predictions?: { bytesBase64Encoded?: string }[] };
    const b64 = json.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) return null;
    return ctx.files.saveImage({ dataBase64: b64, mimeType: 'image/png' }, { prefix: 'theme' });
  } catch {
    return null;
  }
}

function patchBlockImage(block: HomeBlock, url: string, alt: string): HomeBlock {
  const data = { ...block.data };
  if (block.type === 'hero') {
    data.media = 'image';
    data.mainImage = url;
    data.mainImageAlt = alt;
    data.layout = data.layout === 'centered' ? 'split' : data.layout || 'split';
  } else if (block.type === 'textMedia') {
    data.mediaType = 'image';
    data.image = url;
    data.imageAlt = alt;
  } else if (block.type === 'cta') {
    data.image = url;
    data.imageAlt = alt;
    data.layout = 'split';
    data.variant = data.variant === 'light' ? 'light' : 'dark';
  } else if (block.type === 'cards' && Array.isArray(data.items)) {
    // handled separately via patchCardsImages
  } else if (block.type === 'showcase' && Array.isArray(data.items)) {
    data.items = (data.items as Record<string, unknown>[]).map((it, i) => (i === 0 ? { ...it, image: url } : it));
  }
  return { ...block, data };
}

function patchCardsImages(block: HomeBlock, urls: string[], alt: string): HomeBlock {
  if (block.type !== 'cards' || !Array.isArray(block.data.items)) return block;
  const items = (block.data.items as Record<string, unknown>[]).map((it, i) => ({
    ...it,
    image: urls[i % urls.length] || it.image,
    linkLabel: it.linkLabel || 'En savoir plus',
    link: it.link || '/services/',
  }));
  return {
    ...block,
    data: {
      ...block.data,
      style: 'image',
      items,
      // keep heading fields
    },
  };
}

export type ImagePrompts = { hero?: string; secondary?: string; cards?: string[] };

/** Enrichit le spec avec images (IA si possible, sinon stock sectoriel). */
export async function enrichSpecImages(
  ctx: ServerContext<Settings>,
  spec: ThemeSpec,
  prompts: ImagePrompts,
  opts: { generateAi: boolean; provider: string; key: string }
): Promise<ThemeSpec> {
  const stock = stockBucket(spec.industry, spec.mood);
  const heroPrompt =
    prompts.hero ||
    `Professional website hero photo for ${spec.industry || 'business'}, mood ${spec.mood || 'modern'}, brand ${spec.siteName}, wide cinematic composition`;
  const secondaryPrompt =
    prompts.secondary ||
    `Supporting lifestyle photo for ${spec.industry || 'business'}, ${spec.mood || 'warm'}, clean modern interior or scene`;

  // Stock d’abord (instantané). Au plus 1 image IA (hero) avec budget 25 s — le reste reste stock.
  let heroUrl: string | null = null;
  const secondaryUrl = stock[1] || STOCK.default![1]!;
  void secondaryPrompt; // réservé si on réactive une 2ᵉ image IA

  if (opts.generateAi && opts.key) {
    const gen = opts.provider === 'openai' ? dalle : opts.provider === 'gemini' ? imagen : null;
    if (gen) {
      try {
        heroUrl = await Promise.race([
          gen(ctx, opts.key, heroPrompt),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 25_000)),
        ]);
      } catch (e) {
        ctx.log.warn('image AI budget', e);
        heroUrl = null;
      }
    }
  }

  heroUrl = heroUrl || stock[0] || STOCK.default![0]!;
  const cardUrls = [stock[2], stock[3], stock[4], stock[0], stock[1]].filter(Boolean) as string[];

  const alt = `${spec.siteName} — ${spec.industry || 'accueil'}`;
  let blocks = spec.homeBlocks.map((b) => ({ ...b, data: { ...b.data } }));

  const heroIdx = blocks.findIndex((b) => b.type === 'hero');
  if (heroIdx >= 0) blocks[heroIdx] = patchBlockImage(blocks[heroIdx]!, heroUrl, alt);

  const textIdx = blocks.findIndex((b) => b.type === 'textMedia');
  if (textIdx >= 0) blocks[textIdx] = patchBlockImage(blocks[textIdx]!, secondaryUrl, alt);

  const cardsIdx = blocks.findIndex((b) => b.type === 'cards');
  if (cardsIdx >= 0) blocks[cardsIdx] = patchCardsImages(blocks[cardsIdx]!, cardUrls.length ? cardUrls : [secondaryUrl], alt);

  const showcaseIdx = blocks.findIndex((b) => b.type === 'showcase');
  if (showcaseIdx >= 0) {
    blocks[showcaseIdx] = patchBlockImage(blocks[showcaseIdx]!, cardUrls[0] || secondaryUrl, alt);
  }

  const ctaIdx = blocks.findIndex((b) => b.type === 'cta');
  if (ctaIdx >= 0) {
    blocks[ctaIdx] = patchBlockImage(blocks[ctaIdx]!, secondaryUrl, alt);
  }

  return { ...spec, homeBlocks: blocks };
}
