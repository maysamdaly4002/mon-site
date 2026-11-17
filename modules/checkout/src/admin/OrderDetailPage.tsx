/**
 * Snapify — module Commande
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Ban, CheckCircle2, Mail, MapPin, Phone, Printer, Send, Truck, UserRound } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Field,
  PageHeader,
  PageSkeleton,
  Section,
  Select,
  Switch,
  Table,
  Td,
  Textarea,
  Th,
  errorMessage,
  fmtDateTime,
  toast,
  useAsync,
  useConfirm,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import { formatAddress, formatMoney, ORDER_STATUS_LABELS, PAYMENT_LABELS, type OrderStatus, type PaymentStatus } from '@snapify/sdk/commerce';
import { PaymentBadge, StatusBadge } from './badges';
import type { Order, Settings } from '../types';

type AdminOrder = Omit<Order, 'tokenHash'> & { id: string; createdAt: string; updatedAt: string };

const ACTION_LABEL: Record<OrderStatus, string> = {
  pending: 'Remettre en attente',
  confirmed: 'Confirmer',
  shipped: 'Marquer expédiée',
  delivered: 'Marquer livrée',
  cancelled: 'Annuler la commande',
};
const ACTION_ICON = { pending: CheckCircle2, confirmed: CheckCircle2, shipped: Truck, delivered: CheckCircle2, cancelled: Ban } as const;

export function OrderDetailPage({ orderId, api, navigate }: AdminPageProps<Settings> & { orderId: string }) {
  const confirm = useConfirm();
  const res = useAsync(() => api.get<{ order: AdminOrder; next: OrderStatus[]; notifyDefault: boolean }>(`/orders/${orderId}`), [orderId]);
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [internal, setInternal] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (res.data) {
      setNotify(res.data.notifyDefault);
      setInternal(res.data.order.internalNote || '');
    }
  }, [res.data]);

  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (!res.data) return <PageSkeleton />;
  const { order: o, next } = res.data;
  const cur = o.currency;

  const changeStatus = async (status: OrderStatus) => {
    if (status === 'cancelled' && !(await confirm({ title: `Annuler la commande ${o.number} ?`, message: 'Le stock des produits est rétabli et le code promo éventuel est libéré. Une commande annulée ne peut pas être rouverte.', confirmLabel: 'Annuler la commande', danger: true }))) return;
    setBusy(status);
    try {
      const r = await api.post<{ order: AdminOrder; next: OrderStatus[] }>(`/orders/${o.id}/status`, { status, note: note.trim(), notify });
      res.setData({ ...res.data!, order: r.order, next: r.next });
      setNote('');
      toast.success(`Commande ${ORDER_STATUS_LABELS[status].toLowerCase()}${notify ? ' · client prévenu' : ''}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const setPayment = async (paymentStatus: PaymentStatus) => {
    setBusy('payment');
    try {
      const r = await api.post<{ order: AdminOrder }>(`/orders/${o.id}/payment`, { paymentStatus });
      res.setData({ ...res.data!, order: r.order });
      toast.success('Paiement mis à jour');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const saveInternal = async () => {
    setBusy('note');
    try {
      await api.post(`/orders/${o.id}/note`, { note: internal });
      res.setData({ ...res.data!, order: { ...o, internalNote: internal } });
      toast.success('Note enregistrée');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    setBusy('resend');
    try {
      await api.post(`/orders/${o.id}/resend`);
      toast.success(`Confirmation renvoyée à ${o.email}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={
          <button type="button" onClick={() => navigate('')} className="inline-flex items-center gap-1 hover:text-slate-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Commandes
          </button>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            Commande {o.number} <StatusBadge status={o.status} /> <PaymentBadge status={o.paymentStatus} />
          </span>
        }
        description={`Passée le ${fmtDateTime(o.createdAt)} · ${o.itemsCount} article${o.itemsCount > 1 ? 's' : ''}`}
        actions={
          <>
            <Button icon={Send} loading={busy === 'resend'} onClick={() => void resend()}>
              Renvoyer la confirmation
            </Button>
            <Button icon={Printer} onClick={() => window.print()}>
              Imprimer
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>Produit</Th>
                  <Th className="text-right">Prix</Th>
                  <Th className="text-right">Qté</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {o.lines.map((l) => (
                  <tr key={l.productId}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">{l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : null}</div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{l.name}</p>
                          {l.sku ? <p className="text-xs text-slate-500">Réf. {l.sku}</p> : null}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">{formatMoney(l.price, cur)}</Td>
                    <Td className="text-right tabular-nums">{l.qty}</Td>
                    <Td className="text-right font-medium tabular-nums">{formatMoney(l.lineTotal, cur)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <dl className="ml-auto max-w-sm space-y-2 p-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Sous-total</dt>
                <dd className="tabular-nums">{formatMoney(o.subtotal, cur)}</dd>
              </div>
              {o.discount ? (
                <div className="flex justify-between text-emerald-700">
                  <dt>Remise {o.couponCode ? `(${o.couponCode})` : ''}</dt>
                  <dd className="tabular-nums">−{formatMoney(o.discount, cur)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-slate-500">{o.shippingLabel}</dt>
                <dd className="tabular-nums">{o.shippingCost ? formatMoney(o.shippingCost, cur) : 'Offerte'}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-semibold text-slate-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(o.total, cur)}</dd>
              </div>
            </dl>
          </Card>

          {o.notes ? (
            <Alert tone="info" title="Note du client">
              <span className="whitespace-pre-line">{o.notes}</span>
            </Alert>
          ) : null}

          <Section title="Historique">
            <ol className="relative space-y-5 border-l border-slate-200 pl-6">
              {[...o.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[29px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                  <p className="text-sm font-medium text-slate-800">{ORDER_STATUS_LABELS[h.status]}</p>
                  <p className="text-xs text-slate-500">
                    {fmtDateTime(h.at)}
                    {h.by ? ` · ${h.by}` : h.status === 'pending' && i === o.history.length - 1 ? ' · commande passée sur le site' : ''}
                  </p>
                  {h.note ? <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Traitement">
            {next.length ? (
              <>
                <div className="grid gap-2">
                  {next.map((st) => {
                    const Icon = ACTION_ICON[st];
                    return (
                      <Button key={st} variant={st === 'cancelled' ? 'ghost' : st === next[0] ? 'primary' : 'outline'} icon={Icon} loading={busy === st} className={st === 'cancelled' ? 'justify-center text-rose-600 hover:bg-rose-50 hover:text-rose-700' : 'justify-center'} onClick={() => void changeStatus(st)}>
                        {ACTION_LABEL[st]}
                      </Button>
                    );
                  })}
                </div>
                <Field label="Message au client (facultatif)" hint="Ajouté à l’historique et, si coché, à l’e-mail : numéro de suivi, créneau de livraison…">
                  <Textarea rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <Switch checked={notify} onChange={setNotify} label="Prévenir le client par e-mail" />
              </>
            ) : (
              <p className="text-sm text-slate-500">Commande {o.status === 'cancelled' ? 'annulée' : 'livrée'} : aucune action restante.</p>
            )}
          </Section>

          <Section title="Paiement">
            <p className="text-sm text-slate-700">{PAYMENT_LABELS[o.paymentMethod]}</p>
            <Select
              value={o.paymentStatus}
              disabled={busy === 'payment'}
              onChange={(v) => void setPayment(v as PaymentStatus)}
              options={[
                { value: 'unpaid', label: 'Non payée' },
                { value: 'paid', label: 'Payée' },
                { value: 'refunded', label: 'Remboursée' },
              ]}
            />
            {o.paymentMethod === 'cod' ? <p className="text-xs text-slate-500">Marquée payée automatiquement à la livraison.</p> : null}
          </Section>

          <Section title="Client">
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-medium text-slate-900">
                <UserRound className="h-4 w-4 text-slate-400" /> {o.customerName}
                {o.customerId ? (
                  <button type="button" className="ml-auto text-xs font-medium text-brand-700 hover:underline" onClick={() => navigate(`/m/novalabs.customers/customers/${o.customerId}`, { absolute: true })}>
                    Fiche client
                  </button>
                ) : (
                  <span className="ml-auto text-xs text-slate-400">Sans compte</span>
                )}
              </p>
              <a href={`mailto:${o.email}`} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
                <Mail className="h-4 w-4 text-slate-400" /> {o.email}
              </a>
              <a href={`tel:${o.address.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
                <Phone className="h-4 w-4 text-slate-400" /> {o.address.phone}
              </a>
            </div>
          </Section>

          <Section title={o.shippingMethod === 'pickup' ? 'Retrait en boutique' : 'Adresse de livraison'}>
            <p className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                {formatAddress(o.address).map((l, i) => (
                  <span key={i} className="block">
                    {l}
                  </span>
                ))}
              </span>
            </p>
          </Section>

          <Section title="Note interne" description="Visible uniquement dans l’administration.">
            <Textarea rows={3} value={internal} maxLength={4000} onChange={(e) => setInternal(e.target.value)} />
            <Button size="sm" loading={busy === 'note'} disabled={internal === (o.internalNote || '')} onClick={() => void saveInternal()}>
              Enregistrer la note
            </Button>
          </Section>
        </div>
      </div>
    </div>
  );
}
