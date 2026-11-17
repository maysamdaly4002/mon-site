/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useState } from 'react';
import { BadgeCheck, ChevronLeft, ChevronRight, Headphones, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { isModuleActive, type PublicPageProps } from '@snapify/sdk';
import { COMMERCE_PATHS, MODULE_IDS, type ProductCard } from '@snapify/sdk/commerce';
import { AddToCartButton, Breadcrumbs, Container, Price, ProductGrid, QtyStepper, SectionHeading, WishlistButton, cn, discountPercent } from '@snapify/sdk/ui/commerce';
import { NotFound } from './NotFound';
import { useFetch } from './useFetch';
import type { PublicCategory, Settings } from '../types';

interface ProductDetail extends ProductCard {
  images: string[];
  sku: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  lowStock: boolean;
}

const REASSURANCE_ICONS = [Truck, ShieldCheck, RotateCcw, Headphones];
const PROSE =
  '[&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-px-navy [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-px-navy [&_strong]:font-semibold [&_strong]:text-px-navy [&_a]:text-px-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-px-primary [&_blockquote]:pl-4 [&_blockquote]:italic';

export function ProductPage({ slug, api, navigate, settings, setMeta }: PublicPageProps<Settings> & { slug: string }) {
  const { data, error } = useFetch<{ product: ProductDetail; categories: PublicCategory[]; related: ProductCard[] }>(api, `/products/${encodeURIComponent(slug)}`);
  const [index, setIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<'description' | 'delivery'>('description');
  const p = data?.product;

  useEffect(() => {
    if (p) setMeta({ title: p.seoTitle || p.name, description: p.seoDescription.slice(0, 160) });
  }, [p, setMeta]);

  if (error?.status === 404) return <NotFound navigate={navigate} />;
  if (!p) {
    return (
      <Container className="grid gap-10 py-12 lg:grid-cols-2" aria-busy="true">
        <div className="aspect-square animate-pulse rounded-3xl bg-px-surface" />
        <div className="space-y-4 pt-6">
          <div className="h-4 w-32 animate-pulse rounded bg-px-surface" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-px-surface" />
          <div className="h-8 w-40 animate-pulse rounded bg-px-surface" />
          <div className="h-24 animate-pulse rounded bg-px-surface" />
        </div>
      </Container>
    );
  }

  const images = p.images.length ? p.images : [''];
  const current = images[Math.min(index, images.length - 1)];
  const category = data.categories[0];
  const off = discountPercent(p.price, p.compareAtPrice);
  const canBuy = isModuleActive(MODULE_IDS.cart);
  const maxQty = p.stock ?? 99;
  const reassurance = (settings.reassurance || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4);

  return (
    <div className="pb-20">
      <Container className="py-6">
        <Breadcrumbs
          navigate={navigate}
          items={[
            { label: 'Accueil', to: '/' },
            { label: settings.shopTitle || 'Boutique', to: COMMERCE_PATHS.shop },
            ...(category ? [{ label: category.name, to: COMMERCE_PATHS.category(category.slug) }] : []),
            { label: p.name },
          ]}
        />
      </Container>

      <Container className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="group relative aspect-square overflow-hidden rounded-3xl bg-px-surface">
            {current ? <img src={current} alt={p.name} className="h-full w-full object-cover" /> : null}
            {off ? <span className="absolute left-4 top-4 rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white">−{off} %</span> : null}
            {images.length > 1 ? (
              <>
                <button type="button" aria-label="Image précédente" onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-px-navy opacity-0 shadow transition group-hover:opacity-100">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" aria-label="Image suivante" onClick={() => setIndex((i) => (i + 1) % images.length)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-px-navy opacity-0 shadow transition group-hover:opacity-100">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </div>
          {images.length > 1 ? (
            <div className="mt-4 grid grid-cols-5 gap-3">
              {images.map((src, i) => (
                <button key={src + i} type="button" onClick={() => setIndex(i)} aria-label={`Image ${i + 1}`} className={cn('aspect-square overflow-hidden rounded-xl bg-px-surface ring-2 ring-offset-2 transition', i === index ? 'ring-px-primary' : 'ring-transparent hover:ring-px-border')}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="lg:pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {category ? <span className="text-xs font-semibold uppercase tracking-[0.16em] text-px-primary">{category.name}</span> : null}
            {p.badge ? <span className="rounded-full bg-px-navy px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">{p.badge}</span> : null}
          </div>
          <h1 className="mt-3 font-heading text-3xl font-semibold leading-tight tracking-tight text-px-navy sm:text-4xl">{p.name}</h1>
          <div className="mt-5 flex items-center gap-3">
            <Price amount={p.price} compareAt={p.compareAtPrice} currency={p.currency} size="lg" />
            {off ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">Économisez {off} %</span> : null}
          </div>
          {p.shortDescription ? <p className="mt-6 text-[15px] leading-relaxed text-px-text">{p.shortDescription}</p> : null}

          <div className="mt-6 flex items-center gap-2 text-sm font-medium">
            <span className={cn('h-2 w-2 rounded-full', !p.inStock ? 'bg-rose-500' : p.lowStock ? 'bg-amber-500' : 'bg-emerald-500')} />
            {!p.inStock ? (
              <span className="text-rose-600">Épuisé</span>
            ) : p.lowStock && settings.showStock && p.stock !== null ? (
              <span className="text-amber-700">Plus que {p.stock} en stock</span>
            ) : (
              <span className="text-emerald-700">En stock</span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {canBuy && p.inStock ? <QtyStepper value={qty} onChange={setQty} max={Math.max(1, Math.min(99, maxQty))} /> : null}
            {canBuy ? (
              <div className="min-w-[200px] flex-1">
                <AddToCartButton p={p} qty={qty} size="lg" block />
              </div>
            ) : null}
            <WishlistButton productId={p.id} withLabel className={cn(!canBuy && 'flex-1')} />
          </div>

          {reassurance.length ? (
            <ul className="mt-8 grid gap-3 rounded-2xl border border-px-border-soft bg-px-surface/60 p-5 sm:grid-cols-2">
              {reassurance.map((line, i) => {
                const Icon = REASSURANCE_ICONS[i % REASSURANCE_ICONS.length];
                return (
                  <li key={i} className="flex items-center gap-3 text-sm text-px-text">
                    <Icon className="h-5 w-5 shrink-0 text-px-primary" />
                    {line}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {p.sku ? (
            <p className="mt-6 flex items-center gap-2 text-[13px] text-px-muted">
              <BadgeCheck className="h-4 w-4" /> Référence : {p.sku}
            </p>
          ) : null}

          <div className="mt-10 border-t border-px-border-soft pt-6">
            <div className="flex gap-6 border-b border-px-border-soft" role="tablist">
              {(
                [
                  ['description', 'Description'],
                  ['delivery', 'Livraison et retours'],
                ] as const
              ).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn('-mb-px border-b-2 pb-3 text-sm font-semibold transition', tab === key ? 'border-px-navy text-px-navy' : 'border-transparent text-px-muted hover:text-px-navy')}>
                  {label}
                </button>
              ))}
            </div>
            {tab === 'description' ? (
              p.description ? (
                <div className={cn('mt-5 text-[15px] leading-relaxed text-px-text', PROSE)} dangerouslySetInnerHTML={{ __html: p.description }} />
              ) : (
                <p className="mt-5 text-sm text-px-muted">Aucune description pour ce produit.</p>
              )
            ) : (
              <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-px-text">
                {(settings.deliveryText || '').split('\n').filter(Boolean).map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>

      {data.related.length ? (
        <Container className="mt-24">
          <SectionHeading eyebrow="À découvrir" title="Vous aimerez aussi" />
          <ProductGrid items={data.related} navigate={navigate} columns={4} />
        </Container>
      ) : null}
    </div>
  );
}
