/**
 * Snapify — module Commande
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { Badge } from '@snapify/sdk/admin';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus, type PaymentStatus } from '@snapify/sdk/commerce';

const STATUS_TONE: Record<OrderStatus, 'warning' | 'info' | 'brand' | 'success' | 'danger'> = {
  pending: 'warning',
  confirmed: 'info',
  shipped: 'brand',
  delivered: 'success',
  cancelled: 'danger',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={status === 'paid' ? 'success' : status === 'refunded' ? 'neutral' : 'warning'}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}
