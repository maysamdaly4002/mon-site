/**
 * Snapify — achat de modules officiels depuis le backoffice (Flouci + licence)
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import type { LicensePayload, SignedLicense } from '../../sdk/index';
import { encodeLicenseKey, sign } from '../../sdk/package';
import { HttpError } from '../http';
import { generatePayment } from '../platform/flouci';
import { TRUSTED_KEYS } from './trust';
import { getCatalog } from './marketplace';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../../data/module-purchases.json');

export type ModulePurchase = {
  id: string;
  moduleId: string;
  moduleName: string;
  amountMillimes: number;
  status: 'pending' | 'paid' | 'failed';
  paymentId?: string;
  licenseKey?: string;
  createdAt: string;
  paidAt?: string;
  buyerEmail?: string;
};

async function load(): Promise<ModulePurchase[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as ModulePurchase[];
  } catch {
    return [];
  }
}

async function save(rows: ModulePurchase[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

async function signingKey(): Promise<{ pem: string; kid: string }> {
  const raw = process.env.SNAPIFY_SIGNING_KEY;
  const kid = process.env.SNAPIFY_SIGNING_KID || 'novalabs-2026';
  if (!raw) throw new HttpError(503, 'Signature impossible : SNAPIFY_SIGNING_KEY manquante.');
  if (!TRUSTED_KEYS[kid]) throw new HttpError(503, `Clé « ${kid} » absente des clés de confiance.`);
  const file = raw.startsWith('~/') ? path.join(os.homedir(), raw.slice(2)) : raw;
  return { pem: await fs.readFile(file, 'utf8'), kid };
}

function issuePaidLicense(moduleId: string, licensee: string, key: { pem: string; kid: string }): SignedLicense {
  const payload: LicensePayload = {
    v: 1,
    licenseId: `paid-${moduleId}-${crypto.randomUUID().slice(0, 8)}`,
    moduleId,
    licensee: licensee.slice(0, 120) || 'Acheteur Snapify',
    plan: 'standard',
    domains: ['*'],
    issuedAt: new Date().toISOString(),
    expiresAt: null,
  };
  return { payload, signature: sign(payload, key.pem, key.kid) };
}

/** Prix catalogue (millimes) — défaut 49 DT si payant sans prix. */
export function catalogPriceMillimes(entry: { pricing: string; priceMillimes?: number }): number {
  if (entry.pricing !== 'paid') return 0;
  const n = Number(entry.priceMillimes);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 49_000;
}

export async function startModuleCheckout(input: {
  moduleId: string;
  publicBase: string;
  buyerEmail?: string;
}) {
  const catalog = await getCatalog();
  const entry = catalog.modules.find((m) => m.id === input.moduleId && (m.kind ?? 'module') === 'module');
  if (!entry) throw new HttpError(404, 'Module introuvable dans le catalogue');
  if (entry.pricing !== 'paid') throw new HttpError(400, 'Ce module est gratuit — installez-le directement.');

  const amountMillimes = catalogPriceMillimes(entry);
  const id = crypto.randomUUID();
  const trackingId = `module_${id}`;
  const base = input.publicBase.replace(/\/+$/, '');
  const successLink = `${base}/administrator/marketplace?purchase=ok&module=${encodeURIComponent(entry.id)}&pid=${id}`;
  const failLink = `${base}/administrator/marketplace?purchase=fail&module=${encodeURIComponent(entry.id)}`;

  const payment = await generatePayment({
    amountMillimes,
    trackingId,
    successLink,
    failLink,
    webhook: `${base}/api/platform/flouci/webhook`,
  });

  const rows = await load();
  const purchase: ModulePurchase = {
    id,
    moduleId: entry.id,
    moduleName: entry.name,
    amountMillimes,
    status: 'pending',
    paymentId: payment.paymentId,
    createdAt: new Date().toISOString(),
    buyerEmail: input.buyerEmail,
  };
  rows.unshift(purchase);
  await save(rows.slice(0, 500));

  return { purchase, paymentLink: payment.link, paymentId: payment.paymentId };
}

export async function markModulePurchasePaid(paymentId: string): Promise<ModulePurchase | null> {
  const rows = await load();
  let order =
    rows.find((r) => r.paymentId === paymentId) ||
    (paymentId.startsWith('mock_module_') ? rows.find((r) => r.id === paymentId.slice('mock_module_'.length)) : null) ||
    null;
  if (!order && paymentId.startsWith('mock_')) {
    const tracking = paymentId.slice(5);
    if (tracking.startsWith('module_')) order = rows.find((r) => r.id === tracking.slice('module_'.length)) || null;
  }
  if (!order) return null;
  if (order.status === 'paid' && order.licenseKey) return order;

  const key = await signingKey();
  const license = issuePaidLicense(order.moduleId, order.buyerEmail || order.moduleName, key);
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  order.licenseKey = encodeLicenseKey(license);
  if (!order.paymentId) order.paymentId = paymentId;
  await save(rows);
  console.log(`[module-purchase] payé : ${order.moduleId} · ${order.id}`);
  return order;
}

export async function getModulePurchase(id: string) {
  return (await load()).find((r) => r.id === id) || null;
}

export async function latestPaidLicenseForModule(moduleId: string) {
  const rows = await load();
  return rows.find((r) => r.moduleId === moduleId && r.status === 'paid' && r.licenseKey) || null;
}
