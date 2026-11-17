/**
 * Atelier thème IA — génération structurée (identité + réglages AI Canvas + blocs accueil)
 * Génération en arrière-plan pour éviter le timeout 60–120 s des routes admin.
 */
import { defineServerModule, type ServerContext, type StoredRecord } from '@snapify/sdk';
import { generateThemeSpec } from './lib/llm';
import { promptExamples, promptPlaceholder, promptTips, type ThemeMarket } from './lib/prompts';
import { AI_CANVAS_THEME_ID, type GenerationRecord, type Settings, type ThemeSpec } from './types';

type GenDoc = {
  prompt: string;
  lang: string;
  provider: GenerationRecord['provider'];
  model: string;
  status: 'pending' | 'ready' | 'failed';
  error?: string;
  spec?: ThemeSpec;
  applied?: GenerationRecord['applied'];
};

function asGen(r: StoredRecord<GenDoc>): GenerationRecord {
  return {
    id: r.id,
    createdAt: r.createdAt,
    prompt: r.prompt,
    lang: r.lang,
    provider: r.provider,
    model: r.model,
    status: r.status,
    error: r.error,
    spec: r.spec,
    applied: r.applied,
  };
}

export default defineServerModule<Settings>({
  activate(ctx: ServerContext<Settings>) {
    const generations = ctx.db.collection<GenDoc>('generations');

    ctx.admin.get('/meta', async () => {
      const s = ctx.settings();
      let market: ThemeMarket = 'tn';
      try {
        const url = (ctx.site()?.publicUrl || '').toLowerCase();
        if (url.includes('.fr') || url.includes('france')) market = 'fr';
      } catch {
        /* ignore */
      }
      return {
        market,
        examples: promptExamples(market),
        tips: promptTips(market),
        placeholder: promptPlaceholder(market),
        canvasThemeId: AI_CANVAS_THEME_ID,
        provider: s.provider,
        hasApiKey: Boolean((s.apiKey || '').trim()),
        lang: s.defaultLang || 'fr',
        autoApplyHome: s.autoApplyHome !== false,
        generateImages: s.generateImages !== false,
      };
    });

    ctx.admin.get('/generations', async () => {
      const { items } = await generations.find({
        orderBy: [{ field: 'createdAt', dir: 'desc' }],
        limit: 40,
      });
      return { generations: items.map(asGen) };
    });

    ctx.admin.get('/generations/:id', async (req) => {
      const row = await generations.get(req.params.id);
      if (!row) throw ctx.error(404, 'Génération introuvable.');
      return { generation: asGen(row) };
    });

    ctx.admin.post('/generate', async (req) => {
      const body = (req.body || {}) as { prompt?: string; lang?: string; siteHint?: string };
      const prompt = String(body.prompt || '').trim();
      if (prompt.length < 12) throw ctx.error(400, 'Décrivez un peu plus votre marque (au moins une phrase).');
      if (prompt.length > 2000) throw ctx.error(400, 'Prompt trop long (max 2000 caractères).');
      const s = ctx.settings();
      const lang = (body.lang || s.defaultLang || 'fr') as string;
      const siteHint = body.siteHint;

      const row = await generations.insert({
        prompt,
        lang,
        provider: s.provider || 'openai',
        model: '',
        status: 'pending',
      });

      // Travail hors requête HTTP (évite abort / délai route admin).
      void (async () => {
        try {
          const { spec, provider, model } = await generateThemeSpec(ctx, prompt, lang, siteHint);
          await generations.update(row.id, {
            status: 'ready',
            provider,
            model,
            spec,
            error: undefined,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Génération échouée';
          ctx.log.warn('generate fail', message);
          await generations.update(row.id, {
            status: 'failed',
            error: message.slice(0, 400),
          });
        }
      })();

      return { generation: asGen(row) };
    });

    ctx.admin.post('/generations/:id/mark-applied', async (req) => {
      const row = await generations.get(req.params.id);
      if (!row) throw ctx.error(404, 'Génération introuvable.');
      const body = (req.body || {}) as { branding?: boolean; theme?: boolean; home?: boolean };
      const applied = {
        branding: !!body.branding,
        theme: !!body.theme,
        home: !!body.home,
        at: new Date().toISOString(),
      };
      const updated = await generations.update(row.id, { applied });
      return { generation: asGen(updated!) };
    });

    ctx.admin.delete('/generations/:id', async (req) => {
      await generations.delete(req.params.id);
      return { ok: true };
    });
  },
});
