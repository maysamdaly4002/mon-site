/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
export interface Settings {
  shopTitle: string;
  shopIntro: string;
  perPage: number;
  defaultSort: string;
  currency: string;
  showStock: boolean;
  lowStockThreshold: number;
  hideOutOfStock: boolean;
  deliveryText: string;
  reassurance: string;
}

export interface Product {
  name: string;
  slug: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  /** Déduit de `compareAtPrice` : sert au filtre « En promotion ». */
  onSale: boolean;
  stock: number;
  trackStock: boolean;
  /** Déduit du stock : sert aux filtres du catalogue. */
  inStock: boolean;
  images: string[];
  description: string;
  shortDescription: string;
  categoryIds: string[];
  status: 'active' | 'draft';
  featured: boolean;
  badge: string;
  sales: number;
  position: number;
  seoTitle: string;
  seoDescription: string;
}

export interface Category {
  name: string;
  slug: string;
  description: string;
  image: string;
  position: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  count?: number;
}
