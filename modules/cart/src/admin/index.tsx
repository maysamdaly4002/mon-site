/**
 * Snapify — module Panier
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useState } from 'react';
import { MoreHorizontal, Pencil, Plus, RotateCcw, Ticket, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  defineAdminModule,
  Dropdown,
  DropdownItem,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Segmented,
  Skeleton,
  Switch,
  Table,
  Td,
  Th,
  errorMessage,
  fmtDate,
  toast,
  useAsync,
  useConfirm,
  usePagination,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import { formatMoney } from '@snapify/sdk/commerce';
import type { Coupon, CouponType, Settings } from '../types';

type Row = Coupon & { id: string; createdAt: string };
type Draft = { id?: string; code: string; description: string; type: CouponType; value: string; minSubtotal: string; startsAt: string; endsAt: string; usageLimit: string; active: boolean };

const EMPTY: Draft = { code: '', description: '', type: 'percent', value: '10', minSubtotal: '', startsAt: '', endsAt: '', usageLimit: '', active: true };

function couponState(c: Row): { tone: 'success' | 'neutral' | 'warning' | 'danger'; label: string } {
  const d = new Date().toISOString().slice(0, 10);
  if (!c.active) return { tone: 'neutral', label: 'Désactivé' };
  if (c.endsAt && d > c.endsAt) return { tone: 'danger', label: 'Expiré' };
  if (c.usageLimit && c.used >= c.usageLimit) return { tone: 'warning', label: 'Épuisé' };
  if (c.startsAt && d < c.startsAt) return { tone: 'warning', label: 'Programmé' };
  return { tone: 'success', label: 'Actif' };
}

function CouponsPage({ api }: AdminPageProps<Settings>) {
  const confirm = useConfirm();
  const list = useAsync(() => api.get<{ coupons: Row[]; currency: string }>('/coupons'), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const rows = list.data?.coupons ?? [];
  const currency = list.data?.currency ?? 'TND';
  const { pageItems, props } = usePagination(rows, 'cart-coupons');

  const describe = (c: Row) => (c.type === 'percent' ? `−${c.value} %` : c.type === 'fixed' ? `−${formatMoney(c.value, currency)}` : 'Livraison offerte');

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = { ...draft, value: Number(draft.value.replace(',', '.')) || 0, minSubtotal: Number(draft.minSubtotal.replace(',', '.')) || 0, usageLimit: Number(draft.usageLimit) || 0 };
      if (draft.id) await api.put(`/coupons/${draft.id}`, body);
      else await api.post('/coupons', body);
      toast.success(draft.id ? 'Code promo enregistré' : 'Code promo créé');
      setDraft(null);
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const edit = (c: Row) =>
    setDraft({ id: c.id, code: c.code, description: c.description, type: c.type, value: c.value ? String(c.value) : '', minSubtotal: c.minSubtotal ? String(c.minSubtotal) : '', startsAt: c.startsAt, endsAt: c.endsAt, usageLimit: c.usageLimit ? String(c.usageLimit) : '', active: c.active });

  return (
    <div>
      <PageHeader
        title="Codes promo"
        description="Remises saisies par vos clients dans le panier : pourcentage, montant fixe ou livraison offerte."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setDraft(EMPTY)}>
            Nouveau code
          </Button>
        }
      />
      <Card padded={false}>
        {list.error ? (
          <div className="p-4">
            <ErrorState message={list.error} onRetry={list.reload} />
          </div>
        ) : !list.data ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !rows.length ? (
          <EmptyState
            icon={Ticket}
            title="Aucun code promo"
            description="Créez un code pour une opération commerciale, une newsletter ou vos clients fidèles."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setDraft(EMPTY)}>
                Nouveau code
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Remise</Th>
                  <Th>Conditions</Th>
                  <Th>Utilisations</Th>
                  <Th>Statut</Th>
                  <Th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => {
                  const st = couponState(c);
                  return (
                    <tr key={c.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => edit(c)}>
                      <Td>
                        <p className="font-mono text-sm font-semibold text-slate-900">{c.code}</p>
                        {c.description ? <p className="text-xs text-slate-500">{c.description}</p> : null}
                      </Td>
                      <Td className="whitespace-nowrap font-medium">{describe(c)}</Td>
                      <Td className="text-xs text-slate-500">
                        {[c.minSubtotal ? `Dès ${formatMoney(c.minSubtotal, currency)}` : '', c.startsAt ? `Du ${fmtDate(c.startsAt)}` : '', c.endsAt ? `Jusqu’au ${fmtDate(c.endsAt)}` : ''].filter(Boolean).join(' · ') || 'Aucune'}
                      </Td>
                      <Td className="tabular-nums">
                        {c.used}
                        {c.usageLimit ? <span className="text-slate-400"> / {c.usageLimit}</span> : null}
                      </Td>
                      <Td>
                        <Badge tone={st.tone} dot>
                          {st.label}
                        </Badge>
                      </Td>
                      <Td>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Dropdown
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="Actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            }
                          >
                            <DropdownItem icon={Pencil} onClick={() => edit(c)}>
                              Modifier
                            </DropdownItem>
                            <DropdownItem icon={RotateCcw} onClick={() => void act(() => api.post(`/coupons/${c.id}/reset`), 'Compteur remis à zéro')}>
                              Remettre le compteur à zéro
                            </DropdownItem>
                            <DropdownItem
                              icon={Trash2}
                              danger
                              onClick={async () => {
                                if (await confirm({ title: `Supprimer le code ${c.code} ?`, message: 'Les commandes déjà passées ne sont pas modifiées.', confirmLabel: 'Supprimer', danger: true })) {
                                  void act(() => api.delete(`/coupons/${c.id}`), 'Code supprimé');
                                }
                              }}
                            >
                              Supprimer
                            </DropdownItem>
                          </Dropdown>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination {...props} noun="codes" />
          </>
        )}
      </Card>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? `Modifier ${draft.code}` : 'Nouveau code promo'}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Annuler</Button>
            <Button variant="primary" loading={saving} disabled={!draft?.code.trim()} onClick={() => void save()}>
              Enregistrer
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" hint="Lettres, chiffres et tirets ; saisi sans tenir compte des majuscules.">
                <Input autoFocus value={draft.code} maxLength={40} className="font-mono uppercase" onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} placeholder="BIENVENUE10" />
              </Field>
              <Field label="Description" hint="Visible par le client dans le panier.">
                <Input value={draft.description} maxLength={120} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Offre de bienvenue" />
              </Field>
            </div>
            <Field label="Type de remise">
              <Segmented
                value={draft.type}
                onChange={(type) => setDraft({ ...draft, type })}
                options={[
                  { value: 'percent', label: 'Pourcentage' },
                  { value: 'fixed', label: 'Montant fixe' },
                  { value: 'shipping', label: 'Livraison offerte' },
                ]}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {draft.type !== 'shipping' ? (
                <Field label={draft.type === 'percent' ? 'Remise (%)' : `Remise (${currency})`}>
                  <Input inputMode="decimal" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value.replace(/[^\d.,]/g, '') })} />
                </Field>
              ) : null}
              <Field label={`Montant minimum d’achat (${currency})`} hint="Vide : sans minimum.">
                <Input inputMode="decimal" value={draft.minSubtotal} onChange={(e) => setDraft({ ...draft, minSubtotal: e.target.value.replace(/[^\d.,]/g, '') })} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Début">
                <Input type="date" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
              </Field>
              <Field label="Fin (incluse)">
                <Input type="date" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
              </Field>
              <Field label="Utilisations max." hint="Vide : illimité.">
                <Input inputMode="numeric" value={draft.usageLimit} onChange={(e) => setDraft({ ...draft, usageLimit: e.target.value.replace(/\D/g, '') })} />
              </Field>
            </div>
            <Switch checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} label="Code actif" description="Désactivez-le pour le suspendre sans le supprimer." />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default defineAdminModule<Settings>({ pages: { coupons: CouponsPage } });
