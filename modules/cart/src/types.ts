/**
 * Snapify — module Panier
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
export interface Settings {
  openDrawerOnAdd: boolean;
  drawerEnabled: boolean;
  couponsEnabled: boolean;
  note: string;
  continuePath: string;
}

export type CouponType = 'percent' | 'fixed' | 'shipping';

export interface Coupon {
  code: string;
  description: string;
  type: CouponType;
  /** Pourcentage (1 à 100) ou montant ; ignoré pour la livraison offerte. */
  value: number;
  minSubtotal: number;
  /** Dates ISO (AAAA-MM-JJ) incluses ; vide = sans limite. */
  startsAt: string;
  endsAt: string;
  /** 0 = illimité. */
  usageLimit: number;
  used: number;
  active: boolean;
}
