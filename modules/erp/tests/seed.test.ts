import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admin, makeService } from './helpers';
import { seedDemo } from '../seed/demo';
import { isoDay } from '../core/dates';

test('seed : au moins 2 établissements et 30 équipements, données cohérentes', async () => {
  const erp = await makeService();
  const r = await seedDemo(erp, admin, isoDay(new Date()));
  assert.ok((await erp.listEtablissements(admin)).length >= 2);
  const eq = await erp.listEquipements(admin, { size: 100 });
  assert.ok(eq.total >= 30, `${eq.total} équipements`);
  assert.equal(new Set(eq.items.map((e) => e.qrCode)).size, eq.total, 'QR codes uniques');
  const d = await erp.dashboard(admin);
  assert.equal(d.parEtablissement.length, 2);
  assert.ok(d.global.ncOuvertes >= 1 && d.global.enRetard >= 1);
  for (const e of [r.hotel, r.ecole]) assert.equal((await erp.verifyRegistre(admin, e.id)).ok, true);
  assert.ok((await erp.login('exploitant@demo.tn', 'Demo1234!')).token);
});
