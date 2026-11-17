import type { ServerContext } from '@snapify/sdk';
import type { Provider, Settings, ThemeSpec } from '../types';
import { enrichSpecImages } from './images';
import { extractImagePrompts, normalizeThemeSpec, parseModelJson } from './normalize';
import { systemPrompt, userPrompt, type ThemeMarket } from './prompts';

async function callOpenAI(ctx: ServerContext<Settings>, key: string, model: string, system: string, user: string): Promise<string> {
  const res = await ctx.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.65,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw ctx.error(502, `OpenAI : ${res.status} ${await res.text().then((t) => t.slice(0, 220))}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content || '';
}

async function callAnthropic(ctx: ServerContext<Settings>, key: string, model: string, system: string, user: string): Promise<string> {
  const res = await ctx.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw ctx.error(502, `Claude : ${res.status} ${await res.text().then((t) => t.slice(0, 220))}`);
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (json.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('\n');
}

async function callGemini(ctx: ServerContext<Settings>, key: string, model: string, system: string, user: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await ctx.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.65 },
    }),
  });
  if (!res.ok) throw ctx.error(502, `Gemini : ${res.status} ${await res.text().then((t) => t.slice(0, 220))}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
}

export function resolveModel(settings: Settings): { provider: Provider; model: string } {
  const provider = settings.provider || 'openai';
  if (provider === 'anthropic') {
    let model = settings.anthropicModel || 'claude-sonnet-5-5';
    if (
      model === 'claude-sonnet-4-20250514' ||
      model === 'claude-opus-4-20250514' ||
      model === 'claude-3-5-haiku-latest' ||
      model === 'claude-3-5-sonnet-latest'
    ) {
      model = 'claude-sonnet-5-5';
    }
    return { provider, model };
  }
  if (provider === 'gemini') {
    let model = settings.geminiModel || 'gemini-3.8-flash';
    if (model === 'gemini-2.0-flash' || model === 'gemini-1.5-flash' || model === 'gemini-1.5-pro') {
      model = 'gemini-3.8-flash';
    }
    return { provider, model };
  }
  return { provider: 'openai', model: settings.openaiModel || 'gpt-4o' };
}

function marketFromCtx(ctx: ServerContext<Settings>): ThemeMarket {
  try {
    const url = (ctx.site()?.publicUrl || '').toLowerCase();
    if (url.includes('.fr') || url.includes('france')) return 'fr';
  } catch {
    /* site:read absent */
  }
  return 'tn';
}

export async function generateThemeSpec(
  ctx: ServerContext<Settings>,
  brief: string,
  lang: string,
  siteHint?: string
): Promise<{ spec: ThemeSpec; provider: Provider; model: string }> {
  const settings = ctx.settings();
  const key = (settings.apiKey || '').trim();
  if (!key) throw ctx.error(400, 'Ajoutez votre clé API dans les réglages du module.');
  const { provider, model } = resolveModel(settings);
  const market = marketFromCtx(ctx);
  const system = systemPrompt(lang, market);
  const user = userPrompt(brief, siteHint, market);

  let text = '';
  if (provider === 'anthropic') text = await callAnthropic(ctx, key, model, system, user);
  else if (provider === 'gemini') text = await callGemini(ctx, key, model, system, user);
  else text = await callOpenAI(ctx, key, model, system, user);

  const parsed = parseModelJson(text);
  let spec = normalizeThemeSpec(parsed);
  const imagePrompts = extractImagePrompts(parsed);

  const generateAi = settings.generateImages !== false && (provider === 'openai' || provider === 'gemini');
  spec = await enrichSpecImages(ctx, spec, imagePrompts, { generateAi, provider, key });

  return { spec, provider, model };
}
