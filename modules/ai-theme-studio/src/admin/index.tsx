import { defineAdminModule } from '@snapify/sdk/admin';
import type { Settings } from '../types';
import { StudioPage } from './StudioPage';
import { HistoryPage } from './HistoryPage';

export default defineAdminModule<Settings>({
  pages: {
    studio: StudioPage,
    history: HistoryPage,
  },
});
