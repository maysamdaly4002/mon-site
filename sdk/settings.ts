/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import type { SettingField, SettingFieldType } from './index';

export const SETTING_TYPES: readonly SettingFieldType[] = ['boolean', 'text', 'textarea', 'number', 'select', 'phone', 'paths'];
export const SETTING_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/;

const MAX_TEXT = 20_000;
const MAX_PATHS = 100;

/** Valeurs par défaut du manifeste. */
export function defaultSettings(fields: SettingField[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((f) => [f.key, structuredClone(f.default)]));
}

function checkValue(field: SettingField, value: unknown): string | null {
  switch (field.type) {
    case 'boolean':
      return typeof value === 'boolean' ? null : 'Valeur oui/non attendue';
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'Nombre attendu';
      if (field.min !== undefined && value < field.min) return `Minimum ${field.min}`;
      if (field.max !== undefined && value > field.max) return `Maximum ${field.max}`;
      return null;
    }
    case 'text':
    case 'textarea':
    case 'phone': {
      if (typeof value !== 'string') return 'Texte attendu';
      if (value.length > (field.maxLength ?? MAX_TEXT)) return `${field.maxLength ?? MAX_TEXT} caractères maximum`;
      if (field.required && !value.trim()) return 'Champ obligatoire';
      if (field.type === 'phone' && value.trim() && value.replace(/\D/g, '').length < 8) return 'Numéro trop court';
      return null;
    }
    case 'select':
      return typeof value === 'string' && (field.options ?? []).some((o) => o.value === value) ? null : 'Option inconnue';
    case 'paths':
      if (!Array.isArray(value) || value.length > MAX_PATHS) return 'Liste d’adresses invalide';
      return value.every((p) => typeof p === 'string' && /^\/[^\s]{0,200}$/.test(p)) ? null : 'Chaque adresse doit commencer par /';
  }
}

/**
 * Valide un objet de réglages selon le manifeste. Les clés inconnues sont ignorées,
 * les clés absentes reprennent la valeur `base` (réglages courants) puis la valeur par défaut.
 */
export function validateSettings(
  fields: SettingField[],
  input: unknown,
  base: Record<string, unknown> = {}
): { value: Record<string, unknown>; errors: Record<string, string> } {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const value: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const candidate = field.key in source ? source[field.key] : field.key in base ? base[field.key] : field.default;
    const error = checkValue(field, candidate);
    if (error) errors[field.key] = error;
    value[field.key] = error ? structuredClone(field.default) : structuredClone(candidate);
  }
  return { value, errors };
}

/** Réglages destinés au navigateur des visiteurs (`public: true`). */
export function publicSettings(fields: SettingField[], settings: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(fields.filter((f) => f.public).map((f) => [f.key, settings[f.key]]));
}

/** Vérifie la cohérence d'une définition de champ ; renvoie la liste des problèmes. */
export function checkFieldDefinition(field: SettingField): string[] {
  const issues: string[] = [];
  const where = `réglage « ${field?.key ?? '?'} »`;
  if (!field || typeof field !== 'object') return ['définition de réglage invalide'];
  if (!SETTING_KEY_PATTERN.test(field.key ?? '')) issues.push(`${where} : clé invalide`);
  if (!SETTING_TYPES.includes(field.type)) issues.push(`${where} : type inconnu`);
  if (typeof field.label !== 'string' || !field.label.trim() || field.label.length > 120) issues.push(`${where} : libellé invalide`);
  if (field.type === 'select' && (!Array.isArray(field.options) || field.options.length === 0)) issues.push(`${where} : options manquantes`);
  if (SETTING_TYPES.includes(field.type) && checkValue({ ...field, required: false }, field.default)) issues.push(`${where} : valeur par défaut invalide`);
  return issues;
}
