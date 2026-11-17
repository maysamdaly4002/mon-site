/**
 * Snapify — module Panier
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { defineServerModule, type ServerContext, type StoredRecord } from '@snapify/sdk';
import { formatMoney, MODULE_IDS, roundMoney, type CartServices, type CouponApplied, type LineRef, type Quote, type ShopServices } from '@snapify/sdk/commerce';
import type { Coupon, Settings } from './types';

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const normalizeCode = (v: unknown) => (typeof v === 'string' ? v.trim().toUpperCase().slice(0, 40) : '');
const today = () => new Date().toISOString().slice(0, 10);

export default defineServerModule<Settings>({
  activate(ctx: ServerContext<Settings>) {
    const coupons = ctx.db.collection<Coupon>('coupons');
    const shop = () => {
      const s = ctx.use<ShopServices>(MODULE_IDS.shop);
      if (!s) throw ctx.error(503, 'La boutique est momentanément indisponible.');
      return s;
    };

    /** Remise d'un code pour un sous-total donné, ou motif du refus. */
    function evaluate(c: StoredRecord<Coupon> | null, subtotal: number, currency: string): { applied: CouponApplied } | { error: string } {
      if (!c || !c.active) return { error: 'Ce code promo n’existe pas.' };
      const d = today();
      if (c.startsAt && d < c.startsAt) return { error: 'Ce code promo n’est pas encore valable.' };
      if (c.endsAt && d > c.endsAt) return { error: 'Ce code promo a expiré.' };
      if (c.usageLimit > 0 && c.used >= c.usageLimit) return { error: 'Ce code promo a atteint son nombre d’utilisations.' };
      if (c.minSubtotal > 0 && subtotal < c.minSubtotal) return { error: `Ce code est valable dès ${formatMoney(c.minSubtotal, currency)} d’achat.` };
      const discount = c.type === 'percent' ? roundMoney((subtotal * Math.min(100, c.value)) / 100) : c.type === 'fixed' ? roundMoney(Math.min(subtotal, c.value)) : 0;
      const label = c.type === 'percent' ? `−${c.value} %` : c.type === 'fixed' ? `−${formatMoney(c.value, currency)}` : 'Livraison offerte';
      return { applied: { code: c.code, label: c.description ? `${label} · ${c.description}` : label, discount, freeShipping: c.type === 'shipping' } };
    }

    async function quote(lines: LineRef[], couponCode?: string): Promise<Quote> {
      const priced = await shop().priceLines(lines);
      const code = normalizeCode(couponCode);
      let coupon: CouponApplied | null = null;
      let couponError: string | undefined;
      if (code && priced.lines.length) {
        const r = evaluate(await coupons.findOne({ code }), priced.subtotal, priced.currency);
        if ('applied' in r) coupon = r.applied;
        else couponError = r.error;
      }
      const discount = coupon?.discount ?? 0;
      return { ...priced, discount, coupon, couponError, total: roundMoney(Math.max(0, priced.subtotal - discount)) };
    }

    const services: CartServices = {
      quote,
      redeemCoupon: (code) =>
        ctx.lock('coupons', async () => {
          const c = await coupons.findOne({ code: normalizeCode(code) });
          if (!c) return;
          if (c.usageLimit > 0 && c.used >= c.usageLimit) throw ctx.error(409, 'Ce code promo vient d’atteindre son nombre d’utilisations.');
          await coupons.update(c.id, { used: c.used + 1 });
        }),
      releaseCoupon: (code) =>
        ctx.lock('coupons', async () => {
          const c = await coupons.findOne({ code: normalizeCode(code) });
          if (c && c.used > 0) await coupons.update(c.id, { used: c.used - 1 });
        }),
    };
    ctx.provide(services);

    ctx.http.post('/quote', async (req) => {
      const b = (req.body ?? {}) as { lines?: unknown; coupon?: unknown };
      return quote(Array.isArray(b.lines) ? (b.lines as LineRef[]) : [], typeof b.coupon === 'string' ? b.coupon : '');
    });

    /* ---------------------------------------------------------------- Administration */

    function clean(input: unknown, current?: Coupon): Coupon {
      const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
      const code = normalizeCode(b.code);
      if (!CODE_PATTERN.test(code)) throw ctx.error(422, 'Code invalide : 2 à 40 caractères, lettres, chiffres, tirets.');
      const type = b.type === 'fixed' || b.type === 'shipping' ? b.type : 'percent';
      const value = roundMoney(Number(b.value));
      if (type === 'percent' && !(value > 0 && value <= 100)) throw ctx.error(422, 'Le pourcentage doit être compris entre 1 et 100.');
      if (type === 'fixed' && !(value > 0)) throw ctx.error(422, 'Le montant de la remise doit être positif.');
      const startsAt = typeof b.startsAt === 'string' && DATE_PATTERN.test(b.startsAt) ? b.startsAt : '';
      const endsAt = typeof b.endsAt === 'string' && DATE_PATTERN.test(b.endsAt) ? b.endsAt : '';
      if (startsAt && endsAt && endsAt < startsAt) throw ctx.error(422, 'La date de fin précède la date de début.');
      return {
        code,
        description: typeof b.description === 'string' ? b.description.trim().slice(0, 120) : '',
        type,
        value: type === 'shipping' ? 0 : value,
        minSubtotal: Math.max(0, roundMoney(Number(b.minSubtotal) || 0)),
        startsAt,
        endsAt,
        usageLimit: Math.max(0, Math.floor(Number(b.usageLimit) || 0)),
        used: current?.used ?? 0,
        active: b.active !== false,
      };
    }

    async function assertUnique(code: string, id?: string) {
      const other = await coupons.findOne({ code });
      if (other && other.id !== id) throw ctx.error(409, `Le code ${code} existe déjà.`);
    }

    ctx.admin.get('/coupons', async () => {
      const { items } = await coupons.find({ orderBy: [{ field: 'createdAt', dir: 'desc' }], limit: 500 });
      return { coupons: items, currency: ctx.use<ShopServices>(MODULE_IDS.shop)?.currency() ?? 'TND' };
    });

    ctx.admin.post('/coupons', async (req) => {
      const data = clean(req.body);
      await assertUnique(data.code);
      return { coupon: await coupons.insert(data) };
    });

    ctx.admin.put('/coupons/:id', async (req) => {
      const current = await coupons.get(req.params.id);
      if (!current) throw ctx.error(404, 'Code introuvable');
      const data = clean(req.body, current);
      await assertUnique(data.code, current.id);
      return { coupon: await ctx.lock('coupons', () => coupons.update(current.id, data)) };
    });

    ctx.admin.post('/coupons/:id/reset', async (req) => {
      const c = await ctx.lock('coupons', () => coupons.update(req.params.id, { used: 0 }));
      if (!c) throw ctx.error(404, 'Code introuvable');
      return { coupon: c };
    });

    ctx.admin.delete('/coupons/:id', async (req) => {
      if (!(await coupons.delete(req.params.id))) throw ctx.error(404, 'Code introuvable');
      return { ok: true };
    });

    ctx.admin.status(async () => {
      const { items } = await coupons.find({ limit: 500 });
      const d = today();
      const live = items.filter((c) => c.active && (!c.endsAt || c.endsAt >= d) && (!c.usageLimit || c.used < c.usageLimit));
      return {
        stats: [
          { label: 'Codes promo actifs', value: live.length },
          { label: 'Utilisations', value: items.reduce((n, c) => n + c.used, 0) },
        ],
      };
    });
  },
});
