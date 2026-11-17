import 'dotenv/config';
import { reloadSnapshotFromDb } from '../server/cms/store';
import { createCmsBaseline, ensureDemoAdminPassword } from '../server/demo/cmsReset';

await reloadSnapshotFromDb();
await ensureDemoAdminPassword();
await createCmsBaseline();
console.log('[baseline] démarrage OK');
process.exit(0);
