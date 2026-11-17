import { defineServerModule } from '@snapify/sdk';
import type { Settings, Stats } from './types';

const EMPTY: Stats = { clicks: 0, lastClickAt: null };

export default defineServerModule<Settings>({
  activate(ctx) {
    const read = async () => (await ctx.storage.get<Stats>('stats')) ?? EMPTY;

    /** POST /api/modules/<id>/click — appelé par la bannière. */
    ctx.http.post('/click', () =>
      ctx.lock('stats', async () => {
        const stats = await read();
        const next: Stats = { clicks: stats.clicks + 1, lastClickAt: new Date().toISOString() };
        await ctx.storage.set('stats', next);
        return { clicks: next.clicks };
      })
    );

    /** Routes réservées à l’administration (/api/admin/modules/<id>/api/…). */
    ctx.admin.get('/stats', read);
    ctx.admin.post('/reset', async () => {
      await ctx.storage.set('stats', EMPTY);
      return EMPTY;
    });

    /** Indicateurs affichés sur la fiche du module. */
    ctx.admin.status(async () => ({ stats: [{ label: 'Clics', value: (await read()).clicks }] }));
  },
});
