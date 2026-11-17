/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { defineAdminModule } from '@snapify/sdk/admin';
import { CategoriesPage } from './CategoriesPage';
import { ProductsPage } from './ProductsPage';
import type { Settings } from '../types';

export default defineAdminModule<Settings>({
  pages: { products: ProductsPage, categories: CategoriesPage },
});
