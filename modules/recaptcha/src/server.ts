/**
 * Snapify — module Google reCAPTCHA
 * © 2026 Hamdi Ayari — hamdi.ayari@novalabs.tn
 */
import { defineServerModule, type ServerContext } from '@snapify/sdk';
import type { Settings } from './types';

export default defineServerModule<Settings>({
  activate(ctx: ServerContext<Settings>) {
    /** Config publique (sans clé secrète) — utilisée par les formulaires du site. */
    ctx.http.get('/config', async () => {
      const s = ctx.settings();
      if (!s.enabled || !s.siteKey.trim()) return { enabled: false };
      return {
        enabled: true,
        siteKey: s.siteKey.trim(),
        version: s.version === 'v3' ? 'v3' : 'v2',
        action: (s.v3Action || 'contact').slice(0, 40),
      };
    });

    ctx.http.post('/verify', async (req) => {
      const s = ctx.settings();
      if (!s.enabled) return { ok: true, skipped: true };
      if (!s.secretKey.trim()) throw ctx.error(503, 'Clé secrète reCAPTCHA manquante.');
      const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (!token) throw ctx.error(400, 'Jeton reCAPTCHA manquant.');

      const body = new URLSearchParams({
        secret: s.secretKey.trim(),
        response: token,
      });
      if (typeof req.body?.remoteip === 'string' && req.body.remoteip) {
        body.set('remoteip', String(req.body.remoteip).slice(0, 64));
      }

      const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        score?: number;
        action?: string;
        'error-codes'?: string[];
      };

      if (!data.success) {
        throw ctx.error(400, 'Vérification reCAPTCHA échouée. Rechargez la page et réessayez.');
      }

      if (s.version === 'v3') {
        const min = Number(s.v3MinScore);
        const score = Number(data.score ?? 0);
        const threshold = Number.isFinite(min) ? Math.min(1, Math.max(0, min)) : 0.5;
        if (score < threshold) {
          throw ctx.error(400, 'Score anti-robot insuffisant. Réessayez ou contactez-nous par téléphone.');
        }
      }

      return { ok: true, score: data.score ?? null };
    });
  },
});
