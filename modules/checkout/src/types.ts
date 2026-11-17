/**
 * Snapify — module Commande
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import type { Address, OrderStatus, PaymentMethod, PaymentStatus, PricedLine } from '@snapify/sdk/commerce';

export interface Settings {
  homeLabel: string;
  homeDelay: string;
  homePrice: number;
  freeShippingThreshold: number;
  expressEnabled: boolean;
  expressLabel: string;
  expressDelay: string;
  expressPrice: number;
  pickupEnabled: boolean;
  pickupLabel: string;
  pickupAddress: string;
  codEnabled: boolean;
  codText: string;
  transferEnabled: boolean;
  transferText: string;
  bankDetails: string;
  orderPrefix: string;
  minOrder: number;
  guestCheckout: boolean;
  termsPath: string;
  thankYouText: string;
  notifyEmails: string;
  notifyCustomerOnStatus: boolean;
}

export type ShippingMethod = 'home' | 'express' | 'pickup';

export interface ShippingOption {
  id: ShippingMethod;
  label: string;
  delay: string;
  price: number;
  /** Prix avant gratuité (seuil ou code promo). */
  basePrice: number;
}

export interface Order {
  number: string;
  tokenHash: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customerId: string;
  customerName: string;
  email: string;
  address: Address;
  lines: PricedLine[];
  itemsCount: number;
  subtotal: number;
  discount: number;
  couponCode: string;
  shippingMethod: ShippingMethod;
  shippingLabel: string;
  shippingCost: number;
  total: number;
  currency: string;
  notes: string;
  internalNote: string;
  history: { status: Order['status']; at: string; note?: string; by?: string }[];
  ip: string;
}
