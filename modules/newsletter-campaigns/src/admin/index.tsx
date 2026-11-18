import { defineAdminModule } from '@snapify/sdk/admin';
import type { Settings } from '../types';
import { CampaignsPage } from './CampaignsPage';
import { SubscribersPage } from './SubscribersPage';

/** Les identifiants correspondent à `adminPages` du manifeste : campaigns, subscribers. */
export default defineAdminModule<Settings>({
  pages: {
    campaigns: CampaignsPage,
    subscribers: SubscribersPage,
  },
});
