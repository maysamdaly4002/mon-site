/**
 * Snapify — module Articles IA
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import { defineAdminModule } from '@snapify/sdk/admin';
import { ArticlesPage } from './ArticlesPage';
import { GeneratePage } from './GeneratePage';
import type { Settings } from '../types';

export default defineAdminModule<Settings>({
  pages: { generate: GeneratePage, articles: ArticlesPage },
});
