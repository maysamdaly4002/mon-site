/**
 * Snapify — commandes licence annuelle (699 DT)
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePayment } from './flouci';
import { formatDt } from './settings';
import { HttpError } from '../http';
import { ACCESS_TYPES, FR_REGIONS, GOUVERNORATS, HOSTING_TYPES, SITE_TYPES, providerById } from './hostingProviders';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../../data/license-orders.json');

export type LicenseOrderDetails = {
  company?: string;
  phone: string;
  gouvernorat: string;
  city?: string;
  siteType: string;
  domainStatus: 'owned' | 'to-register';
  providerId: string;
  providerName: string;
  hostingType: string;
  accessType: string;
  serverIp?: string;
  theme?: string;
  message?: string;
};

export type LicenseOrder = {
  id: string;
  name: string;
  email: string;
  domain: string;
  hostingNotes: string;
  details?: LicenseOrderDetails;
  amountMillimes: number;
  status: 'pending' | 'paid' | 'failed';
  paymentId?: string;
  createdAt: string;
  paidAt?: string;
};

export type LicenseCheckoutInput = {
  name: string;
  email: string;
  domain: string;
  company?: string;
  phone: string;
  gouvernorat: string;
  city?: string;
  siteType: string;
  domainStatus: string;
  providerId: string;
  providerOther?: string;
  hostingType: string;
  accessType: string;
  serverIp?: string;
  theme?: string;
  message?: string;
  acceptTerms: boolean;
  publicBase: string;
  /** Marché TN / FR pour la fiche client + CGU. */
  market?: 'tn' | 'fr';
  country?: string;
};

async function load(): Promise<LicenseOrder[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as LicenseOrder[];
  } catch {
    return [];
  }
}

async function save(rows: LicenseOrder[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

export function licensePriceMillimes(): number {
  return Math.max(1_000, Number(process.env.LICENSE_PRICE_MILLIMES) || 699_000);
}

const clean = (v: string | undefined, max: number) => (v || '').trim().slice(0, max);

function validateCheckout(input: LicenseCheckoutInput) {
  const name = clean(input.name, 120);
  const email = clean(input.email, 160).toLowerCase();
  const domain = clean(input.domain, 120)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const phone = clean(input.phone, 30);
  const gouvernorat = clean(input.gouvernorat, 40);
  const siteType = clean(input.siteType, 20);
  const providerId = clean(input.providerId, 40);
  const provider = providerById(providerId);
  const providerOther = clean(input.providerOther, 120);
  const hostingType = clean(input.hostingType, 20) || 'unknown';
  const accessType = clean(input.accessType, 20) || 'unknown';
  const serverIp = clean(input.serverIp, 64);

  const fail = (msg: string) => {
    throw new HttpError(422, msg);
  };
  if (name.length < 3) fail('Nom complet requis');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Adresse e-mail invalide');
  if (phone.replace(/\D/g, '').length < 8) fail('Numéro de téléphone invalide');
  const regionsOk = GOUVERNORATS.includes(gouvernorat) || FR_REGIONS.includes(gouvernorat);
  if (!regionsOk) fail(input.market === 'fr' ? 'Région requise' : 'Gouvernorat requis');
  if (!SITE_TYPES.some((s) => s.id === siteType)) fail('Type de site requis');
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) fail('Nom de domaine invalide (ex. maboutique.tn)');
  if (!provider) fail('Hébergeur requis');
  if (providerId === 'other' && providerOther.length < 2) fail('Précisez le nom de votre hébergeur');
  if (!HOSTING_TYPES.some((h) => h.id === hostingType)) fail('Type d’hébergement invalide');
  if (!ACCESS_TYPES.some((a) => a.id === accessType)) fail('Type d’accès invalide');
  if (!input.acceptTerms) fail('Veuillez accepter les conditions');

  const details: LicenseOrderDetails = {
    company: clean(input.company, 120) || undefined,
    phone,
    gouvernorat,
    city: clean(input.city, 80) || undefined,
    siteType,
    domainStatus: input.domainStatus === 'to-register' ? 'to-register' : 'owned',
    providerId,
    providerName: providerId === 'other' ? providerOther : provider!.name,
    hostingType,
    accessType,
    serverIp: serverIp || undefined,
    theme: clean(input.theme, 40) || undefined,
    message: clean(input.message, 2000) || undefined,
  };

  const label = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label || id;
  const hostingNotes = [
    `Hébergeur : ${details.providerName}`,
    `Type : ${label(HOSTING_TYPES, hostingType)} · Accès : ${label(ACCESS_TYPES, accessType)}`,
    details.serverIp ? `IP serveur : ${details.serverIp}` : '',
    details.message ? `Notes : ${details.message}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { name, email, domain, details, hostingNotes };
}

export async function startLicenseCheckout(input: LicenseCheckoutInput) {
  const { name, email, domain, details, hostingNotes } = validateCheckout(input);

  const id = crypto.randomUUID();
  const amountMillimes = licensePriceMillimes();
  const base = input.publicBase.replace(/\/$/, '');
  const payment = await generatePayment({
    amountMillimes,
    trackingId: `license_${id}`,
    successLink: `${base}/commander/success`,
    failLink: `${base}/commander/fail`,
    webhook: `${base}/api/platform/flouci/webhook`,
  });

  const order: LicenseOrder = {
    id,
    name,
    email,
    domain,
    hostingNotes,
    details,
    amountMillimes,
    status: 'pending',
    paymentId: payment.paymentId,
    createdAt: new Date().toISOString(),
  };
  const rows = await load();
  rows.unshift(order);
  await save(rows.slice(0, 500));

  // Fiche client + compte + e-mail de bienvenue (identifiants)
  try {
    const { ensureClientFromLicenseOrder } = await import('./clients');
    const market = input.market === 'fr' ? 'fr' : 'tn';
    const profile = await ensureClientFromLicenseOrder(order, {
      market,
      country: input.country,
    });
    const { provisionClientAndWelcome } = await import('./clientWelcome');
    const mail = await provisionClientAndWelcome(profile, order, { market });
    console.log(`[license] fiche ${profile.id} · compte=${mail.createdAccount} · mail=${mail.mailed}`);
  } catch (e) {
    console.warn('[license] fiche / bienvenue client', e);
  }

  return { orderId: id, link: payment.link, amountLabel: formatDt(amountMillimes) };
}

export async function markLicensePaidByPaymentId(paymentId: string) {
  const rows = await load();
  const idx = rows.findIndex((r) => r.paymentId === paymentId || `license_${r.id}` === paymentId.replace(/^mock_/, ''));
  // tracking mock_license_<uuid>
  let order = idx >= 0 ? rows[idx] : null;
  if (!order && paymentId.startsWith('mock_license_')) {
    const id = paymentId.slice('mock_license_'.length);
    order = rows.find((r) => r.id === id) || null;
  }
  if (!order && paymentId.startsWith('mock_')) {
    const tracking = paymentId.slice(5);
    if (tracking.startsWith('license_')) {
      const id = tracking.slice('license_'.length);
      order = rows.find((r) => r.id === id) || null;
    }
  }
  if (!order) return null;
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  await save(rows);
  try {
    const { ensureClientFromLicenseOrder } = await import('./clients');
    await ensureClientFromLicenseOrder(order);
  } catch (e) {
    console.warn('[license] fiche client paid', e);
  }
  console.log(`[license] payée : ${order.email} · ${order.domain}`);
  return order;
}

export async function listLicenseOrders() {
  return load();
}

/** Mise à jour manuelle du statut (superadmin) — virement reçu, annulation, etc. */
export async function setLicenseOrderStatus(id: string, status: 'pending' | 'paid' | 'failed') {
  const rows = await load();
  const order = rows.find((r) => r.id === id);
  if (!order) return null;
  order.status = status;
  if (status === 'paid') order.paidAt = order.paidAt || new Date().toISOString();
  else if (status === 'pending') delete order.paidAt;
  await save(rows);
  return order;
}

/** Édition manuelle des champs client / projet (superadmin). */
export async function updateLicenseOrder(
  id: string,
  patch: Partial<Pick<LicenseOrder, 'name' | 'email' | 'domain' | 'hostingNotes' | 'amountMillimes' | 'status'>> & {
    details?: Partial<LicenseOrderDetails>;
  }
) {
  const rows = await load();
  const order = rows.find((r) => r.id === id);
  if (!order) return null;
  if (typeof patch.name === 'string') order.name = clean(patch.name, 120) || order.name;
  if (typeof patch.email === 'string') {
    const email = clean(patch.email, 160).toLowerCase();
    if (email) order.email = email;
  }
  if (typeof patch.domain === 'string') {
    const domain = clean(patch.domain, 120)
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (domain) order.domain = domain;
  }
  if (typeof patch.hostingNotes === 'string') order.hostingNotes = clean(patch.hostingNotes, 2000);
  if (typeof patch.amountMillimes === 'number' && Number.isFinite(patch.amountMillimes)) {
    order.amountMillimes = Math.max(1_000, Math.round(patch.amountMillimes));
  }
  if (patch.status === 'pending' || patch.status === 'paid' || patch.status === 'failed') {
    order.status = patch.status;
    if (patch.status === 'paid') order.paidAt = order.paidAt || new Date().toISOString();
    else if (patch.status === 'pending') delete order.paidAt;
  }
  if (patch.details && typeof patch.details === 'object') {
    order.details = { ...(order.details || { phone: '', gouvernorat: '', siteType: '', domainStatus: 'owned', providerId: '', providerName: '', hostingType: 'unknown', accessType: 'unknown' }), ...patch.details };
  }
  await save(rows);
  return order;
}

export async function deleteLicenseOrder(id: string) {
  const rows = await load();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const [removed] = rows.splice(idx, 1);
  await save(rows);
  return removed;
}
