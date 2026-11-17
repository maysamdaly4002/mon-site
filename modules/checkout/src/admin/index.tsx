/**
 * Snapify — module Commande
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useState } from 'react';
import { Clock, Download, PackageCheck, Receipt, Search, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import {
  Button,
  Card,
  defineAdminModule,
  downloadCsv,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatCard,
  Table,
  Tabs,
  Td,
  Th,
  cx,
  fmtDateTime,
  fmtNumber,
  toast,
  errorMessage,
  timeAgo,
  useAsync,
  useDebounced,
  usePaging,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import { formatMoney, ORDER_STATUS_LABELS, PAYMENT_LABELS, type OrderStatus, type PaymentMethod, type PaymentStatus } from '@snapify/sdk/commerce';
import { OrderDetailPage } from './OrderDetailPage';
import { PaymentBadge, StatusBadge } from './badges';
import type { Settings } from '../types';

interface Row {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  total: number;
  currency: string;
  itemsCount: number;
  customerName: string;
  email: string;
  phone: string;
  city: string;
  governorate: string;
  shippingLabel: string;
}

interface Stats {
  currency: string;
  revenue30: number;
  orders30: number;
  average30: number;
  today: number;
  counts: Record<OrderStatus, number>;
  byDay: { date: string; revenue: number; orders: number }[];
}

function OrdersPage(props: AdminPageProps<Settings>) {
  const id = props.subpath.split('/').filter(Boolean)[0];
  if (id) return <OrderDetailPage key={id} orderId={id} {...props} />;
  return <OrdersList {...props} />;
}

function OrdersList({ api, navigate }: AdminPageProps<Settings>) {
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [payment, setPayment] = useState('');
  const [q, setQ] = useState('');
  const search = useDebounced(q, 300);
  const { page, setPage, pageSize, setPageSize } = usePaging('checkout-orders', { resetKey: { status, payment, search } });
  const query = new URLSearchParams({ page: String(page), size: String(pageSize) });
  if (status !== 'all') query.set('status', status);
  if (payment) query.set('payment', payment);
  if (search) query.set('q', search);
  const list = useAsync(() => api.get<{ items: Row[]; total: number }>(`/orders?${query}`), [query.toString()]);
  const stats = useAsync(() => api.get<Stats>('/stats'), []);
  const st = stats.data;
  const cur = st?.currency ?? 'TND';
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams(query);
      params.set('size', '500');
      params.set('page', '1');
      const r = await api.get<{ items: Row[] }>(`/orders?${params}`);
      downloadCsv(`commandes-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['Numéro', 'Date', 'Client', 'E-mail', 'Téléphone', 'Ville', 'Gouvernorat', 'Articles', 'Total', 'Devise', 'Statut', 'Paiement', 'Payée', 'Livraison'],
        ...r.items.map((o) => [o.number, o.createdAt, o.customerName, o.email, o.phone, o.city, o.governorate, o.itemsCount, o.total, o.currency, ORDER_STATUS_LABELS[o.status], PAYMENT_LABELS[o.paymentMethod], o.paymentStatus === 'paid' ? 'oui' : 'non', o.shippingLabel]),
      ]);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const max = Math.max(1, ...(st?.byDay.map((d) => d.revenue) ?? [0]));

  return (
    <div>
      <PageHeader
        title="Commandes"
        description="Suivez, confirmez et expédiez les commandes de la boutique."
        actions={
          <Button icon={Download} loading={exporting} onClick={() => void exportCsv()}>
            Exporter
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Chiffre d’affaires (30 j)" value={st ? formatMoney(st.revenue30, cur) : '—'} icon={Wallet} hint={st ? `${fmtNumber(st.orders30)} commandes` : undefined} />
        <StatCard label="Panier moyen (30 j)" value={st ? formatMoney(st.average30, cur) : '—'} icon={TrendingUp} tone="sky" />
        <StatCard label="À traiter" value={st ? fmtNumber(st.counts.pending) : '—'} icon={Clock} tone="amber" hint="en attente de confirmation" />
        <StatCard label="À expédier" value={st ? fmtNumber(st.counts.confirmed) : '—'} icon={PackageCheck} tone="violet" hint={st ? `${st.today} commande${st.today > 1 ? 's' : ''} aujourd’hui` : undefined} />
      </div>

      {st && st.byDay.some((d) => d.revenue) ? (
        <Card className="mb-6">
          <p className="mb-4 text-[13px] font-medium text-slate-500">Ventes des 14 derniers jours</p>
          <div className="flex h-28 gap-1.5">
            {st.byDay.map((d) => (
              <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end">
                <div className="w-full rounded-t-md bg-brand-500/80 transition group-hover:bg-brand-600" style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }} />
                <span className="pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white group-hover:block">
                  {new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {formatMoney(d.revenue, cur)} · {d.orders} cde
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Tabs
        value={status}
        onChange={setStatus}
        tabs={[
          { value: 'all', label: 'Toutes' },
          ...(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map((s) => ({
            value: s,
            label: ORDER_STATUS_LABELS[s],
            badge: st?.counts[s] ? <span className={cx('rounded-full px-1.5 text-[11px] font-semibold', s === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')}>{st.counts[s]}</span> : undefined,
          })),
        ]}
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Numéro, nom ou e-mail…" className="pl-9" />
          </div>
          <Select
            value={payment}
            onChange={setPayment}
            className="w-48"
            options={[
              { value: '', label: 'Tous les paiements' },
              { value: 'unpaid', label: 'Non payées' },
              { value: 'paid', label: 'Payées' },
            ]}
          />
        </div>
        {list.error ? (
          <div className="p-4">
            <ErrorState message={list.error} onRetry={list.reload} />
          </div>
        ) : !list.data ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !list.data.items.length ? (
          <EmptyState icon={search || status !== 'all' || payment ? Receipt : ShoppingCart} title={search || status !== 'all' || payment ? 'Aucune commande ne correspond' : 'Aucune commande pour le moment'} description={search || status !== 'all' || payment ? 'Modifiez la recherche ou les filtres.' : 'Les commandes passées sur le site apparaîtront ici.'} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Commande</Th>
                  <Th>Client</Th>
                  <Th>Statut</Th>
                  <Th>Paiement</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((o) => (
                  <tr key={o.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => navigate(`/${o.id}`)}>
                    <Td>
                      <p className="font-mono text-[13px] font-semibold text-slate-900">{o.number}</p>
                      <p className="text-xs text-slate-500" title={fmtDateTime(o.createdAt)}>
                        {timeAgo(o.createdAt)} · {o.itemsCount} article{o.itemsCount > 1 ? 's' : ''}
                      </p>
                    </Td>
                    <Td>
                      <p className="font-medium text-slate-800">{o.customerName}</p>
                      <p className="text-xs text-slate-500">{[o.city, o.governorate].filter(Boolean).join(', ')}</p>
                    </Td>
                    <Td>
                      <StatusBadge status={o.status} />
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <PaymentBadge status={o.paymentStatus} />
                        <span className="text-xs text-slate-500">{PAYMENT_LABELS[o.paymentMethod]}</span>
                      </div>
                    </Td>
                    <Td className="text-right font-semibold tabular-nums text-slate-900">{formatMoney(o.total, o.currency)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={list.data.total} onPage={setPage} onPageSize={setPageSize} noun="commandes" />
          </>
        )}
      </Card>
    </div>
  );
}

export default defineAdminModule<Settings>({ pages: { orders: OrdersPage } });
