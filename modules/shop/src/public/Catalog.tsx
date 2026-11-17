/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react';
import type { PublicPageProps } from '@snapify/sdk';
import { COMMERCE_PATHS, formatMoney, type ProductCard } from '@snapify/sdk/commerce';
import { Breadcrumbs, Button, Checkbox, Container, EmptyState, GridSkeleton, Link, ProductGrid, SelectInput, TextInput, cn } from '@snapify/sdk/ui/commerce';
import { NotFound } from './NotFound';
import { useFetch } from './useFetch';
import type { PublicCategory, Settings } from '../types';

interface CatalogResponse {
  items: ProductCard[];
  total: number;
  page: number;
  pages: number;
  category: PublicCategory | null;
  categories: PublicCategory[];
}

const SORT_OPTIONS = [
  { value: 'featured', label: 'Recommandés' },
  { value: 'latest', label: 'Nouveautés' },
  { value: 'bestsellers', label: 'Meilleures ventes' },
  { value: 'price-asc', label: 'Prix croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
  { value: 'name', label: 'Nom (A → Z)' },
];

export function Catalog({ categorySlug, search, navigate, api, settings, setMeta }: PublicPageProps<Settings> & { categorySlug: string }) {
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const base = categorySlug ? COMMERCE_PATHS.category(categorySlug) : COMMERCE_PATHS.shop;
  const sort = params.get('tri') || settings.defaultSort || 'featured';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') || '';
  const min = params.get('min') || '';
  const max = params.get('max') || '';
  const stock = params.get('stock') === '1';
  const sale = params.get('promo') === '1';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [text, setText] = useState(q);
  const [range, setRange] = useState({ min, max });
  useEffect(() => setText(q), [q]);
  useEffect(() => setRange({ min, max }), [min, max]);

  const query = new URLSearchParams({ sort, page: String(page), perPage: String(settings.perPage || 12) });
  if (categorySlug) query.set('category', categorySlug);
  if (q) query.set('q', q);
  if (min) query.set('min', min);
  if (max) query.set('max', max);
  if (stock) query.set('stock', '1');
  if (sale) query.set('sale', '1');
  const { data, error, loading } = useFetch<CatalogResponse>(api, `/catalog?${query}`);

  const title = data?.category?.name ?? (q ? `Résultats pour « ${q} »` : settings.shopTitle || 'Boutique');
  useEffect(() => {
    setMeta({ title: data?.category?.name ?? settings.shopTitle ?? 'Boutique', description: (data?.category?.description || settings.shopIntro || '').slice(0, 160) });
  }, [data?.category, settings.shopTitle, settings.shopIntro, setMeta]);

  const go = (patch: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!keepPage) next.delete('page');
    const qs = next.toString();
    navigate(`${base}${qs ? `?${qs}` : ''}`);
  };

  if (error?.status === 404) return <NotFound navigate={navigate} />;
  const categories = data?.categories ?? [];
  const activeFilters = [q && { key: 'q', label: `« ${q} »` }, stock && { key: 'stock', label: 'En stock' }, sale && { key: 'promo', label: 'En promotion' }, (min || max) && { key: 'price', label: `${min || 0} – ${max || '∞'}` }].filter(Boolean) as { key: string; label: string }[];

  const filters = (
    <div className="space-y-8">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-px-muted">Catégories</p>
        <ul className="space-y-0.5">
          <li>
            <Link to={COMMERCE_PATHS.shop} navigate={navigate} className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-sm transition', !categorySlug ? 'bg-px-surface font-semibold text-px-navy' : 'text-px-text hover:bg-px-surface')}>
              Tous les produits
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link to={COMMERCE_PATHS.category(c.slug)} navigate={navigate} className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-sm transition', c.slug === categorySlug ? 'bg-px-surface font-semibold text-px-navy' : 'text-px-text hover:bg-px-surface')}>
                {c.name}
                <span className="text-xs text-px-muted">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go({ min: range.min.replace(/[^\d.,]/g, '') || null, max: range.max.replace(/[^\d.,]/g, '') || null });
        }}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-px-muted">Prix ({formatMoney(0, settings.currency).replace(/[\d\s,.]/g, '').trim() || settings.currency})</p>
        <div className="flex items-center gap-2">
          <TextInput inputMode="decimal" placeholder="Min" value={range.min} onChange={(e) => setRange((r) => ({ ...r, min: e.target.value }))} className="h-10" />
          <span className="text-px-muted">–</span>
          <TextInput inputMode="decimal" placeholder="Max" value={range.max} onChange={(e) => setRange((r) => ({ ...r, max: e.target.value }))} className="h-10" />
        </div>
        <Button type="submit" variant="outline" size="sm" block className="mt-3">
          Appliquer
        </Button>
      </form>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-px-muted">Disponibilité</p>
        <Checkbox checked={stock} onChange={(v) => go({ stock: v ? '1' : null })}>
          En stock uniquement
        </Checkbox>
        <Checkbox checked={sale} onChange={(v) => go({ promo: v ? '1' : null })}>
          En promotion
        </Checkbox>
      </div>
    </div>
  );

  return (
    <div className="pb-20">
      <div className="border-b border-px-border-soft bg-px-surface">
        <Container className="py-10 sm:py-14">
          <Breadcrumbs navigate={navigate} items={[{ label: 'Accueil', to: '/' }, { label: settings.shopTitle || 'Boutique', to: categorySlug ? COMMERCE_PATHS.shop : undefined }, ...(data?.category ? [{ label: data.category.name }] : [])]} />
          <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-px-navy sm:text-5xl">{title}</h1>
          {(data?.category ? data.category.description : settings.shopIntro) ? <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-px-muted sm:text-base">{data?.category ? data.category.description : settings.shopIntro}</p> : null}
          {categories.length ? (
            <div className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
              {categories.map((c) => (
                <Link key={c.id} to={COMMERCE_PATHS.category(c.slug)} navigate={navigate} className={cn('shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition', c.slug === categorySlug ? 'border-px-navy bg-px-navy text-white' : 'border-px-border bg-white text-px-navy')}>
                  {c.name}
                </Link>
              ))}
            </div>
          ) : null}
        </Container>
      </div>

      <Container className="mt-8 grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">{filters}</aside>
        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <form
              className="relative min-w-[200px] flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                go({ q: text.trim() || null });
              }}
            >
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-px-muted" />
              <TextInput type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Rechercher un produit…" className="pl-10" aria-label="Rechercher un produit" />
            </form>
            <Button variant="outline" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" /> Filtres
            </Button>
            <SelectInput value={sort} onChange={(v) => go({ tri: v })} options={SORT_OPTIONS} className="w-auto min-w-[190px]" />
          </div>
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-px-muted">
            <span>{data ? `${data.total} produit${data.total > 1 ? 's' : ''}` : 'Chargement…'}</span>
            {activeFilters.map((f) => (
              <button key={f.key} type="button" onClick={() => go(f.key === 'price' ? { min: null, max: null } : { [f.key]: null })} className="inline-flex items-center gap-1 rounded-full bg-px-surface px-3 py-1 text-[13px] font-medium text-px-navy hover:bg-px-border-soft">
                {f.label} <X className="h-3 w-3" />
              </button>
            ))}
          </div>

          {!data ? (
            <GridSkeleton count={6} columns={3} />
          ) : data.items.length ? (
            <div className={cn('transition-opacity', loading && 'opacity-60')}>
              <ProductGrid items={data.items} navigate={navigate} columns={3} />
            </div>
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Aucun produit trouvé"
              text="Essayez d’autres mots-clés ou retirez certains filtres."
              action={activeFilters.length ? <Button variant="outline" onClick={() => navigate(base)}>Effacer les filtres</Button> : undefined}
            />
          )}

          {data && data.pages > 1 ? <Pager page={data.page} pages={data.pages} onPage={(p) => go({ page: p > 1 ? String(p) : null }, true)} /> : null}
        </div>
      </Container>

      {filtersOpen ? (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-px-border-soft px-5 py-4">
              <p className="font-heading text-lg font-semibold text-px-navy">Filtres</p>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-px-navy hover:bg-px-surface">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6" onClick={(e) => (e.target as HTMLElement).closest('a,button[type="submit"],input[type="checkbox"]') && setTimeout(() => setFiltersOpen(false), 0)}>
              {filters}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const list: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) list.push(p);
    else if (list[list.length - 1] !== '…') list.push('…');
  }
  const go = (p: number) => {
    onPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1.5">
      <button type="button" disabled={page <= 1} onClick={() => go(page - 1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-px-border text-px-navy disabled:opacity-30" aria-label="Page précédente">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {list.map((p, i) =>
        p === '…' ? (
          <span key={`g${i}`} className="px-1 text-px-muted">
            …
          </span>
        ) : (
          <button key={p} type="button" onClick={() => go(p)} aria-current={p === page ? 'page' : undefined} className={cn('h-10 min-w-10 rounded-xl px-3 text-sm font-semibold tabular-nums transition', p === page ? 'bg-px-navy text-white' : 'text-px-navy hover:bg-px-surface')}>
            {p}
          </button>
        )
      )}
      <button type="button" disabled={page >= pages} onClick={() => go(page + 1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-px-border text-px-navy disabled:opacity-30" aria-label="Page suivante">
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
