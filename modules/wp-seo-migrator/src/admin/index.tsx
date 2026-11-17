import { defineAdminModule } from '@snapify/sdk/admin';
import { WizardPage } from './WizardPage';
import { HistoryPage } from './HistoryPage';
import type { Settings } from '../types';

export default defineAdminModule<Settings>({
  pages: {
    wizard: WizardPage,
    history: HistoryPage,
  },
});
