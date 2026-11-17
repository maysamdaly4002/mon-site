/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useMemo, useState } from 'react';
import { Copy, ExternalLink, MoreHorizontal, Package, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Dropdown,
  DropdownItem,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  Segmented,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
  cx,
  errorMessage,
  fmtNumber,
  toast,
  useAsync,
  useConfirm,
  useDebounced,
  usePaging,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import { COMMERCE_PATHS, formatMoney } from '@snapify/sdk/commerce';
import { ProductEditor } from './ProductEditor';
import type { Category, Settings } from '../types';

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  trackStock: boolean;
  image: string;
  status: 'active' | 'draft';
  featured: boolean;
  categoryIds: string[];
  sales: number;
  lowStock: boolean;
  updatedAt: string;
}

export type AdminCategory = Category & { id: string; count: number };

export function ProductsPage(props: AdminPageProps<Settings>) {
  const id = props.subpath.split('/').filter(Boolean)[0];
  if (id) return <ProductEditor key={id} productId={id === 'nouveau' ? null : id} {...props} />;
  return <ProductList {...props} />;
}

function ProductList({ api, navigate, settings }: AdminPageProps<Settings>) {
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'draft'>('all');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const search = useDebounced(q, 300);
  const filtersKey = { search, status, stock, category };
  const { page, setPage, pageSize, setPageSize } = usePaging('shop-products', { resetKey: filtersKey });

  const query = new URLSearchParams({ page: String(page), size: String(pageSize) });
  if (search) query.set('q', search);
  if (status !== 'all') query.set('status', status);
  if (stock) query.set('stock', stock);
  if (category) query.set('category', category);
  const list = useAsync(() => api.get<{ items: AdminProductRow[]; total: number }>(`/products?${query}`), [query.toString()]);
  const cats = useAsync(() => api.get<{ categories: AdminCategory[] }>('/categories'), []);
  const catNames = useMemo(() => new Map((cats.data?.categories ?? []).map((c) => [c.id, c.name])), [cats.data]);
  const currency = settings.currency || 'TND';
  const rows = list.data?.items ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const run = async (action: string, ids: string[]) => {
    if (action === 'delete' && !(await confirm({ title: `Supprimer ${ids.length > 1 ? `${ids.length} produits` : 'ce produit'} ?`, message: 'Cette action est définitive. Les commandes passées conservent leurs informations.', confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      const r = await api.post<{ done: number }>('/products/bulk', { ids, action });
      toast.success(`${r.done} produit${r.done > 1 ? 's' : ''} mis à jour`);
      setSelected(new Set());
      void list.reload();
      void cats.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const duplicate = async (row: AdminProductRow) => {
    try {
      const r = await api.post<{ product: { id: string } }>(`/products/${row.id}/duplicate`);
      toast.success('Copie créée en brouillon');
      navigate(`/${r.product.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Produits"
        description="Votre catalogue : prix, stock, images et catégories."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => navigate('/nouveau')}>
            Nouveau produit
          </Button>
        }
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, référence ou adresse…" className="pl-9" />
          </div>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'active', label: 'En ligne' },
              { value: 'draft', label: 'Brouillons' },
            ]}
          />
          <Select
            value={stock}
            onChange={setStock}
            className="w-44"
            options={[
              { value: '', label: 'Tout le stock' },
              { value: 'low', label: 'Stock faible' },
              { value: 'out', label: 'Épuisés' },
            ]}
          />
          <Select value={category} onChange={setCategory} className="w-48" options={[{ value: '', label: 'Toutes les catégories' }, ...(cats.data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        </div>

        {selected.size ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-sm">
            <span className="mr-2 font-medium text-slate-700">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
            <Button size="sm" onClick={() => run('activate', [...selected])}>
              Mettre en ligne
            </Button>
            <Button size="sm" onClick={() => run('draft', [...selected])}>
              Passer en brouillon
            </Button>
            <Button size="sm" onClick={() => run('feature', [...selected])}>
              Mettre en avant
            </Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => run('delete', [...selected])}>
              Supprimer
            </Button>
          </div>
        ) : null}

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
        ) : !rows.length ? (
          <EmptyState
            icon={Package}
            title={search || status !== 'all' || stock || category ? 'Aucun produit ne correspond' : 'Aucun produit pour le moment'}
            description={search || status !== 'all' || stock || category ? 'Modifiez la recherche ou les filtres.' : 'Ajoutez votre premier produit : nom, prix, photos et stock.'}
            action={
              <Button variant="primary" icon={Plus} onClick={() => navigate('/nouveau')}>
                Nouveau produit
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                      className="h-4 w-4 rounded border-slate-300 accent-[#00a89d]"
                    />
                  </Th>
                  <Th>Produit</Th>
                  <Th>Prix</Th>
                  <Th>Stock</Th>
                  <Th>Statut</Th>
                  <Th className="text-right">Ventes</Th>
                  <Th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer transition hover:bg-slate-50/70" onClick={() => navigate(`/${r.id}`)}>
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${r.name}`}
                        checked={selected.has(r.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (n.has(r.id)) n.delete(r.id);
                            else n.add(r.id);
                            return n;
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 accent-[#00a89d]"
                      />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">{r.image ? <img src={r.image} alt="" className="h-full w-full object-cover" /> : null}</div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium text-slate-900">
                            {r.name}
                            {r.featured ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
                          </p>
                          <p className="truncate text-xs text-slate-500">{[r.sku, r.categoryIds.map((c) => catNames.get(c)).filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      <span className="font-medium text-slate-900">{formatMoney(r.price, currency)}</span>
                      {r.compareAtPrice ? <span className="ml-2 text-xs text-slate-400 line-through">{formatMoney(r.compareAtPrice, currency)}</span> : null}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {!r.trackStock ? (
                        <span className="text-slate-400">Non suivi</span>
                      ) : r.stock <= 0 ? (
                        <Badge tone="danger" dot>
                          Épuisé
                        </Badge>
                      ) : r.lowStock ? (
                        <Badge tone="warning" dot>
                          {r.stock} restant{r.stock > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <span className="tabular-nums">{fmtNumber(r.stock)}</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={r.status === 'active' ? 'success' : 'neutral'} dot>
                        {r.status === 'active' ? 'En ligne' : 'Brouillon'}
                      </Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{fmtNumber(r.sales)}</Td>
                    <Td>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          }
                        >
                          <DropdownItem icon={Pencil} onClick={() => navigate(`/${r.id}`)}>
                            Modifier
                          </DropdownItem>
                          <DropdownItem icon={Copy} onClick={() => void duplicate(r)}>
                            Dupliquer
                          </DropdownItem>
                          {r.status === 'active' ? (
                            <DropdownItem icon={ExternalLink} onClick={() => window.open(COMMERCE_PATHS.product(r.slug), '_blank', 'noopener')}>
                              Voir sur le site
                            </DropdownItem>
                          ) : null}
                          <DropdownItem icon={Trash2} danger onClick={() => void run('delete', [r.id])}>
                            Supprimer
                          </DropdownItem>
                        </Dropdown>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={list.data.total} onPage={setPage} onPageSize={setPageSize} noun="produits" />
          </>
        )}
      </Card>
      <p className={cx('mt-3 text-xs text-slate-400', !list.loading && 'invisible')}>Mise à jour…</p>
    </div>
  );
}
