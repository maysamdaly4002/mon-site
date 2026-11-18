import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeService } from './helpers';
import { seedDemo } from '../seed/demo';

test('seed : le jeu de démonstration est cohérent', async () => {
  const crm = await makeService();
  await seedDemo(crm);
  const d = await crm.dashboard();
  assert.equal(d.totalContacts, 8);
  assert.equal(d.deals.total, 8);
  assert.equal(d.conversionRate, 50);
});
