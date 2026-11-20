/** Erreurs métier : les adaptateurs HTTP les traduisent en réponses (400 / 403 / 404 / 409). */
export type LmsErrorCode = 'validation' | 'not_found' | 'conflict' | 'forbidden' | 'unauthenticated';
export class LmsError extends Error {
  constructor(public code: LmsErrorCode, message: string, public details?: unknown) {
    super(message);
    this.name = 'LmsError';
  }
}
export const notFound = (what: string) => new LmsError('not_found', `${what} introuvable`);
export const conflict = (m: string, d?: unknown) => new LmsError('conflict', m, d);
export const invalid = (m: string, d?: unknown) => new LmsError('validation', m, d);
export const unauthenticated = (m = 'Connexion requise') => new LmsError('unauthenticated', m);
export const forbidden = (m = 'Accès refusé') => new LmsError('forbidden', m);
