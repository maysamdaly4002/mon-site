/**
 * Snapify — module Calendrier
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import { defineAdminModule } from '@snapify/sdk/admin';
import { EventsPage } from './EventsPage';
import type { Settings } from '../types';

export default defineAdminModule<Settings>({
  pages: { events: EventsPage },
});
