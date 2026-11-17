/**
 * Snapify — module Espace client
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import type { SavedAddress } from '@snapify/sdk/commerce';

export interface Settings {
  allowRegistration: boolean;
  requirePhone: boolean;
  avatars: boolean;
  sessionDays: number;
  welcomeEmail: boolean;
  welcomeText: string;
  privacyPath: string;
}

export interface Customer {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl?: string;
  passwordHash: string;
  addresses: SavedAddress[];
  wishlist: string[];
  status: 'active' | 'disabled';
  lastLoginAt: string;
  notes: string;
  resetHash?: string;
  resetExpires?: string;
}

export interface Session {
  customerId: string;
  expiresAt: string;
  ip: string;
  userAgent: string;
}

/** Données renvoyées au navigateur du client connecté. */
export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string;
  addresses: SavedAddress[];
  wishlist: string[];
  createdAt: string;
}
