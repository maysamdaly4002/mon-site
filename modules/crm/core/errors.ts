/** Erreurs métier : les adaptateurs HTTP les traduisent en réponses (400 / 404 / 409). */
export class CrmError extends Error {
  constructor(public code: 'validation' | 'not_found' | 'conflict', message: string, public details?: unknown) {
    super(message);
    this.name = 'CrmError';
  }
}
export const notFound = (what: string) => new CrmError('not_found', `${what} introuvable`);
export const conflict = (message: string, details?: unknown) => new CrmError('conflict', message, details);
export const invalid = (message: string, details?: unknown) => new CrmError('validation', message, details);
