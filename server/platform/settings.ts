/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { mpSettings } from '../db/schema';
import { decryptSecret, encryptSecret } from '../security/secrets';

export type MarketplaceSettings = {
  commissionBps: number;
  developerFeeMillimes: number;
  bankFallback: string;
  flouciPublicKey?: string;
  flouciPrivateKeyEnc?: string;
};

const DEFAULTS: MarketplaceSettings = {
  commissionBps: Number(process.env.MARKETPLACE_COMMISSION_BPS) || 3000,
  developerFeeMillimes: Number(process.env.DEVELOPER_FEE_MILLIMES) || 100_000,
  bankFallback: '',
};

export async function getMpSettings(): Promise<MarketplaceSettings> {
  const rows = await db.select().from(mpSettings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    commissionBps: typeof map.commissionBps === 'number' ? map.commissionBps : DEFAULTS.commissionBps,
    developerFeeMillimes:
      typeof map.developerFeeMillimes === 'number' ? map.developerFeeMillimes : DEFAULTS.developerFeeMillimes,
    bankFallback: typeof map.bankFallback === 'string' ? map.bankFallback : DEFAULTS.bankFallback,
    flouciPublicKey: typeof map.flouciPublicKey === 'string' ? map.flouciPublicKey : process.env.FLOUCI_PUBLIC_KEY || undefined,
    flouciPrivateKeyEnc: typeof map.flouciPrivateKeyEnc === 'string' ? map.flouciPrivateKeyEnc : undefined,
  };
}

export async function setMpSettings(patch: Partial<MarketplaceSettings & { flouciPrivateKey?: string }>): Promise<MarketplaceSettings> {
  const current = await getMpSettings();
  const next: MarketplaceSettings = {
    ...current,
    ...(patch.commissionBps !== undefined ? { commissionBps: patch.commissionBps } : {}),
    ...(patch.developerFeeMillimes !== undefined ? { developerFeeMillimes: patch.developerFeeMillimes } : {}),
    ...(patch.bankFallback !== undefined ? { bankFallback: patch.bankFallback } : {}),
    ...(patch.flouciPublicKey !== undefined ? { flouciPublicKey: patch.flouciPublicKey } : {}),
  };
  if (patch.flouciPrivateKey) {
    next.flouciPrivateKeyEnc = encryptSecret(patch.flouciPrivateKey);
  }
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    await db
      .insert(mpSettings)
      .values({ key, value: value as never, updatedAt: new Date() })
      .onConflictDoUpdate({ target: mpSettings.key, set: { value: value as never, updatedAt: new Date() } });
  }
  return next;
}

export async function getFlouciCredentials(): Promise<{ publicKey: string; privateKey: string } | null> {
  const s = await getMpSettings();
  const publicKey = s.flouciPublicKey || process.env.FLOUCI_PUBLIC_KEY || '';
  const privateKey =
    (s.flouciPrivateKeyEnc ? decryptSecret(s.flouciPrivateKeyEnc) : null) || process.env.FLOUCI_PRIVATE_KEY || '';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

export function formatDt(millimes: number): string {
  return `${(millimes / 1000).toFixed(millimes % 1000 === 0 ? 0 : 3)} DT`;
}
