/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Contrat e-commerce partagé par les modules Boutique, Panier, Commande et Espace client, et par
 * les thèmes (`@snapify/sdk/commerce`). Chaque bundle embarque sa propre copie de ce fichier :
 * l'état commun (panier, client connecté, favoris) vit donc dans `globalThis` et `localStorage`,
 * jamais dans des variables de module.
 */
import type { useSyncExternalStore as UseSyncExternalStore } from 'react';

/** React vient du site hôte : ce fichier reste importable côté serveur sans embarquer React. */
const useSyncExternalStore: typeof UseSyncExternalStore = (subscribe, getSnapshot, getServerSnapshot) =>
  (globalThis as unknown as { __SNAPIFY_RUNTIME__: { React: { useSyncExternalStore: typeof UseSyncExternalStore } } }).__SNAPIFY_RUNTIME__.React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

/* ------------------------------------------------------------------ */
/* Adresses                                                            */
/* ------------------------------------------------------------------ */

export const COMMERCE_PATHS = {
  shop: '/boutique/',
  product: (slug: string) => `/produit/${slug}/`,
  category: (slug: string) => `/boutique/${slug}/`,
  cart: '/panier/',
  checkout: '/commande/',
  confirmation: (number: string, token: string) => `/commande/merci/?n=${encodeURIComponent(number)}&t=${encodeURIComponent(token)}`,
  account: '/compte/',
  accountSection: (s: 'commandes' | 'adresses' | 'profil' | 'favoris') => `/compte/${s}/`,
  login: '/compte/connexion/',
  register: '/compte/inscription/',
} as const;

export const MODULE_IDS = {
  shop: 'novalabs.shop',
  cart: 'novalabs.cart',
  checkout: 'novalabs.checkout',
  customers: 'novalabs.customers',
} as const;

/* ------------------------------------------------------------------ */
/* Données échangées entre modules                                     */
/* ------------------------------------------------------------------ */

/** Produit tel qu'affiché dans une liste (carte produit). */
export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  image: string;
  images?: string[];
  badge: string;
  inStock: boolean;
  /** Stock restant si suivi, `null` sinon. */
  stock: number | null;
  currency: string;
  shortDescription?: string;
}

export interface LineRef {
  productId: string;
  qty: number;
}

/** Ligne recalculée par le serveur à partir du catalogue (prix et stock réels). */
export interface PricedLine {
  productId: string;
  name: string;
  slug: string;
  sku: string;
  image: string;
  price: number;
  qty: number;
  lineTotal: number;
  /** Quantité maximale commandable, `null` si le stock n'est pas suivi. */
  maxQty: number | null;
}

export interface LineIssue {
  productId: string;
  message: string;
}

export interface CouponApplied {
  code: string;
  label: string;
  discount: number;
  freeShipping: boolean;
}

export interface Quote {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  coupon: CouponApplied | null;
  couponError?: string;
  /** Sous-total après remise, hors livraison. */
  total: number;
  currency: string;
  issues: LineIssue[];
}

export interface Address {
  firstName: string;
  lastName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  governorate: string;
  postalCode: string;
}

export interface SavedAddress extends Address {
  id: string;
  label: string;
  isDefault: boolean;
}

export const GOVERNORATES = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia',
  'La Manouba', 'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
] as const;

export const isEmail = (v: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(v);

/** Numéro de téléphone : chiffres, espaces, +, tirets ; au moins 8 chiffres. */
export const isPhone = (v: string) => /^[+\d][\d\s.-]{6,20}$/.test(v.trim()) && v.replace(/\D/g, '').length >= 8;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Contrôle d'une adresse de livraison ; `errors` est indexé par nom de champ. */
export function validateAddress(input: unknown): { value: Address; errors: Partial<Record<keyof Address, string>> } {
  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const value: Address = {
    firstName: text(b.firstName, 60),
    lastName: text(b.lastName, 60),
    phone: text(b.phone, 24),
    line1: text(b.line1, 160),
    line2: text(b.line2, 160),
    city: text(b.city, 80),
    governorate: text(b.governorate, 40),
    postalCode: text(b.postalCode, 10),
  };
  const errors: Partial<Record<keyof Address, string>> = {};
  if (!value.firstName) errors.firstName = 'Prénom requis';
  if (!value.lastName) errors.lastName = 'Nom requis';
  if (!isPhone(value.phone)) errors.phone = 'Numéro de téléphone invalide';
  if (value.line1.length < 4) errors.line1 = 'Adresse requise';
  if (!value.city) errors.city = 'Ville requise';
  if (!(GOVERNORATES as readonly string[]).includes(value.governorate)) errors.governorate = 'Choisissez un gouvernorat';
  if (value.postalCode && !/^\d{4}$/.test(value.postalCode)) errors.postalCode = 'Code postal à 4 chiffres';
  return { value, errors };
}

export const formatAddress = (a: Address): string[] =>
  [`${a.firstName} ${a.lastName}`.trim(), a.line1, a.line2 ?? '', `${a.postalCode ? `${a.postalCode} ` : ''}${a.city}`, a.governorate, a.phone].filter(Boolean);

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cod' | 'transfer';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cod: 'Paiement à la livraison',
  transfer: 'Virement bancaire',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Non payée',
  paid: 'Payée',
  refunded: 'Remboursée',
};

export interface OrderSummary {
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  total: number;
  currency: string;
  itemsCount: number;
}

export interface OrderDetail extends OrderSummary {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  couponCode: string;
  shippingLabel: string;
  shippingCost: number;
  paymentMethod: PaymentMethod;
  email: string;
  address: Address;
  notes: string;
  history: { status: OrderStatus; at: string; note?: string }[];
  /** Instructions de virement, si ce mode de paiement a été choisi. */
  bankDetails?: string;
}

/** Services serveur publiés par chaque module (`ctx.provide`) et lus par les autres (`ctx.use`). */
export interface ShopServices {
  currency: () => string;
  priceLines: (lines: LineRef[]) => Promise<{ lines: PricedLine[]; subtotal: number; currency: string; issues: LineIssue[] }>;
  /** Vérifie et décrémente le stock de toutes les lignes, ou aucune ; erreur 409 si le stock manque. */
  decrementStock: (lines: LineRef[]) => Promise<void>;
  restoreStock: (lines: LineRef[]) => Promise<void>;
}

export interface CartServices {
  quote: (lines: LineRef[], couponCode?: string) => Promise<Quote>;
  redeemCoupon: (code: string) => Promise<void>;
  releaseCoupon: (code: string) => Promise<void>;
}

export interface CustomerIdentity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  addresses: SavedAddress[];
}

export interface CustomerServices {
  /** Client connecté d'après les cookies de la requête (`sm_customer`). */
  current: (cookies: Record<string, string>) => Promise<CustomerIdentity | null>;
}

export interface CheckoutServices {
  ordersForCustomer: (customerId: string, opts?: { limit?: number; offset?: number }) => Promise<{ items: OrderSummary[]; total: number }>;
  orderForCustomer: (customerId: string, number: string) => Promise<OrderDetail | null>;
  customerStats: (customerId: string) => Promise<{ orders: number; spent: number; lastOrderAt: string | null }>;
}

/* ------------------------------------------------------------------ */
/* Montants                                                            */
/* ------------------------------------------------------------------ */

/** Arrondi au millime (3 décimales), suffisant pour toutes les devises courantes. */
export const roundMoney = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

const formatters = new Map<string, Intl.NumberFormat>();

/** Les montants ronds s'affichent sans décimales (« 89 DT » plutôt que « 89,000 DT »). */
export function formatMoney(amount: number, currency = 'TND'): string {
  const value = roundMoney(amount);
  const whole = Number.isInteger(value);
  const key = `${currency}:${whole}`;
  let f = formatters.get(key);
  if (!f) {
    const opts: Intl.NumberFormatOptions = whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {};
    try {
      f = new Intl.NumberFormat('fr-TN', { style: 'currency', currency, ...opts });
    } catch {
      f = new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', ...opts });
    }
    formatters.set(key, f);
  }
  return f.format(value);
}

/* ------------------------------------------------------------------ */
/* État partagé entre bundles                                          */
/* ------------------------------------------------------------------ */

interface SharedState {
  values: Map<string, unknown>;
  listeners: Map<string, Set<() => void>>;
}

function shared(): SharedState {
  const g = globalThis as { __SNAPIFY_SHARED__?: SharedState };
  g.__SNAPIFY_SHARED__ ??= { values: new Map(), listeners: new Map() };
  return g.__SNAPIFY_SHARED__;
}

export function getShared<T>(key: string): T | undefined {
  return shared().values.get(key) as T | undefined;
}

export function setShared<T>(key: string, value: T) {
  const s = shared();
  s.values.set(key, value);
  s.listeners.get(key)?.forEach((l) => l());
}

export function subscribeShared(key: string, listener: () => void): () => void {
  const s = shared();
  if (!s.listeners.has(key)) s.listeners.set(key, new Set());
  s.listeners.get(key)!.add(listener);
  return () => s.listeners.get(key)?.delete(listener);
}

export function useShared<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    (l) => subscribeShared(key, l),
    () => (shared().values.has(key) ? (shared().values.get(key) as T) : fallback),
    () => fallback
  );
}

/* ------------------------------------------------------------------ */
/* Panier                                                              */
/* ------------------------------------------------------------------ */

/** Ligne du panier ; nom, prix et image sont mémorisés pour l'affichage, le prix réel est recalculé par le serveur. */
export interface CartLine {
  productId: string;
  qty: number;
  name: string;
  slug: string;
  price: number;
  image?: string;
  currency?: string;
}

const CART_KEY = 'snapify.cart';
const MAX_LINES = 50;
export const MAX_QTY = 99;

function readCart(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter((l) => l && typeof l.productId === 'string' && Number.isFinite(l.qty) && l.qty > 0).slice(0, MAX_LINES)
      : [];
  } catch {
    return [];
  }
}

function ensureCart(): CartLine[] {
  let lines = getShared<CartLine[]>('cart');
  if (!lines) {
    lines = typeof localStorage === 'undefined' ? [] : readCart();
    // Initialisation pendant un rendu : sans notifier les abonnés.
    shared().values.set('cart', lines);
    if (typeof window !== 'undefined' && !getShared('cart:sync')) {
      setShared('cart:sync', true);
      window.addEventListener('storage', (e) => e.key === CART_KEY && setShared('cart', readCart()));
    }
  }
  return lines;
}

function writeCart(lines: CartLine[]) {
  const next = lines.filter((l) => l.qty > 0).slice(0, MAX_LINES);
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : panier gardé pour la session */
  }
  setShared('cart', next);
}

export const cart = {
  lines: (): CartLine[] => ensureCart(),
  count: (): number => ensureCart().reduce((n, l) => n + l.qty, 0),
  add(line: Omit<CartLine, 'qty'> & { qty?: number }, opts: { open?: boolean } = {}) {
    const lines = [...ensureCart()];
    const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(line.qty ?? 1)));
    const i = lines.findIndex((l) => l.productId === line.productId);
    if (i >= 0) lines[i] = { ...lines[i], ...line, qty: Math.min(MAX_QTY, lines[i].qty + qty) };
    else lines.push({ ...line, qty });
    writeCart(lines);
    window.dispatchEvent(new CustomEvent('snapify:cart-added', { detail: { productId: line.productId, qty, name: line.name, image: line.image } }));
    if (opts.open !== false) cart.open('add');
  },
  setQty(productId: string, qty: number) {
    const q = Math.max(0, Math.min(MAX_QTY, Math.floor(qty)));
    writeCart(ensureCart().map((l) => (l.productId === productId ? { ...l, qty: q } : l)));
  },
  remove(productId: string) {
    writeCart(ensureCart().filter((l) => l.productId !== productId));
  },
  /** Met à jour les informations mémorisées après un recalcul par le serveur. */
  refresh(updates: { productId: string; name?: string; price?: number; image?: string; slug?: string; maxQty?: number }[]) {
    const byId = new Map(updates.map((u) => [u.productId, u]));
    writeCart(
      ensureCart().flatMap((l) => {
        const u = byId.get(l.productId);
        if (!u) return [l];
        const qty = u.maxQty !== undefined ? Math.min(l.qty, u.maxQty) : l.qty;
        return [{ ...l, name: u.name ?? l.name, price: u.price ?? l.price, image: u.image ?? l.image, slug: u.slug ?? l.slug, qty }];
      })
    );
  },
  clear() {
    writeCart([]);
  },
  /** Ouvre le panier (panier latéral du module Panier) ; `add` : à la suite d'un ajout, selon les réglages du module. */
  open(reason: 'user' | 'add' = 'user') {
    window.dispatchEvent(new CustomEvent('snapify:cart-open', { detail: { reason } }));
  },
};

export function useCart() {
  ensureCart();
  const lines = useShared<CartLine[]>('cart', []);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = roundMoney(lines.reduce((n, l) => n + l.qty * (l.price || 0), 0));
  return { lines, count, subtotal, currency: lines[0]?.currency ?? 'TND' };
}

const COUPON_KEY = 'snapify.coupon';

function ensureCoupon(): string {
  let code = getShared<string>('coupon');
  if (code === undefined) {
    try {
      code = (localStorage.getItem(COUPON_KEY) || '').slice(0, 40);
    } catch {
      code = '';
    }
    shared().values.set('coupon', code);
  }
  return code;
}

/** Code promo saisi dans le panier, repris par la page de commande. */
export const coupon = {
  get: (): string => ensureCoupon(),
  set(code: string) {
    const next = code.trim().toUpperCase().slice(0, 40);
    try {
      if (next) localStorage.setItem(COUPON_KEY, next);
      else localStorage.removeItem(COUPON_KEY);
    } catch {
      /* ignoré */
    }
    setShared('coupon', next);
  },
};

export function useCoupon(): string {
  ensureCoupon();
  return useShared<string>('coupon', '');
}

/* ------------------------------------------------------------------ */
/* Client connecté et favoris                                          */
/* ------------------------------------------------------------------ */

export interface CustomerSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
}

/** `undefined` tant que l'état de connexion n'est pas connu, `null` pour un visiteur. */
export function useCustomer(): CustomerSummary | null | undefined {
  return useShared<CustomerSummary | null | undefined>('customer', undefined);
}

export const setCustomer = (c: CustomerSummary | null) => setShared('customer', c);

const WISHLIST_KEY = 'snapify.wishlist';

function ensureWishlist(): string[] {
  let ids = getShared<string[]>('wishlist');
  if (!ids) {
    try {
      const raw = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
      ids = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string').slice(0, 200) : [];
    } catch {
      ids = [];
    }
    shared().values.set('wishlist', ids);
  }
  return ids;
}

export const wishlist = {
  ids: (): string[] => ensureWishlist(),
  has: (id: string) => ensureWishlist().includes(id),
  set(ids: string[]) {
    const next = [...new Set(ids)].slice(0, 200);
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
    } catch {
      /* ignoré */
    }
    setShared('wishlist', next);
    window.dispatchEvent(new CustomEvent('snapify:wishlist-changed', { detail: next }));
  },
  toggle(id: string): boolean {
    const ids = ensureWishlist();
    const on = !ids.includes(id);
    wishlist.set(on ? [...ids, id] : ids.filter((x) => x !== id));
    return on;
  },
};

export function useWishlist(): string[] {
  ensureWishlist();
  return useShared<string[]>('wishlist', []);
}
