/**
 * One-shot : restaure accueil + menus classiques, puis régénère la baseline démo CMS.
 */
import 'dotenv/config';
import { restoreClassicHomeAndMenus } from '../server/cms/restoreClassicHome';
import { createCmsBaseline, ensureDemoAdminPassword } from '../server/demo/cmsReset';

const result = await restoreClassicHomeAndMenus();
console.log('[restore]', result);
await ensureDemoAdminPassword();
await createCmsBaseline();
console.log('[restore] OK');
process.exit(0);
