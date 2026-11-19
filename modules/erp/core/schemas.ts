import { z } from 'zod';
import { isDay } from './dates';
import { ACTION_STATUTS, AVIS, CATEGORIES, EQUIPEMENT_STATUTS, EXERCICE_TYPES, PRESCRIPTION_STATUTS, RESULTATS } from './types';

/** Supprime balises HTML et caractères de contrôle : défense en profondeur contre le XSS stocké
 *  (l'interface React échappe déjà à l'affichage ; le PDF ne l'interprète pas). */
export const stripHtml = (s: string) =>
  s.replace(/<[^>]*>/g, '').replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

const text = (max: number) => z.string().transform(stripHtml).pipe(z.string().trim().max(max));
const req = (max: number, label: string) => text(max).pipe(z.string().min(1, `${label} obligatoire`));
const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Identifiant invalide');
const optId = z.preprocess(emptyToNull, id.nullable().optional());
const day = z.string().refine(isDay, 'Date invalide (AAAA-MM-JJ)');
const email = z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.string().email('E-mail invalide').max(254));
const mois = z.coerce.number().int('Nombre entier requis').min(1, 'Minimum 1 mois').max(120, 'Maximum 120 mois');

export const etablissementInput = z.object({
  nom: req(120, 'Nom'), adresse: text(300).default(''), typeActivite: req(80, 'Type d’activité'),
  categorie: z.enum(CATEGORIES), effectifMax: z.coerce.number().int().min(0).max(100_000),
  emailAlertes: z.union([email, z.literal('')]).default(''),
});
export const etablissementPatch = etablissementInput.partial();
export const batimentInput = z.object({ etablissementId: id, nom: req(80, 'Nom') });
export const niveauInput = z.object({ batimentId: id, nom: req(60, 'Nom'), ordre: z.coerce.number().int().min(-10).max(200).default(0) });

export const typeInput = z.object({ code: z.string().regex(/^[a-z0-9_]{2,30}$/, 'Code : minuscules, chiffres, _'), libelle: req(80, 'Libellé'), periodiciteDefautMois: mois });
export const regleInput = z.object({ typeEquipementId: id, categorie: z.preprocess(emptyToNull, z.enum(CATEGORIES).nullable()), periodiciteMois: mois });

export const equipementInput = z.object({
  etablissementId: id, niveauId: optId, typeId: id, libelle: req(120, 'Libellé'), emplacement: text(200).default(''),
  dateMiseEnService: day, statut: z.enum(EQUIPEMENT_STATUTS).default('en_service'),
});
export const equipementPatch = z.object({ libelle: req(120, 'Libellé').optional(), emplacement: text(200).optional(), niveauId: optId, statut: z.enum(EQUIPEMENT_STATUTS).optional() });

export const photoInput = z.object({ nom: text(100).default('photo'), mime: z.enum(['image/jpeg', 'image/png', 'image/webp']), base64: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Photo illisible').max(2_100_000, 'Photo trop lourde (1,5 Mo max)') });
export const controleInput = z.object({
  equipementId: id, date: day, resultat: z.enum(RESULTATS), observations: text(2000).default(''),
  controleur: text(100).pipe(z.string().min(2, 'Nom du contrôleur obligatoire')), photo: photoInput.optional(),
}).refine((c) => c.resultat === 'conforme' || c.observations.length >= 3, { path: ['observations'], message: 'Décrivez la non-conformité (observations obligatoires)' });

export const actionInput = z.object({ nonConformiteId: id, description: req(500, 'Description'), responsable: req(100, 'Responsable'), echeance: day });
export const actionPatch = z.object({ description: req(500, 'Description').optional(), responsable: req(100, 'Responsable').optional(), echeance: day.optional(), statut: z.enum(ACTION_STATUTS).optional() });
export const leveeInput = z.object({ note: text(500).default('') });

export const exerciceInput = z.object({
  etablissementId: id, type: z.enum(EXERCICE_TYPES), date: day, participants: z.coerce.number().int().min(0).max(100_000),
  dureeMin: z.coerce.number().int().min(1).max(1440), observations: text(1000).default(''),
  recyclageMois: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(120).nullable().optional()),
});
export const interventionInput = z.object({ etablissementId: id, equipementId: optId, date: day, intervenant: req(100, 'Intervenant'), description: req(1000, 'Description') });
export const correctionInput = z.object({ entryId: id, motif: req(300, 'Motif'), correction: req(1000, 'Correction') });
export const userInput = z.object({ email, nom: req(100, 'Nom'), role: z.enum(['admin', 'exploitant', 'technicien', 'auditeur']), password: z.string().min(8, '8 caractères minimum').max(200), etablissementIds: z.array(id).max(200).default([]) });

// ───────── Commission de sécurité (bonus) ─────────
export const prescriptionInput = z.object({ visiteId: id, description: req(500, 'Description'), responsable: req(100, 'Responsable'), echeance: day });
export const prescriptionPatch = z.object({ description: req(500, 'Description').optional(), responsable: req(100, 'Responsable').optional(), echeance: day.optional(), statut: z.enum(PRESCRIPTION_STATUTS).optional() });
export const visiteInput = z.object({
  etablissementId: id, date: day, avis: z.enum(AVIS), president: text(100).default(''), observations: text(2000).default(''),
  prochaineVisite: z.preprocess(emptyToNull, day.nullable().optional()),
  prescriptions: z.array(prescriptionInput.omit({ visiteId: true })).max(50).default([]),
});

// ───────── Plans d'étage (bonus) ─────────
export const planInput = z.object({ etablissementId: id, niveauId: id, nom: text(100).default(''), image: photoInput });
export const positionInput = z.object({ planId: id, equipementId: id, x: z.preprocess(emptyToNull, z.coerce.number().min(0).max(100).nullable()), y: z.preprocess(emptyToNull, z.coerce.number().min(0).max(100).nullable()) })
  .refine((p) => (p.x === null) === (p.y === null), { message: 'x et y doivent être tous deux renseignés (ou tous deux vides pour retirer l’équipement)' });
