/**
 * Snapify — module Espace client
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Heart, KeyRound, Mail, MapPin, Phone, Receipt, Save, Trash2, Wallet, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  PageSkeleton,
  Section,
  StatCard,
  Switch,
  Table,
  Td,
  Textarea,
  Th,
  errorMessage,
  fmtDate,
  fmtDateTime,
  toast,
  useAsync,
  useConfirm,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import { formatAddress, formatMoney, MODULE_IDS, ORDER_STATUS_LABELS, type OrderStatus, type OrderSummary, type SavedAddress } from '@snapify/sdk/commerce';
import type { Settings } from '../types';

interface Detail {
  customer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    avatarUrl?: string;
    status: 'active' | 'disabled';
    notes: string;
    addresses: SavedAddress[];
    wishlistCount: number;
    createdAt: string;
    lastLoginAt: string;
  };
  stats: { orders: number; spent: number; lastOrderAt: string | null } | null;
  orders: OrderSummary[];
  ordersEnabled: boolean;
}

const STATUS_TONE: Record<OrderStatus, 'warning' | 'info' | 'brand' | 'success' | 'danger'> = {
  pending: 'warning',
  confirmed: 'info',
  shipped: 'brand',
  delivered: 'success',
  cancelled: 'danger',
};

export function CustomerDetailPage({ customerId, api, navigate }: AdminPageProps<Settings> & { customerId: string }) {
  const confirm = useConfirm();
  const res = useAsync(() => api.get<Detail>(`/customers/${customerId}`), [customerId]);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', notes: '', active: true });
  const [busy, setBusy] = useState('');

  useEffect(() => {
    const c = res.data?.customer;
    if (c) setForm({ firstName: c.firstName, lastName: c.lastName, phone: c.phone, notes: c.notes, active: c.status === 'active' });
  }, [res.data]);

  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (!res.data) return <PageSkeleton />;
  const { customer: c, stats, orders, ordersEnabled } = res.data;
  const currency = orders[0]?.currency ?? 'TND';
  const dirty = form.firstName !== c.firstName || form.lastName !== c.lastName || form.phone !== c.phone || form.notes !== c.notes || form.active !== (c.status === 'active');

  const save = async () => {
    if (!form.active && c.status === 'active' && !(await confirm({ title: 'Désactiver ce compte ?', message: `${c.firstName} ${c.lastName} est déconnecté et ne peut plus se connecter tant que le compte reste désactivé. Ses commandes ne sont pas modifiées.`, confirmLabel: 'Désactiver', danger: true }))) return;
    setBusy('save');
    try {
      await api.put(`/customers/${c.id}`, { ...form, status: form.active ? 'active' : 'disabled' });
      res.setData({ ...res.data!, customer: { ...c, firstName: form.firstName.trim() || c.firstName, lastName: form.lastName.trim() || c.lastName, phone: form.phone.trim(), notes: form.notes, status: form.active ? 'active' : 'disabled' } });
      toast.success('Fiche client enregistrée');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy('');
    }
  };

  const sendReset = async () => {
    setBusy('reset');
    try {
      await api.post(`/customers/${c.id}/reset-link`);
      toast.success(`Lien de réinitialisation envoyé à ${c.email}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy('');
    }
  };

  const removeAvatar = async () => {
    if (!(await confirm({ title: 'Retirer la photo de profil ?', message: `La photo de ${c.firstName} ${c.lastName} est supprimée ; ses initiales s’affichent à la place. Le client peut en ajouter une nouvelle.`, confirmLabel: 'Retirer', danger: true }))) return;
    try {
      await api.post(`/customers/${c.id}/avatar/delete`);
      res.setData({ ...res.data!, customer: { ...c, avatarUrl: '' } });
      toast.success('Photo retirée');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: `Supprimer le compte de ${c.firstName} ${c.lastName} ?`, message: 'Le compte, ses adresses et ses favoris sont effacés définitivement. Les commandes déjà passées sont conservées.', confirmLabel: 'Supprimer', danger: true }))) return;
    setBusy('delete');
    try {
      await api.delete(`/customers/${c.id}`);
      toast.success('Compte supprimé');
      navigate('');
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy('');
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={
          <button type="button" onClick={() => navigate('')} className="inline-flex items-center gap-1 hover:text-slate-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Clients
          </button>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.avatarUrl ? (
              <span className="group relative">
                <img src={c.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200" />
                <button
                  type="button"
                  onClick={() => void removeAvatar()}
                  title="Retirer la photo (photo inappropriée…)"
                  aria-label="Retirer la photo de profil"
                  className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-white text-rose-600 shadow ring-1 ring-slate-200 group-hover:flex"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : null}
            {c.firstName} {c.lastName}
            {c.status === 'disabled' ? <Badge tone="danger">Désactivé</Badge> : <Badge tone="success">Actif</Badge>}
          </span>
        }
        description={`Client depuis le ${fmtDate(c.createdAt)} · ${c.lastLoginAt ? `dernière connexion le ${fmtDateTime(c.lastLoginAt)}` : 'jamais connecté'}`}
        actions={
          <>
            <Button icon={KeyRound} loading={busy === 'reset'} onClick={() => void sendReset()}>
              Envoyer un lien de mot de passe
            </Button>
            <Button icon={Trash2} variant="ghost" className="text-rose-600 hover:bg-rose-50" loading={busy === 'delete'} onClick={() => void remove()}>
              Supprimer
            </Button>
          </>
        }
      />

      {ordersEnabled ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Commandes" value={stats?.orders ?? 0} icon={Receipt} hint={stats?.lastOrderAt ? `Dernière le ${fmtDate(stats.lastOrderAt)}` : 'Aucune commande'} />
          <StatCard label="Total dépensé" value={formatMoney(stats?.spent ?? 0, currency)} icon={Wallet} tone="sky" hint="hors commandes annulées" />
          <StatCard label="Favoris" value={c.wishlistCount} icon={Heart} tone="violet" />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {ordersEnabled ? (
            <Card padded={false}>
              <p className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-900">Commandes</p>
              {orders.length ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Numéro</Th>
                      <Th>Date</Th>
                      <Th>Statut</Th>
                      <Th className="text-right">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.number} className="cursor-pointer hover:bg-slate-50/70" onClick={() => navigate(`/m/${MODULE_IDS.checkout}/orders/${encodeURIComponent(o.number)}`, { absolute: true })}>
                        <Td className="font-mono text-[13px] font-semibold text-slate-900">{o.number}</Td>
                        <Td>{fmtDateTime(o.createdAt)}</Td>
                        <Td>
                          <Badge tone={STATUS_TONE[o.status]} dot>
                            {ORDER_STATUS_LABELS[o.status]}
                          </Badge>
                        </Td>
                        <Td className="text-right font-semibold tabular-nums">{formatMoney(o.total, o.currency)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <EmptyState icon={Receipt} title="Aucune commande" description="Ce client n’a pas encore commandé avec son compte." />
              )}
            </Card>
          ) : null}

          <Section title="Adresses" description={c.addresses.length ? undefined : 'Aucune adresse enregistrée.'}>
            {c.addresses.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {c.addresses.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                    <p className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                      <MapPin className="h-4 w-4 text-slate-400" /> {a.label}
                      {a.isDefault ? <Badge tone="brand">Par défaut</Badge> : null}
                    </p>
                    {formatAddress(a).map((l, i) => (
                      <p key={i} className="text-slate-600">
                        {l}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Coordonnées">
            <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
              <Mail className="h-4 w-4 text-slate-400" /> {c.email}
            </a>
            {c.phone ? (
              <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
                <Phone className="h-4 w-4 text-slate-400" /> {c.phone}
              </a>
            ) : null}
          </Section>

          <Section title="Fiche client">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom">
                <Input value={form.firstName} maxLength={60} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </Field>
              <Field label="Nom">
                <Input value={form.lastName} maxLength={60} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </Field>
            </div>
            <Field label="Téléphone">
              <Input value={form.phone} maxLength={24} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Note interne" hint="Visible uniquement dans l’administration.">
              <Textarea rows={3} value={form.notes} maxLength={4000} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Switch checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Compte actif" description="Désactivé : le client est déconnecté et ne peut plus se connecter." />
            <Button icon={Save} variant="primary" loading={busy === 'save'} disabled={!dirty} onClick={() => void save()}>
              Enregistrer
            </Button>
          </Section>
        </div>
      </div>
    </div>
  );
}
