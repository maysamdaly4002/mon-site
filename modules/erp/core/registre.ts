import crypto from 'node:crypto';
import type { JournalEntry, NewJournalEntry } from './types';

/**
 * Registre de sécurité infalsifiable (chaîne de hachage, comme un mini-blockchain sans réseau) :
 * chaque entrée contient le hash de la précédente ; modifier ou retirer une ligne passée casse toutes les suivantes.
 * Défense en 3 couches : (1) le dépôt n'expose ni update ni delete, (2) PostgreSQL refuse UPDATE/DELETE/TRUNCATE par trigger,
 * (3) verifyChain() détecte toute altération faite directement en base. Corriger = ajouter une entrée « correction ».
 */
export const GENESIS = '0'.repeat(64);

/** JSON canonique (clés triées) : le hash ne dépend pas de l'ordre des clés, que JSONB ne conserve pas. */
const canon = (v: unknown): string =>
  v === null || typeof v !== 'object' ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(canon).join(',')}]`
  : `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canon((v as any)[k])}`).join(',')}}`;

export const entryHash = (e: Omit<NewJournalEntry, 'hash'>) =>
  crypto.createHash('sha256')
    .update(`${e.prevHash}|${e.etablissementId}|${e.seq}|${e.type}|${e.occurredAt}|${e.auteur}|${e.corrigeId ?? ''}|${canon(e.payload)}`)
    .digest('hex');

export type EntryDraft = Pick<NewJournalEntry, 'etablissementId' | 'type' | 'occurredAt' | 'auteur' | 'payload'> & { corrigeId?: string | null };

/** Construit l'entrée qui suit `last` (appelée par le dépôt, sous verrou). */
export function nextEntry(last: JournalEntry | null, d: EntryDraft): NewJournalEntry {
  const base = {
    etablissementId: d.etablissementId, seq: (last?.seq ?? 0) + 1, type: d.type, occurredAt: d.occurredAt, auteur: d.auteur,
    payload: JSON.parse(JSON.stringify(d.payload)) as Record<string, unknown>, // retire les undefined, fige la forme
    corrigeId: d.corrigeId ?? null, prevHash: last?.hash ?? GENESIS,
  };
  return { ...base, hash: entryHash(base) };
}

export interface Integrity { ok: boolean; checked: number; brokenAt?: number; reason?: string }
export function verifyChain(entries: JournalEntry[]): Integrity {
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i + 1) return { ok: false, checked: i, brokenAt: e.seq, reason: 'séquence interrompue (entrée supprimée ou insérée)' };
    if (e.prevHash !== prev) return { ok: false, checked: i, brokenAt: e.seq, reason: 'chaînage rompu' };
    if (entryHash(e) !== e.hash) return { ok: false, checked: i, brokenAt: e.seq, reason: 'contenu modifié (hash invalide)' };
    prev = e.hash;
  }
  return { ok: true, checked: entries.length };
}
