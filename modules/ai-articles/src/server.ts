/**
 * Snapify — module Articles IA
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import { defineServerModule, type ServerContext, type StoredRecord } from '@snapify/sdk';
import type { AiArticle, Settings } from './types';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

type GenOut = { title: string; excerpt: string; html: string; seoTitle: string; seoDescription: string; imagePrompt: string };

function buildPrompt(topic: string, tone: string, lang: string, words: number) {
  const toneLabel = tone === 'friendly' ? 'convivial' : tone === 'expert' ? 'expert et technique' : 'professionnel';
  const langLabel = lang === 'en' ? 'English' : lang === 'ar' ? 'arabe (accessible)' : 'français';
  return `Tu es un rédacteur web pour un site tunisien.
Rédige un article de blog d’environ ${words} mots en ${langLabel}, ton ${toneLabel}, sur le sujet : « ${topic} ».
Réponds UNIQUEMENT avec un JSON valide (sans markdown) de la forme :
{"title":"...","excerpt":"...","html":"<p>...</p><h2>...</h2><p>...</p>","seoTitle":"...","seoDescription":"...","imagePrompt":"prompt anglais pour une image de couverture réaliste"}
Le HTML doit contenir des balises p, h2, ul/li uniquement. Pas de scripts.`;
}

function parseJson(text: string): GenOut {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Réponse IA invalide (JSON attendu).');
  const data = JSON.parse(cleaned.slice(start, end + 1)) as Partial<GenOut>;
  if (!data.title || !data.html) throw new Error('Réponse IA incomplète.');
  return {
    title: String(data.title).slice(0, 160),
    excerpt: String(data.excerpt || '').slice(0, 400),
    html: String(data.html).slice(0, 80_000),
    seoTitle: String(data.seoTitle || data.title).slice(0, 70),
    seoDescription: String(data.seoDescription || data.excerpt || '').slice(0, 200),
    imagePrompt: String(data.imagePrompt || data.title).slice(0, 400),
  };
}

async function genOpenAI(ctx: ServerContext<Settings>, key: string, model: string, prompt: string): Promise<GenOut> {
  const res = await ctx.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Tu génères des articles de blog structurés en JSON.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw ctx.error(502, `OpenAI : ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseJson(json.choices?.[0]?.message?.content || '');
}

async function genAnthropic(ctx: ServerContext<Settings>, key: string, model: string, prompt: string): Promise<GenOut> {
  const res = await ctx.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw ctx.error(502, `Claude : ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (json.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('\n');
  return parseJson(text);
}

async function genGemini(ctx: ServerContext<Settings>, key: string, model: string, prompt: string): Promise<GenOut> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await ctx.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw ctx.error(502, `Gemini : ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
  return parseJson(text);
}

async function imageOpenAI(ctx: ServerContext<Settings>, key: string, prompt: string): Promise<string | null> {
  const res = await ctx.fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'dall-e-3', prompt: prompt.slice(0, 900), size: '1024x1024', response_format: 'b64_json', n: 1 }),
  });
  if (!res.ok) {
    ctx.log.warn('image OpenAI échouée', res.status);
    return null;
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) return null;
  return ctx.files.saveImage({ dataBase64: b64, mimeType: 'image/png' }, { prefix: 'cover' });
}

async function imageGemini(ctx: ServerContext<Settings>, key: string, prompt: string): Promise<string | null> {
  // Imagen via Gemini API (best-effort) ; si indisponible, on ignore.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(key)}`;
  try {
    const res = await ctx.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { predictions?: { bytesBase64Encoded?: string }[] };
    const b64 = json.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) return null;
    return ctx.files.saveImage({ dataBase64: b64, mimeType: 'image/png' }, { prefix: 'cover' });
  } catch {
    return null;
  }
}

export default defineServerModule<Settings>({
  activate(ctx: ServerContext<Settings>) {
    const articles = ctx.db.collection<AiArticle>('articles');

    const publicCard = (a: StoredRecord<AiArticle>) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      coverImage: a.coverImage,
      createdAt: a.createdAt,
    });

    ctx.http.get('/articles', async (req) => {
      const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 12));
      const { items } = await articles.find({
        where: { status: 'published' },
        orderBy: [{ field: 'createdAt', dir: 'desc' }],
        limit,
      });
      return { articles: items.map(publicCard) };
    });

    ctx.http.get('/articles/:slug', async (req) => {
      const a = await articles.findOne({ slug: req.params.slug, status: 'published' });
      if (!a) throw ctx.error(404, 'Article introuvable');
      return { article: { ...publicCard(a), html: a.html, seoTitle: a.seoTitle, seoDescription: a.seoDescription } };
    });

    ctx.admin.get('/articles', async () => {
      const { items, total } = await articles.find({ orderBy: [{ field: 'createdAt', dir: 'desc' }], limit: 200 });
      return { articles: items, total };
    });

    ctx.admin.get('/articles/:id', async (req) => {
      const a = await articles.get(req.params.id);
      if (!a) throw ctx.error(404, 'Article introuvable');
      return { article: a };
    });

    ctx.admin.put('/articles/:id', async (req) => {
      const current = await articles.get(req.params.id);
      if (!current) throw ctx.error(404, 'Article introuvable');
      const b = (req.body || {}) as Record<string, unknown>;
      const patch: Partial<AiArticle> = {
        title: str(b.title, 160) || current.title,
        excerpt: str(b.excerpt, 400),
        html: str(b.html, 80_000) || current.html,
        coverImage: str(b.coverImage, 400) || current.coverImage,
        status: b.status === 'published' ? 'published' : b.status === 'draft' ? 'draft' : current.status,
        seoTitle: str(b.seoTitle, 70) || current.seoTitle,
        seoDescription: str(b.seoDescription, 200) || current.seoDescription,
      };
      if (typeof b.slug === 'string' && b.slug.trim()) {
        const slug = slugify(b.slug);
        const other = await articles.findOne({ slug });
        if (other && other.id !== current.id) throw ctx.error(409, 'Cette adresse est déjà utilisée.');
        patch.slug = slug;
      }
      return { article: await articles.update(current.id, patch) };
    });

    ctx.admin.delete('/articles/:id', async (req) => {
      const a = await articles.get(req.params.id);
      if (!a) throw ctx.error(404, 'Article introuvable');
      if (a.coverImage) await ctx.files.delete(a.coverImage);
      await articles.delete(a.id);
      return { ok: true };
    });

    ctx.admin.post('/generate', async (req) => {
      const s = ctx.settings();
      const key = str(s.apiKey, 200);
      if (!key) throw ctx.error(400, 'Ajoutez votre clé API dans les réglages du module.');

      const b = (req.body || {}) as Record<string, unknown>;
      const topic = str(b.topic, 300);
      if (!topic) throw ctx.error(400, 'Indiquez un sujet.');
      const tone = str(b.tone, 20) || s.defaultTone || 'pro';
      const lang = str(b.lang, 5) || s.defaultLang || 'fr';
      const words = Math.min(2000, Math.max(300, Number(b.words) || 800));
      const wantImage = b.generateImage !== false && s.generateImages !== false;
      const prompt = buildPrompt(topic, tone, lang, words);

      let out: GenOut;
      let model = '';
      if (s.provider === 'anthropic') {
        model = s.anthropicModel || 'claude-sonnet-5-5';
        if (
          model === 'claude-sonnet-4-20250514' ||
          model === 'claude-opus-4-20250514' ||
          model === 'claude-3-5-haiku-latest' ||
          model === 'claude-3-5-sonnet-latest'
        ) {
          model = 'claude-sonnet-5-5';
        }
        out = await genAnthropic(ctx, key, model, prompt);
      } else if (s.provider === 'gemini') {
        model = s.geminiModel || 'gemini-3.8-flash';
        if (model === 'gemini-2.0-flash' || model === 'gemini-1.5-flash' || model === 'gemini-1.5-pro') {
          model = 'gemini-3.8-flash';
        }
        out = await genGemini(ctx, key, model, prompt);
      } else {
        model = s.openaiModel || 'gpt-4o-mini';
        out = await genOpenAI(ctx, key, model, prompt);
      }

      let coverImage = '';
      if (wantImage) {
        if (s.provider === 'openai') coverImage = (await imageOpenAI(ctx, key, out.imagePrompt)) || '';
        else if (s.provider === 'gemini') coverImage = (await imageGemini(ctx, key, out.imagePrompt)) || '';
      }

      let slug = slugify(out.title) || `article-${Date.now()}`;
      const existing = await articles.findOne({ slug });
      if (existing) slug = `${slug}-${Date.now().toString(36)}`;

      const article = await articles.insert({
        title: out.title,
        slug,
        excerpt: out.excerpt,
        html: out.html,
        coverImage,
        topic,
        provider: s.provider,
        model,
        status: 'draft',
        seoTitle: out.seoTitle,
        seoDescription: out.seoDescription,
      });
      return { article };
    });

    ctx.admin.status(async () => {
      const [all, published, drafts] = await Promise.all([
        articles.count(),
        articles.count({ where: { status: 'published' } }),
        articles.count({ where: { status: 'draft' } }),
      ]);
      const s = ctx.settings();
      return {
        stats: [
          { label: 'Articles', value: all },
          { label: 'Publiés', value: published },
          { label: 'Brouillons', value: drafts },
        ],
        alerts: s.apiKey
          ? []
          : [{ tone: 'warning' as const, text: 'Configurez une clé API dans les réglages pour générer des articles.' }],
      };
    });
  },
});
