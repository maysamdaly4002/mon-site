/**
 * Snapify — module Chat IA
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { defineServerModule, type ServerContext } from '@snapify/sdk';

interface Settings {
  model: string;
  temperature: number;
  systemInstruction: string;
  maxMessagesPerSession: number;
  maxSessionsPerDayPerIp: number;
  maxTokensPerDayGlobal: number;
}

interface Turn {
  role?: string;
  parts?: { text?: string }[];
}

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_PROMPT = 2000;

/** Compteurs journaliers en mémoire : remis à zéro au changement de date. */
function createLimiter() {
  let day = '';
  let perIp = new Map<string, { sessions: number; messages: number }>();
  let usage = { requests: 0, sessions: 0, tokens: 0, blocked: 0 };
  const roll = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      perIp = new Map();
      usage = { requests: 0, sessions: 0, tokens: 0, blocked: 0 };
    }
  };
  return {
    check(ip: string, s: Settings, isNewSession: boolean): string | null {
      roll();
      if (s.maxTokensPerDayGlobal > 0 && usage.tokens >= s.maxTokensPerDayGlobal) {
        usage.blocked++;
        return 'L’assistant a atteint son quota du jour. Contactez-nous directement, nous vous répondrons rapidement.';
      }
      const row = perIp.get(ip) ?? { sessions: 0, messages: 0 };
      if (isNewSession && row.sessions >= s.maxSessionsPerDayPerIp) {
        usage.blocked++;
        return 'Nombre maximal de conversations atteint pour aujourd’hui.';
      }
      if (row.messages >= s.maxSessionsPerDayPerIp * s.maxMessagesPerSession) {
        usage.blocked++;
        return 'Limite quotidienne de messages atteinte.';
      }
      if (isNewSession || row.sessions === 0) {
        row.sessions++;
        usage.sessions++;
      }
      row.messages++;
      usage.requests++;
      perIp.set(ip, row);
      return null;
    },
    record(tokens: number) {
      roll();
      usage.tokens += Math.max(0, tokens || 0);
    },
    today() {
      roll();
      return { ...usage, uniqueIps: perIp.size };
    },
  };
}

export default defineServerModule<Settings>({
  activate(ctx: ServerContext<Settings>) {
    const limiter = createLimiter();

    ctx.http.post('/chat', async (req) => {
      const apiKey = ctx.env('GEMINI_API_KEY');
      if (!apiKey) throw ctx.error(503, 'Assistant indisponible : clé GEMINI_API_KEY non configurée');

      const body = (req.body ?? {}) as { prompt?: unknown; history?: unknown };
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      if (!prompt) throw ctx.error(400, 'Message manquant');
      if (prompt.length > MAX_PROMPT) throw ctx.error(400, `Message trop long (${MAX_PROMPT} caractères maximum)`);

      const s = ctx.settings();
      const turns: Turn[] = Array.isArray(body.history) ? (body.history as Turn[]).slice(-40) : [];
      if (turns.filter((t) => t?.role === 'user').length >= s.maxMessagesPerSession) {
        throw ctx.error(429, 'Limite de messages atteinte pour cette conversation. Contactez-nous directement.');
      }
      const refusal = limiter.check(req.ip, s, turns.length === 0);
      if (refusal) throw ctx.error(429, refusal);

      const contents = turns.map((t) => ({
        role: t?.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(t?.parts?.[0]?.text ?? '').slice(0, 4000) }],
      }));
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      const res = await ctx.fetch(`${GEMINI}/${encodeURIComponent(s.model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: s.systemInstruction }] },
          contents,
          generationConfig: { temperature: s.temperature, maxOutputTokens: 1024 },
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { totalTokenCount?: number };
        error?: { message?: string };
      } | null;
      if (!res.ok || !data) {
        ctx.log.error('Gemini', res.status, data?.error?.message);
        throw ctx.error(502, 'L’assistant est momentanément indisponible.');
      }
      const reply = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
      limiter.record(data.usageMetadata?.totalTokenCount ?? Math.ceil((prompt.length + reply.length) / 4));
      return { reply: reply || 'Je n’ai pas de réponse à cette question. Contactez-nous directement.' };
    });

    ctx.admin.status(() => {
      const s = ctx.settings();
      const u = limiter.today();
      const quota = s.maxTokensPerDayGlobal > 0 ? `${Math.min(100, Math.round((u.tokens / s.maxTokensPerDayGlobal) * 100))} %` : 'Illimité';
      return {
        stats: [
          { label: 'Conversations aujourd’hui', value: u.sessions },
          { label: 'Messages aujourd’hui', value: u.requests },
          { label: 'Visiteurs distincts', value: u.uniqueIps },
          { label: 'Quota de tokens du jour', value: quota, hint: `${u.tokens.toLocaleString('fr-FR')} tokens${u.blocked ? ` · ${u.blocked} refus` : ''}` },
        ],
        alerts: ctx.env('GEMINI_API_KEY')
          ? []
          : [{ tone: 'danger', title: 'Clé API manquante', text: 'La variable GEMINI_API_KEY n’est pas définie sur le serveur : l’assistant ne peut pas répondre.' }],
      };
    });
  },
});
