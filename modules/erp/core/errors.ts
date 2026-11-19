/** Erreurs métier : les adaptateurs HTTP les traduisent en réponses (400 / 403 / 404 / 409). */
export type ErpErrorCode = 'validation' | 'not_found' | 'conflict' | 'forbidden';
export class ErpError extends Error {
  constructor(public code: ErpErrorCode, message: string, public details?: unknown) {
    super(message);
    this.name = 'ErpError';
  }
}
export const notFound = (what: string) => new ErpError('not_found', `${what} introuvable`);
export const conflict = (m: string, d?: unknown) => new ErpError('conflict', m, d);
export const invalid = (m: string, d?: unknown) => new ErpError('validation', m, d);
export const forbidden = (m = 'Accès refusé') => new ErpError('forbidden', m);
