import { z } from 'zod';
import { ACTIVITY_TYPES, STAGES } from './types';

/** Supprime balises HTML et caractères de contrôle : défense en profondeur contre le XSS stocké
 *  (l'interface React échappe déjà à l'affichage). */
export const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

const text = (max: number) => z.string().transform(stripHtml).pipe(z.string().trim().max(max));
const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const email = z.preprocess(emptyToNull, z.string().trim().toLowerCase().email('E-mail invalide').max(254).nullable().optional());
const phone = z
  .string()
  .transform((s) => s.replace(/[\s.\-()]/g, ''))
  .pipe(z.string().regex(/^\+?\d{6,15}$/, 'Téléphone invalide'))
  .or(z.literal(''));
const url = z.string().trim().max(300).refine((v) => v === '' || /^https?:\/\//i.test(v), 'URL invalide (http:// ou https://)');
const tags = z
  .array(text(30))
  .max(20)
  .transform((a) => [...new Set(a.map((t) => t.toLowerCase()).filter(Boolean))]);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Identifiant invalide');

export const contactInput = z.object({
  firstName: text(80).default(''),
  lastName: text(80).pipe(z.string().min(1, 'Nom obligatoire')),
  email,
  phone: phone.default(''),
  companyId: z.preprocess(emptyToNull, id.nullable().optional()),
  source: text(40).default('manuel'),
  tags: tags.default([]),
});
export const contactPatch = contactInput.partial();

export const companyInput = z.object({
  name: text(120).pipe(z.string().min(1, 'Nom obligatoire')),
  website: url.default(''),
  phone: phone.default(''),
  address: text(300).default(''),
});
export const companyPatch = companyInput.partial();

export const dealInput = z.object({
  contactId: id,
  title: text(160).pipe(z.string().min(1, 'Titre obligatoire')),
  stage: z.enum(STAGES).default('nouveau'),
  amount: z.coerce.number().finite().min(0).max(1_000_000_000).default(0),
  expectedClose: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue : AAAA-MM-JJ').nullable().optional()),
});
export const dealPatch = dealInput.omit({ contactId: true }).partial();

export const activityInput = z.object({
  type: z.enum(ACTIVITY_TYPES).default('note'),
  note: text(5000).pipe(z.string().min(1, 'Note vide')),
  occurredAt: z.string().datetime().optional(),
});

/** Formulaire public : tout est optionnel sauf l'e-mail ; `website` est un champ piège (honeypot). */
export const leadInput = z.object({
  email: z.string().trim().toLowerCase().email('E-mail invalide').max(254),
  name: text(160).default(''),
  phone: phone.default(''),
  company: text(120).default(''),
  message: text(2000).default(''),
  source: text(40).default('formulaire'),
  website: z.string().default(''),
});

export const stageEnum = z.enum(STAGES);
export const queryInput = z.object({
  q: text(100).optional(),
  companyId: id.optional(),
  source: text(40).optional(),
  tag: text(30).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});
export { id as idSchema };
