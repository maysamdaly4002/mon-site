/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/** Affichage d'une commande, commun à la page de confirmation, au suivi et à l'espace client. */
import { Check, Landmark } from 'lucide-react';
import { COMMERCE_PATHS, formatAddress, formatMoney, ORDER_STATUS_LABELS, PAYMENT_LABELS, PAYMENT_STATUS_LABELS, type OrderDetail, type OrderStatus } from '../commerce';
import { Link, cn } from './commerce';

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  confirmed: 'bg-sky-50 text-sky-800 ring-sky-200',
  shipped: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  delivered: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', STATUS_TONE[status])}>{ORDER_STATUS_LABELS[status]}</span>;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const formatOrderDate = (iso: string) => dateFmt.format(new Date(iso));

const STEPS: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered'];

export function OrderProgress({ order }: { order: OrderDetail }) {
  if (order.status === 'cancelled') return null;
  const current = STEPS.indexOf(order.status);
  return (
    <ol className="grid grid-cols-4 gap-2">
      {STEPS.map((st, i) => {
        const at = order.history.find((h) => h.status === st)?.at;
        const done = i <= current;
        return (
          <li key={st} className="min-w-0">
            <div className={cn('h-1.5 rounded-full', done ? 'bg-px-primary' : 'bg-px-border-soft')} />
            <p className={cn('mt-2 flex items-center gap-1 truncate text-xs font-semibold sm:text-[13px]', done ? 'text-px-navy' : 'text-px-muted')}>
              {done ? <Check className="h-3.5 w-3.5 shrink-0 text-px-primary" /> : null}
              {ORDER_STATUS_LABELS[st]}
            </p>
            {at ? <p className="truncate text-[11px] text-px-muted">{dateTimeFmt.format(new Date(at))}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDetailView({ order, navigate }: { order: OrderDetail; navigate: (p: string) => void }) {
  const cur = order.currency;
  return (
    <div className="space-y-6">
      <OrderProgress order={order} />

      {order.bankDetails ? (
        <div className="rounded-2xl border border-px-primary/30 bg-px-primary/5 p-5">
          <p className="flex items-center gap-2 font-semibold text-px-navy">
            <Landmark className="h-4 w-4 text-px-primary" /> Réglez votre commande par virement
          </p>
          <p className="mt-1 text-sm text-px-text">
            Montant : <strong>{formatMoney(order.total, cur)}</strong> · Référence : <strong>{order.number}</strong>
          </p>
          <p className="mt-3 whitespace-pre-line rounded-xl bg-white p-4 font-mono text-[13px] leading-relaxed text-px-navy">{order.bankDetails}</p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-px-border-soft bg-white">
        <ul className="divide-y divide-px-border-soft">
          {order.lines.map((l) => (
            <li key={l.productId} className="flex items-center gap-4 p-4">
              <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-px-surface">{l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : null}</div>
              <div className="min-w-0 flex-1">
                <Link to={COMMERCE_PATHS.product(l.slug)} navigate={navigate} className="line-clamp-2 text-sm font-medium text-px-navy hover:text-px-primary">
                  {l.name}
                </Link>
                <p className="text-xs text-px-muted">
                  {l.qty} × {formatMoney(l.price, cur)}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-px-navy">{formatMoney(l.lineTotal, cur)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-px-border-soft bg-px-surface/50 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-px-text">Sous-total</dt>
            <dd className="tabular-nums text-px-navy">{formatMoney(order.subtotal, cur)}</dd>
          </div>
          {order.discount ? (
            <div className="flex justify-between text-emerald-700">
              <dt>Remise{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
              <dd className="tabular-nums">−{formatMoney(order.discount, cur)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-px-text">{order.shippingLabel}</dt>
            <dd className="tabular-nums text-px-navy">{order.shippingCost ? formatMoney(order.shippingCost, cur) : 'Offerte'}</dd>
          </div>
          <div className="flex justify-between border-t border-px-border pt-3 text-base font-semibold text-px-navy">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(order.total, cur)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-px-border-soft p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-px-muted">Livraison</p>
          <p className="mt-2 text-sm font-semibold text-px-navy">{order.shippingLabel}</p>
          <p className="mt-1 text-sm leading-relaxed text-px-text">
            {formatAddress(order.address).map((l, i) => (
              <span key={i} className="block">
                {l}
              </span>
            ))}
          </p>
        </div>
        <div className="rounded-2xl border border-px-border-soft p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-px-muted">Paiement</p>
          <p className="mt-2 text-sm font-semibold text-px-navy">{PAYMENT_LABELS[order.paymentMethod]}</p>
          <p className="mt-1 text-sm text-px-text">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</p>
          {order.notes ? (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-px-muted">Votre note</p>
              <p className="mt-1 whitespace-pre-line text-sm text-px-text">{order.notes}</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
