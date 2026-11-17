/**
 * Snapify — module Commande
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { defineServerModule, type ModuleRequest, type RecordFilter, type ServerContext, type StoredRecord } from '@snapify/sdk';
import {
  formatAddress,
  formatMoney,
  isEmail,
  MODULE_IDS,
  ORDER_STATUS_LABELS,
  PAYMENT_LABELS,
  roundMoney,
  validateAddress,
  type CartServices,
  type CheckoutServices,
  type CustomerServices,
  type LineRef,
  type OrderDetail,
  type OrderStatus,
  type OrderSummary,
  type PaymentMethod,
  type Quote,
  type ShopServices,
} from '@snapify/sdk/commerce';
import type { Order, Settings, ShippingMethod, ShippingOption } from './types';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
/** Statuts accessibles depuis chaque statut (une commande annulée ou livrée est close). */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'shipped', 'delivered', 'cancelled'],
  confirmed: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export default defineServerModule<Settings>({
  activate(ctx: ServerContext<Settings>) {
    const orders = ctx.db.collection<Order>('orders');
    const s = () => ctx.settings();
    const shop = () => ctx.use<ShopServices>(MODULE_IDS.shop);
    const cart = () => ctx.use<CartServices>(MODULE_IDS.cart);
    const customers = () => ctx.use<CustomerServices>(MODULE_IDS.customers);
    const currency = () => shop()?.currency() ?? 'TND';

    /* ---------------------------------------------------------------- Calculs */

    function shippingOptions(q: Pick<Quote, 'total' | 'coupon'>): ShippingOption[] {
      const st = s();
      const freeByCoupon = !!q.coupon?.freeShipping;
      const options: ShippingOption[] = [];
      const homeFree = freeByCoupon || (st.freeShippingThreshold > 0 && q.total >= st.freeShippingThreshold);
      options.push({ id: 'home', label: st.homeLabel, delay: st.homeDelay, basePrice: st.homePrice, price: homeFree ? 0 : st.homePrice });
      if (st.expressEnabled) options.push({ id: 'express', label: st.expressLabel, delay: st.expressDelay, basePrice: st.expressPrice, price: freeByCoupon ? 0 : st.expressPrice });
      if (st.pickupEnabled) options.push({ id: 'pickup', label: st.pickupLabel, delay: st.pickupAddress, basePrice: 0, price: 0 });
      return options;
    }

    const paymentMethods = (): PaymentMethod[] => [...(s().codEnabled ? (['cod'] as const) : []), ...(s().transferEnabled ? (['transfer'] as const) : [])];

    async function fullQuote(lines: LineRef[], coupon: string, method: string) {
      const c = cart();
      if (!c) throw ctx.error(503, 'Le panier est momentanément indisponible.');
      const quote = await c.quote(lines, coupon);
      const options = shippingOptions(quote);
      const shipping = options.find((o) => o.id === method) ?? options[0];
      return { quote, options, shipping, grandTotal: roundMoney(quote.total + shipping.price) };
    }

    /* ---------------------------------------------------------------- Présentation */

    const summary = (o: StoredRecord<Order>): OrderSummary => ({ number: o.number, status: o.status, paymentStatus: o.paymentStatus, createdAt: o.createdAt, total: o.total, currency: o.currency, itemsCount: o.itemsCount });

    const detail = (o: StoredRecord<Order>): OrderDetail => ({
      ...summary(o),
      lines: o.lines,
      subtotal: o.subtotal,
      discount: o.discount,
      couponCode: o.couponCode,
      shippingLabel: o.shippingLabel,
      shippingCost: o.shippingCost,
      paymentMethod: o.paymentMethod,
      email: o.email,
      address: o.address,
      notes: o.notes,
      history: o.history.map(({ status, at, note }) => ({ status, at, note })),
      ...(o.paymentMethod === 'transfer' && o.paymentStatus === 'unpaid' && o.status !== 'cancelled' ? { bankDetails: s().bankDetails } : {}),
    });

    const siteUrl = () => (ctx.site().publicUrl || '').replace(/\/+$/, '');

    function linesHtml(o: Order): string {
      const cur = o.currency;
      const row = (label: string, value: string, strong = false) =>
        `<tr><td style="padding:6px 0;color:#475569;${strong ? 'font-weight:700;color:#0f172a;' : ''}">${esc(label)}</td><td style="padding:6px 0;text-align:right;${strong ? 'font-weight:700;color:#0f172a;' : 'color:#0f172a;'}">${esc(value)}</td></tr>`;
      const items = o.lines
        .map((l) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;">${esc(l.name)} <span style="color:#64748b;">× ${l.qty}</span></td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;color:#0f172a;white-space:nowrap;">${esc(formatMoney(l.lineTotal, cur))}</td></tr>`)
        .join('');
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse;font-size:14px;">${items}${row('Sous-total', formatMoney(o.subtotal, cur))}${o.discount ? row(`Remise${o.couponCode ? ` (${o.couponCode})` : ''}`, `−${formatMoney(o.discount, cur)}`) : ''}${row(o.shippingLabel, o.shippingCost ? formatMoney(o.shippingCost, cur) : 'Offerte')}${row('Total', formatMoney(o.total, cur), true)}</table>`;
    }

    async function notifyCustomer(o: StoredRecord<Order>, kind: 'created' | OrderStatus, note?: string) {
      const transfer = o.paymentMethod === 'transfer' && o.paymentStatus === 'unpaid' && kind === 'created';
      const titles: Record<string, string> = {
        created: `Merci pour votre commande ${o.number}`,
        confirmed: `Votre commande ${o.number} est confirmée`,
        shipped: `Votre commande ${o.number} est en route`,
        delivered: `Votre commande ${o.number} a été livrée`,
        cancelled: `Votre commande ${o.number} a été annulée`,
      };
      const intros: Record<string, string> = {
        created: `Bonjour ${o.address.firstName}, nous avons bien reçu votre commande. ${s().thankYouText}`,
        confirmed: `Bonjour ${o.address.firstName}, votre commande est confirmée et en cours de préparation.`,
        shipped: `Bonjour ${o.address.firstName}, votre commande a été remise au transporteur.`,
        delivered: `Bonjour ${o.address.firstName}, votre commande a été livrée. Merci et à bientôt !`,
        cancelled: `Bonjour ${o.address.firstName}, votre commande a été annulée. Pour toute question, répondez simplement à cet e-mail.`,
      };
      if (!titles[kind]) return;
      const lines = [`Commande : ${o.number}`, `Paiement : ${PAYMENT_LABELS[o.paymentMethod]}`, `Livraison : ${o.shippingLabel}`, ...(note ? [`Message : ${note}`] : [])];
      const mail = ctx.mail.render({
        title: titles[kind],
        intro: intros[kind],
        lines,
        html: `${linesHtml(o)}${o.shippingMethod !== 'pickup' ? `<p style="margin:0 0 6px;font-size:13px;color:#64748b;">Adresse de livraison</p><p style="margin:0 0 16px;font-size:14px;color:#0f172a;line-height:1.6;">${formatAddress(o.address).map(esc).join('<br>')}</p>` : ''}${transfer ? `<p style="margin:0 0 6px;font-size:13px;color:#64748b;">Coordonnées pour le virement</p><p style="margin:0 0 16px;font-size:14px;color:#0f172a;line-height:1.6;">${esc(s().bankDetails).replace(/\n/g, '<br>')}</p>` : ''}`,
        button: o.customerId ? { label: 'Suivre ma commande', url: `${siteUrl()}/compte/commandes/${encodeURIComponent(o.number)}/` } : { label: 'Suivre ma commande', url: `${siteUrl()}/commande/suivi/?n=${encodeURIComponent(o.number)}` },
      });
      await ctx.mail.send({ to: o.email, subject: titles[kind], ...mail });
    }

    async function notifyShop(o: StoredRecord<Order>) {
      const to = (s().notifyEmails || ctx.site().email || '')
        .split(',')
        .map((x) => x.trim())
        .filter(isEmail);
      if (!to.length) return;
      const mail = ctx.mail.render({
        title: `Nouvelle commande ${o.number}`,
        intro: `${o.customerName} vient de commander pour ${formatMoney(o.total, o.currency)} (${PAYMENT_LABELS[o.paymentMethod].toLowerCase()}).`,
        lines: [`E-mail : ${o.email}`, `Téléphone : ${o.address.phone}`, `Livraison : ${o.shippingLabel}`, ...(o.notes ? [`Note du client : ${o.notes}`] : [])],
        html: linesHtml(o),
        button: { label: 'Voir la commande', url: `${siteUrl()}/administrator/m/${ctx.module.id}/orders/${o.id}` },
      });
      await ctx.mail.send({ to, subject: `Nouvelle commande ${o.number} — ${formatMoney(o.total, o.currency)}`, replyTo: o.email, ...mail });
    }

    /* ---------------------------------------------------------------- Services */

    const services: CheckoutServices = {
      ordersForCustomer: async (customerId, opts = {}) => {
        const { items, total } = await orders.find({ where: { customerId }, orderBy: [{ field: 'createdAt', dir: 'desc' }], limit: Math.min(100, opts.limit ?? 20), offset: opts.offset ?? 0 });
        return { items: items.map(summary), total };
      },
      orderForCustomer: async (customerId, number) => {
        const o = customerId ? await orders.findOne({ customerId, number }) : null;
        return o ? detail(o) : null;
      },
      customerStats: async (customerId) => {
        const { items } = await orders.find({ where: { customerId }, filters: [{ field: 'status', op: 'ne', value: 'cancelled' }], orderBy: [{ field: 'createdAt', dir: 'desc' }], limit: 500 });
        return { orders: items.length, spent: roundMoney(items.reduce((n, o) => n + o.total, 0)), lastOrderAt: items[0]?.createdAt ?? null };
      },
    };
    ctx.provide(services);

    /* ---------------------------------------------------------------- Routes publiques */

    ctx.http.get('/config', async () => ({ freeShippingThreshold: s().freeShippingThreshold, currency: currency() }));

    ctx.http.post('/quote', async (req) => {
      const b = (req.body ?? {}) as Record<string, unknown>;
      const { quote, options, shipping, grandTotal } = await fullQuote(Array.isArray(b.lines) ? (b.lines as LineRef[]) : [], str(b.coupon, 40), str(b.shipping, 20));
      return { quote, shippingOptions: options, shipping: shipping.id, shippingCost: shipping.price, grandTotal, payments: paymentMethods() };
    });

    ctx.http.post('/orders', async (req: ModuleRequest) => {
      const b = (req.body ?? {}) as Record<string, unknown>;
      const st = s();
      const email = str(b.email, 254).toLowerCase();
      if (!isEmail(email)) throw ctx.error(422, 'Adresse e-mail invalide.');
      const { value: address, errors } = validateAddress(b.address);
      const firstError = Object.values(errors)[0];
      if (firstError) throw ctx.error(422, firstError);
      const payment = b.payment as PaymentMethod;
      if (!paymentMethods().includes(payment)) throw ctx.error(422, 'Choisissez un mode de paiement.');
      if (st.termsPath && b.acceptTerms !== true) throw ctx.error(422, 'Veuillez accepter les conditions générales de vente.');
      const customer = (await customers()?.current(req.cookies)) ?? null;
      if (!st.guestCheckout && !customer) throw ctx.error(401, 'Connectez-vous à votre espace client pour commander.');

      const lines = Array.isArray(b.lines) ? (b.lines as LineRef[]) : [];
      const couponCode = str(b.coupon, 40).toUpperCase();
      const { quote, shipping, grandTotal } = await fullQuote(lines, couponCode, str(b.shipping, 20));
      if (!quote.lines.length) throw ctx.error(422, 'Votre panier est vide.');
      if (quote.issues.length) throw ctx.error(409, `Votre panier a changé : ${quote.issues[0].message} Vérifiez-le avant de valider.`);
      if (couponCode && !quote.coupon) throw ctx.error(409, quote.couponError || 'Ce code promo n’est plus valable.');
      if (st.minOrder > 0 && quote.total < st.minOrder) throw ctx.error(422, `Le montant minimum de commande est de ${formatMoney(st.minOrder, quote.currency)}.`);
      const expected = Number(b.expectedTotal);
      if (Number.isFinite(expected) && expected > 0 && Math.abs(expected - grandTotal) > 0.0005) throw ctx.error(409, `Le total a été mis à jour (${formatMoney(grandTotal, quote.currency)}) : vérifiez votre commande avant de valider.`);

      const token = randomBytes(24).toString('base64url');
      const order = await ctx.lock('orders', async () => {
        const shopSvc = shop();
        const cartSvc = cart();
        if (!shopSvc || !cartSvc) throw ctx.error(503, 'La boutique est momentanément indisponible.');
        const refs = quote.lines.map((l) => ({ productId: l.productId, qty: l.qty }));
        await shopSvc.decrementStock(refs);
        try {
          if (quote.coupon) await cartSvc.redeemCoupon(quote.coupon.code);
        } catch (e) {
          await shopSvc.restoreStock(refs);
          throw e;
        }
        const seq = ((await ctx.storage.get<number>('sequence')) ?? 1000) + 1;
        await ctx.storage.set('sequence', seq);
        const now = new Date().toISOString();
        return orders.insert({
          number: `${st.orderPrefix || ''}${seq}`,
          tokenHash: sha256(token),
          status: 'pending',
          paymentMethod: payment,
          paymentStatus: 'unpaid',
          customerId: customer?.id ?? '',
          customerName: `${address.firstName} ${address.lastName}`,
          email,
          address,
          lines: quote.lines,
          itemsCount: quote.lines.reduce((n, l) => n + l.qty, 0),
          subtotal: quote.subtotal,
          discount: quote.discount,
          couponCode: quote.coupon?.code ?? '',
          shippingMethod: shipping.id,
          shippingLabel: shipping.label,
          shippingCost: shipping.price,
          total: grandTotal,
          currency: quote.currency,
          notes: str(b.notes, 1000),
          internalNote: '',
          history: [{ status: 'pending', at: now }],
          ip: req.ip,
        });
      });
      void notifyCustomer(order, 'created').catch((e) => ctx.log.warn('e-mail client', e));
      void notifyShop(order).catch((e) => ctx.log.warn('e-mail boutique', e));
      return ctx.http.reply({ number: order.number, token }, { status: 201 });
    });

    ctx.http.get('/orders/:number', async (req) => {
      const token = str(req.query.t, 100);
      const o = token ? await orders.findOne({ number: str(req.params.number, 40) }) : null;
      if (!o || !token) throw ctx.error(404, 'Commande introuvable');
      const a = Buffer.from(sha256(token));
      const b = Buffer.from(o.tokenHash);
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw ctx.error(404, 'Commande introuvable');
      return { order: detail(o), thankYouText: s().thankYouText };
    });

    ctx.http.post('/track', async (req) => {
      const b = (req.body ?? {}) as Record<string, unknown>;
      const number = str(b.number, 40).toUpperCase();
      const email = str(b.email, 254).toLowerCase();
      const o = number && email ? await orders.findOne({ number, email }) : null;
      if (!o) throw ctx.error(404, 'Aucune commande ne correspond à ce numéro et à cette adresse e-mail.');
      const d = detail(o);
      return { order: { ...d, address: { ...d.address, line1: '', line2: '', phone: '' } } };
    });

    /* ---------------------------------------------------------------- Administration */

    ctx.admin.get('/orders', async (req) => {
      const q = req.query;
      const size = Math.min(500, Math.max(1, Math.floor(Number(q.size)) || 25));
      const page = Math.max(1, Math.floor(Number(q.page)) || 1);
      const where: Record<string, unknown> = {};
      const filters: RecordFilter[] = [];
      if (STATUSES.includes(q.status as OrderStatus)) where.status = q.status;
      if (q.payment === 'unpaid' || q.payment === 'paid') where.paymentStatus = q.payment;
      if (q.from) filters.push({ field: 'createdAt', op: 'gte', value: `${str(q.from, 10)}T00:00:00.000Z` });
      if (q.to) filters.push({ field: 'createdAt', op: 'lte', value: `${str(q.to, 10)}T23:59:59.999Z` });
      if (q.customer) where.customerId = str(q.customer, 64);
      const text = str(q.q, 100);
      const { items, total } = await orders.find({
        where,
        filters,
        search: text ? { fields: ['number', 'email', 'customerName'], text } : undefined,
        orderBy: [{ field: 'createdAt', dir: 'desc' }],
        limit: size,
        offset: (page - 1) * size,
      });
      return {
        items: items.map((o) => ({ id: o.id, ...summary(o), customerName: o.customerName, email: o.email, phone: o.address.phone, city: o.address.city, governorate: o.address.governorate, paymentMethod: o.paymentMethod, shippingLabel: o.shippingLabel })),
        total,
      };
    });

    ctx.admin.get('/stats', async () => {
      const since = new Date(Date.now() - 30 * 86400_000);
      const { items } = await orders.find({ filters: [{ field: 'createdAt', op: 'gte', value: since.toISOString() }], orderBy: [{ field: 'createdAt', dir: 'desc' }], limit: 500 });
      const valid = items.filter((o) => o.status !== 'cancelled');
      const revenue = roundMoney(valid.reduce((n, o) => n + o.total, 0));
      const today = new Date().toISOString().slice(0, 10);
      const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 86400_000).toISOString().slice(0, 10));
      const byDay = days.map((d) => ({ date: d, revenue: roundMoney(valid.filter((o) => o.createdAt.slice(0, 10) === d).reduce((n, o) => n + o.total, 0)), orders: valid.filter((o) => o.createdAt.slice(0, 10) === d).length }));
      const counts = Object.fromEntries(await Promise.all(STATUSES.map(async (st) => [st, await orders.count({ where: { status: st } })] as const)));
      return {
        currency: currency(),
        revenue30: revenue,
        orders30: valid.length,
        average30: valid.length ? roundMoney(revenue / valid.length) : 0,
        today: valid.filter((o) => o.createdAt.slice(0, 10) === today).length,
        counts,
        byDay,
      };
    });

    ctx.admin.get('/orders/:id', async (req) => {
      // Identifiant ou numéro de commande (liens depuis la fiche client).
      const o = (await orders.get(req.params.id)) ?? (await orders.findOne({ number: req.params.id.slice(0, 40) }));
      if (!o) throw ctx.error(404, 'Commande introuvable');
      const { tokenHash: _t, ...rest } = o;
      return { order: rest, next: NEXT[o.status], notifyDefault: s().notifyCustomerOnStatus };
    });

    ctx.admin.post('/orders/:id/status', async (req) => {
      const b = (req.body ?? {}) as Record<string, unknown>;
      const status = b.status as OrderStatus;
      const note = str(b.note, 500);
      const updated = await ctx.lock(`order:${req.params.id}`, async () => {
        const o = await orders.get(req.params.id);
        if (!o) throw ctx.error(404, 'Commande introuvable');
        if (!NEXT[o.status].includes(status)) throw ctx.error(409, `Impossible de passer de « ${ORDER_STATUS_LABELS[o.status]} » à « ${ORDER_STATUS_LABELS[status] ?? status} ».`);
        if (status === 'cancelled') {
          await shop()?.restoreStock(o.lines.map((l) => ({ productId: l.productId, qty: l.qty })));
          if (o.couponCode) await cart()?.releaseCoupon(o.couponCode);
        }
        const patch: Partial<Order> = { status, history: [...o.history, { status, at: new Date().toISOString(), ...(note ? { note } : {}), by: req.admin?.name || req.admin?.email }] };
        if (status === 'delivered' && o.paymentMethod === 'cod') patch.paymentStatus = 'paid';
        return orders.update(o.id, patch);
      });
      if (b.notify === true && updated) void notifyCustomer(updated, status, note).catch((e) => ctx.log.warn('e-mail statut', e));
      const { tokenHash: _t, ...rest } = updated!;
      return { order: rest, next: NEXT[updated!.status] };
    });

    ctx.admin.post('/orders/:id/payment', async (req) => {
      const v = (req.body as { paymentStatus?: unknown })?.paymentStatus;
      if (v !== 'paid' && v !== 'unpaid' && v !== 'refunded') throw ctx.error(422, 'Statut de paiement inconnu');
      const o = await orders.update(req.params.id, { paymentStatus: v });
      if (!o) throw ctx.error(404, 'Commande introuvable');
      const { tokenHash: _t, ...rest } = o;
      return { order: rest };
    });

    ctx.admin.post('/orders/:id/note', async (req) => {
      const o = await orders.update(req.params.id, { internalNote: str((req.body as { note?: unknown })?.note, 4000) });
      if (!o) throw ctx.error(404, 'Commande introuvable');
      return { ok: true };
    });

    ctx.admin.post('/orders/:id/resend', async (req) => {
      const o = await orders.get(req.params.id);
      if (!o) throw ctx.error(404, 'Commande introuvable');
      await notifyCustomer(o, 'created');
      return { ok: true };
    });

    ctx.admin.status(async () => {
      const [pending, confirmed, total] = await Promise.all([orders.count({ where: { status: 'pending' } }), orders.count({ where: { status: 'confirmed' } }), orders.count()]);
      return {
        stats: [
          { label: 'À traiter', value: pending, hint: 'en attente' },
          { label: 'À expédier', value: confirmed },
          { label: 'Commandes au total', value: total },
        ],
        alerts: paymentMethods().length ? [] : [{ tone: 'danger', text: 'Aucun mode de paiement n’est activé : les clients ne peuvent pas commander.' }],
      };
    });
  },
});
