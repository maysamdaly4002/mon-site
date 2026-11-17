/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { definePublicModule, type PublicPageProps, type WidgetProps } from '@snapify/sdk';
import { COMMERCE_PATHS } from '@snapify/sdk/commerce';
import { ArrowRight } from 'lucide-react';
import { Container, GridSkeleton, Link, ProductGrid, SectionHeading, cn } from '@snapify/sdk/ui/commerce';
import { Catalog } from './Catalog';
import { NotFound } from './NotFound';
import { ProductPage } from './ProductPage';
import { useFetch } from './useFetch';
import type { PublicCategory, Settings } from '../types';
import type { ProductCard } from '@snapify/sdk/commerce';

function ShopPage(props: PublicPageProps<Settings>) {
  const parts = props.path.split('/').filter(Boolean);
  if (parts[0] === 'produit' && parts.length === 2) return <ProductPage key={parts[1]} slug={parts[1]} {...props} />;
  if (parts[0] === 'boutique' && parts.length <= 2) return <Catalog key={parts[1] ?? ''} categorySlug={parts[1] ?? ''} {...props} />;
  return <NotFound navigate={props.navigate} />;
}

interface ProductsOptions {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  source?: string;
  category?: string;
  limit?: number;
  columns?: string;
  buttonLabel?: string;
}

function ProductsWidget({ options, api, navigate }: WidgetProps<Settings, ProductsOptions>) {
  const o = options ?? {};
  const columns = (Number(o.columns) || 4) as 3 | 4 | 5;
  const limit = Math.min(24, Math.max(1, Number(o.limit) || 8));
  const query = new URLSearchParams({ source: o.source || 'featured', category: o.category || '', limit: String(limit) }).toString();
  const { data, error } = useFetch(api, `/widget/products?${query}`);
  const res = data as { items: ProductCard[]; category: PublicCategory | null } | null;
  const target = res?.category ? COMMERCE_PATHS.category(res.category.slug) : COMMERCE_PATHS.shop;
  if (error || (res && !res.items.length)) return null;
  return (
    <Container>
      <SectionHeading
        eyebrow={o.eyebrow}
        title={o.title}
        subtitle={o.subtitle}
        action={
          o.buttonLabel ? (
            <Link to={target} navigate={navigate} className="group inline-flex items-center gap-2 text-sm font-semibold text-px-navy hover:text-px-primary">
              {o.buttonLabel}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          ) : null
        }
      />
      {res ? <ProductGrid items={res.items} navigate={navigate} columns={columns} /> : <GridSkeleton count={limit > 8 ? 8 : limit} columns={columns} />}
    </Container>
  );
}

interface CategoriesOptions {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  limit?: number;
  style?: string;
}

function CategoriesWidget({ options, api, navigate }: WidgetProps<Settings, CategoriesOptions>) {
  const o = options ?? {};
  const { data } = useFetch(api, '/categories');
  const list = ((data as { categories: PublicCategory[] } | null)?.categories ?? []).filter((c) => c.count).slice(0, Math.max(1, Number(o.limit) || 6));
  if (data && !list.length) return null;
  return (
    <Container>
      <SectionHeading eyebrow={o.eyebrow} title={o.title} subtitle={o.subtitle} />
      {!data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-3xl bg-px-surface" />
          ))}
        </div>
      ) : o.style === 'chips' ? (
        <div className="flex flex-wrap gap-3">
          {list.map((c) => (
            <Link key={c.id} to={COMMERCE_PATHS.category(c.slug)} navigate={navigate} className="group inline-flex items-center gap-3 rounded-full border border-px-border bg-white py-1.5 pl-1.5 pr-5 transition hover:border-px-primary">
              {c.image ? <img src={c.image} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="h-10 w-10 rounded-full bg-px-surface" />}
              <span className="text-sm font-semibold text-px-navy group-hover:text-px-primary">{c.name}</span>
              <span className="text-xs text-px-muted">{c.count}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className={cn('grid grid-cols-2 gap-4 sm:gap-6', list.length === 4 ? 'lg:grid-cols-4' : list.length >= 3 && 'md:grid-cols-3')}>
          {list.map((c, i) => (
            <Link
              key={c.id}
              to={COMMERCE_PATHS.category(c.slug)}
              navigate={navigate}
              className={cn(
                'group relative block overflow-hidden rounded-3xl bg-px-navy',
                list.length % 2 === 1 && i === 0 ? 'col-span-2 aspect-[16/7]' : 'aspect-[4/5]',
                list.length % 3 !== 1 && list.length >= 3 && 'md:col-span-1 md:aspect-[4/5]',
              )}
            >
              {c.image ? <img src={c.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-105" /> : null}
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 sm:p-6">
                <span>
                  <span className="block font-heading text-lg font-semibold text-white sm:text-2xl">{c.name}</span>
                  <span className="mt-0.5 block text-[13px] text-white/75">
                    {c.count} produit{(c.count ?? 0) > 1 ? 's' : ''}
                  </span>
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-px-navy transition group-hover:bg-px-primary group-hover:text-white">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}

export default definePublicModule<Settings>({
  page: ShopPage,
  widgets: { products: ProductsWidget, categories: CategoriesWidget },
});
