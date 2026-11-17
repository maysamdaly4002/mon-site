/**
 * Snapify — module Espace client
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useState } from 'react';
import { Download, Search, UserRound, Users } from 'lucide-react';
import {
  Badge,
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
  Table,
  Td,
  Th,
  errorMessage,
  fmtDate,
  timeAgo,
  toast,
  useAsync,
  useDebounced,
  usePaging,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import { formatMoney } from '@snapify/sdk/commerce';
import { CustomerDetailPage } from './CustomerDetailPage';
import type { Settings } from '../types';

interface Row {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string;
  status: 'active' | 'disabled';
  createdAt: string;
  lastLoginAt: string;
  city: string;
  orders: number;
  spent: number;
}

function CustomersPage(props: AdminPageProps<Settings>) {
  const id = props.subpath.split('/').filter(Boolean)[0];
  if (id) return <CustomerDetailPage key={id} customerId={id} {...props} />;
  return <CustomersList {...props} />;
}

function CustomersList({ api, navigate }: AdminPageProps<Settings>) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('recent');
  const search = useDebounced(q, 300);
  const { page, setPage, pageSize, setPageSize } = usePaging('customers-list', { resetKey: { search, status, sort } });
  const query = new URLSearchParams({ page: String(page), size: String(pageSize), sort });
  if (status) query.set('status', status);
  if (search) query.set('q', search);
  const list = useAsync(() => api.get<{ items: Row[]; total: number; ordersEnabled: boolean }>(`/customers?${query}`), [query.toString()]);
  const [exporting, setExporting] = useState(false);
  const filtered = !!(search || status);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams(query);
      params.set('size', '500');
      params.set('page', '1');
      const r = await api.get<{ items: Row[] }>(`/customers?${params}`);
      downloadCsv(`clients-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Ville', 'Statut', 'Inscription', 'Dernière connexion', 'Commandes', 'Total dépensé'],
        ...r.items.map((c) => [c.firstName, c.lastName, c.email, c.phone, c.city, c.status === 'active' ? 'actif' : 'désactivé', c.createdAt, c.lastLoginAt, c.orders, c.spent]),
      ]);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Comptes créés sur la boutique : commandes, coordonnées et accès."
        actions={
          <Button icon={Download} loading={exporting} onClick={() => void exportCsv()}>
            Exporter
          </Button>
        }
      />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail ou téléphone…" className="pl-9" />
          </div>
          <Select
            value={status}
            onChange={setStatus}
            className="w-44"
            options={[
              { value: '', label: 'Tous les statuts' },
              { value: 'active', label: 'Actifs' },
              { value: 'disabled', label: 'Désactivés' },
            ]}
          />
          <Select
            value={sort}
            onChange={setSort}
            className="w-48"
            options={[
              { value: 'recent', label: 'Plus récents' },
              { value: 'name', label: 'Nom (A → Z)' },
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
          <EmptyState icon={filtered ? Search : Users} title={filtered ? 'Aucun client ne correspond' : 'Aucun client pour le moment'} description={filtered ? 'Modifiez la recherche ou les filtres.' : 'Les comptes créés sur le site apparaîtront ici.'} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Téléphone</Th>
                  <Th>Inscription</Th>
                  {list.data.ordersEnabled ? <Th className="text-right">Commandes</Th> : null}
                  {list.data.ordersEnabled ? <Th className="text-right">Dépensé</Th> : null}
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => navigate(`/${c.id}`)}>
                    <Td>
                      <div className="flex items-center gap-3">
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-600">
                            {`${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`.toUpperCase() || <UserRound className="h-4 w-4" />}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium text-slate-900">
                            {c.firstName} {c.lastName}
                            {c.status === 'disabled' ? <Badge tone="danger">Désactivé</Badge> : null}
                          </p>
                          <p className="truncate text-xs text-slate-500">{c.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="text-slate-700">{c.phone || '—'}</p>
                      {c.city ? <p className="text-xs text-slate-500">{c.city}</p> : null}
                    </Td>
                    <Td>
                      <p className="text-slate-700">{fmtDate(c.createdAt)}</p>
                      <p className="text-xs text-slate-500">{c.lastLoginAt ? `Vu ${timeAgo(c.lastLoginAt)}` : 'Jamais connecté'}</p>
                    </Td>
                    {list.data!.ordersEnabled ? <Td className="text-right tabular-nums">{c.orders}</Td> : null}
                    {list.data!.ordersEnabled ? <Td className="text-right font-semibold tabular-nums text-slate-900">{formatMoney(c.spent)}</Td> : null}
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={list.data.total} onPage={setPage} onPageSize={setPageSize} noun="clients" />
          </>
        )}
      </Card>
    </div>
  );
}

export default defineAdminModule<Settings>({ pages: { customers: CustomersPage } });
