/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Éléments d'interface communs aux modules e-commerce (`@snapify/sdk/ui/commerce`) : cartes produit,
 * prix, champs de formulaire… Couleurs et polices viennent du site (jetons `px-*`), si bien que
 * boutique, panier, commande et espace client gardent l'identité du thème actif.
 */
import React, { forwardRef, useEffect, useState } from 'react';
import { Check, Heart, Loader2, Minus, Plus, ShoppingBag } from 'lucide-react';
import { isModuleActive } from '../index';
import { cart, formatMoney, MODULE_IDS, COMMERCE_PATHS, MAX_QTY, wishlist, useWishlist, type ProductCard } from '../commerce';

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>;
}

/** Lien interne : navigation sans rechargement, clic molette / Ctrl conservés. */
export function Link({
  to,
  navigate,
  className,
  children,
  onClick,
  ...rest
}: { to: string; navigate: (p: string) => void } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-px-primary text-white hover:bg-px-primary-dark shadow-sm',
  dark: 'bg-px-navy text-white hover:bg-px-navy-2 shadow-sm',
  outline: 'border border-px-border bg-white text-px-navy hover:border-px-navy/40 hover:bg-px-surface',
  ghost: 'text-px-navy hover:bg-px-surface',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
};
const SIZES = { sm: 'h-9 px-3.5 text-sm gap-1.5', md: 'h-11 px-5 text-sm gap-2', lg: 'h-12 px-6 text-[15px] gap-2' } as const;

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES; loading?: boolean; block?: boolean }
>(function Button({ variant = 'primary', size = 'md', loading, block, className, children, disabled, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-px-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
});

export const discountPercent = (price: number, compareAt: number | null | undefined) =>
  compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;

export function Price({ amount, compareAt, currency, className, size = 'md' }: { amount: number; compareAt?: number | null; currency?: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const off = discountPercent(amount, compareAt);
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2', className)}>
      <span className={cn('font-semibold tabular-nums text-px-navy', size === 'lg' ? 'text-2xl sm:text-3xl' : size === 'sm' ? 'text-sm' : 'text-base')}>{formatMoney(amount, currency)}</span>
      {off ? <span className={cn('tabular-nums text-px-muted line-through', size === 'lg' ? 'text-base' : 'text-xs')}>{formatMoney(compareAt!, currency)}</span> : null}
    </span>
  );
}

export function QtyStepper({ value, onChange, max = MAX_QTY, size = 'md' }: { value: number; onChange: (n: number) => void; max?: number; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-8' : 'h-11';
  const w = size === 'sm' ? 'w-8' : 'w-10';
  return (
    <div className={cn('inline-flex items-stretch overflow-hidden rounded-xl border border-px-border bg-white', h)}>
      <button type="button" aria-label="Diminuer" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} className={cn(w, 'flex items-center justify-center text-px-navy transition hover:bg-px-surface disabled:opacity-30')}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        aria-label="Quantité"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''));
          if (n > 0) onChange(Math.min(max, n));
        }}
        className={cn('w-10 border-x border-px-border bg-transparent text-center text-sm font-semibold tabular-nums text-px-navy outline-none', size === 'sm' && 'w-9 text-[13px]')}
      />
      <button type="button" aria-label="Augmenter" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className={cn(w, 'flex items-center justify-center text-px-navy transition hover:bg-px-surface disabled:opacity-30')}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-px-muted', className)} />;
}

export function WishlistButton({ productId, className, withLabel }: { productId: string; className?: string; withLabel?: boolean }) {
  const ids = useWishlist();
  const on = ids.includes(productId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        wishlist.toggle(productId);
      }}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition',
        withLabel ? 'h-11 rounded-xl border border-px-border bg-white px-4 text-sm font-semibold text-px-navy hover:border-px-navy/40' : 'h-9 w-9 rounded-full bg-white/95 shadow-sm ring-1 ring-black/5 hover:scale-105',
        className
      )}
    >
      <Heart className={cn('h-4 w-4', on ? 'fill-rose-500 text-rose-500' : 'text-px-navy')} />
      {withLabel ? (on ? 'Dans vos favoris' : 'Ajouter aux favoris') : null}
    </button>
  );
}

/** Ajout au panier depuis une carte produit, avec confirmation visuelle. */
export function AddToCartButton({ p, qty = 1, size = 'md', block, label = 'Ajouter au panier' }: { p: ProductCard; qty?: number; size?: 'sm' | 'md' | 'lg'; block?: boolean; label?: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(t);
  }, [done]);
  if (!p.inStock) {
    return (
      <Button variant="outline" size={size} block={block} disabled>
        Épuisé
      </Button>
    );
  }
  return (
    <Button
      size={size}
      block={block}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        cart.add({ productId: p.id, name: p.name, slug: p.slug, price: p.price, image: p.image, currency: p.currency, qty });
        setDone(true);
      }}
    >
      {done ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
      {done ? 'Ajouté' : label}
    </Button>
  );
}

export function ProductTile({ p, navigate, showAdd = true }: { p: ProductCard; navigate: (path: string) => void; showAdd?: boolean }) {
  const off = discountPercent(p.price, p.compareAtPrice);
  const canBuy = showAdd && isModuleActive(MODULE_IDS.cart);
  const second = p.images?.[1];
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-px-surface">
        <Link to={COMMERCE_PATHS.product(p.slug)} navigate={navigate} className="block h-full w-full" aria-label={p.name}>
          {p.image ? (
            <>
              <img src={p.image} alt={p.name} loading="lazy" className={cn('h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]', second && 'group-hover:opacity-0')} />
              {second ? <img src={second} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" /> : null}
            </>
          ) : (
            <span className="flex h-full items-center justify-center text-px-muted">
              <ShoppingBag className="h-10 w-10 opacity-40" />
            </span>
          )}
        </Link>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {p.badge ? <span className="rounded-full bg-px-navy px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">{p.badge}</span> : null}
          {off ? <span className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white">−{off} %</span> : null}
          {!p.inStock ? <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-px-navy">Épuisé</span> : null}
        </div>
        <WishlistButton productId={p.id} className="absolute right-3 top-3" />
        {canBuy && p.inStock ? (
          <div className="absolute inset-x-3 bottom-3 translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 max-lg:hidden">
            <AddToCartButton p={p} size="sm" block />
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-1 px-0.5">
        <Link to={COMMERCE_PATHS.product(p.slug)} navigate={navigate} className="line-clamp-2 text-[15px] font-medium leading-snug text-px-navy hover:text-px-primary">
          {p.name}
        </Link>
        <Price amount={p.price} compareAt={p.compareAtPrice} currency={p.currency} />
        {canBuy && p.inStock ? (
          <div className="mt-2 lg:hidden">
            <AddToCartButton p={p} size="sm" block label="Ajouter" />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ProductGrid({ items, navigate, columns = 4, showAdd }: { items: ProductCard[]; navigate: (p: string) => void; columns?: 2 | 3 | 4 | 5; showAdd?: boolean }) {
  const cols = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }[columns];
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3', cols)}>
      {items.map((p) => (
        <ProductTile key={p.id} p={p} navigate={navigate} showAdd={showAdd} />
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 8, columns = 4 }: { count?: number; columns?: 2 | 3 | 4 | 5 }) {
  const cols = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }[columns];
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3', cols)} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="aspect-[4/5] animate-pulse rounded-2xl bg-px-surface" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-px-surface" />
          <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-px-surface" />
        </div>
      ))}
    </div>
  );
}

export function Breadcrumbs({ items, navigate }: { items: { label: string; to?: string }[]; navigate: (p: string) => void }) {
  return (
    <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-1.5 text-[13px] text-px-muted">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i ? <span aria-hidden="true">/</span> : null}
          {it.to ? (
            <Link to={it.to} navigate={navigate} className="hover:text-px-navy">
              {it.label}
            </Link>
          ) : (
            <span className="text-px-navy">{it.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: React.ComponentType<{ className?: string }>; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-px-surface text-px-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="font-heading text-xl font-semibold text-px-navy">{title}</p>
      {text ? <p className="mt-2 max-w-md text-sm leading-relaxed text-px-muted">{text}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'success' | 'warning' | 'danger'; children: React.ReactNode; className?: string }) {
  const cls = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-rose-200 bg-rose-50 text-rose-900',
  }[tone];
  return <div className={cn('rounded-xl border px-4 py-3 text-sm leading-relaxed', cls, className)}>{children}</div>;
}

const controlBaseCls =
  'rounded-xl border border-px-border bg-white px-3.5 text-[15px] text-px-navy placeholder:text-px-muted/70 transition focus:border-px-primary focus:outline-none focus:ring-3 focus:ring-px-primary/15';

/** Tailwind classe `w-full` après `w-auto` : une largeur passée en `className` ne s'appliquerait jamais. */
const controlClsFor = (className?: string) => (className && /(^|\s)w-/.test(className) ? controlBaseCls : `w-full ${controlBaseCls}`);

export function FormField({ label, error, hint, children, className, required }: { label?: string; error?: string; hint?: string; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      {label ? (
        <span className="block text-[13px] font-medium text-px-navy">
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </span>
      ) : null}
      {children}
      {error ? <span className="block text-xs text-rose-600">{error}</span> : hint ? <span className="block text-xs text-px-muted">{hint}</span> : null}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function TextInput({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={cn(controlClsFor(className), 'h-11', invalid && 'border-rose-400', className)} {...rest} />;
});

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClsFor(className), 'py-2.5 leading-relaxed', className)} rows={3} {...rest} />;
}

export function SelectInput({ value, onChange, options, className, invalid, placeholder }: { value: string; onChange: (v: string) => void; options: readonly (string | { value: string; label: string })[]; className?: string; invalid?: boolean; placeholder?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(controlClsFor(className), 'h-11 appearance-none pr-9', invalid && 'border-rose-400', className)} style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%2394a3b8%27%3E%3Cpath d=%27M5.5 7.5l4.5 4.5 4.5-4.5%27/%3E%3C/svg%3E")', backgroundSize: '18px', backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat' }}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-px-text">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-px-border accent-[var(--px-primary)]" />
      <span className="leading-relaxed">{children}</span>
    </label>
  );
}

/** Choix sous forme de cartes (mode de livraison, de paiement…). */
export function OptionCard({ checked, onSelect, title, description, aside, icon: Icon }: { checked: boolean; onSelect: () => void; title: string; description?: React.ReactNode; aside?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn('flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition', checked ? 'border-px-primary bg-px-primary/5 ring-1 ring-px-primary' : 'border-px-border bg-white hover:border-px-navy/30')}
    >
      <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-px-primary' : 'border-px-border')}>
        {checked ? <span className="h-2.5 w-2.5 rounded-full bg-px-primary" /> : null}
      </span>
      {Icon ? <Icon className="mt-0.5 h-5 w-5 shrink-0 text-px-navy" /> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-px-navy">{title}</span>
        {description ? <span className="mt-0.5 block text-[13px] leading-relaxed text-px-muted">{description}</span> : null}
      </span>
      {aside ? <span className="shrink-0 text-sm font-semibold text-px-navy">{aside}</span> : null}
    </button>
  );
}

export function SectionHeading({ eyebrow, title, subtitle, action, align = 'left' }: { eyebrow?: string; title?: string; subtitle?: string; action?: React.ReactNode; align?: 'left' | 'center' }) {
  if (!title && !eyebrow && !subtitle && !action) return null;
  return (
    <div className={cn('mb-8 flex flex-col gap-4 sm:mb-10', align === 'center' ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between')}>
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-px-primary">{eyebrow}</p> : null}
        {title ? <h2 className="font-heading text-2xl font-semibold tracking-tight text-px-navy sm:text-3xl">{title}</h2> : null}
        {subtitle ? <p className="mt-2 text-[15px] leading-relaxed text-px-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
